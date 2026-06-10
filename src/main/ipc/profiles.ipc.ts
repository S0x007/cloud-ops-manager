import { ipcMain } from 'electron'
import { clientFactory } from '../aws/client.factory'
import { getCallerIdentity } from '../aws/sts.service'
import * as credentialStore from '../store/credential-store'

interface UnifiedCredential {
  id: string
  name: string
  source: 'custom'
  region: string
  provider?: string
  extraFields?: Record<string, string>
}

function wErr(e: unknown, m: string): Error {
  return new Error(`${m}: ${e instanceof Error ? e.message : String(e)}`)
}

export function registerProfilesIpc(): void {
  // ---- 凭证列表（仅本地加密存储） ----
  ipcMain.handle('profiles:list-all', async (): Promise<UnifiedCredential[]> => {
    try {
      return credentialStore.listCredentials().map((c) => ({
        id: c.id,
        name: c.name,
        source: 'custom' as const,
        region: c.region,
        provider: c.provider || 'aws',
        extraFields: c.extraFields,
      }))
    } catch (err) { throw wErr(err, '获取凭证列表失败') }
  })

  // ---- 凭证验证（仅 local） ----
  ipcMain.handle('profiles:verify', async (_e, params: { id: string; provider?: string }) => {
    try {
      const cred = credentialStore.getCredentialWithSecret(params.id)
      if (!cred) throw new Error(`凭证不存在: ${params.id}`)
      // 优先用前端传来的当前厂商，其次用凭证存储的 provider
      const providerId = params.provider || cred.provider || 'aws'

      if (providerId === 'huawei') {
        const { ProviderRegistry } = await import('../providers/registry')
        const hw = ProviderRegistry.getInstance().get('huawei')
        const info = await hw.verifyCredential(cred.accessKeyId, cred.secretAccessKey, cred.region, cred.extraFields)
        return { accountId: info.accountId }
      }

      // AWS: 临时注入 AK/SK
      const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts')
      const client = new STSClient({
        region: cred.region || 'us-east-1',
        credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
      })
      const r = await client.send(new GetCallerIdentityCommand({}))
      return { accountId: r.Account ?? 'unknown' }
    } catch (err) { throw wErr(err, '凭证验证失败') }
  })

  // ---- credentials CRUD ----
  ipcMain.handle('credentials:list', async () => {
    try { return credentialStore.listCredentials() }
    catch (err) { throw wErr(err, '凭证列表读取失败') }
  })

  ipcMain.handle('credentials:add', async (_e, data: {
    name: string; accessKeyId: string; secretAccessKey: string;
    region: string; description: string; provider?: string;
    extraFields?: Record<string, string>;
  }) => {
    try { return credentialStore.addCredential(data) }
    catch (err) { throw wErr(err, '添加凭证失败') }
  })

  ipcMain.handle('credentials:update', async (_e, params: {
    id: string
    data: Partial<{ name: string; accessKeyId: string; secretAccessKey: string;
      region: string; description: string; provider: string; extraFields: Record<string, string> }>
  }) => {
    try { return credentialStore.updateCredential(params.id, params.data) }
    catch (err) { throw wErr(err, '更新凭证失败') }
  })

  ipcMain.handle('credentials:delete', async (_e, id: string) => {
    try { return credentialStore.deleteCredential(id) }
    catch (err) { throw wErr(err, '删除凭证失败') }
  })
}
