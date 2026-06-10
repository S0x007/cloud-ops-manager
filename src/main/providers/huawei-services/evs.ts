/**
 * 华为云 EVS 服务 — 云硬盘管理
 */

import { EvsClient } from '@huaweicloud/huaweicloud-sdk-evs/v2/EvsClient'
import { ListVolumesRequest } from '@huaweicloud/huaweicloud-sdk-evs/v2/model/ListVolumesRequest'
import { CreateVolumeRequest } from '@huaweicloud/huaweicloud-sdk-evs/v2/model/CreateVolumeRequest'
import { CreateVolumeRequestBody } from '@huaweicloud/huaweicloud-sdk-evs/v2/model/CreateVolumeRequestBody'
import { CreateVolumeOption } from '@huaweicloud/huaweicloud-sdk-evs/v2/model/CreateVolumeOption'
import { DeleteVolumeRequest } from '@huaweicloud/huaweicloud-sdk-evs/v2/model/DeleteVolumeRequest'
import { ResizeVolumeRequest } from '@huaweicloud/huaweicloud-sdk-evs/v2/model/ResizeVolumeRequest'
import { ResizeVolumeRequestBody } from '@huaweicloud/huaweicloud-sdk-evs/v2/model/ResizeVolumeRequestBody'
import { OsExtend } from '@huaweicloud/huaweicloud-sdk-evs/v2/model/OsExtend'
import { huaweiFactory } from '../huawei-client'

function buildClient(region: string): EvsClient {
  return EvsClient.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('evs', region))
    .build()
}

export async function listVolumes(region: string): Promise<any[]> {
  const client = buildClient(region)
  const resp = await client.listVolumes(new ListVolumesRequest().withLimit(2000))
  return (resp.volumes ?? []).map((v: any) => ({
    id: v.id, name: v.name ?? '', size: v.size ?? 0,
    type: v.volumeType ?? '', status: v.status ?? '',
    availabilityZone: v.availabilityZone ?? '',
    encrypted: v.metadata?.['__system__encrypted'] === '1',
    attachedTo: (v.attachments ?? []).map((a: any) => a.server_id).filter(Boolean),
    createdAt: v.createdAt ?? '',
  }))
}

export async function createVolume(region: string, params: {
  name: string; size: number; volumeType: string; availabilityZone: string; description?: string
}): Promise<{ id: string; jobId?: string }> {
  const client = buildClient(region)
  const vol = new CreateVolumeOption(params.availabilityZone, params.size, params.volumeType)
    .withName(params.name)
  if (params.description) vol.withDescription(params.description)
  const body = new CreateVolumeRequestBody(vol)
  const resp = await client.createVolume(new CreateVolumeRequest().withBody(body))
  return { id: resp.volumeIds?.[0] ?? '', jobId: resp.jobId }
}

export async function deleteVolume(region: string, volumeId: string): Promise<void> {
  const client = buildClient(region)
  await client.deleteVolume(new DeleteVolumeRequest().withVolumeId(volumeId))
}

export async function resizeVolume(region: string, volumeId: string, newSize: number): Promise<{ jobId?: string }> {
  const client = buildClient(region)
  const body = new ResizeVolumeRequestBody(new OsExtend(newSize))
  const resp = await client.resizeVolume(new ResizeVolumeRequest().withVolumeId(volumeId).withBody(body))
  return { jobId: resp.jobId }
}
