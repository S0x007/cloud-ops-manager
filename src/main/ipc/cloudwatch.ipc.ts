import { ipcMain } from 'electron'
import { clientFactory } from '../aws/client.factory'
import * as cwService from '../aws/cloudwatch.service'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}
function wrapErr(err: unknown, msg: string): Error {
  return new Error(`${msg}: ${err instanceof Error ? err.message : String(err)}`)
}

export function registerCloudWatchIpc(): void {
  ipcMain.handle('cw:get-instance-metrics', async (_event, params: { region: string; profile: string; source: string; instanceId: string }) => {
    try {
      setSource(params)
      return await cwService.getInstanceMetrics(params.region, params.instanceId)
    } catch (err) { throw wrapErr(err, '获取监控数据失败') }
  })
}
