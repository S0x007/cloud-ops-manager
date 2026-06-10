/**
 * 华为云 ECS 服务 — 弹性云服务器管理
 */

import { EcsClient } from '@huaweicloud/huaweicloud-sdk-ecs/v2/EcsClient'
import { ListServersDetailsRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ListServersDetailsRequest'
import { ShowServerRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ShowServerRequest'
import { BatchStartServersRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchStartServersRequest'
import { BatchStartServersRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchStartServersRequestBody'
import { BatchStartServersOption } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchStartServersOption'
import { BatchStopServersRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchStopServersRequest'
import { BatchStopServersRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchStopServersRequestBody'
import { BatchStopServersOption } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchStopServersOption'
import { BatchRebootServersRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchRebootServersRequest'
import { BatchRebootServersRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchRebootServersRequestBody'
import { BatchRebootSeversOption } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/BatchRebootSeversOption'
import { ServerId } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ServerId'
import { DeleteServersRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/DeleteServersRequest'
import { DeleteServersRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/DeleteServersRequestBody'
import { ListFlavorsRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ListFlavorsRequest'
import { ResizePostPaidServerRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ResizePostPaidServerRequest'
import { ResizePostPaidServerRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ResizePostPaidServerRequestBody'
import { ResizePostPaidServerOption } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ResizePostPaidServerOption'
import { UpdateServerRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/UpdateServerRequest'
import { UpdateServerRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/UpdateServerRequestBody'
import { UpdateServerOption } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/UpdateServerOption'
import { ResetServerPasswordRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ResetServerPasswordRequest'
import { ResetServerPasswordRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ResetServerPasswordRequestBody'
import { ResetServerPasswordOption } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ResetServerPasswordOption'
import { ShowServerRemoteConsoleRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ShowServerRemoteConsoleRequest'
import { ShowServerRemoteConsoleRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ShowServerRemoteConsoleRequestBody'
import { GetServerRemoteConsoleOption } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/GetServerRemoteConsoleOption'
import { ListServerVolumeAttachmentsRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ListServerVolumeAttachmentsRequest'
import { ShowServerPasswordRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/ShowServerPasswordRequest'
import { AttachServerVolumeRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/AttachServerVolumeRequest'
import { AttachServerVolumeRequestBody } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/AttachServerVolumeRequestBody'
import { AttachServerVolumeOption } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/AttachServerVolumeOption'
import { DetachServerVolumeRequest } from '@huaweicloud/huaweicloud-sdk-ecs/v2/model/DetachServerVolumeRequest'
import { huaweiFactory } from '../huawei-client'
import type { HuaweiServer } from '../huawei-types'

function buildClient(region: string): EcsClient {
  return EcsClient.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('ecs', region))
    .build()
}

function extractVncUrl(resp: unknown): string {
  if (!resp || typeof resp !== 'object') return ''
  const seen = new Set<unknown>()
  const stack: unknown[] = [resp]
  while (stack.length > 0) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue
    seen.add(cur)
    const obj = cur as Record<string, unknown>
    const url = obj.url
    if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
      return url.trim()
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') stack.push(value)
    }
  }
  return ''
}

function extractApiError(resp: unknown): string {
  if (!resp || typeof resp !== 'object') return ''
  const obj = resp as Record<string, unknown>
  const err = obj.error
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const msg = e.message ?? e.msg ?? e.error_msg
    if (msg) return String(msg)
  }
  for (const key of ['error_msg', 'error_message', 'message', 'errorCode', 'code'] as const) {
    const val = obj[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}

function mapServer(s: any): HuaweiServer {
  return {
    id: s.id ?? '',
    name: s.name ?? '',
    status: s.status ?? 'UNKNOWN',
    flavor: s.flavor?.id ?? '',
    vcpus: parseInt(s.flavor?.vcpus ?? '0'),
    memoryMB: parseInt(s.flavor?.ram ?? '0'),
    imageId: s.image?.id ?? '',
    publicIp: (Object.values(s.addresses ?? {}).flat() as Array<{ addr?: string; 'OS-EXT-IPS:type'?: string }>).find((a) => a['OS-EXT-IPS:type'] === 'floating')?.addr || '',
    privateIp: Object.values(s.addresses ?? {}).flat().map((a: any) => a.addr).join(', ') || '',
    availabilityZone: s['OS-EXT-AZ:availability_zone'] ?? '',
    createdAt: s.created ?? '',
    vpcId: s.metadata?.vpc_id ?? '',
    subnetId: s.metadata?.subnet_id ?? '',
    securityGroupIds: (s.security_groups ?? []).map((sg: any) => sg.name ?? ''),
    osType: s.metadata?.os_type ?? 'linux',
    keyName: s.key_name ?? s.keyName ?? '',
    diskConfig: '',
    tags: Object.fromEntries(Object.entries(s.tags ?? {}).map(([k, v]: any) => [k, String(v)])),
  }
}

export async function listServers(region: string): Promise<HuaweiServer[]> {
  const client = buildClient(region)
  const PAGE_SIZE = 100
  let allServers: any[] = []
  let page = 1

  while (true) {
    const req = new ListServersDetailsRequest().withLimit(PAGE_SIZE).withOffset(page)
    const resp = await client.listServersDetails(req)
    const servers = resp.servers ?? []
    const totalCount = resp.count ?? 0

    // 去重（API marker/offset 行为可能不一致）
    const existingIds = new Set(allServers.map((s) => s.id))
    const newServers = servers.filter((s: any) => !existingIds.has(s.id))
    allServers = allServers.concat(newServers)

    // 停止条件：已获取全部，或本页返回不足一页（说明没有更多数据了）
    if (allServers.length >= totalCount || servers.length < PAGE_SIZE) break
    page++
  }

  const result = allServers.map(mapServer)
  return result
}

export async function getServer(region: string, serverId: string): Promise<HuaweiServer | null> {
  const client = buildClient(region)
  const resp = await client.showServer(new ShowServerRequest().withServerId(serverId))
  return resp.server ? mapServer(resp.server) : null
}

export async function startServer(region: string, serverId: string): Promise<void> {
  const client = buildClient(region)
  const body = new BatchStartServersRequestBody().withOsStart(
    new BatchStartServersOption().withServers([new ServerId().withId(serverId)])
  )
  await client.batchStartServers(new BatchStartServersRequest().withBody(body))
}

export async function stopServer(region: string, serverId: string): Promise<void> {
  const client = buildClient(region)
  const body = new BatchStopServersRequestBody().withOsStop(
    new BatchStopServersOption().withServers([new ServerId().withId(serverId)])
  )
  await client.batchStopServers(new BatchStopServersRequest().withBody(body))
}

export async function rebootServer(region: string, serverId: string): Promise<void> {
  const client = buildClient(region)
  const body = new BatchRebootServersRequestBody().withReboot(
    new BatchRebootSeversOption().withServers([new ServerId().withId(serverId)]).withType('SOFT')
  )
  await client.batchRebootServers(new BatchRebootServersRequest().withBody(body))
}

export async function batchStartServers(region: string, serverIds: string[]): Promise<void> {
  if (serverIds.length === 0) return
  const client = buildClient(region)
  const body = new BatchStartServersRequestBody().withOsStart(
    new BatchStartServersOption().withServers(serverIds.map((id) => new ServerId().withId(id)))
  )
  await client.batchStartServers(new BatchStartServersRequest().withBody(body))
}

export async function batchStopServers(region: string, serverIds: string[]): Promise<void> {
  if (serverIds.length === 0) return
  const client = buildClient(region)
  const body = new BatchStopServersRequestBody().withOsStop(
    new BatchStopServersOption().withServers(serverIds.map((id) => new ServerId().withId(id)))
  )
  await client.batchStopServers(new BatchStopServersRequest().withBody(body))
}

export async function deleteServer(region: string, serverId: string, deletePublicIp: boolean, deleteVolume: boolean): Promise<void> {
  const client = buildClient(region)
  const serverIds = [new ServerId().withId(serverId)]
  const body = new DeleteServersRequestBody()
    .withServers(serverIds)
    .withDeletePublicip(deletePublicIp)
    .withDeleteVolume(deleteVolume)
  await client.deleteServers(new DeleteServersRequest().withBody(body))
}

export async function listFlavors(region: string, az?: string): Promise<any[]> {
  const client = buildClient(region)
  const req = new ListFlavorsRequest()
  if (az) req.withAvailabilityZone(az)
  const resp = await client.listFlavors(req)
  return (resp.flavors ?? []).map((f: any) => ({
    id: f.id ?? '', name: f.name ?? '', vcpus: f.vcpus ?? '', ram: f.ram ?? 0,
    disk: f.disk ?? '', osExtraSpecs: f.osExtraSpecs ?? {},
  }))
}

export async function resizeServer(region: string, serverId: string, newFlavorId: string): Promise<void> {
  const client = buildClient(region)
  const body = new ResizePostPaidServerRequestBody().withResize(
    new ResizePostPaidServerOption().withFlavorRef(newFlavorId)
  )
  await client.resizePostPaidServer(new ResizePostPaidServerRequest().withServerId(serverId).withBody(body))
}

export async function updateServerName(region: string, serverId: string, name: string): Promise<void> {
  const client = buildClient(region)
  const body = new UpdateServerRequestBody().withServer(
    new UpdateServerOption().withName(name)
  )
  await client.updateServer(new UpdateServerRequest().withServerId(serverId).withBody(body))
}

export async function resetPassword(region: string, serverId: string, newPassword: string): Promise<void> {
  const client = buildClient(region)
  const body = new ResetServerPasswordRequestBody().withResetPassword(
    new ResetServerPasswordOption().withNewPassword(newPassword),
  )
  await client.resetServerPassword(new ResetServerPasswordRequest().withServerId(serverId).withBody(body))
}

export async function getVncConsole(region: string, serverId: string): Promise<{ url: string; type: string }> {
  const server = await getServer(region, serverId)
  if (!server) throw new Error('实例不存在或当前区域无权限访问')
  if (server.status !== 'ACTIVE') {
    throw new Error(`实例状态为 ${server.status}，VNC 仅支持运行中（ACTIVE）的实例`)
  }

  const client = buildClient(region)
  const option = new GetServerRemoteConsoleOption().withProtocol('vnc').withType('novnc')
  const body = new ShowServerRemoteConsoleRequestBody().withRemoteConsole(option)
  const resp = await client.showServerRemoteConsole(
    new ShowServerRemoteConsoleRequest().withServerId(serverId).withBody(body)
  )

  const url = extractVncUrl(resp)
  if (!url) {
    const apiErr = extractApiError(resp)
    const keys = resp && typeof resp === 'object' ? Object.keys(resp as object).join(', ') : 'unknown'
    throw new Error(
      apiErr
        || `未获取到 VNC 登录地址（响应字段: ${keys}）。请确认 AK/SK 具备 ecs:cloudServers:vnc 权限`
    )
  }

  const remoteConsole = (resp as any)?.remote_console ?? (resp as any)?.remoteConsole
  return {
    url,
    type: remoteConsole?.type ?? 'novnc',
  }
}

export async function listServerVolumes(region: string, serverId: string): Promise<any[]> {
  const client = buildClient(region)
  const resp = await client.listServerVolumeAttachments(
    new ListServerVolumeAttachmentsRequest().withServerId(serverId)
  )
  return (resp.volumeAttachments ?? []).map((v: any) => ({
    volumeId: v.volumeId ?? '',
    device: v.device ?? '',
    size: v.size ?? '',
    serverId: v.serverId ?? '',
  }))
}

export async function getServerPassword(region: string, serverId: string): Promise<string> {
  const client = buildClient(region)
  try {
    const resp = await client.showServerPassword(new ShowServerPasswordRequest(serverId))
    const password = resp.password ?? ''
    if (!password) {
      throw new Error('NO_PASSWORD:该实例未返回默认密码。华为云仅支持「Windows + 创建时绑定密钥对」的实例；Linux 实例不支持此接口。若满足条件仍为空，可能是创建时使用了自定义密码而非密钥对。')
    }
    return password
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.startsWith('NO_PASSWORD:')) throw err
    throw err
  }
}

export async function attachVolume(region: string, serverId: string, volumeId: string, device?: string): Promise<void> {
  const client = buildClient(region)
  const option = new AttachServerVolumeOption(volumeId).withDevice(device || '/dev/vdb')
  const body = new AttachServerVolumeRequestBody().withVolumeAttachment(option)
  const req = new AttachServerVolumeRequest(serverId).withBody(body)
  await client.attachServerVolume(req)
}

export async function detachVolume(region: string, serverId: string, volumeId: string): Promise<void> {
  const client = buildClient(region)
  const req = new DetachServerVolumeRequest(serverId, volumeId)
  await client.detachServerVolume(req)
}

export async function createServer(region: string, params: {
  name: string; flavorRef: string; imageRef: string; vpcId: string; subnetId: string
  securityGroupIds?: string[]; rootVolumeType: string; rootVolumeSize: number
  adminPass?: string; keyName?: string; availabilityZone?: string
  publicIp?: { eipType: string; bandwidthSize: number }
  dataVolumes?: Array<{ type: string; size: number }>; count?: number
}): Promise<{ jobId: string; serverIds: string[] }> {
  const client = buildClient(region)
  const { PostPaidServer } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/PostPaidServer')
  const { PostPaidServerNic } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/PostPaidServerNic')
  const { PostPaidServerRootVolume } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/PostPaidServerRootVolume')
  const { PostPaidServerSecurityGroup } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/PostPaidServerSecurityGroup')
  const { PostPaidServerPublicip } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/PostPaidServerPublicip')
  const { PostPaidServerEip } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/PostPaidServerEip')
  const { PostPaidServerEipBandwidth } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/PostPaidServerEipBandwidth')
  const { PostPaidServerDataVolume } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/PostPaidServerDataVolume')
  const { CreatePostPaidServersRequest } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/CreatePostPaidServersRequest')
  const { CreatePostPaidServersRequestBody } = await import('@huaweicloud/huaweicloud-sdk-ecs/v2/model/CreatePostPaidServersRequestBody')

  const nic = new PostPaidServerNic().withSubnetId(params.subnetId)
  const rootVol = new PostPaidServerRootVolume(params.rootVolumeType).withSize(params.rootVolumeSize)
  const server = new PostPaidServer(params.flavorRef, params.imageRef, params.name, [nic], rootVol, params.vpcId)

  if (params.securityGroupIds?.length) {
    server.withSecurityGroups(params.securityGroupIds.map((id: string) => new PostPaidServerSecurityGroup().withId(id)))
  }
  if (params.adminPass) server.withAdminPass(params.adminPass)
  if (params.keyName) server.withKeyName(params.keyName)
  if (params.availabilityZone) server.withAvailabilityZone(params.availabilityZone)

  if (params.publicIp) {
    const eip = new PostPaidServerEip(params.publicIp.eipType, new PostPaidServerEipBandwidth('PER').withSize(params.publicIp.bandwidthSize))
    server.withPublicip(new PostPaidServerPublicip().withEip(eip))
  }
  if (params.dataVolumes?.length) {
    server.withDataVolumes(params.dataVolumes.map((dv: { type: string; size: number }) =>
      new PostPaidServerDataVolume(dv.type, dv.size)))
  }
  if (params.count) server.withCount(params.count)

  const body = new CreatePostPaidServersRequestBody().withServer(server)
  const req = new CreatePostPaidServersRequest().withBody(body)
  const resp = await client.createPostPaidServers(req)
  return { jobId: resp.jobId ?? '', serverIds: resp.serverIds ?? [] }
}
