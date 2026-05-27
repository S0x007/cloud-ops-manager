import { ipcMain } from 'electron'
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  AuthorizeSecurityGroupIngressCommand,
  AuthorizeSecurityGroupEgressCommand,
  RevokeSecurityGroupIngressCommand,
  RevokeSecurityGroupEgressCommand,
  CreateSecurityGroupCommand,
  DeleteSecurityGroupCommand,
} from '@aws-sdk/client-ec2'
import { clientFactory } from '../aws/client.factory'
import { getCached, setCache } from '../store/api-cache'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}

function wrapError(err: unknown, prefix: string): Error {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[EC2 SG IPC] ${prefix}:`, msg)
  return new Error(`${prefix}: ${msg}`)
}

export function registerEc2SecurityGroupsIpc(): void {

  ipcMain.handle('ec2:list-security-groups', async (_event, params: {
    region: string; profile: string; source: string; forceRefresh?: boolean
  }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) {
        const cached = getCached(params.profile, params.source, params.region, 'ec2:list-sg')
        if (cached) return cached
      }
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new DescribeSecurityGroupsCommand({}))
      const data = (resp.SecurityGroups ?? []).map((sg) => ({
        groupId: sg.GroupId ?? '',
        groupName: sg.GroupName ?? '',
        description: sg.Description ?? '',
        vpcId: sg.VpcId ?? '',
        ipPermissions: sg.IpPermissions?.map((p) => ({
          protocol: p.IpProtocol ?? '-',
          fromPort: p.FromPort ?? 0,
          toPort: p.ToPort ?? 65535,
          ipRanges: p.IpRanges?.map((r) => ({ cidr: r.CidrIp, description: r.Description })) ?? [],
          ipv6Ranges: p.Ipv6Ranges?.map((r) => ({ cidr: r.CidrIpv6, description: r.Description })) ?? [],
          userIdGroupPairs: p.UserIdGroupPairs?.map((g) => ({ groupId: g.GroupId, groupName: g.GroupName, description: g.Description })) ?? [],
        })) ?? [],
        ipPermissionsEgress: sg.IpPermissionsEgress?.map((p) => ({
          protocol: p.IpProtocol ?? '-',
          fromPort: p.FromPort ?? 0,
          toPort: p.ToPort ?? 65535,
          ipRanges: p.IpRanges?.map((r) => ({ cidr: r.CidrIp, description: r.Description })) ?? [],
          ipv6Ranges: p.Ipv6Ranges?.map((r) => ({ cidr: r.CidrIpv6, description: r.Description })) ?? [],
          userIdGroupPairs: p.UserIdGroupPairs?.map((g) => ({ groupId: g.GroupId, groupName: g.GroupName, description: g.Description })) ?? [],
        })) ?? [],
        tags: sg.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [],
      }))
      setCache(params.profile, params.source, params.region, 'ec2:list-sg', data)
      return data
    } catch (err) { throw wrapError(err, '获取安全组列表失败') }
  })

  ipcMain.handle('ec2:create-security-group', async (_event, params: {
    region: string; profile: string; source: string; name: string; description: string; vpcId: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new CreateSecurityGroupCommand({
        GroupName: params.name, Description: params.description, VpcId: params.vpcId,
      }))
      return { groupId: resp.GroupId ?? '' }
    } catch (err) { throw wrapError(err, '创建安全组失败') }
  })

  ipcMain.handle('ec2:delete-security-group', async (_event, params: {
    region: string; profile: string; source: string; groupId: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new DeleteSecurityGroupCommand({ GroupId: params.groupId }))
    } catch (err) { throw wrapError(err, '删除安全组失败') }
  })

  ipcMain.handle('ec2:authorize-sg-ingress', async (_event, params: {
    region: string; profile: string; source: string; groupId: string;
    protocol: string; fromPort: number; toPort: number; cidr: string; description: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new AuthorizeSecurityGroupIngressCommand({
        GroupId: params.groupId,
        IpPermissions: [{
          IpProtocol: params.protocol,
          FromPort: params.fromPort, ToPort: params.toPort,
          IpRanges: [{ CidrIp: params.cidr, Description: params.description }],
        }],
      }))
    } catch (err) { throw wrapError(err, '添加入站规则失败') }
  })

  ipcMain.handle('ec2:authorize-sg-egress', async (_event, params: {
    region: string; profile: string; source: string; groupId: string;
    protocol: string; fromPort: number; toPort: number; cidr: string; description: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new AuthorizeSecurityGroupEgressCommand({
        GroupId: params.groupId,
        IpPermissions: [{
          IpProtocol: params.protocol,
          FromPort: params.fromPort, ToPort: params.toPort,
          IpRanges: [{ CidrIp: params.cidr, Description: params.description }],
        }],
      }))
    } catch (err) { throw wrapError(err, '添加出站规则失败') }
  })

  ipcMain.handle('ec2:revoke-sg-ingress', async (_event, params: {
    region: string; profile: string; source: string; groupId: string;
    protocol: string; fromPort: number; toPort: number; cidr: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new RevokeSecurityGroupIngressCommand({
        GroupId: params.groupId,
        IpPermissions: [{
          IpProtocol: params.protocol, FromPort: params.fromPort, ToPort: params.toPort,
          IpRanges: [{ CidrIp: params.cidr }],
        }],
      }))
    } catch (err) { throw wrapError(err, '删除入站规则失败') }
  })

  ipcMain.handle('ec2:revoke-sg-egress', async (_event, params: {
    region: string; profile: string; source: string; groupId: string;
    protocol: string; fromPort: number; toPort: number; cidr: string
  }) => {
    try {
      setSource(params)
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      await client.send(new RevokeSecurityGroupEgressCommand({
        GroupId: params.groupId,
        IpPermissions: [{
          IpProtocol: params.protocol, FromPort: params.fromPort, ToPort: params.toPort,
          IpRanges: [{ CidrIp: params.cidr }],
        }],
      }))
    } catch (err) { throw wrapError(err, '删除出站规则失败') }
  })
}
