import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Card, Input, Button, Space, Tag, Typography, List, Spin, Alert, Descriptions,
  App,
} from 'antd'
import {
  CodeOutlined, SendOutlined, ReloadOutlined, HistoryOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useT } from '../../i18n'

const { TextArea } = Input
const { Text } = Typography

const PRESET_COMMANDS = [
  { key: 'sysinfo', commands: ['uname -a', 'cat /etc/os-release', 'df -h', 'free -m'] },
  { key: 'process', commands: ['ps aux --sort=-%mem | head -20', 'top -bn1 | head -20'] },
  { key: 'network', commands: ['ss -tlnp', 'ip addr show', 'netstat -i'] },
  { key: 'disk', commands: ['df -h', 'lsblk', 'du -sh /* 2>/dev/null | sort -rh | head -10'] },
  { key: 'log', commands: ['journalctl -n 50 --no-pager', 'tail -100 /var/log/syslog 2>/dev/null || tail -100 /var/log/messages 2>/dev/null'] },
  { key: 'service', commands: ['systemctl list-units --type=service --state=running', 'systemctl status sshd 2>/dev/null || service sshd status 2>/dev/null'] },
  { key: 'docker', commands: ['docker ps -a', 'docker stats --no-stream'] },
  { key: 'security', commands: ['last -20', 'cat /etc/passwd', 'ss -tlnp'] },
] as const

interface CommandResult {
  commandId: string
  status: string
  output: string
  startTime?: string
  endTime?: string
}

interface SsmStatus {
  managed: boolean
  online: boolean
  agentVersion?: string
  platformName?: string
  pingStatus?: string
  lastPingDateTime?: string
  errorType?: string
  errorMessage?: string
}

