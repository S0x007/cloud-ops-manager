import { ipcMain } from 'electron'
import { EC2Client, DescribeAddressesCommand, AllocateAddressCommand, CreateTagsCommand,
  ReleaseAddressCommand, AssociateAddressCommand, DisassociateAddressCommand } from '@aws-sdk/client-ec2'
import { clientFactory } from '../aws/client.factory'
import { getCached, setCache } from '../store/api-cache'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}
function wrapErr(err: unknown, msg: string): Error {
  return new Error(`${msg}: ${err instanceof Error ? err.message : String(err)}`)
}

export function registerEc2AddressesIpc(): void {
  ipcMain.handle('ec2:list-addresses', async (_event, params: { region: string; profile: string; source: string; forceRefresh?: boolean }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) {
        const cached = getCached(params.profile, params.source, params.region, 'ec2:list-addresses')
        if (cached) return cached
      }
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new DescribeAddressesCommand({}))
      const data = (resp.Addresses ?? []).map((a) => {
        const tags = a.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? []
        const allocTag = tags.find((t) => t.key === 'AllocationDate')
        return {
          publicIp: a.PublicIp ?? '', allocationId: a.AllocationId ?? '',
          instanceId: a.InstanceId ?? '', associationId: a.AssociationId ?? '',
          domain: a.Domain ?? 'vpc', networkInterfaceId: a.NetworkInterfaceId,
          networkBorderGroup: a.NetworkBorderGroup ?? '',
          allocationDate: allocTag?.value ?? '',
          tags,
        }
      })
      setCache(params.profile, params.source, params.region, 'ec2:list-addresses', data)
      return data
    } catch (err) { throw wrapErr(err, '获取弹性IP列表失败') }
  })

  ipcMain.handle('ec2:allocate-address', async (_event, params: { region: string; profile: string; source: string }) => {
    try {
      setSource(params)
      const now = new Date().toISOString()
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new AllocateAddressCommand({
        Domain: 'vpc',
        TagSpecifications: [{
          ResourceType: 'elastic-ip',
          Tags: [
            { Key: 'AllocatedBy', Value: 'AWS Ops Manager' },
            { Key: 'AllocationDate', Value: now },
          ],
        }],
      }))
      return {
        publicIp: resp.PublicIp ?? '',
        allocationId: resp.AllocationId ?? '',
        networkBorderGroup: resp.NetworkBorderGroup ?? '',
        allocationDate: now,
      }
    } catch (err) { throw wrapErr(err, '分配弹性IP失败') }
  })

  ipcMain.handle('ec2:release-address', async (_event, params: { region: string; profile: string; source: string; allocationId: string }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new ReleaseAddressCommand({ AllocationId: params.allocationId }))
    } catch (err) { throw wrapErr(err, '释放弹性IP失败') }
  })

  ipcMain.handle('ec2:associate-address', async (_event, params: { region: string; profile: string; source: string; allocationId: string; instanceId: string }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new AssociateAddressCommand({ AllocationId: params.allocationId, InstanceId: params.instanceId }))
    } catch (err) { throw wrapErr(err, '关联弹性IP失败') }
  })

  ipcMain.handle('ec2:disassociate-address', async (_event, params: { region: string; profile: string; source: string; associationId: string }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new DisassociateAddressCommand({ AssociationId: params.associationId }))
    } catch (err) { throw wrapErr(err, '解绑弹性IP失败') }
  })
}
