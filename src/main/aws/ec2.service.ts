import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeInstanceTypesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  RebootInstancesCommand,
  DescribeSecurityGroupsCommand,
  Filter,
} from '@aws-sdk/client-ec2'
import { clientFactory } from './client.factory'

export interface EC2Instance {
  instanceId: string
  name: string
  state: string
  instanceType: string
  platform: string
  publicIpAddress: string
  privateIpAddress: string
  vpcId: string
  subnetId: string
  launchTime: string
  availabilityZone: string
  tags: { key: string; value: string }[]
  ssmManaged: boolean
}

function extractTag(tags: any[] | undefined, key: string): string {
  const tag = tags?.find((t: any) => t.Key === key)
  return tag?.Value ?? ''
}

export async function listInstances(region: string): Promise<EC2Instance[]> {
  const client = clientFactory.getClient(EC2Client, { region })
  const instances: EC2Instance[] = []
  let nextToken: string | undefined

  do {
    const cmd = new DescribeInstancesCommand({
      NextToken: nextToken,
      MaxResults: 100,
    })
    const response = await client.send(cmd)
    nextToken = response.NextToken

    for (const reservation of response.Reservations ?? []) {
      for (const inst of reservation.Instances ?? []) {
        instances.push({
          instanceId: inst.InstanceId ?? '',
          name: extractTag(inst.Tags, 'Name'),
          state: inst.State?.Name ?? 'unknown',
          instanceType: inst.InstanceType ?? '',
          platform: inst.Platform ?? 'linux',
          publicIpAddress: inst.PublicIpAddress ?? '',
          privateIpAddress: inst.PrivateIpAddress ?? '',
          vpcId: inst.VpcId ?? '',
          subnetId: inst.SubnetId ?? '',
          launchTime: inst.LaunchTime?.toISOString() ?? '',
          availabilityZone: inst.Placement?.AvailabilityZone ?? '',
          tags:
            inst.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [],
          ssmManaged: false,
        })
      }
    }
  } while (nextToken)

  return instances
}

export async function describeInstance(region: string, instanceId: string): Promise<EC2Instance | null> {
  const client = clientFactory.getClient(EC2Client, { region })
  const cmd = new DescribeInstancesCommand({
    InstanceIds: [instanceId],
  })
  const response = await client.send(cmd)

  for (const reservation of response.Reservations ?? []) {
    for (const inst of reservation.Instances ?? []) {
      return {
        instanceId: inst.InstanceId ?? '',
        name: extractTag(inst.Tags, 'Name'),
        state: inst.State?.Name ?? 'unknown',
        instanceType: inst.InstanceType ?? '',
        platform: inst.Platform ?? 'linux',
        publicIpAddress: inst.PublicIpAddress ?? '',
        privateIpAddress: inst.PrivateIpAddress ?? '',
        vpcId: inst.VpcId ?? '',
        subnetId: inst.SubnetId ?? '',
        launchTime: inst.LaunchTime?.toISOString() ?? '',
        availabilityZone: inst.Placement?.AvailabilityZone ?? '',
        tags:
          inst.Tags?.map((t) => ({ key: t.Key ?? '', value: t.Value ?? '' })) ?? [],
        ssmManaged: false,
      }
    }
  }

  return null
}

export async function startInstance(region: string, instanceId: string): Promise<void> {
  const client = clientFactory.getClient(EC2Client, { region })
  await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }))
}

export async function stopInstance(region: string, instanceId: string): Promise<void> {
  const client = clientFactory.getClient(EC2Client, { region })
  await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }))
}

export async function rebootInstance(region: string, instanceId: string): Promise<void> {
  const client = clientFactory.getClient(EC2Client, { region })
  await client.send(new RebootInstancesCommand({ InstanceIds: [instanceId] }))
}

export async function describeSecurityGroups(
  region: string,
  groupIds: string[],
): Promise<any[]> {
  if (groupIds.length === 0) return []
  const client = clientFactory.getClient(EC2Client, { region })
  const cmd = new DescribeSecurityGroupsCommand({ GroupIds: groupIds })
  const response = await client.send(cmd)
  return (
    response.SecurityGroups?.map((sg) => ({
      groupId: sg.GroupId ?? '',
      groupName: sg.GroupName ?? '',
      description: sg.Description ?? '',
      vpcId: sg.VpcId ?? '',
    })) ?? []
  )
}

// ---- 实例类型规格缓存 ----
interface InstanceTypeInfo {
  vcpu: number
  memoryGiB: number
  networkPerformance: string
}

const typeInfoCache = new Map<string, InstanceTypeInfo>()

export async function describeInstanceTypes(region: string, typeNames: string[]): Promise<Map<string, InstanceTypeInfo>> {
  const client = clientFactory.getClient(EC2Client, { region })
  const result = new Map<string, InstanceTypeInfo>()
  const toFetch: string[] = []

  // 先从缓存取
  for (const name of typeNames) {
    if (typeInfoCache.has(name)) {
      result.set(name, typeInfoCache.get(name)!)
    } else {
      toFetch.push(name)
    }
  }

  // 批量查询未缓存的（每批最多 100 个）
  for (let i = 0; i < toFetch.length; i += 100) {
    const batch = toFetch.slice(i, i + 100)
    const resp = await client.send(new DescribeInstanceTypesCommand({ InstanceTypes: batch }))
    for (const info of resp.InstanceTypes ?? []) {
      const entry: InstanceTypeInfo = {
        vcpu: info.VCpuInfo?.DefaultVCpus ?? 0,
        memoryGiB: info.MemoryInfo?.SizeInMiB ? info.MemoryInfo.SizeInMiB / 1024 : 0,
        networkPerformance: info.NetworkInfo?.NetworkPerformance ?? '-',
      }
      const name = info.InstanceType ?? ''
      typeInfoCache.set(name, entry)
      result.set(name, entry)
    }
  }

  return result
}
