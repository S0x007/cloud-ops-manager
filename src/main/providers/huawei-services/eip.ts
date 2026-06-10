/**
 * 华为云 EIP 服务 — 弹性公网 IP 管理
 */

import { EipClient } from '@huaweicloud/huaweicloud-sdk-eip/v2/EipClient'
import { ListPublicipsRequest } from '@huaweicloud/huaweicloud-sdk-eip/v2/model/ListPublicipsRequest'
import { CreatePublicipRequest } from '@huaweicloud/huaweicloud-sdk-eip/v2/model/CreatePublicipRequest'
import { CreatePublicipRequestBody } from '@huaweicloud/huaweicloud-sdk-eip/v2/model/CreatePublicipRequestBody'
import { CreatePublicipOption } from '@huaweicloud/huaweicloud-sdk-eip/v2/model/CreatePublicipOption'
import { DeletePublicipRequest } from '@huaweicloud/huaweicloud-sdk-eip/v2/model/DeletePublicipRequest'
import { UpdatePublicipRequest } from '@huaweicloud/huaweicloud-sdk-eip/v2/model/UpdatePublicipRequest'
import { UpdatePublicipsRequestBody } from '@huaweicloud/huaweicloud-sdk-eip/v2/model/UpdatePublicipsRequestBody'
import { UpdatePublicipOption } from '@huaweicloud/huaweicloud-sdk-eip/v2/model/UpdatePublicipOption'
import { huaweiFactory } from '../huawei-client'

function buildClient(region: string): EipClient {
  return EipClient.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('vpc', region))
    .build()
}

function mapEip(e: any) {
  const ip =
    e?.publicIpAddress ??
    e?.public_ip_address ??
    e?.['public_ip_address'] ??
    ''
  const port =
    e?.portId ??
    e?.port_id ??
    e?.['port_id'] ??
    ''
  return {
    id: e?.id ?? '',
    publicIpAddress: String(ip),
    status: e?.status ?? '',
    type: e?.type ?? '',
    bandwidthSize: e?.bandwidthSize ?? e?.bandwidth_size ?? (e?.bandwidth?.size ?? 0),
    bandwidthName: e?.bandwidthName ?? e?.bandwidth_name ?? (e?.bandwidth?.name ?? ''),
    portId: String(port),
    privateIpAddress: e?.privateIpAddress ?? e?.private_ip_address ?? '',
    createTime: e?.createTime ?? e?.create_time ?? '',
  }
}

/** 华为云：仅 status=DOWN 且无 portId 的 EIP 可绑定到 ECS */
export function isBindableEip(e: { portId?: string; status?: string }): boolean {
  return e.status === 'DOWN' && !e.portId
}

export function summarizeEips(eips: Array<{ status?: string; portId?: string }>) {
  const total = eips.length
  const bindable = eips.filter(isBindableEip).length
  const active = eips.filter((e) => e.status === 'ACTIVE').length
  const elb = eips.filter((e) => e.status === 'ELB').length
  const down = eips.filter((e) => e.status === 'DOWN').length
  return { total, bindable, active, elb, down }
}

export async function listEips(region: string, projectId: string): Promise<any[]> {
  const client = buildClient(region)
  const resp = await client.listPublicips(new ListPublicipsRequest())
  const mapped = (resp.publicips ?? []).map(mapEip)
  return mapped
}

export async function allocateEip(region: string, projectId: string, params: { bandwidthSize?: number }): Promise<any> {
  const client = buildClient(region)
  const option = new CreatePublicipOption('5_bgp')
  const body = new CreatePublicipRequestBody().withPublicip(option)
    .withBandwidth({ size: params.bandwidthSize || 5, share_type: 'PER' } as any)
  const resp = await client.createPublicip(new CreatePublicipRequest().withBody(body))
  const pip = resp.publicip ?? {}
  return mapEip(pip)
}

export async function releaseEip(region: string, projectId: string, publicipId: string): Promise<void> {
  const client = buildClient(region)
  await client.deletePublicip(new DeletePublicipRequest(publicipId))
}

async function getServerPortId(region: string, serverId: string): Promise<string> {
  const { EcsClient } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/EcsClient')
  const { ListServerInterfacesRequest } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/ListServerInterfacesRequest')
  const ecsClient = EcsClient.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('ecs', region))
    .build()
  const resp = await ecsClient.listServerInterfaces(new ListServerInterfacesRequest(serverId))
  const ifaces = (resp as any).interfaceAttachments ?? (resp as any).interfaces ?? []
  if (ifaces.length === 0) throw new Error('实例未找到可用网卡')
  return ifaces[0].portId ?? ifaces[0].port_id ?? ''
}

export async function associateEip(region: string, projectId: string, serverId: string, publicipId: string): Promise<void> {
  const portId = await getServerPortId(region, serverId)
  const client = buildClient(region)
  const option = new UpdatePublicipOption().withPortId(portId)
  const body = new UpdatePublicipsRequestBody().withPublicip(option)
  await client.updatePublicip(new UpdatePublicipRequest(publicipId).withBody(body))
}

export async function disassociateEip(region: string, projectId: string, publicipId: string): Promise<void> {
  const client = buildClient(region)
  // 解绑：传入空 port_id
  const option = new UpdatePublicipOption()
  const body = new UpdatePublicipsRequestBody().withPublicip(option)
  await client.updatePublicip(new UpdatePublicipRequest(publicipId).withBody(body))
}
