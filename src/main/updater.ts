import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdateEventStatus =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'error'
  | 'progress'
  | 'downloaded'

export interface UpdateStatusPayload {
  status: UpdateEventStatus
  version?: string
  releaseNotes?: string
  percent?: number
  transferred?: number
  total?: number
  message?: string
}

let getMainWindow: (() => BrowserWindow | null) | null = null

function emit(payload: UpdateStatusPayload): void {
  const win = getMainWindow?.()
  win?.webContents.send('app:update-status', payload)
}

export function initAutoUpdater(getWindow: () => BrowserWindow | null): void {
  getMainWindow = getWindow

  if (!app.isPackaged) {
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    emit({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    emit({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    })
  })

  autoUpdater.on('update-not-available', () => {
    emit({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    emit({
      status: 'progress',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    emit({
      status: 'downloaded',
      version: info.version,
    })
  })

  autoUpdater.on('error', (err) => {
    emit({ status: 'error', message: err.message })
  })

  // 启动后延迟检查，避免阻塞首屏
  setTimeout(() => {
    checkForUpdates().catch(() => {})
  }, 8000)
}

export async function checkForUpdates(): Promise<{ ok: boolean; message?: string }> {
  if (!app.isPackaged) {
    return { ok: false, message: 'DEV_MODE' }
  }
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit({ status: 'error', message })
    return { ok: false, message }
  }
}

export async function downloadUpdate(): Promise<{ ok: boolean; message?: string }> {
  if (!app.isPackaged) {
    return { ok: false, message: 'DEV_MODE' }
  }
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit({ status: 'error', message })
    return { ok: false, message }
  }
}

export function quitAndInstall(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(false, true)
}

export function getAppVersion(): string {
  return app.getVersion()
}
