import { ipcMain } from 'electron'
import { clientFactory } from '../aws/client.factory'
import * as ec2Service from '../aws/ec2.service'
import { getCached, setCache } from '../store/api-cache'

const consoleOutputLastCall = new Map<string, number>()
const CONSOLE_OUTPUT_MIN_INTERVAL_MS = 15_000

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}
function wrapErr(err: unknown, msg: string): Error {
  return new Error(`${msg}: ${err instanceof Error ? err.message : String(err)}`)
}

export function registerEc2Ipc(): void {
  ipcMain.handle('ec2:list-instances', async (_event, params: {
    region: string; profile: string; source: string; forceRefresh?: boolean
  }) => {
    try {
      setSource(params)
      if (!params.forceRefresh) {
        const cached = getCached(params.profile, params.source, params.region, 'ec2:list')
        if (cached) return cached
      }
      const data = await ec2Service.listInstances(params.region)
      setCache(params.profile, params.source, params.region, 'ec2:list', data)
      return data
    } catch (err) { throw wrapErr(err, '获取EC2实例列表失败') }
  })

  ipcMain.handle('ec2:describe-instance', async (_event, params) => {
    try {
      setSource(params)
      return await ec2Service.describeInstance(params.region, params.instanceId)
    } catch (err) { throw wrapErr(err, '获取实例详情失败') }
  })

  ipcMain.handle('ec2:start-instance', async (_event, params) => {
    try {
      setSource(params)
      await ec2Service.startInstance(params.region, params.instanceId)
    } catch (err) { throw wrapErr(err, '启动实例失败') }
  })

  ipcMain.handle('ec2:stop-instance', async (_event, params) => {
    try {
      setSource(params)
      await ec2Service.stopInstance(params.region, params.instanceId)
    } catch (err) { throw wrapErr(err, '停止实例失败') }
  })

  ipcMain.handle('ec2:reboot-instance', async (_event, params) => {
    try {
      setSource(params)
      await ec2Service.rebootInstance(params.region, params.instanceId)
    } catch (err) { throw wrapErr(err, '重启实例失败') }
  })

  ipcMain.handle('ec2:describe-instance-types', async (_event, params: {
    region: string; profile: string; source: string; types: string[]
  }) => {
    try {
      setSource(params)
      const map = await ec2Service.describeInstanceTypes(params.region, params.types)
      const obj: Record<string, { vcpu: number; memoryGiB: number; networkPerformance: string }> = {}
      for (const [k, v] of map) { obj[k] = v }
      return obj
    } catch (err) { throw wrapErr(err, '获取实例规格失败') }
  })

  ipcMain.handle('ec2:get-console-output', async (_event, params: { region: string; profile: string; source: string; instanceId: string }) => {
    try {
      const rateKey = `${params.profile}::${params.source}::${params.region}::${params.instanceId}`
      const now = Date.now()
      const last = consoleOutputLastCall.get(rateKey) ?? 0
      if (now - last < CONSOLE_OUTPUT_MIN_INTERVAL_MS) {
        const waitSec = Math.ceil((CONSOLE_OUTPUT_MIN_INTERVAL_MS - (now - last)) / 1000)
        throw new Error(`请求过于频繁，请 ${waitSec} 秒后再试（GetConsoleOutput 速率限制严格）`)
      }
      consoleOutputLastCall.set(rateKey, now)
      setSource(params)
      const { EC2Client, GetConsoleOutputCommand } = await import('@aws-sdk/client-ec2')
      const client = clientFactory.getClient(EC2Client, { region: params.region })
      const resp = await client.send(new GetConsoleOutputCommand({ InstanceId: params.instanceId }))
      return {
        output: resp.Output ? Buffer.from(resp.Output, 'base64').toString('utf-8') : '',
        timestamp: resp.Timestamp?.toISOString(),
        instanceId: resp.InstanceId,
      }
    } catch (err) { throw wrapErr(err, '获取控制台输出失败') }
  })
}
