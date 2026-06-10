/**
 * 华为云 OBS 服务 — 对象存储
 */

import { randomUUID } from 'crypto'
import { readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { huaweiFactory } from '../huawei-client'
import { classifyObjectPreview, type ObjectPreviewContent } from '../../../shared/object-preview'

function normalizeObsRegion(location: string): string {
  return String(location || '').trim().toLowerCase()
}

function obsServerUrl(region: string): string {
  return `https://obs.${normalizeObsRegion(region)}.myhuaweicloud.com`
}

function formatObsError(action: string, result: any): string {
  const common = result?.CommonMsg ?? result?.commonMsg ?? {}
  const code = common.Code ?? common.code ?? ''
  const message = common.Message ?? common.message ?? ''
  const detail = [code, message].filter(Boolean).join(' ')
  return detail ? `${action} 失败: ${detail}` : `${action} 失败: ${JSON.stringify(common || result)?.slice(0, 200)}`
}

function createObsClient(region: string): any {
  const cred = huaweiFactory.getCredentials()
  const ObsClient = require('esdk-obs-nodejs')

  // 从 BasicCredentials 提取 AK/SK
  const ak = (cred as any).ak || (cred as any)._ak
  const sk = (cred as any).sk || (cred as any)._sk

  // OBS 使用独立的认证方式，需要直接传入 AK/SK
  // 这里从 huaweiFactory 中获取，所以需要重构存储方式
  // 暂时通过环境变量或直接传递
  return { cred, ObsClient, createClient: (ak: string, sk: string) =>
    new ObsClient({
      access_key_id: ak,
      secret_access_key: sk,
      server: `https://obs.${region}.myhuaweicloud.com`,
    })
  }
}

export async function listBuckets(ak: string, sk: string, region: string): Promise<any[]> {
  const ObsClient = require('esdk-obs-nodejs')
  const targetRegion = normalizeObsRegion(region)
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: obsServerUrl(targetRegion),
  })

  return new Promise((resolve, reject) => {
    obs.listBuckets({ QueryLocation: true }).then((result: any) => {
      if (result.CommonMsg?.Status >= 300) {
        reject(new Error(formatObsError('OBS 请求', result)))
        return
      }
      // SDK 返回 Buckets 数组，每个元素含 BucketName/Location/CreationDate
      const ifr = result.InterfaceResult || {}
      let raw: any = ifr.Buckets ?? ifr.buckets ?? []
      if (!Array.isArray(raw)) {
        // Buckets 可能是对象包装：{ Bucket: [...] } 或 { Bucket: {...} }
        const inner = raw.Bucket ?? raw.bucket ?? []
        raw = Array.isArray(inner) ? inner : (inner && typeof inner === 'object' ? [inner] : [])
      }
      const getName = (b: any) => b.BucketName ?? b.bucketName ?? b.Name ?? b.name ?? ''
      const getRegion = (b: any) => b.Location ?? b.location ?? b.Loc ?? ''
      const getCreatedAt = (b: any) => b.CreationDate ?? b.creationDate ?? b.creationdate ?? ''
      const buckets = (raw as any[])
        .map((b: any) => ({
          name: getName(b),
          region: normalizeObsRegion(getRegion(b)),
          createdAt: getCreatedAt(b),
        }))
        .filter((b) => b.name && b.region === targetRegion)
      resolve(buckets)
    }).catch(reject)
  })
}

function parseObsContents(ifr: any): any[] {
  const contentData = ifr.Contents ?? ifr.contents
  if (!contentData) return []
  return Array.isArray(contentData) ? contentData : [contentData]
}

function parseObsPrefixes(ifr: any): string[] {
  const prefixData = ifr.CommonPrefixes ?? ifr.commonPrefixes ?? ifr.commonprefixes
  if (!prefixData) return []
  const list = Array.isArray(prefixData) ? prefixData : [prefixData]
  return list.map((p: any) => (typeof p === 'string' ? p : (p.Prefix ?? p.prefix ?? ''))).filter(Boolean)
}

function obsListObjects(obs: any, params: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    obs.listObjects(params).then(resolve).catch(reject)
  })
}

