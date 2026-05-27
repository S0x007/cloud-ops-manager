import { ipcMain } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { clientFactory } from '../aws/client.factory'
import { getCallerIdentity } from '../aws/sts.service'
import type { StoredCredential } from '../store/credential-store'
import * as credentialStore from '../store/credential-store'

interface AwsProfile { name: string; region: string; type: 'basic' | 'sso' | 'role'; isExpired?: boolean; accountId?: string; source: 'aws-config' }
interface UnifiedCredential { id: string; name: string; source: 'aws-config' | 'custom'; type?: 'basic' | 'sso' | 'role'; region: string; accountId?: string; isExpired?: boolean }

function parseIni(content: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {}
  let currentSection = ''
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith(';')) continue
    const sm = t.match(/^\[(.+)\]$/)
    if (sm) { currentSection = sm[1]; sections[currentSection] = {}; continue }
    const km = t.match(/^([^=]+)=(.*)$/)
    if (km && currentSection) sections[currentSection][km[1].trim()] = km[2].trim()
  }
  return sections
}
function detectProfileType(p: Record<string, string>): 'basic' | 'sso' | 'role' {
  if (p['sso_session'] || p['sso_start_url']) return 'sso'
  if (p['role_arn']) return 'role'
  return 'basic'
}
function wErr(e: unknown, m: string): Error {
  return new Error(`${m}: ${e instanceof Error ? e.message : String(e)}`)
}

export function registerProfilesIpc(): void {
  ipcMain.handle('profiles:list-all', async (): Promise<UnifiedCredential[]> => {
    try {
      const result: UnifiedCredential[] = []; const awsDir = join(homedir(), '.aws'); const seen = new Set<string>()
      const cp = join(awsDir, 'config')
      if (existsSync(cp)) {
        const sec = parseIni(readFileSync(cp, 'utf-8'))
        for (const [sn, sd] of Object.entries(sec)) {
          const nm = sn.startsWith('profile ') ? sn.slice(8) : sn === 'default' ? 'default' : null
          if (nm && !seen.has(nm)) { seen.add(nm); result.push({ id: nm, source: 'aws-config', name: nm === 'default' ? 'Default Profile' : nm, type: detectProfileType(sd), region: sd['region'] || 'us-east-1' }) }
        }
      }
      const crp = join(awsDir, 'credentials')
      if (existsSync(crp)) {
        const sec = parseIni(readFileSync(crp, 'utf-8'))
        for (const sn of Object.keys(sec)) { const nm = sn === 'default' ? 'default' : sn; if (!seen.has(nm)) { seen.add(nm); result.push({ id: nm, source: 'aws-config', name: nm, type: 'basic', region: 'us-east-1' }) } }
      }
      for (const c of credentialStore.listCredentials()) result.push({ id: c.id, name: `[自] ${c.name}`, source: 'custom', region: c.region })
      // 始终提供 default profile，便于从自定义凭证切回 ~/.aws 默认链
      if (!seen.has('default')) {
        result.unshift({ id: 'default', source: 'aws-config', name: 'Default Profile', type: 'basic', region: 'us-east-1' })
      }
      return result
    } catch (err) { throw wErr(err, '获取凭证列表失败') }
  })

  ipcMain.handle('profiles:list', async (): Promise<AwsProfile[]> => {
    try {
      const awsDir = join(homedir(), '.aws'); const profiles: AwsProfile[] = []; const seen = new Set<string>()
      const cp = join(awsDir, 'config')
      if (existsSync(cp)) {
        const sec = parseIni(readFileSync(cp, 'utf-8'))
        for (const [sn, sd] of Object.entries(sec)) {
          const nm = sn.startsWith('profile ') ? sn.slice(8) : sn === 'default' ? 'default' : null
          if (nm && !seen.has(nm)) { seen.add(nm); profiles.push({ name: nm, region: sd['region'] || 'us-east-1', type: detectProfileType(sd), source: 'aws-config' }) }
        }
      }
      const crp = join(awsDir, 'credentials')
      if (existsSync(crp)) {
        const sec = parseIni(readFileSync(crp, 'utf-8'))
        for (const sn of Object.keys(sec)) { const nm = sn === 'default' ? 'default' : sn; if (!seen.has(nm)) { seen.add(nm); profiles.push({ name: nm, region: 'us-east-1', type: 'basic', source: 'aws-config' }) } }
      }
      return profiles
    } catch (err) { throw wErr(err, '获取Profiles列表失败') }
  })

  ipcMain.handle('profiles:verify', async (_e, params: { id: string; source: string }) => {
    try {
      clientFactory.setProfile(params.id, params.source as 'aws-config' | 'custom')
      const iden = await getCallerIdentity()
      return { accountId: iden.accountId, arn: iden.arn }
    } catch (err) { throw wErr(err, '凭证验证失败') }
  })

  ipcMain.handle('profiles:sso-login', async (_e, profile: string) => {
    try {
      const { execSync } = await import('child_process')
      execSync(`aws sso login --profile ${profile}`, { stdio: 'inherit', env: { ...process.env, AWS_PROFILE: profile } })
    } catch (err) { throw wErr(err, 'SSO登录失败') }
  })

  ipcMain.handle('credentials:list', async () => {
    try { return credentialStore.listCredentials() }
    catch (err) { throw wErr(err, '凭证列表读取失败') }
  })
  ipcMain.handle('credentials:add', async (_e, data: { name: string; accessKeyId: string; secretAccessKey: string; region: string; description: string }) => {
    try { return credentialStore.addCredential(data) }
    catch (err) { throw wErr(err, '添加凭证失败') }
  })
  ipcMain.handle('credentials:update', async (_e, params: { id: string; data: Partial<{ name: string; accessKeyId: string; secretAccessKey: string; region: string; description: string }> }) => {
    try { return credentialStore.updateCredential(params.id, params.data) }
    catch (err) { throw wErr(err, '更新凭证失败') }
  })
  ipcMain.handle('credentials:delete', async (_e, id: string) => {
    try { return credentialStore.deleteCredential(id) }
    catch (err) { throw wErr(err, '删除凭证失败') }
  })
}
