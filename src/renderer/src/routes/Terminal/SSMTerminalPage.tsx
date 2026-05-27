import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Space, Tag, Spin, Alert, Tooltip } from 'antd'
import {
  DisconnectOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Terminal } from 'xterm'
import { useSSM } from '../../hooks/useSSM'
import { useT } from '../../i18n'
import 'xterm/css/xterm.css'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export function SSMTerminalPage(): JSX.Element {
  const { instanceId } = useParams<{ instanceId: string }>()
  const navigate = useNavigate()
  const t = useT()
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)

  const {
    startSession,
    sendData,
    resize,
    closeSession,
    onOutput,
    onSessionEnd,
    onSessionError,
  } = useSSM()

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [errorMessage, setErrorMessage] = useState('')

  const connect = useCallback(async () => {
    if (!instanceId) return
    setConnectionState('connecting')
    setErrorMessage('')

    try {
      if (!xtermRef.current && terminalRef.current) {
        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: 13,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#d4d4d4',
            selectionBackground: '#264f78',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5',
            brightBlack: '#666666',
            brightRed: '#f14c4c',
            brightGreen: '#23d18b',
            brightYellow: '#f5f543',
            brightBlue: '#3b8eea',
            brightMagenta: '#d670d6',
            brightCyan: '#29b8db',
            brightWhite: '#e5e5e5',
          },
          allowProposedApi: true,
          allowTransparency: false,
        })

        term.open(terminalRef.current)
        term.focus()

        xtermRef.current = term
      }

      await startSession(instanceId)
      setConnectionState('connected')

      const unsubOutput = onOutput((data) => {
        xtermRef.current?.write(data)
      })
      const unsubEnd = onSessionEnd(() => {
        setConnectionState('disconnected')
        xtermRef.current?.write(`\r\n\x1b[33m${t('terminal.sessionEnded')}\x1b[0m\r\n`)
      })
      const unsubError = onSessionError((error) => {
        setConnectionState('error')
        setErrorMessage(error)
      })

      xtermRef.current?.onData((data) => {
        sendData(data)
      })

      const resizeObserver = new ResizeObserver(() => {
        if (xtermRef.current) {
          const dims = { cols: xtermRef.current.cols, rows: xtermRef.current.rows }
          resize(dims.cols, dims.rows)
        }
      })
      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current)
      }

      return () => {
        unsubOutput()
        unsubEnd()
        unsubError()
        resizeObserver.disconnect()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setConnectionState('error')
      setErrorMessage(msg)
    }
  }, [instanceId, startSession, sendData, resize, onOutput, onSessionEnd, onSessionError, t])

  useEffect(() => {
    let disposed = false
    let unsubCleanup: (() => void) | undefined

    connect().then((fn) => {
      if (disposed) {
        fn?.()
        return
      }
      unsubCleanup = fn
    })

    return () => {
      disposed = true
      unsubCleanup?.()
      closeSession()
      xtermRef.current?.dispose()
      xtermRef.current = null
    }
  }, [connect, closeSession])

  const handleDisconnect = () => {
    closeSession()
  }

  const statusLabel =
    connectionState === 'connected'
      ? t('terminal.connected')
      : connectionState === 'connecting'
        ? t('terminal.connecting')
        : connectionState === 'error'
          ? t('terminal.error')
          : t('terminal.disconnected')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '8px 16px',
          background: '#2d2d2d',
          borderBottom: '1px solid #3d3d3d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Space>
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ color: '#ccc' }}
            type="text"
          >
            {t('terminal.back')}
          </Button>
          <span style={{ color: '#ccc', fontSize: 13 }}>
            SSM: {instanceId}
          </span>
          <Tag
            color={
              connectionState === 'connected'
                ? 'green'
                : connectionState === 'connecting'
                  ? 'processing'
                  : connectionState === 'error'
                    ? 'error'
                    : 'default'
            }
          >
            {statusLabel}
          </Tag>
        </Space>
        <Space>
          <Tooltip title={t('terminal.reconnect')}>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={connect}
              type="text"
              style={{ color: '#ccc' }}
            />
          </Tooltip>
          <Button
            size="small"
            icon={<DisconnectOutlined />}
            onClick={handleDisconnect}
            type="text"
            danger
          >
            {t('terminal.disconnect')}
          </Button>
        </Space>
      </div>

      <div style={{ flex: 1, position: 'relative', background: '#1e1e1e' }}>
        {connectionState === 'connecting' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Spin tip={t('terminal.connectingSsm')} style={{ color: '#d4d4d4' }} />
          </div>
        )}

        {connectionState === 'error' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              padding: 24,
            }}
          >
            <Alert
              type="error"
              message={t('terminal.ssmFailed')}
              description={errorMessage}
              action={
                <Space direction="vertical">
                  <Button onClick={connect}>{t('common.retry')}</Button>
                  <Button onClick={() => navigate(-1)}>{t('terminal.back')}</Button>
                </Space>
              }
            />
          </div>
        )}

        <div
          ref={terminalRef}
          style={{
            width: '100%',
            height: '100%',
            padding: 8,
          }}
        />
      </div>
    </div>
  )
}