const FOLDER_STATS_MAX_OBJECTS = 10000

async function aggregateFolderStats(
  obs: any,
  bucket: string,
  prefix: string,
  folderKeys: string[],
): Promise<{ stats: Map<string, { size: number; lastModified: string }>; truncated: boolean }> {
  const stats = new Map<string, { size: number; lastModified: string }>()
  for (const fk of folderKeys) stats.set(fk, { size: 0, lastModified: '' })
  if (folderKeys.length === 0) return { stats, truncated: false }

  const folderSet = new Set(folderKeys)
  let marker: string | undefined
  let truncated = false
  let scanned = 0

  while (scanned < FOLDER_STATS_MAX_OBJECTS) {
    const params: Record<string, unknown> = {
      Bucket: bucket,
      Prefix: prefix || '',
      MaxKeys: Math.min(1000, FOLDER_STATS_MAX_OBJECTS - scanned),
    }
    if (marker) params.Marker = marker

    const result = await obsListObjects(obs, params)
    if (result.CommonMsg?.Status >= 300) break

    const ifr = result.InterfaceResult || {}
    for (const c of parseObsContents(ifr)) {
      scanned++
      const key = c.Key ?? c.key ?? ''
      if (!key || key === prefix) continue

      if (folderSet.has(key)) {
        const entry = stats.get(key)!
        const lm = c.LastModified ?? c.lastModified ?? ''
        if (lm && (!entry.lastModified || lm > entry.lastModified)) entry.lastModified = lm
      }

      const rel = prefix ? key.slice(prefix.length) : key
      const slashIdx = rel.indexOf('/')
      if (slashIdx < 0) continue

      const childKey = (prefix || '') + rel.slice(0, slashIdx + 1)
      const entry = stats.get(childKey)
      if (!entry) continue

      entry.size += parseInt(String(c.Size ?? c.size ?? '0'), 10)
      const lm = c.LastModified ?? c.lastModified ?? ''
      if (lm && (!entry.lastModified || lm > entry.lastModified)) entry.lastModified = lm
    }

    const isTruncated = ifr.IsTruncated === true || ifr.isTruncated === true || ifr.IsTruncated === 'true'
    marker = ifr.NextMarker ?? ifr.nextMarker
    if (!isTruncated || !marker) break
    if (scanned >= FOLDER_STATS_MAX_OBJECTS) {
      truncated = true
      break
    }
  }

  return { stats, truncated }
}

export async function listObjects(ak: string, sk: string, region: string, bucket: string, prefix: string): Promise<any[]> {
  const bucketRegion = normalizeObsRegion(region)
  if (!bucketRegion) throw new Error('缺少桶所在区域，无法访问 OBS 对象')
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: obsServerUrl(bucketRegion),
  })

  const result = await obsListObjects(obs, {
    Bucket: bucket,
    Prefix: prefix || '',
    Delimiter: '/',
    MaxKeys: 1000,
  })

  if (result.CommonMsg?.Status >= 300) {
    throw new Error(formatObsError('OBS ListObjects', result))
  }

  const ifr = result.InterfaceResult || {}
  const folderKeys = parseObsPrefixes(ifr)
  const folders = folderKeys.map((key) => ({
    key,
    size: 0,
    isFolder: true,
    lastModified: '',
    statsPartial: false,
  }))

  const contentList = parseObsContents(ifr)
  const files = contentList
    .filter((c: any) => {
      const key = c.Key ?? c.key ?? ''
      return key && key !== prefix
    })
    .map((c: any) => ({
      key: c.Key ?? c.key ?? '',
      size: parseInt(String(c.Size ?? c.size ?? '0'), 10),
      isFolder: false,
      lastModified: c.LastModified ?? c.lastModified ?? '',
      etag: c.ETag ?? c.etag ?? '',
    }))

  if (folders.length > 0) {
    const { stats, truncated } = await aggregateFolderStats(obs, bucket, prefix, folderKeys)
    for (const folder of folders) {
      const s = stats.get(folder.key)
      if (s) {
        folder.size = s.size
        folder.lastModified = s.lastModified
        folder.statsPartial = truncated
      }
    }
  }

  return [...folders, ...files]
}

