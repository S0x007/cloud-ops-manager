import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerAllIpcHandlers } from './ipc'
import { ProviderRegistry } from './providers/registry'
import { AwsProvider } from './providers/aws'
import { HuaweiProvider } from './providers/huawei'

import { initAutoUpdater } from './updater'

const isDev = process.env['NODE_ENV'] === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

function resolveAppIcon() {
  const candidates = isDev
    ? [join(__dirname, '../../resources/icon-mac.png')]
    : [join(process.resourcesPath, 'icon-mac.png'), join(process.resourcesPath, 'icon.png')]
  for (const p of candidates) {
    if (existsSync(p)) return nativeImage.createFromPath(p)
  }
  return undefined
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const appIcon = resolveAppIcon()

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    ...(appIcon ? { icon: appIcon } : {}),
    ...(isMac ? {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 16, y: 12 },
    } : {
      // Windows/Linux 使用系统标题栏，避免 hiddenInset 无效
      frame: true,
    }),
    title: 'Cloud Ops Manager',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] Renderer process gone:', details.reason, details.exitCode)
    if (details.reason === 'crashed' || details.reason === 'oom' || details.reason === 'killed') {
      mainWindow?.webContents.reload()
    }
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[main] Renderer became unresponsive')
  })

  mainWindow.webContents.on('responsive', () => {
    console.log('[main] Renderer responsive again')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ProviderRegistry.getInstance().register(new AwsProvider())
  ProviderRegistry.getInstance().register(new HuaweiProvider())
  registerAllIpcHandlers()
  createWindow()
  initAutoUpdater(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
