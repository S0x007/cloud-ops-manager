import { ipcMain, dialog, BrowserWindow, shell } from 'electron'

const store: Record<string, unknown> = {}

function wrapErr(err: unknown, msg: string): Error {
  return new Error(`${msg}: ${err instanceof Error ? err.message : String(err)}`)
}

export function registerAppIpc(): void {
  ipcMain.handle('app:get-store', (_event, key: string) => {
    try { return store[key] ?? null }
    catch (err) { throw wrapErr(err, '读取存储失败') }
  })

  ipcMain.handle('app:set-store', (_event, key: string, value: unknown) => {
    try { store[key] = value }
    catch (err) { throw wrapErr(err, '写入存储失败') }
  })

  ipcMain.handle('app:open-file-dialog', async (_event, options) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('无法获取当前窗口')
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        filters: options?.filters ?? [],
      })
      return result.canceled ? null : result.filePaths
    } catch (err) { throw wrapErr(err, '打开文件对话框失败') }
  })

  ipcMain.handle('app:save-file', async (_event, params: { content: string; defaultName: string }) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('无法获取当前窗口')
      const result = await dialog.showSaveDialog(win, {
        defaultPath: params.defaultName,
        filters: [{ name: 'PEM 文件', extensions: ['pem'] }, { name: '所有文件', extensions: ['*'] }],
      })
      if (result.canceled || !result.filePath) return null
      const { writeFileSync } = await import('fs')
      writeFileSync(result.filePath, params.content, { mode: 0o600 })
      return result.filePath
    } catch (err) { throw wrapErr(err, '保存文件失败') }
  })

  ipcMain.handle('app:save-file-dialog', async (_event, options) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('无法获取当前窗口')
      const result = await dialog.showSaveDialog(win, {
        defaultPath: options?.defaultPath,
        filters: options?.filters ?? [],
      })
      return result.canceled ? null : result.filePath
    } catch (err) { throw wrapErr(err, '保存文件对话框失败') }
  })

  ipcMain.handle('app:open-external', (_event, url: string) => {
    try {
      if (!url || !/^https?:\/\//i.test(url)) throw new Error('无效的 URL')
      shell.openExternal(url)
    } catch (err) { throw wrapErr(err, '打开外部链接失败') }
  })
}
