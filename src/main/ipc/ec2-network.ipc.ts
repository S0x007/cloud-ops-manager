import { ipcMain } from 'electron'
import { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand,
  DescribeRouteTablesCommand, DescribeInternetGatewaysCommand,
  DescribeNatGatewaysCommand } from '@aws-sdk/client-ec2'
import { clientFactory } from '../aws/client.factory'
import { getCached, setCache } from '../store/api-cache'

function setSource(p: { profile: string; source?: string }): void {
  clientFactory.setProfile(p.profile, (p.source as 'aws-config'|'custom')||'aws-config')
}
function wErr(e: unknown, m: string): Error {
  return new Error(`${m}: ${e instanceof Error ? e.message : String(e)}`)
}

export function registerEc2NetworkIpc(): void {
  const cacheList = async (channel: string, params: any, fetch: () => Promise<any>) => {
    setSource(params)
    if (!params.forceRefresh) {
      const c = getCached(params.profile, params.source, params.region, channel)
      if (c) return c
    }
    const data = await fetch()
    setCache(params.profile, params.source, params.region, channel, data)
    return data
  }

  // VPCs
  ipcMain.handle('ec2:list-vpcs', async (_e, params: any) => {
    try {
      return await cacheList('ec2:list-vpcs', params, async () => {
        const c = clientFactory.getClient(EC2Client, { region: params.region })
        const r = await c.send(new DescribeVpcsCommand({}))
        return (r.Vpcs ?? []).map((v) => ({ vpcId: v.VpcId ?? '', cidr: v.CidrBlock ?? '', default: v.IsDefault ?? false, tags: v.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [], }))
      })
    } catch (err) { throw wErr(err, '获取VPC失败') }
  })

  // Subnets
  ipcMain.handle('ec2:list-subnets', async (_e, params: any) => {
    try {
      return await cacheList('ec2:list-subnets', params, async () => {
        const c = clientFactory.getClient(EC2Client, { region: params.region })
        const r = await c.send(new DescribeSubnetsCommand({}))
        return (r.Subnets ?? []).map((s) => ({ subnetId: s.SubnetId ?? '', vpcId: s.VpcId ?? '', cidr: s.CidrBlock ?? '', az: s.AvailabilityZone ?? '', availableIps: s.AvailableIpAddressCount ?? 0, default: s.DefaultForAz ?? false, tags: s.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [], }))
      })
    } catch (err) { throw wErr(err, '获取子网失败') }
  })

  // Route Tables
  ipcMain.handle('ec2:list-route-tables', async (_e, params: any) => {
    try {
      return await cacheList('ec2:list-route-tables', params, async () => {
        const c = clientFactory.getClient(EC2Client, { region: params.region })
        const r = await c.send(new DescribeRouteTablesCommand({}))
        return (r.RouteTables ?? []).map((rt) => ({
          routeTableId: rt.RouteTableId ?? '', vpcId: rt.VpcId ?? '',
          routes: (rt.Routes ?? []).map((r) => ({ dest: r.DestinationCidrBlock ?? r.DestinationPrefixListId ?? '', target: r.GatewayId ?? r.NatGatewayId ?? r.TransitGatewayId ?? r.VpcPeeringConnectionId ?? r.NetworkInterfaceId ?? 'local', state: r.State ?? 'active' })),
          associations: (rt.Associations ?? []).map((a) => ({ subnetId: a.SubnetId ?? '', main: a.Main ?? false })),
          tags: rt.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [],
        }))
      })
    } catch (err) { throw wErr(err, '获取路由表失败') }
  })

  // Internet Gateways
  ipcMain.handle('ec2:list-internet-gateways', async (_e, params: any) => {
    try {
      return await cacheList('ec2:list-internet-gateways', params, async () => {
        const c = clientFactory.getClient(EC2Client, { region: params.region })
        const r = await c.send(new DescribeInternetGatewaysCommand({}))
        return (r.InternetGateways ?? []).map((ig) => ({ igwId: ig.InternetGatewayId ?? '', vpcId: ig.Attachments?.[0]?.VpcId ?? '', state: ig.Attachments?.[0]?.State ?? 'detached', tags: ig.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [], }))
      })
    } catch (err) { throw wErr(err, '获取IGW失败') }
  })

  // NAT Gateways
  ipcMain.handle('ec2:list-nat-gateways', async (_e, params: any) => {
    try {
      return await cacheList('ec2:list-nat-gateways', params, async () => {
        const c = clientFactory.getClient(EC2Client, { region: params.region })
        const r = await c.send(new DescribeNatGatewaysCommand({}))
        return (r.NatGateways ?? []).map((n) => ({ natId: n.NatGatewayId ?? '', subnetId: n.SubnetId ?? '', vpcId: n.VpcId ?? '', state: n.State ?? '', publicIp: n.NatGatewayAddresses?.[0]?.PublicIp ?? '', privateIp: n.NatGatewayAddresses?.[0]?.PrivateIp ?? '', tags: n.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [], }))
      })
    } catch (err) { throw wErr(err, '获取NAT网关失败') }
  })
}
