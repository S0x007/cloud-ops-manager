import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  GetBucketLocationCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { clientFactory } from './client.factory'

export interface S3Bucket {
  name: string
  creationDate: string
  region?: string
}

export interface S3Object {
  key: string
  size: number
  lastModified: string
  storageClass: string
}

export interface ListObjectsResult {
  objects: S3Object[]
  truncated: boolean
}

const MAX_LIST_OBJECTS = 2000

// 全局 bucket region 缓存（5 分钟 TTL）
const bucketRegionCache = new Map<string, { region: string; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

// 解析 Bucket 所在 region
async function resolveBucketRegion(bucket: string): Promise<string> {
  // 检查缓存
  const cached = bucketRegionCache.get(bucket)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.region
  }

  // 方法1：GetBucketLocation（最可靠，但需要额外权限）
  try {
    const client = clientFactory.getClient(S3Client, { region: 'us-east-1' })
    const locResponse = await client.send(
      new GetBucketLocationCommand({ Bucket: bucket }),
    )
    const region = locResponse.LocationConstraint || 'us-east-1'
    bucketRegionCache.set(bucket, { region, ts: Date.now() })
    return region
  } catch (locErr: any) {
    const msg = locErr.message ?? String(locErr)

    // 从错误信息中提取 redirect region
    const redirectMatch =
      msg.match(/region '([^']+)'/i) ||
      msg.match(/Region:\s*([^\s,]+)/i) ||
      msg.match(/redirect\s+to\s+([^\s,]+)/i) ||
      msg.match(/x-amz-bucket-region[:\s]*([^\s,]+)/i)

    if (redirectMatch) {
      const region = redirectMatch[1].replace(/[',"]/g, '').trim()
      if (region && region !== 'us-east-1') {
        bucketRegionCache.set(bucket, { region, ts: Date.now() })
        return region
      }
    }

    // 方法2：HeadBucket 试探 us-east-1
    try {
      const client = clientFactory.getClient(S3Client, { region: 'us-east-1' })
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      bucketRegionCache.set(bucket, { region: 'us-east-1', ts: Date.now() })
      return 'us-east-1'
    } catch (headErr: any) {
      const headMsg = headErr.message ?? String(headErr)

      // 301/400 Bad Request 通常包含 correct region
      const headMatch =
        headMsg.match(/region '([^']+)'/i) ||
        headMsg.match(/Region:\s*([^\s,]+)/i) ||
        headMsg.match(/x-amz-bucket-region[:\s]*([^\s,]+)/i) ||
        headMsg.match(/redirect\s+to\s+([^\s,]+)/i)

      if (headMatch) {
        const region = headMatch[1].replace(/[',"]/g, '').trim()
        if (region) {
          bucketRegionCache.set(bucket, { region, ts: Date.now() })
          return region
        }
      }

      // 方法3：依次尝试常用 region
      const commonRegions = [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2',
        'ap-south-1', 'eu-west-1', 'eu-west-2', 'eu-central-1',
      ]
      for (const region of commonRegions) {
        try {
          const regionalClient = clientFactory.getClient(S3Client, { region })
          await regionalClient.send(new HeadBucketCommand({ Bucket: bucket }))
          bucketRegionCache.set(bucket, { region, ts: Date.now() })
          return region
        } catch {
          continue
        }
      }

      // 彻底失败，给出有用的错误信息
      throw new Error(
        `无法解析 Bucket "${bucket}" 的区域。请检查：\n` +
        `1. 该 Bucket 是否存在且属于当前账号\n` +
        `2. 凭证是否有 s3:GetBucketLocation 权限\n` +
        `3. 原始错误: ${headMsg}`,
      )
    }
  }
}

export async function listBuckets(): Promise<S3Bucket[]> {
  const client = clientFactory.getClient(S3Client, { region: 'us-east-1' })
  const response = await client.send(new ListBucketsCommand({}))
  const buckets: S3Bucket[] =
    response.Buckets?.map((b) => ({
      name: b.Name ?? '',
      creationDate: b.CreationDate?.toISOString() ?? '',
    })) ?? []

  // 并行解析每个 bucket 的 region（限并发 5 个）
  const CONCURRENCY = 5
  for (let i = 0; i < buckets.length; i += CONCURRENCY) {
    const batch = buckets.slice(i, i + CONCURRENCY)
    const regions = await Promise.allSettled(
      batch.map((b) =>
        resolveBucketRegion(b.name).catch(() => 'unknown'),
      ),
    )
    regions.forEach((r, j) => {
      buckets[i + j].region = r.status === 'fulfilled' ? r.value : 'unknown'
    })
  }

  return buckets
}

export async function getBucketRegion(bucket: string): Promise<string> {
  return resolveBucketRegion(bucket)
}

export async function listObjects(
  bucket: string,
  prefix: string,
): Promise<ListObjectsResult> {
  const region = await resolveBucketRegion(bucket)
  const client = clientFactory.getClient(S3Client, { region })
  const objects: S3Object[] = []
  let continuationToken: string | undefined
  let truncated = false

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      Delimiter: '/',
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    })
    const response = await client.send(cmd)

    for (const prefixItem of response.CommonPrefixes ?? []) {
      if (objects.length >= MAX_LIST_OBJECTS) {
        truncated = true
        break
      }
      objects.push({
        key: prefixItem.Prefix ?? '',
        size: 0,
        lastModified: '',
        storageClass: 'DIRECTORY',
      })
    }

    if (truncated) break

    for (const obj of response.Contents ?? []) {
      if (obj.Key === prefix) continue
      if (objects.length >= MAX_LIST_OBJECTS) {
        truncated = true
        break
      }
      objects.push({
        key: obj.Key ?? '',
        size: obj.Size ?? 0,
        lastModified: obj.LastModified?.toISOString() ?? '',
        storageClass: obj.StorageClass ?? 'STANDARD',
      })
    }

    if (truncated) break
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  if (continuationToken && !truncated) {
    truncated = true
  }

  return { objects, truncated }
}

