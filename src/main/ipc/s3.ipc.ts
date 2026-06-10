import { ipcMain, BrowserWindow } from 'electron'
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  DeleteObjectsCommand, CopyObjectCommand, HeadObjectCommand,
  GetObjectAttributesCommand, ListObjectVersionsCommand,
} from '@aws-sdk/client-s3'
import { clientFactory } from '../aws/client.factory'
import * as s3Service from '../aws/s3.service'
import { getCached, setCache } from '../store/api-cache'
import { classifyObjectPreview } from '../../shared/object-preview'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}

function wrapError(err: unknown, prefix: string): Error {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[S3 IPC] ${prefix}:`, msg)
  return new Error(`${prefix}: ${msg}`)
}

export function registerS3Ipc(): void {
  ipcMain.handle('s3:list-buckets', async (_event, params: {
    region: string; profile: string; source: string; forceRefresh?: boolean
  }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) {
        const cached = getCached(params.profile, params.source, params.region, 's3:list-buckets')
        if (cached) return cached
      }
      const data = await s3Service.listBuckets()
      setCache(params.profile, params.source, params.region, 's3:list-buckets', data)
      return data
    } catch (err) { throw wrapError(err, '获取存储桶列表失败') }
  })

  ipcMain.handle('s3:list-objects', async (_event, params: {
    profile: string; source?: string; bucket: string; prefix?: string; continuationToken?: string; maxItems?: number
  }) => {
    try {
      setSource(params)
      return await s3Service.listObjects(params.bucket, params.prefix ?? '', {
        continuationToken: params.continuationToken,
        maxItems: params.maxItems,
      })
    } catch (err) { throw wrapError(err, `列出对象失败 (${params.bucket}/${params.prefix ?? ''})`) }
  })

  ipcMain.handle('s3:head-bucket', async (_event, params) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      return { region }
    } catch (err) { throw wrapError(err, `获取Bucket区域失败 (${params.bucket})`) }
  })

  ipcMain.handle('s3:delete-object', async (_event, params) => {
    try {
      setSource(params)
      await s3Service.deleteObject(params.bucket, params.key)
    } catch (err) { throw wrapError(err, `删除对象失败 (${params.key})`) }
  })

  ipcMain.handle('s3:upload-file', async (_event, params) => {
    try {
      setSource(params)
      const win = BrowserWindow.getFocusedWindow()
      await s3Service.uploadFile(params.bucket, params.key, params.localPath, (loaded, total) => {
        win?.webContents.send('s3:upload-progress', { key: params.key, loaded, total })
      })
    } catch (err) { throw wrapError(err, '上传文件失败') }
  })

  ipcMain.handle('s3:download-file', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; key: string; savePath: string; versionId?: string
  }) => {
    try {
      setSource(params)
      const win = BrowserWindow.getFocusedWindow()
      await s3Service.downloadFile(
        params.bucket,
        params.key,
        params.savePath,
        (loaded, total) => {
          win?.webContents.send('s3:download-progress', { key: params.key, loaded, total })
        },
        params.versionId,
      )
    } catch (err) { throw wrapError(err, '下载文件失败') }
  })

  ipcMain.handle('s3:get-signed-url', async (_event, params: {
    profile: string; source?: string; bucket: string; key: string; expiresIn?: number
  }) => {
    try {
      setSource(params)
      return await s3Service.generateSignedUrl(params.bucket, params.key, params.expiresIn)
    } catch (err) { throw wrapError(err, '生成签名URL失败') }
  })

  ipcMain.handle('s3:create-folder', async (_event, params) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        Body: '',
      }))
    } catch (err) { throw wrapError(err, '创建文件夹失败') }
  })

  // 获取对象内容用于预览/编辑
  ipcMain.handle('s3:get-object-content', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; key: string; versionId?: string
  }) => {
    try {
      // 校验 key 不为空
      if (!params.key || params.key.trim() === '') {
        throw new Error('文件 Key 为空，无法获取')
      }

      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })

      // S3 key 可能在 URL 中被编码，先尝试解码
      let objectKey = params.key
      try {
        const decoded = decodeURIComponent(objectKey)
        if (decoded !== objectKey) objectKey = decoded
      } catch { /* 保持原值 */ }

      console.log(`[S3] get-object-content: bucket=${params.bucket}, key="${objectKey}"`)

      const response = await client.send(new GetObjectCommand({
        Bucket: params.bucket,
        Key: objectKey,
        ...(params.versionId ? { VersionId: params.versionId } : {}),
      }))

      const contentType = response.ContentType ?? 'application/octet-stream'
      const body = response.Body

      if (!body) throw new Error('对象内容为空')

      // 收集所有数据
      const chunks: Buffer[] = []
      // @ts-ignore
      for await (const chunk of body as AsyncIterable<Buffer>) {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk))
      }
      const data = Buffer.concat(chunks)

      return classifyObjectPreview(data, contentType, objectKey)
    } catch (err) { throw wrapError(err, '获取文件内容失败') }
  })

  // 将编辑后的内容上传回 S3
  ipcMain.handle('s3:put-object-content', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; key: string; content: string; contentType: string
  }) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        Body: params.content,
        ContentType: params.contentType || 'text/plain',
      }))
    } catch (err) { throw wrapError(err, '保存文件失败') }
  })

  // ---- 批量操作 ----
  ipcMain.handle('s3:delete-objects', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; keys: string[]
  }) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      for (let i = 0; i < params.keys.length; i += 1000) {
        const batch = params.keys.slice(i, i + 1000).map((k) => ({ Key: k }))
        await client.send(new DeleteObjectsCommand({ Bucket: params.bucket, Delete: { Objects: batch, Quiet: true } }))
      }
    } catch (err) { throw wrapError(err, `批量删除失败 (${params.keys.length} 个对象)`) }
  })

  ipcMain.handle('s3:copy-object', async (_event, params: {
    region: string; profile: string; source: string; sourceBucket: string; sourceKey: string; destBucket: string; destKey: string
  }) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.sourceBucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new CopyObjectCommand({
        Bucket: params.destBucket, Key: params.destKey,
        CopySource: `/${params.sourceBucket}/${encodeURIComponent(params.sourceKey)}`,
      }))
    } catch (err) { throw wrapError(err, '复制对象失败') }
  })

  ipcMain.handle('s3:rename-object', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; oldKey: string; newKey: string
  }) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new CopyObjectCommand({
        Bucket: params.bucket, Key: params.newKey,
        CopySource: `/${params.bucket}/${encodeURIComponent(params.oldKey)}`,
      }))
      await client.send(new DeleteObjectCommand({ Bucket: params.bucket, Key: params.oldKey }))
    } catch (err) { throw wrapError(err, '重命名失败') }
  })

  ipcMain.handle('s3:get-object-attributes', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; key: string
  }) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new GetObjectAttributesCommand({
        Bucket: params.bucket, Key: params.key,
        ObjectAttributes: ['ETag', 'Checksum', 'ObjectParts', 'StorageClass', 'ObjectSize'],
      }))
      return { etag: resp.ETag, size: resp.ObjectSize, storageClass: resp.StorageClass }
    } catch (err) { throw wrapError(err, '获取对象属性失败') }
  })

  ipcMain.handle('s3:head-object', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; key: string
  }) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new HeadObjectCommand({ Bucket: params.bucket, Key: params.key }))
      return {
        contentType: resp.ContentType, contentLength: resp.ContentLength,
        lastModified: resp.LastModified?.toISOString(), etag: resp.ETag,
        storageClass: resp.StorageClass, metadata: resp.Metadata,
        serverSideEncryption: resp.ServerSideEncryption,
      }
    } catch (err) { throw wrapError(err, '获取对象元数据失败') }
  })

  ipcMain.handle('s3:list-object-versions', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; prefix?: string; key?: string
  }) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const versions: any[] = []
      const exactKey = params.key?.trim()
      const listPrefix = exactKey || params.prefix || undefined
      let keyMarker: string | undefined
      let versionIdMarker: string | undefined
      do {
        const resp = await client.send(new ListObjectVersionsCommand({
          Bucket: params.bucket, Prefix: listPrefix,
          KeyMarker: keyMarker, VersionIdMarker: versionIdMarker, MaxKeys: 500,
        }))
        for (const v of resp.Versions ?? []) {
          if (exactKey && v.Key !== exactKey) continue
          versions.push({
            key: v.Key,
            versionId: v.VersionId ?? undefined,
            size: v.Size,
            lastModified: v.LastModified?.toISOString(),
            isLatest: v.IsLatest,
            isDeleteMarker: false,
          })
        }
        for (const d of resp.DeleteMarkers ?? []) {
          if (exactKey && d.Key !== exactKey) continue
          versions.push({
            key: d.Key,
            versionId: d.VersionId ?? undefined,
            size: 0,
            lastModified: d.LastModified?.toISOString(),
            isLatest: d.IsLatest,
            isDeleteMarker: true,
          })
        }
        keyMarker = resp.NextKeyMarker
        versionIdMarker = resp.NextVersionIdMarker
      } while (keyMarker || versionIdMarker)
      versions.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''))
      return versions
    } catch (err) { throw wrapError(err, '获取版本列表失败') }
  })

  ipcMain.handle('s3:delete-object-version', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; key: string; versionId: string
  }) => {
    try {
      setSource(params)
      const region = await s3Service.getBucketRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new DeleteObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        VersionId: params.versionId,
      }))
    } catch (err) { throw wrapError(err, '删除对象版本失败') }
  })
}
