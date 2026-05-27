import { ipcMain } from 'electron'
import { clientFactory } from '../aws/client.factory'
import * as ssmService from '../aws/ssm.service'

function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}

function wrapError(err: unknown, prefix: string): Error {
  const msg = err instanceof Error ? err.message : String(err)
  return new Error(`${prefix}: ${msg}`)
}

export function registerSsmCommandIpc(): void {

  // 检查实例 SSM 状态
  ipcMain.handle('ssm:check-managed', async (_event, params: {
    region: string; profile: string; source: string; instanceId: string
  }) => {
    try {
      setSource(params)
      return await ssmService.checkSsmManaged(params.instanceId, params.region)
    } catch (err) { throw wrapError(err, 'SSM 状态检查失败') }
  })

  // 发送命令
  ipcMain.handle('ssm:send-command', async (_event, params: {
    region: string; profile: string; source: string;
    instanceId: string; commands: string[];
    workingDirectory?: string; timeoutSeconds?: number; comment?: string
  }) => {
    try {
      setSource(params)
      return await ssmService.sendCommand(params.region, params.instanceId, params.commands, {
        workingDirectory: params.workingDirectory,
        timeoutSeconds: params.timeoutSeconds,
        comment: params.comment,
      })
    } catch (err) { throw wrapError(err, '命令下发失败') }
  })

  // 查询命令执行结果
  ipcMain.handle('ssm:get-invocation', async (_event, params: {
    region: string; profile: string; source: string;
    commandId: string; instanceId: string
  }) => {
    try {
      setSource(params)
      return await ssmService.getCommandInvocation(params.region, params.commandId, params.instanceId)
    } catch (err) { throw wrapError(err, '获取命令结果失败') }
  })

  // 命令历史
  ipcMain.handle('ssm:list-commands', async (_event, params: {
    region: string; profile: string; source: string; instanceId: string
  }) => {
    try {
      setSource(params)
      return await ssmService.listRecentCommands(params.region, params.instanceId)
    } catch (err) { throw wrapError(err, '获取命令历史失败') }
  })
}