export async function headBucket(ak: string, sk: string, bucket: string): Promise<{ region: string } | null> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.myhuaweicloud.com`,
  })

  return new Promise((resolve) => {
    obs.getBucketLocation({ Bucket: bucket }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) { resolve(null); return }
      resolve({ region: result.InterfaceResult?.Location ?? '' })
    }).catch(() => resolve(null))
  })
}

export async function deleteObject(ak: string, sk: string, region: string, bucket: string, key: string): Promise<void> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.${region}.myhuaweicloud.com`,
  })

  return new Promise((resolve, reject) => {
    obs.deleteObject({ Bucket: bucket, Key: key }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) {
        reject(new Error(`OBS 删除失败: ${result.CommonMsg.Code} ${result.CommonMsg.Message}`))
        return
      }
      resolve()
    }).catch(reject)
  })
}

export async function getObjectContent(
  ak: string, sk: string, region: string, bucket: string, key: string,
): Promise<ObjectPreviewContent> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: obsServerUrl(region),
  })

  // SDK 默认把 body 转成 utf8 字符串会破坏图片；用 SaveAsFile 保留原始字节
  const tmpPath = join(tmpdir(), `obs-preview-${randomUUID()}`)

  return new Promise((resolve, reject) => {
    obs.getObject({ Bucket: bucket, Key: key, SaveAsFile: tmpPath }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) {
        try { unlinkSync(tmpPath) } catch { /* ignore */ }
        reject(new Error(`OBS 读取失败: ${result.CommonMsg.Code} ${result.CommonMsg.Message}`))
        return
      }
      try {
        const ifr = result.InterfaceResult ?? {}
        const contentType = ifr.ContentType ?? ifr.contentType ?? 'application/octet-stream'
        const buf = readFileSync(tmpPath)
        resolve(classifyObjectPreview(buf, contentType, key))
      } catch (err) {
        reject(err)
      } finally {
        try { unlinkSync(tmpPath) } catch { /* ignore */ }
      }
    }).catch((err: unknown) => {
      try { unlinkSync(tmpPath) } catch { /* ignore */ }
      reject(err)
    })
  })
}

export async function putObjectContent(
  ak: string, sk: string, region: string, bucket: string, key: string, content: string, contentType?: string,
): Promise<void> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.${region}.myhuaweicloud.com`,
  })

  return new Promise((resolve, reject) => {
    obs.putObject({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType || 'text/plain',
    }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) {
        reject(new Error(`OBS 写入失败: ${result.CommonMsg.Code} ${result.CommonMsg.Message}`))
        return
      }
      resolve()
    }).catch(reject)
  })
}

export async function uploadFile(
  ak: string, sk: string, region: string, bucket: string, key: string, localPath: string,
): Promise<void> {
  const fs = require('fs')
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.${region}.myhuaweicloud.com`,
  })

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(localPath)
    obs.putObject({
      Bucket: bucket,
      Key: key,
      Body: fileStream,
    }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) {
        reject(new Error(`OBS 上传失败: ${result.CommonMsg.Code} ${result.CommonMsg.Message}`))
        return
      }
      resolve()
    }).catch(reject)
  })
}

export async function downloadFile(
  ak: string, sk: string, region: string, bucket: string, key: string, savePath: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.${region}.myhuaweicloud.com`,
  })

  return new Promise((resolve, reject) => {
    obs.downloadFile({
      Bucket: bucket,
      Key: key,
      DownloadFile: savePath,
      ProgressCallback: (transferred: number, total: number) => {
        if (onProgress) onProgress(transferred, total)
      },
    }, (err: any, result: any) => {
      if (err) { reject(new Error(`OBS 下载失败: ${err}`)); return }
      if (result && result.CommonMsg && result.CommonMsg.Status >= 300) {
        reject(new Error(`OBS 下载失败: ${result.CommonMsg.Code} ${result.CommonMsg.Message}`))
        return
      }
      resolve()
    })
  })
}

export async function deleteObjects(
  ak: string, sk: string, region: string, bucket: string, keys: string[],
): Promise<{ deleted: number }> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.${region}.myhuaweicloud.com`,
  })

  return new Promise((resolve, reject) => {
    obs.deleteObjects({
      Bucket: bucket,
      Objects: keys.map((k) => ({ Key: k })),
      Quiet: true,
    }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) {
        reject(new Error(`OBS 批量删除失败: ${result.CommonMsg.Code} ${result.CommonMsg.Message}`))
        return
      }
      resolve({ deleted: keys.length })
    }).catch(reject)
  })
}

