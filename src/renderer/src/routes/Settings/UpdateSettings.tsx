import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Progress, Space, Typography } from 'antd'
import { CloudDownloadOutlined, ReloadOutlined, RocketOutlined } from '@ant-design/icons'
import { useT } from '../../i18n'

const { Text, Paragraph } = Typography

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'error'
  | 'progress'
  | 'downloaded'

interface AppVersionInfo {
  version: string
  platform: string
  arch: string
  isPackaged: boolean
}

interface UpdateStatusPayload {
  status: string
  version?: string
  releaseNotes?: string
  percent?: number
  message?: string
}

const RELEASE_PAGE = 'https://github.com/S0x007/cloud-ops-manager/releases/latest'

export function UpdateSettings(): JSX.Element {
  const t = useT()
  const { message } = App.useApp()
  const [appInfo, setAppInfo] = useState<AppVersionInfo | null>(null)
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setAppInfo).catch(() => {})
  }, [])

  useEffect(() => {
    const cleanup = window.electronAPI.app.onUpdateStatus((payload: UpdateStatusPayload) => {
      switch (payload.status) {
        case 'checking':
          setStatus('checking')
          setErrorMsg(null)
          break
        case 'available':
          setStatus('available')
          setRemoteVersion(payload.version ?? null)
          break
        case 'not-available':
          setStatus('not-available')
          message.success(t('update.upToDate'))
          break
        case 'progress':
          setStatus('progress')
          setProgress(Math.round(payload.percent ?? 0))
          break
        case 'downloaded':
          setStatus('downloaded')
          setRemoteVersion(payload.version ?? remoteVersion)
          message.success(t('update.downloaded'))
          break
        case 'error':
          setStatus('error')
          setErrorMsg(payload.message ?? t('update.error'))
          break
        default:
          break
      }
    })
    return cleanup
  }, [message, remoteVersion, t])

  const handleCheck = useCallback(async () => {
    if (!appInfo?.isPackaged) {
      message.info(t('update.devMode'))
      return
    }
    setStatus('checking')
    setErrorMsg(null)
    try {
      const r = await window.electronAPI.app.checkForUpdates()
      if (r.message === 'DEV_MODE') {
        message.info(t('update.devMode'))
        setStatus('idle')
      } else if (!r.ok && r.message) {
        setStatus('error')
        setErrorMsg(r.message)
      }
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }, [appInfo?.isPackaged, message, t])

  const handleDownload = useCallback(async () => {
    setStatus('progress')
    setProgress(0)
    try {
      const r = await window.electronAPI.app.downloadUpdate()
      if (!r.ok && r.message) {
        setStatus('error')
        setErrorMsg(r.message)
      }
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const handleInstall = useCallback(() => {
    window.electronAPI.app.quitAndInstall()
  }, [])

  const handleOpenRelease = useCallback(() => {
    window.electronAPI.app.openExternal(RELEASE_PAGE)
  }, [])

  return (
    <Card title={t('update.title')}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Text type="secondary">
          {t('update.current')}: <Text code>{appInfo?.version ?? '…'}</Text>
          {appInfo ? ` · ${appInfo.platform}/${appInfo.arch}` : ''}
        </Text>

        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            loading={status === 'checking'}
            onClick={handleCheck}
          >
            {t('update.check')}
          </Button>
          {status === 'available' && (
            <Button type="primary" icon={<CloudDownloadOutlined />} onClick={handleDownload}>
              {t('update.download').replace('{version}', remoteVersion ?? '')}
            </Button>
          )}
          {status === 'downloaded' && (
            <Button type="primary" icon={<RocketOutlined />} onClick={handleInstall}>
              {t('update.install')}
            </Button>
          )}
          <Button type="link" onClick={handleOpenRelease}>
            {t('update.manual')}
          </Button>
        </Space>

        {status === 'progress' && (
          <Progress percent={progress} status="active" />
        )}

        {status === 'error' && errorMsg && (
          <Paragraph type="danger" style={{ marginBottom: 0 }}>{errorMsg}</Paragraph>
        )}

        <Text type="secondary" style={{ fontSize: 12 }}>{t('update.hint')}</Text>
      </Space>
    </Card>
  )
}
