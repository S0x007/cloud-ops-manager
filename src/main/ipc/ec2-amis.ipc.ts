import { ipcMain } from 'electron'
import { EC2Client, DescribeImagesCommand, DeregisterImageCommand, CopyImageCommand } from '@aws-sdk/client-ec2'
import { clientFactory } from '../aws/client.factory'
import { getCached, setCache } from '../store/api-cache'

function setSource(p: { profile: string; source?: string }): void {
  clientFactory.setProfile(p.profile, (p.source as 'aws-config'|'custom')||'aws-config')
}
function wErr(e: unknown, m: string): Error {
  return new Error(`${m}: ${e instanceof Error ? e.message : String(e)}`)
}

export function registerEc2AmisIpc(): void {
  ipcMain.handle('ec2:list-images', async (_e, params: { region: string; profile: string; source: string; forceRefresh?: boolean }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) { const c = getCached(params.profile, params.source, params.region, 'ec2:list-images'); if (c) return c }
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new DescribeImagesCommand({ Owners: ['self'] }))
      const data = (resp.Images ?? []).map((img) => ({
        imageId: img.ImageId ?? '', name: img.Name ?? '', description: img.Description ?? '',
        state: img.State ?? '', platform: img.Platform ?? 'linux', architecture: img.Architecture ?? 'x86_64',
        creationDate: img.CreationDate ?? '', rootDeviceType: img.RootDeviceType ?? 'ebs',
        blockDevices: img.BlockDeviceMappings?.map((b) => ({ deviceName: b.DeviceName ?? '', snapshotId: b.Ebs?.SnapshotId, volumeSize: b.Ebs?.VolumeSize ?? 0 })) ?? [],
        tags: img.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [],
      }))
      setCache(params.profile, params.source, params.region, 'ec2:list-images', data)
      return data
    } catch (err) { throw wErr(err, '获取AMI列表失败') }
  })

  ipcMain.handle('ec2:deregister-image', async (_e, params: { region: string; profile: string; source: string; imageId: string }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new DeregisterImageCommand({ ImageId: params.imageId }))
    } catch (err) { throw wErr(err, '注销AMI失败') }
  })

  ipcMain.handle('ec2:copy-image', async (_e, params: { region: string; profile: string; source: string; imageId: string; name: string; destRegion: string }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new CopyImageCommand({ SourceImageId: params.imageId, SourceRegion: params.region, Name: params.name, DestinationRegion: params.destRegion }))
      return { imageId: resp.ImageId ?? '' }
    } catch (err) { throw wErr(err, '复制AMI失败') }
  })
}
