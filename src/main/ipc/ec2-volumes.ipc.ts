import { ipcMain } from 'electron'
import {
  EC2Client, DescribeVolumesCommand, CreateVolumeCommand, DeleteVolumeCommand,
  AttachVolumeCommand, DetachVolumeCommand,
  DescribeSnapshotsCommand, CreateSnapshotCommand, DeleteSnapshotCommand,
} from '@aws-sdk/client-ec2'
import { clientFactory } from '../aws/client.factory'
import { getCached, setCache } from '../store/api-cache'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}
function wrapError(err: unknown, p: string): Error {
  const msg = err instanceof Error ? err.message : String(err)
  return new Error(`${p}: ${msg}`)
}

export function registerEc2VolumesIpc(): void {

  ipcMain.handle('ec2:list-instance-volumes', async (_event, params: {
    region: string; profile: string; source: string; instanceId: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new DescribeVolumesCommand({
        Filters: [{ Name: 'attachment.instance-id', Values: [params.instanceId] }],
      }))
      return (resp.Volumes ?? []).map((v) => ({
        volumeId: v.VolumeId ?? '', size: v.Size ?? 0, volumeType: v.VolumeType ?? 'gp2',
        state: v.State ?? '', iops: v.Iops ?? 0, throughput: v.Throughput,
        availabilityZone: v.AvailabilityZone ?? '', encrypted: v.Encrypted ?? false,
        createTime: v.CreateTime?.toISOString() ?? '',
        attachments: v.Attachments?.map((a) => ({
          instanceId: a.InstanceId ?? '', device: a.Device ?? '', state: a.State ?? '',
        })) ?? [],
        tags: v.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [],
        snapshotId: v.SnapshotId,
      }))
    } catch (err) { throw wrapError(err, '获取实例卷失败') }
  })

  ipcMain.handle('ec2:list-volumes', async (_event, params: {
    region: string; profile: string; source: string; forceRefresh?: boolean
  }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) {
        const cached = getCached(params.profile, params.source, params.region, 'ec2:list-volumes')
        if (cached) return cached
      }
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new DescribeVolumesCommand({}))
      const data = (resp.Volumes ?? []).map((v) => ({
        volumeId: v.VolumeId ?? '', size: v.Size ?? 0, volumeType: v.VolumeType ?? 'gp2',
        state: v.State ?? '', iops: v.Iops ?? 0, throughput: v.Throughput,
        availabilityZone: v.AvailabilityZone ?? '', encrypted: v.Encrypted ?? false,
        createTime: v.CreateTime?.toISOString() ?? '',
        attachments: v.Attachments?.map((a) => ({
          instanceId: a.InstanceId ?? '', device: a.Device ?? '', state: a.State ?? '',
        })) ?? [],
        tags: v.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [],
        snapshotId: v.SnapshotId,
      }))
      setCache(params.profile, params.source, params.region, 'ec2:list-volumes', data)
      return data
    } catch (err) { throw wrapError(err, '获取卷列表失败') }
  })

  ipcMain.handle('ec2:create-volume', async (_event, params: {
    region: string; profile: string; source: string; size: number; volumeType: string;
    iops?: number; availabilityZone: string; encrypted?: boolean; snapshotId?: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new CreateVolumeCommand({
        Size: params.size, VolumeType: params.volumeType, AvailabilityZone: params.availabilityZone,
        Iops: params.iops, Encrypted: params.encrypted, SnapshotId: params.snapshotId,
      }))
      return { volumeId: resp.VolumeId ?? '' }
    } catch (err) { throw wrapError(err, '创建卷失败') }
  })

  ipcMain.handle('ec2:delete-volume', async (_event, params: {
    region: string; profile: string; source: string; volumeId: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new DeleteVolumeCommand({ VolumeId: params.volumeId }))
    } catch (err) { throw wrapError(err, '删除卷失败') }
  })

  ipcMain.handle('ec2:attach-volume', async (_event, params: {
    region: string; profile: string; source: string; volumeId: string; instanceId: string; device: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new AttachVolumeCommand({ VolumeId: params.volumeId, InstanceId: params.instanceId, Device: params.device }))
    } catch (err) { throw wrapError(err, '挂载卷失败') }
  })

  ipcMain.handle('ec2:detach-volume', async (_event, params: {
    region: string; profile: string; source: string; volumeId: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new DetachVolumeCommand({ VolumeId: params.volumeId }))
    } catch (err) { throw wrapError(err, '卸载卷失败') }
  })

  ipcMain.handle('ec2:list-snapshots', async (_event, params: {
    region: string; profile: string; source: string; forceRefresh?: boolean
  }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) {
        const cached = getCached(params.profile, params.source, params.region, 'ec2:list-snapshots')
        if (cached) return cached
      }
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new DescribeSnapshotsCommand({ OwnerIds: ['self'] }))
      const data = (resp.Snapshots ?? []).map((s) => ({
        snapshotId: s.SnapshotId ?? '', volumeId: s.VolumeId ?? '', volumeSize: s.VolumeSize ?? 0,
        state: s.State ?? '', description: s.Description ?? '', startTime: s.StartTime?.toISOString() ?? '',
        encrypted: s.Encrypted ?? false,
      }))
      setCache(params.profile, params.source, params.region, 'ec2:list-snapshots', data)
      return data
    } catch (err) { throw wrapError(err, '获取快照列表失败') }
  })

  ipcMain.handle('ec2:create-snapshot', async (_event, params: {
    region: string; profile: string; source: string; volumeId: string; description: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new CreateSnapshotCommand({ VolumeId: params.volumeId, Description: params.description }))
    } catch (err) { throw wrapError(err, '创建快照失败') }
  })

  ipcMain.handle('ec2:delete-snapshot', async (_event, params: {
    region: string; profile: string; source: string; snapshotId: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new DeleteSnapshotCommand({ SnapshotId: params.snapshotId }))
    } catch (err) { throw wrapError(err, '删除快照失败') }
  })
}
