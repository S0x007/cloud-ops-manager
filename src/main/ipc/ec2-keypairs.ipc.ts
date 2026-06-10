import { ipcMain } from 'electron'
import { EC2Client, DescribeKeyPairsCommand, CreateKeyPairCommand,
  DeleteKeyPairCommand, ImportKeyPairCommand } from '@aws-sdk/client-ec2'
import { clientFactory } from '../aws/client.factory'
import { getCached, setCache } from '../store/api-cache'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}
function wrapErr(err: unknown, msg: string): Error {
  return new Error(`${msg}: ${err instanceof Error ? err.message : String(err)}`)
}

export function registerEc2KeyPairsIpc(): void {
  ipcMain.handle('ec2:list-key-pairs', async (_event, params: { region: string; profile: string; source: string; forceRefresh?: boolean }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) {
        const cached = getCached(params.profile, params.source, params.region, 'ec2:list-key-pairs')
        if (cached) return cached
      }
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new DescribeKeyPairsCommand({}))
      const data = (resp.KeyPairs ?? []).map((k) => ({
        keyName: k.KeyName ?? '', keyFingerprint: k.KeyFingerprint ?? '',
        keyType: k.KeyType ?? 'rsa', createTime: k.CreateTime?.toISOString(),
        tags: k.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [],
      }))
      setCache(params.profile, params.source, params.region, 'ec2:list-key-pairs', data)
      return data
    } catch (err) { throw wrapErr(err, '获取密钥对列表失败') }
  })

  ipcMain.handle('ec2:create-key-pair', async (_event, params: { region: string; profile: string; source: string; keyName: string }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new CreateKeyPairCommand({ KeyName: params.keyName }))
      return { keyName: resp.KeyName ?? '', keyMaterial: resp.KeyMaterial ?? '', keyFingerprint: resp.KeyFingerprint ?? '' }
    } catch (err) { throw wrapErr(err, '创建密钥对失败') }
  })

  ipcMain.handle('ec2:delete-key-pair', async (_event, params: { region: string; profile: string; source: string; keyName: string }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new DeleteKeyPairCommand({ KeyName: params.keyName }))
    } catch (err) { throw wrapErr(err, '删除密钥对失败') }
  })

  ipcMain.handle('ec2:import-key-pair', async (_event, params: { region: string; profile: string; source: string; keyName: string; publicKey: string }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new ImportKeyPairCommand({ KeyName: params.keyName, PublicKeyMaterial: new TextEncoder().encode(Buffer.from(params.publicKey).toString('base64')) }))
    } catch (err) { throw wrapErr(err, '导入密钥对失败') }
  })
}