export async function deleteObject(
  bucket: string,
  key: string,
): Promise<void> {
  const region = await resolveBucketRegion(bucket)
  const client = clientFactory.getClient(S3Client, { region })
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function uploadFile(
  bucket: string,
  key: string,
  localPath: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const region = await resolveBucketRegion(bucket)
  const client = clientFactory.getClient(S3Client, { region })

  const fileStream = createReadStream(localPath)
  const { statSync } = await import('fs')
  const size = statSync(localPath).size

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fileStream,
    },
  })

  upload.on('httpUploadProgress', (progress) => {
    onProgress?.(progress.loaded ?? 0, progress.total ?? size)
  })

  await upload.done()
}

export async function downloadFile(
  bucket: string,
  key: string,
  savePath: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const region = await resolveBucketRegion(bucket)
  const client = clientFactory.getClient(S3Client, { region })

  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  )
  const body = response.Body
  const totalSize = response.ContentLength ?? 0

  if (body && 'pipe' in body) {
    let loaded = 0
    const readable = body as NodeJS.ReadableStream
    const writable = createWriteStream(savePath)

    readable.on('data', (chunk: Buffer) => {
      loaded += chunk.length
      if (totalSize > 0) onProgress?.(loaded, totalSize)
    })

    await pipeline(readable, writable)
    if (totalSize > 0) onProgress?.(totalSize, totalSize) // 100%
  } else if (body) {
    const chunks: Buffer[] = []
    let loaded = 0
    // @ts-ignore
    for await (const chunk of body as AsyncIterable<Buffer>) {
      const buf = chunk instanceof Buffer ? chunk : Buffer.from(chunk)
      chunks.push(buf)
      loaded += buf.length
      if (totalSize > 0) onProgress?.(loaded, totalSize)
    }
    const { writeFile } = await import('fs/promises')
    await writeFile(savePath, Buffer.concat(chunks))
    if (totalSize > 0) onProgress?.(totalSize, totalSize) // 100%
  }
}

export async function generateSignedUrl(
  bucket: string,
  key: string,
): Promise<string> {
  const region = await resolveBucketRegion(bucket)
  const client = clientFactory.getClient(S3Client, { region })
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 },
  )
}

export async function getObjectHead(
  bucket: string,
  key: string,
): Promise<{ contentType: string; contentLength: number }> {
  const region = await resolveBucketRegion(bucket)
  const client = clientFactory.getClient(S3Client, { region })
  const response = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )
  return {
    contentType: response.ContentType ?? 'application/octet-stream',
    contentLength: response.ContentLength ?? 0,
  }
}
