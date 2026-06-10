import type { CloudProvider, CloudMenuGroup } from './types'
import { AWS_MANIFEST } from '../../shared/providers/aws.manifest'

const REGIONS = AWS_MANIFEST.regions.map((r) => ({ id: r.id, name: r.name }))
const MENU: CloudMenuGroup[] = AWS_MANIFEST.menus

export class AwsProvider implements CloudProvider {
  id = 'aws' as const
  name = AWS_MANIFEST.name
  nameZh = AWS_MANIFEST.nameZh
  color = AWS_MANIFEST.color

  getRegions() { return REGIONS }
  getDefaultRegion() { return AWS_MANIFEST.defaultRegion }
  getMenuGroups() { return MENU }

  async verifyCredential(ak: string, sk: string, region: string, _extraFields?: Record<string, string>): Promise<{ accountId: string }> {
    const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts')
    const client = new STSClient({
      region: region || 'us-east-1',
      credentials: { accessKeyId: ak, secretAccessKey: sk },
    })
    const r = await client.send(new GetCallerIdentityCommand({}))
    return { accountId: r.Account ?? 'unknown' }
  }

  async executeOperation(action: string, _credentialId: string, _region: string, _payload: Record<string, unknown>) {
    throw new Error(
      `AWS 操作请使用专用 IPC 通道（electronAPI.ec2/s3/...），暂不迁移 cloud:invoke。action=${action}`,
    )
  }
}