export function RunCommand({ instanceId }: { instanceId: string }): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [ssmStatus, setSsmStatus] = useState<SsmStatus | null>(null)
  const [commands, setCommands] = useState('')
  const [executing, setExecuting] = useState(false)
  const [results, setResults] = useState<CommandResult[]>([])
  const [pollingId, setPollingId] = useState<string | null>(null)
  const pollTimer = useRef<NodeJS.Timeout | null>(null)

  const [ssmError, setSsmError] = useState<string | null>(null)
  const statusChecked = useRef(false)
  const commandAllowed = !!ssmStatus?.managed && !!ssmStatus?.online

  const presetCommands = useMemo(
    () => PRESET_COMMANDS.map((p) => ({
      ...p,
      label: t(`ec2.runCmd.preset.${p.key}`),
    })),
    [t],
  )

  const checkStatus = useCallback(async () => {
    if (statusChecked.current) return
    statusChecked.current = true
    setSsmError(null)
    try {
      const status = await window.electronAPI.ssm.checkManaged({
        region: activeRegion, profile: activeProfile, source: activeSource, instanceId,
      })
      setSsmStatus(status)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSsmError(msg)
      statusChecked.current = false
    }
  }, [instanceId, activeRegion, activeProfile, activeSource])

  useEffect(() => {
    statusChecked.current = false
    setSsmStatus(null)
    setSsmError(null)
  }, [instanceId, activeRegion, activeProfile, activeSource])

  useEffect(() => { checkStatus() }, [checkStatus])

  const handleExecute = async () => {
    const cmdList = commands.split('\n').filter((c) => c.trim())
    if (cmdList.length === 0) { message.warning(t('ec2.runCmd.enterCommand')); return }

    setExecuting(true)
    try {
      const result = await window.electronAPI.ssm.sendCommand({
        region: activeRegion, profile: activeProfile, source: activeSource,
        instanceId, commands: cmdList,
        comment: `Cloud Ops Manager - ${new Date().toLocaleString()}`,
      })
      setPollingId(result.commandId)
      message.success(t('ec2.runCmd.sent'))
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
      setExecuting(false)
    }
  }

  useEffect(() => {
    if (!pollingId) return
    let attempts = 0
    const MAX_ATTEMPTS = 30

    const poll = async () => {
      attempts++
      try {
        const inv = await window.electronAPI.ssm.getInvocation({
          region: activeRegion, profile: activeProfile, source: activeSource,
          commandId: pollingId, instanceId,
        })
        const terminal = ['Success', 'Failed', 'Cancelled', 'TimedOut', 'DeliveryTimedOut']
        if (terminal.includes(inv.status) || attempts >= MAX_ATTEMPTS) {
          setPollingId(null)
          setExecuting(false)
          setResults((prev) => [{ ...inv, commandId: pollingId }, ...prev])
          pollTimer.current && clearTimeout(pollTimer.current)
        }
      } catch { /* keep polling */ }
    }

    pollTimer.current = setInterval(poll, 2000)
    return () => { pollTimer.current && clearInterval(pollTimer.current) }
  }, [pollingId, instanceId, activeRegion, activeProfile, activeSource])

  const handlePreset = (preset: typeof presetCommands[number]) => {
    setCommands(preset.commands.join('\n'))
  }

  return (
    <div>
      <Card size="small" title={t('ec2.runCmd.ssmDiag')} style={{ marginBottom: 16 }}
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => { statusChecked.current = false; checkStatus() }}
          >
            {t('common.refresh')}
          </Button>
        }>
        {ssmError && (
          <Alert type="error" message={ssmError} style={{ marginBottom: 12 }} showIcon />
        )}
        {ssmStatus === null && !ssmError ? <Spin /> : ssmStatus === null ? null : (
          <Descriptions size="small" column={3}>
            <Descriptions.Item label={t('ec2.ssmManaged')}>
              <Tag color={ssmStatus.managed ? 'green' : 'red'}>
                {ssmStatus.managed ? t('ec2.ssmAvailable') : t('ec2.ssmUnavailable')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('ec2.runCmd.agentVersion')}>{ssmStatus.agentVersion || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('ec2.platform')}>{ssmStatus.platformName || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('ec2.runCmd.onlineStatus')}>
              <Tag color={ssmStatus.pingStatus === 'Online' ? 'green' : 'orange'}>
                {ssmStatus.pingStatus || t('ec2.runCmd.unknown')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('ec2.runCmd.lastOnline')}>
              {ssmStatus.lastPingDateTime ? new Date(ssmStatus.lastPingDateTime).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('ec2.runCommand')}>
              {commandAllowed
                ? <Tag color="green">{t('ec2.ssmAvailable')}</Tag>
                : <Tag color="red">{t('ec2.ssmUnavailable')}</Tag>
              }
            </Descriptions.Item>
          </Descriptions>
        )}

        {ssmStatus && !commandAllowed && (
          <Alert type="warning" style={{ marginTop: 12 }}
            message={t('ec2.runCmd.notManaged')}
            description={
              <div>
                <p>{t('ec2.runCmd.notManagedHint')}</p>
                {ssmStatus.errorType && (
                  <p><Text type="secondary">检测错误：{ssmStatus.errorType}{ssmStatus.errorMessage ? ` - ${ssmStatus.errorMessage}` : ''}</Text></p>
                )}
                <ol>
                  <li>{t('ec2.runCmd.notManagedLi1')}（<Text code>sudo snap install amazon-ssm-agent</Text>）</li>
                  <li>{t('ec2.runCmd.notManagedLi2')}</li>
                  <li>{t('ec2.runCmd.notManagedLi3')}</li>
                </ol>
              </div>
            }
          />
        )}
      </Card>

      <Card size="small" title={
        <Space><CodeOutlined /><span>{t('ec2.runCmd.title')}</span></Space>
      } style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('ec2.runCmd.presets')}</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {presetCommands.map((p) => (
              <Button key={p.key} size="small" onClick={() => handlePreset(p)}>{p.label}</Button>
            ))}
          </div>
        </div>

        <TextArea
          value={commands}
          onChange={(e) => setCommands(e.target.value)}
          placeholder={t('ec2.runCmd.placeholder')}
          rows={8}
          disabled={!commandAllowed}
          style={{ fontFamily: 'monospace', fontSize: 13, marginBottom: 12 }}
        />

        <Space>
          <Button
            type="primary"
            icon={executing ? <SyncOutlined spin /> : <SendOutlined />}
            onClick={handleExecute}
            loading={executing}
            disabled={!commandAllowed || !commands.trim()}
          >
            {executing ? t('ec2.runCmd.executing') : t('ec2.runCmd.execute')}
          </Button>
          <Button onClick={() => setCommands('')} disabled={!commands.trim()}>{t('ec2.runCmd.clear')}</Button>
        </Space>
      </Card>

      <Card size="small" title={<Space><HistoryOutlined /><span>{t('ec2.runCmd.history')}</span></Space>}>
        {results.length === 0 ? (
          <Text type="secondary">{t('ec2.runCmd.noHistory')}</Text>
        ) : (
          results.map((r) => (
            <div key={r.commandId} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Space>
                  <Tag>{r.commandId?.slice(0, 12)}...</Tag>
                  <Tag color={r.status === 'Success' ? 'green' : r.status === 'Failed' ? 'red' : 'orange'}>
                    {r.status === 'Success' ? <CheckCircleOutlined /> : r.status === 'Failed' ? <CloseCircleOutlined /> : <ClockCircleOutlined />}
                    {' '}{r.status}
                  </Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {r.startTime ? new Date(r.startTime).toLocaleString() : ''}
                  {r.endTime ? ` (${((new Date(r.endTime).getTime() - new Date(r.startTime!).getTime()) / 1000).toFixed(1)}s)` : ''}
                </Text>
              </div>
              <pre style={{
                background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 6,
                fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                maxHeight: 300, overflow: 'auto', margin: 0,
              }}>
                {r.output || t('ec2.runCmd.noOutput')}
              </pre>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
