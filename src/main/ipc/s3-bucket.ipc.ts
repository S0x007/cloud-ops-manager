import { ipcMain } from 'electron'
import {
  S3Client,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  DeleteBucketPolicyCommand,
  GetPublicAccessBlockCommand,
  PutPublicAccessBlockCommand,
  GetBucketEncryptionCommand,
  PutBucketEncryptionCommand,
  GetBucketVersioningCommand,
  PutBucketVersioningCommand,
  GetBucketTaggingCommand,
  PutBucketTaggingCommand,
  DeleteBucketTaggingCommand,
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  GetBucketWebsiteCommand,
  PutBucketWebsiteCommand,
  DeleteBucketWebsiteCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type BucketLocationConstraint,
} from '@aws-sdk/client-s3'
import { clientFactory } from '../aws/client.factory'
import * as s3Service from '../aws/s3.service'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}

function wrapError(err: unknown, prefix: string): Error {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[S3 Bucket IPC] ${prefix}:`, msg)
  return new Error(`${prefix}: ${msg}`)
}

async function resolveRegion(bucket: string): Promise<string> {
  return s3Service.getBucketRegion(bucket)
}

export function registerS3BucketIpc(): void {

  // ========== 存储桶 CRUD ==========

  ipcMain.handle('s3:create-bucket', async (_event, params: {
    region: string; profile: string; source: string;
    bucket: string; locationConstraint?: string; enableEncryption?: boolean
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(S3Client, { region: 'us-east-1' })
      await client.send(new CreateBucketCommand({
        Bucket: params.bucket,
        CreateBucketConfiguration: params.locationConstraint && params.locationConstraint !== 'us-east-1'
          ? { LocationConstraint: params.locationConstraint as BucketLocationConstraint }
          : undefined,
      }))
      if (params.enableEncryption) {
        await client.send(new PutBucketEncryptionCommand({
          Bucket: params.bucket,
          ServerSideEncryptionConfiguration: {
            Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
          },
        }))
      }
    } catch (err) { throw wrapError(err, '创建存储桶失败') }
  })

  ipcMain.handle('s3:delete-bucket', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new DeleteBucketCommand({ Bucket: params.bucket }))
    } catch (err) { throw wrapError(err, '删除存储桶失败（桶可能非空）') }
  })

  ipcMain.handle('s3:empty-bucket', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      // 列出并批量删除所有对象（分页）
      let continuationToken: string | undefined
      let deleted = 0
      do {
        const listResp = await client.send(new ListObjectsV2Command({
          Bucket: params.bucket,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }))
        const keys = (listResp.Contents ?? []).map((o) => ({ Key: o.Key! }))
        if (keys.length > 0) {
          await client.send(new DeleteObjectsCommand({ Bucket: params.bucket, Delete: { Objects: keys } }))
          deleted += keys.length
        }
        continuationToken = listResp.NextContinuationToken
      } while (continuationToken)
      console.log(`[S3] 已清空桶 ${params.bucket}: ${deleted} 个对象`)
    } catch (err) { throw wrapError(err, '清空存储桶失败') }
  })

  // ========== 桶策略 ==========

  ipcMain.handle('s3:get-bucket-policy', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new GetBucketPolicyCommand({ Bucket: params.bucket }))
      return { policy: resp.Policy ?? '', json: JSON.parse(resp.Policy ?? '{}') }
    } catch (err: any) {
      if (err.name === 'NoSuchBucketPolicy') return { policy: '', json: null }
      throw wrapError(err, '获取桶策略失败')
    }
  })

  ipcMain.handle('s3:put-bucket-policy', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; policy: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new PutBucketPolicyCommand({ Bucket: params.bucket, Policy: params.policy }))
    } catch (err) { throw wrapError(err, '更新桶策略失败') }
  })

  ipcMain.handle('s3:delete-bucket-policy', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new DeleteBucketPolicyCommand({ Bucket: params.bucket }))
    } catch (err) { throw wrapError(err, '删除桶策略失败') }
  })

  // ========== 公共访问阻止 ==========

  ipcMain.handle('s3:get-public-access-block', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new GetPublicAccessBlockCommand({ Bucket: params.bucket }))
      return resp.PublicAccessBlockConfiguration ?? {}
    } catch (err: any) {
      if (err.name === 'NoSuchPublicAccessBlockConfiguration') return null
      throw wrapError(err, '获取公共访问配置失败')
    }
  })

  ipcMain.handle('s3:put-public-access-block', async (_event, params: {
    region: string; profile: string; source: string; bucket: string;
    blockPublicAcls: boolean; ignorePublicAcls: boolean;
    blockPublicPolicy: boolean; restrictPublicBuckets: boolean
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new PutPublicAccessBlockCommand({
        Bucket: params.bucket,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: params.blockPublicAcls,
          IgnorePublicAcls: params.ignorePublicAcls,
          BlockPublicPolicy: params.blockPublicPolicy,
          RestrictPublicBuckets: params.restrictPublicBuckets,
        },
      }))
    } catch (err) { throw wrapError(err, '更新公共访问配置失败') }
  })

  // ========== 加密 ==========

  ipcMain.handle('s3:get-bucket-encryption', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new GetBucketEncryptionCommand({ Bucket: params.bucket }))
      return resp.ServerSideEncryptionConfiguration ?? null
    } catch (err: any) {
      if (err.name === 'ServerSideEncryptionConfigurationNotFoundError') return null
      throw wrapError(err, '获取加密配置失败')
    }
  })

  ipcMain.handle('s3:put-bucket-encryption', async (_event, params: {
    region: string; profile: string; source: string; bucket: string;
    sseAlgorithm: string; kmsKeyId?: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const rule: any = { ApplyServerSideEncryptionByDefault: { SSEAlgorithm: params.sseAlgorithm } }
      if (params.kmsKeyId) rule.ApplyServerSideEncryptionByDefault.KMSMasterKeyID = params.kmsKeyId
      await client.send(new PutBucketEncryptionCommand({
        Bucket: params.bucket,
        ServerSideEncryptionConfiguration: { Rules: [rule] },
      }))
    } catch (err) { throw wrapError(err, '更新加密配置失败') }
  })

  // ========== 版本控制 ==========

  ipcMain.handle('s3:get-bucket-versioning', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new GetBucketVersioningCommand({ Bucket: params.bucket }))
      return { status: resp.Status ?? 'Suspended', mfaDelete: resp.MFADelete ?? 'Disabled' }
    } catch (err) { throw wrapError(err, '获取版本控制配置失败') }
  })

  ipcMain.handle('s3:put-bucket-versioning', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; status: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new PutBucketVersioningCommand({
        Bucket: params.bucket,
        VersioningConfiguration: { Status: params.status as 'Enabled' | 'Suspended' },
      }))
    } catch (err) { throw wrapError(err, '更新版本控制配置失败') }
  })

  // ========== 标签 ==========

  ipcMain.handle('s3:get-bucket-tagging', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new GetBucketTaggingCommand({ Bucket: params.bucket }))
      return resp.TagSet ?? []
    } catch (err: any) {
      if (err.name === 'NoSuchTagSet') return []
      throw wrapError(err, '获取标签失败')
    }
  })

  ipcMain.handle('s3:put-bucket-tagging', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; tags: { Key: string; Value: string }[]
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new PutBucketTaggingCommand({
        Bucket: params.bucket,
        Tagging: { TagSet: params.tags },
      }))
    } catch (err) { throw wrapError(err, '更新标签失败') }
  })

  ipcMain.handle('s3:delete-bucket-tagging', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new DeleteBucketTaggingCommand({ Bucket: params.bucket }))
    } catch (err) { throw wrapError(err, '删除标签失败') }
  })

  // ========== 生命周期 ==========

  ipcMain.handle('s3:get-bucket-lifecycle', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: params.bucket }))
      return resp.Rules ?? []
    } catch (err: any) {
      if (err.name === 'NoSuchLifecycleConfiguration') return []
      throw wrapError(err, '获取生命周期配置失败')
    }
  })

  ipcMain.handle('s3:put-bucket-lifecycle', async (_event, params: {
    region: string; profile: string; source: string; bucket: string; rules: any[]
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new PutBucketLifecycleConfigurationCommand({
        Bucket: params.bucket,
        LifecycleConfiguration: { Rules: params.rules },
      }))
    } catch (err) { throw wrapError(err, '更新生命周期配置失败') }
  })

  // ========== 静态网站托管 ==========

  ipcMain.handle('s3:get-bucket-website', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const resp = await client.send(new GetBucketWebsiteCommand({ Bucket: params.bucket }))
      return {
        indexDocument: resp.IndexDocument?.Suffix ?? '',
        errorDocument: resp.ErrorDocument?.Key ?? '',
        redirectAllTo: resp.RedirectAllRequestsTo?.HostName ?? '',
      }
    } catch (err: any) {
      if (err.name === 'NoSuchWebsiteConfiguration') return null
      throw wrapError(err, '获取网站配置失败')
    }
  })

  ipcMain.handle('s3:put-bucket-website', async (_event, params: {
    region: string; profile: string; source: string; bucket: string;
    indexDocument?: string; errorDocument?: string; redirectHost?: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      const config: any = {}
      if (params.redirectHost) {
        config.RedirectAllRequestsTo = { HostName: params.redirectHost, Protocol: 'https' }
      } else {
        if (params.indexDocument) config.IndexDocument = { Suffix: params.indexDocument }
        if (params.errorDocument) config.ErrorDocument = { Key: params.errorDocument }
      }
      await client.send(new PutBucketWebsiteCommand({
        Bucket: params.bucket,
        WebsiteConfiguration: config,
      }))
    } catch (err) { throw wrapError(err, '更新网站配置失败') }
  })

  ipcMain.handle('s3:delete-bucket-website', async (_event, params: {
    region: string; profile: string; source: string; bucket: string
  }) => {
    try {
      setSource(params)
      const region = await resolveRegion(params.bucket)
      const client = clientFactory.getClient(S3Client, { region })
      await client.send(new DeleteBucketWebsiteCommand({ Bucket: params.bucket }))
    } catch (err) { throw wrapError(err, '删除网站配置失败') }
  })
}