export async function createFolder(
  ak: string, sk: string, region: string, bucket: string, folderPath: string,
): Promise<void> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.${region}.myhuaweicloud.com`,
  })

  const key = folderPath.endsWith('/') ? folderPath : `${folderPath}/`
  return new Promise((resolve, reject) => {
    obs.putObject({
      Bucket: bucket,
      Key: key,
      Body: '',
    }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) {
        reject(new Error(`OBS 创建目录失败: ${result.CommonMsg.Code} ${result.CommonMsg.Message}`))
        return
      }
      resolve()
    }).catch(reject)
  })
}

export async function copyObject(
  ak: string, sk: string, region: string, sourceBucket: string, sourceKey: string, destBucket: string, destKey: string,
): Promise<void> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.${region}.myhuaweicloud.com`,
  })

  return new Promise((resolve, reject) => {
    obs.copyObject({
      Bucket: destBucket,
      Key: destKey,
      CopySource: `${sourceBucket}/${encodeURIComponent(sourceKey)}`,
    }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) {
        reject(new Error(`OBS 复制失败: ${result.CommonMsg.Code} ${result.CommonMsg.Message}`))
        return
      }
      resolve()
    }).catch(reject)
  })
}

export async function headObject(
  ak: string, sk: string, region: string, bucket: string, key: string,
): Promise<{ size: number; contentType: string; lastModified: string; etag: string } | null> {
  const ObsClient = require('esdk-obs-nodejs')
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: `https://obs.${region}.myhuaweicloud.com`,
  })

  return new Promise((resolve, reject) => {
    obs.getObjectMetadata({
      Bucket: bucket,
      Key: key,
    }).then((result: any) => {
      if (result.CommonMsg.Status >= 300) { resolve(null); return }
      resolve({
        size: parseInt(result.InterfaceResult?.ContentLength ?? '0'),
        contentType: result.InterfaceResult?.ContentType ?? 'application/octet-stream',
        lastModified: result.InterfaceResult?.LastModified ?? '',
        etag: result.InterfaceResult?.ETag ?? '',
      })
    }).catch(() => resolve(null))
  })
}

function obsCall<T>(obs: any, method: string, params: Record<string, unknown>): Promise<T | null> {
  return new Promise((resolve) => {
    obs[method](params).then((result: any) => {
      if (result.CommonMsg?.Status >= 300) { resolve(null); return }
      resolve(result.InterfaceResult ?? result)
    }).catch(() => resolve(null))
  })
}

export async function getBucketDetail(ak: string, sk: string, region: string, bucket: string): Promise<{
  region: string
  storageClass?: string
  versioning?: string
  policy?: string | null
}> {
  const ObsClient = require('esdk-obs-nodejs')
  const targetRegion = normalizeObsRegion(region)
  const obs = new ObsClient({
    access_key_id: ak,
    secret_access_key: sk,
    server: obsServerUrl(targetRegion),
  })

  const [location, metadata, versioning, policyResult] = await Promise.all([
    headBucket(ak, sk, bucket),
    obsCall<any>(obs, 'getBucketMetadata', { Bucket: bucket }),
    obsCall<any>(obs, 'getBucketVersioningConfiguration', { Bucket: bucket }),
    obsCall<any>(obs, 'getBucketPolicy', { Bucket: bucket }),
  ])

  return {
    region: location?.region || targetRegion,
    storageClass: metadata?.StorageClass ?? metadata?.storageClass,
    versioning: versioning?.Status ?? versioning?.status ?? 'Suspended',
    policy: policyResult?.Policy ?? policyResult?.policy ?? null,
  }
}
