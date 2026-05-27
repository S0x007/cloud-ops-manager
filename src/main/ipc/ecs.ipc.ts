import { ipcMain } from 'electron'
import { clientFactory } from '../aws/client.factory'
import * as ecsService from '../aws/ecs.service'
import { getCached, setCache } from '../store/api-cache'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}
function wrapErr(err: unknown, msg: string): Error {
  return new Error(`${msg}: ${err instanceof Error ? err.message : String(err)}`)
}

export function registerEcsIpc(): void {
  ipcMain.handle('ecs:list-clusters', async (_event, params: {
    region: string; profile: string; source: string; forceRefresh?: boolean
  }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) {
        const cached = getCached(params.profile, params.source, params.region, 'ecs:list-clusters')
        if (cached) return cached
      }
      const data = await ecsService.listClusters(params.region)
      setCache(params.profile, params.source, params.region, 'ecs:list-clusters', data)
      return data
    } catch (err) { throw wrapErr(err, '获取ECS集群失败') }
  })

  ipcMain.handle('ecs:list-services', async (_event, params) => {
    try {
      setSource(params)
      return await ecsService.listServices(params.region, params.cluster)
    } catch (err) { throw wrapErr(err, '获取ECS服务失败') }
  })

  ipcMain.handle('ecs:list-tasks', async (_event, params) => {
    try {
      setSource(params)
      return await ecsService.listTasks(params.region, params.cluster)
    } catch (err) { throw wrapErr(err, '获取ECS任务失败') }
  })

  ipcMain.handle('ecs:describe-task', async (_event, params) => {
    try {
      setSource(params)
      return await ecsService.describeTask(params.region, params.cluster, params.taskId)
    } catch (err) { throw wrapErr(err, '获取任务详情失败') }
  })

  ipcMain.handle('ecs:describe-task-definition', async (_event, params) => {
    try {
      setSource(params)
      const { ECSClient, DescribeTaskDefinitionCommand } = await import('@aws-sdk/client-ecs')
      const client = clientFactory.getClient(ECSClient, { region: params.region })
      const resp = await client.send(new DescribeTaskDefinitionCommand({ taskDefinition: params.taskDefArn }))
      return resp.taskDefinition ?? null
    } catch (err) { throw wrapErr(err, '获取任务定义失败') }
  })
}
