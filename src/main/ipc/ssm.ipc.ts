import { ipcMain, BrowserWindow } from 'electron'
import { clientFactory } from '../aws/client.factory'
import { SsmSession } from '../terminal/ssm-session'
import { PortForwardSession } from '../terminal/port-forwarding'

let activeSession: SsmSession | null = null
let activePortForward: PortForwardSession | null = null

function getWin(): BrowserWindow | null { return BrowserWindow.getFocusedWindow() }
function setSource(params: { profile: string; source?: string }): void {
  clientFactory.setProfile(params.profile, (params.source as 'aws-config' | 'custom') || 'aws-config')
}
function wErr(e: unknown, m: string): Error {
  return new Error(`${m}: ${e instanceof Error ? e.message : String(e)}`)
}

export function registerSsmIpc(): void {
  ipcMain.handle('ssm:start-session', async (_event, params) => {
    try {
      setSource(params)
      const win = getWin()
      if (!win) throw new Error('无法获取当前窗口')
      if (activeSession) { await activeSession.close(); activeSession = null }
      activeSession = new SsmSession({
        instanceId: params.instanceId, region: params.region,
        onOutput: (data) => win.webContents.send('ssm:output', data),
        onError: (error) => win.webContents.send('ssm:error', error),
        onEnd: () => { win.webContents.send('ssm:session-ended'); activeSession = null },
      })
      await activeSession.start()
    } catch (err) { throw wErr(err, 'SSM会话启动失败') }
  })

  ipcMain.on('ssm:send-data', (_event, data: string) => {
    try { activeSession?.sendData(data) } catch { /* 忽略发送错误 */ }
  })
  ipcMain.on('ssm:resize', (_event, params: { cols: number; rows: number }) => {
    try { activeSession?.resize(params.cols, params.rows) } catch { /* 忽略 */ }
  })
  ipcMain.on('ssm:close-session', async () => {
    try { if (activeSession) { await activeSession.close(); activeSession = null } } catch { /* 忽略 */ }
  })

  ipcMain.handle('ssm:start-port-forwarding', async (_event, params) => {
    try {
      setSource(params)
      const win = getWin()
      if (!win) throw new Error('无法获取当前窗口')
      if (activePortForward) await activePortForward.stop()
      activePortForward = new PortForwardSession({
        instanceId: params.instanceId, region: params.region,
        remotePort: params.remotePort, localPort: params.localPort,
        onStatus: (status) => win.webContents.send('ssm:port-forward-status', status),
        onError: (error) => win.webContents.send('ssm:error', error),
      })
      await activePortForward.start()
      return { localPort: params.localPort }
    } catch (err) { throw wErr(err, '端口转发启动失败') }
  })

  ipcMain.on('ssm:stop-port-forwarding', async () => {
    try { if (activePortForward) { await activePortForward.stop(); activePortForward = null } } catch { /* 忽略 */ }
  })
}
