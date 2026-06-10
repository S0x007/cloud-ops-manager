import { ipcMain, app } from 'electron'
import { checkForUpdates, downloadUpdate, getAppVersion, quitAndInstall } from '../updater'

function wrapErr(err: unknown, msg: string): Error {
  return new Error(`${msg}: ${err instanceof Error ? err.message : String(err)}`)
}

export function registerUpdaterIpc(): void {
  ipcMain.handle('app:get-version', () => {
    try {
      return {
        version: getAppVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
      }
    } catch (err) {
      throw wrapErr(err, '读取版本失败')
    }
  })

  ipcMain.handle('app:check-for-updates', async () => {
    try {
      return await checkForUpdates()
    } catch (err) {
      throw wrapErr(err, '检查更新失败')
    }
  })

  ipcMain.handle('app:download-update', async () => {
    try {
      return await downloadUpdate()
    } catch (err) {
      throw wrapErr(err, '下载更新失败')
    }
  })

  ipcMain.handle('app:quit-and-install', () => {
    try {
      quitAndInstall()
    } catch (err) {
      throw wrapErr(err, '安装更新失败')
    }
  })
}
