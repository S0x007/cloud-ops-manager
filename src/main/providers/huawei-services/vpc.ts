/**
 * 华为云 VPC 服务 — 网络管理
 */

import { VpcClient as VpcClientV3 } from '@huaweicloud/huaweicloud-sdk-vpc/v3/VpcClient'
import { ListVpcsRequest } from '@huaweicloud/huaweicloud-sdk-vpc/v3/model/ListVpcsRequest'
import { ListSecurityGroupsRequest } from '@huaweicloud/huaweicloud-sdk-vpc/v3/model/ListSecurityGroupsRequest'
import { CreateSecurityGroupRuleRequest } from '@huaweicloud/huaweicloud-sdk-vpc/v3/model/CreateSecurityGroupRuleRequest'
import { CreateSecurityGroupRuleRequestBody } from '@huaweicloud/huaweicloud-sdk-vpc/v3/model/CreateSecurityGroupRuleRequestBody'
import { CreateSecurityGroupRuleOption } from '@huaweicloud/huaweicloud-sdk-vpc/v3/model/CreateSecurityGroupRuleOption'
import { DeleteSecurityGroupRuleRequest } from '@huaweicloud/huaweicloud-sdk-vpc/v3/model/DeleteSecurityGroupRuleRequest'
import { VpcClient as VpcClientV2 } from '@huaweicloud/huaweicloud-sdk-vpc/v2/VpcClient'
import { ListSubnetsRequest } from '@huaweicloud/huaweicloud-sdk-vpc/v2/model/ListSubnetsRequest'
import { huaweiFactory } from '../huawei-client'

export async function listVpcs(region: string): Promise<any[]> {
  const client = VpcClientV3.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('vpc', region))
    .build()
  const resp = await client.listVpcs(new ListVpcsRequest().withLimit(2000))
  return (resp.vpcs ?? []).map((v: any) => ({
    id: v.id, name: v.name, cidr: v.cidr, status: v.status, isDefault: v['default'],
  }))
}

export async function listSubnets(region: string): Promise<any[]> {
  const client = VpcClientV2.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('vpc', region))
    .build()
  const resp = await client.listSubnets(new ListSubnetsRequest().withLimit(2000))
  return (resp.subnets ?? []).map((s: any) => ({
    id: s.id, name: s.name, vpcId: s.vpc_id, cidr: s.cidr,
    gatewayIp: s.gateway_ip, availabilityZone: s.availability_zone,
    availableIpCount: s.available_ip_count ?? 0,
  }))
}

export async function listSecurityGroups(region: string): Promise<any[]> {
  const client = VpcClientV3.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('vpc', region))
    .build()
  const resp = await client.listSecurityGroups(new ListSecurityGroupsRequest().withLimit(2000))
  return (resp.securityGroups ?? []).map((sg: any) => ({
    id: sg.id, name: sg.name, description: sg.description,
    rules: (sg.securityGroupRules ?? []).map((r: any) => ({
      id: r.id, direction: r.direction, protocol: r.protocol,
      portRange: r.multiport ?? r.portRangeMax ? `${r.portRangeMin || ''}-${r.portRangeMax || ''}` : r.ports ?? '-',
      remoteIpPrefix: r.remoteIpPrefix ?? r.remoteGroupId ?? '-',
      description: r.description ?? '',
    })),
  }))
}

export async function createSecurityGroupRule(region: string, params: {
  securityGroupId: string; direction: string; protocol: string; multiport?: string
  remoteIpPrefix?: string; description?: string; ethertype?: string
}): Promise<{ id: string }> {
  const client = VpcClientV3.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('vpc', region))
    .build()
  const option = new CreateSecurityGroupRuleOption(params.securityGroupId, params.direction)
    .withProtocol(params.protocol)
    .withEthertype(params.ethertype || 'IPv4')
  if (params.multiport) option.withMultiport(params.multiport)
  if (params.remoteIpPrefix) option.withRemoteIpPrefix(params.remoteIpPrefix)
  if (params.description) option.withDescription(params.description)
  const body = new CreateSecurityGroupRuleRequestBody(option)
  const resp = await client.createSecurityGroupRule(new CreateSecurityGroupRuleRequest().withBody(body))
  return { id: resp.securityGroupRule?.id ?? '' }
}

export async function deleteSecurityGroupRule(region: string, ruleId: string): Promise<void> {
  const client = VpcClientV3.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('vpc', region))
    .build()
  await client.deleteSecurityGroupRule(new DeleteSecurityGroupRuleRequest().withSecurityGroupRuleId(ruleId))
}
