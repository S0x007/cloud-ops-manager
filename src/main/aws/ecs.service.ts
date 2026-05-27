import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
  ListTasksCommand,
  DescribeTasksCommand,
  DescribeTaskDefinitionCommand,
} from '@aws-sdk/client-ecs'
import { clientFactory } from './client.factory'

export interface ECSCluster {
  clusterArn: string
  clusterName: string
  status: string
  runningTasksCount: number
  pendingTasksCount: number
  activeServicesCount: number
}

export interface ECSService {
  serviceArn: string
  serviceName: string
  status: string
  desiredCount: number
  runningCount: number
  pendingCount: number
  launchType: string
}

export interface ECSTask {
  taskArn: string
  taskId: string
  lastStatus: string
  desiredStatus: string
  cpu: string
  memory: string
  containerInstanceArn: string
  group: string
  launchType: string
}

export interface ECSTaskDetail extends ECSTask {
  containers: Array<{
    name: string
    image: string
    lastStatus: string
    exitCode?: number
    cpu: string
    memory: string
  }>
}

function extractResourceName(arn: string): string {
  const parts = arn.split('/')
  return parts[parts.length - 1] || arn
}

export async function listClusters(region: string): Promise<ECSCluster[]> {
  const client = clientFactory.getClient(ECSClient, { region })
  const response = await client.send(new ListClustersCommand({}))

  if (!response.clusterArns || response.clusterArns.length === 0) {
    return []
  }

  const descResponse = await client.send(
    new DescribeClustersCommand({ clusters: response.clusterArns }),
  )

  return (
    descResponse.clusters?.map((c) => ({
      clusterArn: c.clusterArn ?? '',
      clusterName: c.clusterName ?? extractResourceName(c.clusterArn ?? ''),
      status: c.status ?? 'UNKNOWN',
      runningTasksCount: c.runningTasksCount ?? 0,
      pendingTasksCount: c.pendingTasksCount ?? 0,
      activeServicesCount: c.activeServicesCount ?? 0,
    })) ?? []
  )
}

export async function listServices(
  region: string,
  cluster: string,
): Promise<ECSService[]> {
  const client = clientFactory.getClient(ECSClient, { region })
  const response = await client.send(new ListServicesCommand({ cluster }))

  if (!response.serviceArns || response.serviceArns.length === 0) {
    return []
  }

  const descResponse = await client.send(
    new DescribeServicesCommand({ cluster, services: response.serviceArns }),
  )

  return (
    descResponse.services?.map((s) => ({
      serviceArn: s.serviceArn ?? '',
      serviceName: s.serviceName ?? '',
      status: s.status ?? 'UNKNOWN',
      desiredCount: s.desiredCount ?? 0,
      runningCount: s.runningCount ?? 0,
      pendingCount: s.pendingCount ?? 0,
      launchType: s.launchType ?? 'EC2',
    })) ?? []
  )
}

export async function listTasks(
  region: string,
  cluster: string,
): Promise<ECSTask[]> {
  const client = clientFactory.getClient(ECSClient, { region })
  const response = await client.send(new ListTasksCommand({ cluster }))

  if (!response.taskArns || response.taskArns.length === 0) {
    return []
  }

  const descResponse = await client.send(
    new DescribeTasksCommand({ cluster, tasks: response.taskArns }),
  )

  return (
    descResponse.tasks?.map((t) => ({
      taskArn: t.taskArn ?? '',
      taskId: extractResourceName(t.taskArn ?? ''),
      lastStatus: t.lastStatus ?? 'UNKNOWN',
      desiredStatus: t.desiredStatus ?? 'RUNNING',
      cpu: t.cpu ?? '-',
      memory: t.memory ?? '-',
      containerInstanceArn: t.containerInstanceArn ?? '-',
      group: t.group ?? '-',
      launchType: t.launchType ?? 'EC2',
    })) ?? []
  )
}

export async function describeTask(
  region: string,
  cluster: string,
  taskId: string,
): Promise<ECSTaskDetail | null> {
  const client = clientFactory.getClient(ECSClient, { region })
  const response = await client.send(
    new DescribeTasksCommand({ cluster, tasks: [taskId] }),
  )

  const t = response.tasks?.[0]
  if (!t) return null

  return {
    taskArn: t.taskArn ?? '',
    taskId: extractResourceName(t.taskArn ?? ''),
    lastStatus: t.lastStatus ?? 'UNKNOWN',
    desiredStatus: t.desiredStatus ?? 'RUNNING',
    cpu: t.cpu ?? '-',
    memory: t.memory ?? '-',
    containerInstanceArn: t.containerInstanceArn ?? '-',
    group: t.group ?? '-',
    launchType: t.launchType ?? 'EC2',
    containers:
      t.containers?.map((c) => ({
        name: c.name ?? '',
        image: c.image ?? '',
        lastStatus: c.lastStatus ?? 'UNKNOWN',
        exitCode: c.exitCode,
        cpu: c.cpu ?? '-',
        memory: c.memory ?? '-',
      })) ?? [],
  }
}
