import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { App, Card, Tabs, Descriptions, Tag, Typography, Space, Button, Popconfirm, Tooltip, Empty, Skeleton, Table, Select, Input, Alert, Modal, List } from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined, PauseCircleOutlined, SyncOutlined, ReloadOutlined, DeleteOutlined, CodeOutlined, SendOutlined, LinkOutlined, KeyOutlined, HistoryOutlined } from '@ant-design/icons'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { useT } from '../../../i18n'
import { formatHuaweiFlavorSpec } from '../../../lib/instanceSpec'

const { Title, Text } = Typography

const LINUX_COC_PRESETS = [
  { key: 'sysinfo', label: '系统信息', command: 'uname -a && cat /etc/os-release && df -h && free -m' },
  { key: 'process', label: '进程 Top', command: 'ps aux --sort=-%mem | head -20' },
  { key: 'network', label: '网络', command: 'ss -tlnp && ip addr show' },
  { key: 'disk', label: '磁盘', command: 'df -h && lsblk' },
  { key: 'log', label: '系统日志', command: 'journalctl -n 50 --no-pager 2>/dev/null || tail -50 /var/log/messages' },
] as const

const WIN_COC_PRESETS = [
  { key: 'sysinfo', label: '系统信息', command: 'systeminfo' },
  { key: 'process', label: '进程', command: 'tasklist' },
  { key: 'network', label: '网络', command: 'ipconfig /all && netstat -an' },
  { key: 'disk', label: '磁盘', command: 'wmic logicaldisk get size,freespace,caption' },
] as const

interface CocHistoryItem {
  id: string
  command: string
  status: string
  output: string
  time: string
}

export function ECSInstanceDetail(): JSX.Element {
  const t = useT()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { serverId } = useParams<{ serverId: string }>()
  const { invoke: cloudInvoke } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [server, setServer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [volumes, setVolumes] = useState<any[]>([])
  const [volLoading, setVolLoading] = useState(false)
  const [vncUrl, setVncUrl] = useState<string | null>(null)
  const [vncLoading, setVncLoading] = useState(false)
  const [vncError, setVncError] = useState<string | null>(null)
  const [activeTabKey, setActiveTabKey] = useState('basic')

  // COC 命令执行
  const [commandText, setCommandText] = useState('')
  const [commandTimeout, setCommandTimeout] = useState(60)
  const minTimeout = 6
  const [executing, setExecuting] = useState(false)
  const [execStatus, setExecStatus] = useState<string>('')
  const [cmdResult, setCmdResult] = useState<string>('')
  const [cmdError, setCmdError] = useState<string>('')
  const [jobId, setJobId] = useState<string>('')
  const [executeUser, setExecuteUser] = useState('root')
  const [agentState, setAgentState] = useState<string>('')
  const [pollCount, setPollCount] = useState(0)
  const [lastUpdateAt, setLastUpdateAt] = useState<string>('')
  const [cmdHistory, setCmdHistory] = useState<CocHistoryItem[]>([])

  // 默认密码
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [password, setPassword] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // 挂载云硬盘
  const [attachModalOpen, setAttachModalOpen] = useState(false)
  const [availableVolumes, setAvailableVolumes] = useState<any[]>([])
  const [availVolLoading, setAvailVolLoading] = useState(false)
  const [attachVolumeId, setAttachVolumeId] = useState<string | undefined>()
  const [attachDevice, setAttachDevice] = useState('/dev/vdb')
  const [attachLoading, setAttachLoading] = useState(false)

  // 弹性 IP
  const [eipModalOpen, setEipModalOpen] = useState(false)
  const [eipList, setEipList] = useState<any[]>([])
  const [eipSummary, setEipSummary] = useState<{ total: number; bindable: number; active: number; elb: number; down: number } | null>(null)
  const [eipLoading, setEipLoading] = useState(false)
  const [eipBinding, setEipBinding] = useState(false)

  const invoke = useCallback((action: string, payload: Record<string, unknown> = {}) =>
    cloudInvoke('ecs', action, payload), [cloudInvoke])

  const invokeEvs = useCallback((action: string, payload: Record<string, unknown> = {}) =>
    cloudInvoke('evs', action, payload), [cloudInvoke])

  const invokeEip = useCallback((action: string, payload: Record<string, unknown> = {}) =>
    cloudInvoke('eip', action, payload), [cloudInvoke])

  const loadVncConsole = useCallback(async () => {
    if (!serverId || currentProvider !== 'huawei') return
    setVncLoading(true)
    setVncError(null)
    setVncUrl(null)
    try {
      const vncR = await invoke('ecs:vncConsole', { serverId })
      if (vncR.success && (vncR.data as any)?.url) {
        setVncUrl(String((vncR.data as any).url))
      } else {
        setVncError(String(vncR.error || '未获取到 VNC 登录地址'))
      }
    } catch (err: any) {
      setVncError(err.message || String(err))
    } finally {
      setVncLoading(false)
    }
  }, [serverId, currentProvider, invoke])

  const loadServer = useCallback(async () => {
    if (!serverId || currentProvider !== 'huawei') return
    setLoading(true); setError(null)
    setVncUrl(null); setVncError(null)
    try {
      const getResult = await invoke('ecs:get', { serverId })
      let serverData: any = getResult.success ? getResult.data : null
      if (!serverData && getResult.error?.includes('不支持的操作')) {
        const listResult = await invoke('ecs:list', {})
        if (listResult.success) {
          serverData = (listResult.data as any[])?.find((s) => s.id === serverId) ?? null
        }
        if (!serverData) {
          setError(listResult.success ? t('ec2.notFound') : (listResult.error || getResult.error || '加载失败'))
          return
        }
      } else if (!getResult.success) {
        setError(getResult.error || '加载失败')
        return
      }
      setServer(serverData)
      if (/windows/i.test(String(serverData?.osType || ''))) {
        setExecuteUser('system')
      } else {
        setExecuteUser('root')
      }
      try {
        const agentR = await cloudInvoke('coc', 'coc:checkAgent', { serverIds: [serverId] })
        if (agentR.success && agentR.data) {
          const state = String((agentR.data as Record<string, string>)[serverId] ?? 'UNKNOWN').toUpperCase()
          setAgentState(state)
        }
      } catch { setAgentState('UNKNOWN') }
      setVolLoading(true)
      const vr = await invoke('ecs:listVolumes', { serverId })
      if (vr.success) setVolumes(vr.data as any[])
      setVolLoading(false)
    } catch (err: any) { setError(err.message || String(err)) }
    finally { setLoading(false) }
  }, [serverId, currentProvider, invoke, cloudInvoke, t])

  useEffect(() => { loadServer() }, [loadServer])

  useEffect(() => {
    if (activeTabKey === 'vnc' && server?.status === 'ACTIVE') {
      loadVncConsole()
    }
  }, [activeTabKey, server?.status, loadVncConsole])

  useEffect(() => {
    if (!serverId) return
    try {
      const raw = localStorage.getItem(`huawei-coc-history-${serverId}`)
      setCmdHistory(raw ? JSON.parse(raw) as CocHistoryItem[] : [])
    } catch {
      setCmdHistory([])
    }
  }, [serverId])

  const appendCmdHistory = useCallback((item: CocHistoryItem) => {
    if (!serverId) return
    setCmdHistory((prev) => {
      const next = [item, ...prev].slice(0, 20)
      localStorage.setItem(`huawei-coc-history-${serverId}`, JSON.stringify(next))
      return next
    })
  }, [serverId])

  const handleAction = useCallback(async (action: string, label: string) => {
    if (!serverId) return
    try {
      const r = await invoke(action, { serverId })
      if (r.success) { message.success(`${label}成功`); loadServer() }
      else message.error(r.error || `${label}失败`)
    } catch (err: any) { message.error(err.message || String(err)) }
  }, [serverId, invoke, loadServer, message])

  const handleDelete = useCallback(async () => {
    if (!serverId) return
    try {
      const r = await invoke('ecs:delete', { serverId, deletePublicIp: true, deleteVolume: false })
      if (r.success) { message.success('删除成功'); navigate('/huawei/ecs') }
      else message.error(r.error || '删除失败')
    } catch (err: any) { message.error(err.message || String(err)) }
  }, [serverId, invoke, navigate, message])

  const loadPassword = useCallback(async () => {
    if (!serverId) return
    setPasswordVisible(true)
    setPasswordError(null)
    setPassword(null)
    if (!server) {
      setPasswordError('实例信息尚未加载完成，请刷新后重试。')
      return
    }
    const os = String(server.osType || 'linux')
    if (!/windows/i.test(os)) {
      setPasswordError(`当前实例操作系统为 ${os}。华为云 ShowServerPassword 接口仅支持 Windows 实例，Linux 无初始密码可查。`)
      return
    }
    if (!server.keyName) {
      setPasswordError('该 Windows 实例创建时未绑定密钥对，API 不会返回初始密码。请使用创建时设置的登录密码，或在控制台重置密码。')
      return
    }
    setPasswordLoading(true)
    try {
      const r = await invoke('ecs:getPassword', { serverId })
      if (r.success && r.data) {
        setPassword(String(r.data))
      } else {
        const errMsg = r.error || t('huawei.ecs.noPassword')
        setPasswordError(errMsg.startsWith('NO_PASSWORD:') ? errMsg.replace(/^NO_PASSWORD:/, '') : errMsg)
      }
    } catch (err: any) {
      const errMsg = err.message || String(err)
      setPasswordError(errMsg.startsWith('NO_PASSWORD:') ? errMsg.replace(/^NO_PASSWORD:/, '') : errMsg)
    } finally {
      setPasswordLoading(false)
    }
  }, [serverId, invoke, t, server])

  const loadAvailableVolumes = useCallback(async () => {
    setAvailVolLoading(true)
    try {
      const r = await invokeEvs('evs:list', {})
      if (r.success) {
        setAvailableVolumes((r.data as any[]).filter((v: any) => v.status === 'available'))
      }
    } catch { /* ignore */ }
    finally { setAvailVolLoading(false) }
  }, [invokeEvs])

  const handleAttachVolume = useCallback(async () => {
    if (!serverId || !attachVolumeId) return
    setAttachLoading(true)
    try {
      const r = await invoke('ecs:attachVolume', { serverId, volumeId: attachVolumeId, device: attachDevice })
      if (r.success) { message.success(t('huawei.ecs.attachSuccess')); setAttachModalOpen(false); loadServer() }
      else message.error(r.error || '挂载失败')
    } catch (err: any) { message.error(err.message || String(err)) }
    finally { setAttachLoading(false) }
  }, [serverId, attachVolumeId, attachDevice, invoke, loadServer, message, t])

  const handleDetachVolume = useCallback(async (volumeId: string) => {
    if (!serverId) return
    try {
      const r = await invoke('ecs:detachVolume', { serverId, volumeId })
      if (r.success) { message.success(t('huawei.ecs.detachSuccess')); loadServer() }
      else message.error(r.error || '卸载失败')
    } catch (err: any) { message.error(err.message || String(err)) }
  }, [serverId, invoke, loadServer, message, t])

  const loadEipList = useCallback(async () => {
    setEipLoading(true)
    try {
      const r = await invokeEip('eip:list', {})
      if (r.success) {
        const all = r.data as any[]
        const filtered = all.filter((e: any) => e.status === 'DOWN' && !e.portId)
        const summary = {
          total: all.length,
          bindable: filtered.length,
          active: all.filter((e: any) => e.status === 'ACTIVE').length,
          elb: all.filter((e: any) => e.status === 'ELB').length,
          down: all.filter((e: any) => e.status === 'DOWN').length,
        }
        setEipSummary(summary)
        setEipList(filtered)
      } else {
        message.error(r.error || '加载弹性 IP 列表失败')
        setEipList([])
      }
    } catch (err: any) {
      message.error(err.message || String(err))
      setEipList([])
    }
    finally { setEipLoading(false) }
  }, [invokeEip, message])

  const handleBindEip = useCallback(async (publicipId: string) => {
    if (!serverId) return
    setEipBinding(true)
    try {
      const r = await invokeEip('eip:associate', { serverId, publicipId })
      if (r.success) { message.success(t('huawei.ecs.eipBound')); setEipModalOpen(false); loadServer() }
      else message.error(r.error || '绑定失败')
    } catch (err: any) { message.error(err.message || String(err)) }
    finally { setEipBinding(false) }
  }, [serverId, invokeEip, loadServer, message, t])

  const handleUnbindEip = useCallback(async () => {
    // 获取实例的公网 IP 对应的 EIP ID
    if (!server?.publicIp) return
    setEipBinding(true)
    try {
      const r = await invokeEip('eip:list', {})
      if (r.success) {
        const boundEip = (r.data as any[]).find((e: any) => e.publicIpAddress === server.publicIp)
        if (boundEip) {
          const dr = await invokeEip('eip:disassociate', { publicipId: boundEip.id })
          if (dr.success) { message.success(t('huawei.ecs.eipUnbound')); loadServer() }
          else message.error(dr.error || '解绑失败')
        } else {
          message.warning('未找到关联的弹性 IP')
        }
      }
    } catch (err: any) { message.error(err.message || String(err)) }
    finally { setEipBinding(false) }
  }, [server, invokeEip, loadServer, message, t])

  const statusMap: Record<string, { color: string; text: string }> = useMemo(() => {
    return {
      ACTIVE: { color: 'green', text: t('huawei.status.active') },
      SHUTOFF: { color: 'red', text: t('huawei.status.shutoff') },
      REBOOT: { color: 'orange', text: t('huawei.status.reboot') },
      HARD_REBOOT: { color: 'orange', text: t('huawei.status.hardReboot') },
      BUILD: { color: 'blue', text: t('huawei.status.build') },
      ERROR: { color: 'red', text: t('huawei.status.error') },
      VERIFY_RESIZE: { color: 'blue', text: t('huawei.status.verifying') },
      REVERT_RESIZE: { color: 'blue', text: t('huawei.status.reverting') },
    }
  }, [t])

  if (currentProvider !== 'huawei') return <Card><Empty description={t('huawei.ecs.switchHint')} /></Card>
  if (loading) return <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>
  if (error) return <Card><Empty description={error}><Button icon={<ReloadOutlined />} onClick={loadServer}>{t('common.retry')}</Button></Empty></Card>
  if (!server) return <Card><Empty description={t('ec2.notFound')} /></Card>

  const isRunning = server.status === 'ACTIVE'
  const isStopped = server.status === 'SHUTOFF'
  const isWindows = /windows/i.test(String(server.osType || ''))
  const lang = 'zh-CN' // TODO: i18n

  const renderAgentTag = (s?: string) => {
    const state = String(s || 'UNKNOWN').toUpperCase()
    if (!s || state === 'UNKNOWN') return <Tag>未知</Tag>
    if (state === 'ONLINE') return <Tag color="green">在线</Tag>
    if (state === 'OFFLINE') return <Tag color="red">离线</Tag>
    if (state === 'INSTALLING') return <Tag color="processing">安装中</Tag>
    if (state === 'FAILED') return <Tag color="error">异常</Tag>
    if (state === 'UNINSTALLED') return <Tag color="default">未安装</Tag>
    return <Tag>{state}</Tag>
  }

  const tabItems = [
    {
      key: 'basic', label: t('ec2.overview'), children: (
        <Descriptions bordered column={2} size="small" style={{ marginTop: 16 }}>
          <Descriptions.Item label={t('ec2.instanceId')}>{server.id}</Descriptions.Item>
          <Descriptions.Item label={t('common.name')}>{server.name || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('common.status')}><Tag color={statusMap[server.status]?.color}>{statusMap[server.status]?.text || server.status}</Tag></Descriptions.Item>
          <Descriptions.Item label={t('ec2.spec')}>{formatHuaweiFlavorSpec(server.vcpus, server.memoryMB)}</Descriptions.Item>
          <Descriptions.Item label={t('ec2.platform')}>{server.osType || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('ec2.az')}>{server.availabilityZone || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('ec2.publicIp')}><Text copyable>{server.publicIp || '-'}</Text></Descriptions.Item>
          <Descriptions.Item label={t('ec2.privateIp')}><Text copyable>{server.privateIp || '-'}</Text></Descriptions.Item>
          <Descriptions.Item label={t('common.createdAt')}>{server.createdAt ? new Date(server.createdAt).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Image ID"><Text code>{server.imageId || '-'}</Text></Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'disks', label: t('ec2.volumes'), children: (
        <div style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 12 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => { loadServer(); loadAvailableVolumes() }}
              loading={volLoading}
            >{t('common.refresh')}</Button>
            <Button
              type="primary"
              onClick={() => { setAttachModalOpen(true); loadAvailableVolumes() }}
            >{t('huawei.ecs.attachVolume')}</Button>
          </Space>
          <Table dataSource={volumes} rowKey="volumeId" loading={volLoading} pagination={false} size="small"
            locale={{ emptyText: <Empty description={t('huawei.ecs.noDisks')} /> }}
            columns={[
              { title: '卷 ID', dataIndex: 'volumeId', render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text> },
              { title: t('ec2.deviceName'), dataIndex: 'device', width: 120 },
              { title: t('ebs.size'), dataIndex: 'size', width: 100, render: (s: string) => s ? `${s} GB` : '-' },
              { title: t('common.actions'), width: 80, render: (_: any, record: any) => (
                <Popconfirm title={t('huawei.ecs.confirmDetach')} onConfirm={() => handleDetachVolume(record.volumeId)}>
                  <Button size="small" danger>{t('huawei.ecs.detachVolume')}</Button>
                </Popconfirm>
              )},
            ]}
          />
        </div>
      ),
    },
    {
      key: 'vnc', label: t('huawei.ecs.vncConsole'), children: (
        <div style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              message="VNC 使用说明"
              description="VNC 地址含一次性 token（约 10 分钟有效），请在打开本页签时获取。桌面客户端内嵌 iframe 可能被华为控制台拦截，推荐使用「在浏览器打开」。"
            />
            {!isRunning ? (
              <Alert type="warning" showIcon message="实例未运行" description="VNC 仅支持运行中（ACTIVE）的实例，请先启动实例后再连接。" />
            ) : (
              <>
                <Space wrap>
                  <Button icon={<ReloadOutlined />} loading={vncLoading} onClick={loadVncConsole}>
                    获取 VNC 地址
                  </Button>
                  {vncUrl && (
                    <Button type="primary" icon={<LinkOutlined />} onClick={() => window.electronAPI.app.openExternal(vncUrl)}>
                      在浏览器打开
                    </Button>
                  )}
                </Space>
                {vncError && (
                  <Alert type="error" showIcon message="获取 VNC 失败" description={vncError} />
                )}
                <div style={{ height: 500, background: '#1e1e1e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {vncLoading ? (
                    <Skeleton active paragraph={{ rows: 4 }} style={{ width: '80%' }} />
                  ) : vncUrl ? (
                    <iframe src={vncUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
                      title="VNC Console" allow="clipboard-read; clipboard-write" />
                  ) : (
                    <Empty description={vncError ? '请查看上方错误信息' : t('huawei.ecs.noVnc')} />
                  )}
                </div>
              </>
            )}
          </Space>
        </div>
      ),
    },
    {
      key: 'coc', label: t('huawei.ecs.runCommand'), children: (
        <div style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              message="执行说明"
              description={
                isWindows
                  ? 'Windows 实例需 UniAgent 在线，脚本类型为 BAT，执行用户固定为 system（不可修改）。示例：dir C:\\ && echo done'
                  : 'Linux 实例脚本类型为 Shell，默认执行用户 root。COC 显示 FINISHED 表示任务已完成；若命令无 stdout，页面会显示“无输出”。'
              }
            />
            {agentState && agentState !== 'ONLINE' && (
              <Alert
                type="warning"
                showIcon
                message={`UniAgent 状态：${agentState === 'UNKNOWN' ? '未知' : agentState}`}
                description="远程命令依赖 COC + UniAgent。请在华为云控制台确认已开通 COC，并在实例上安装/启动 UniAgent 后再执行命令。"
              />
            )}

            <Card size="small" title={t('huawei.ecs.cocPresets')}>
              <Space wrap>
                {(isWindows ? WIN_COC_PRESETS : LINUX_COC_PRESETS).map((p) => (
                  <Button key={p.key} size="small" onClick={() => setCommandText(p.command)}>
                    {p.label}
                  </Button>
                ))}
              </Space>
            </Card>

            {cmdHistory.length > 0 && (
              <Card size="small" title={<><HistoryOutlined /> {t('huawei.ecs.cocHistory')}</>}>
                <List
                  size="small"
                  dataSource={cmdHistory}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button key="reuse" type="link" size="small" onClick={() => setCommandText(item.command)}>
                          {t('huawei.ecs.cocReuse')}
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<Space size="small"><Text code style={{ fontSize: 11 }}>{item.command.slice(0, 80)}{item.command.length > 80 ? '…' : ''}</Text><Tag>{item.status}</Tag></Space>}
                        description={item.time}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            <Card size="small" title="执行配置">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Input.TextArea
                  rows={5}
                  placeholder={isWindows ? '输入 BAT 命令，如：dir C:\\ && echo done' : '输入 Shell 命令，如：df -h && echo done'}
                  value={commandText}
                  onChange={(e) => setCommandText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
                <Space wrap>
                  <span>{t('common.timeout')}:</span>
                  <Input
                    type="number"
                    min={minTimeout}
                    value={commandTimeout}
                    onChange={(e) => setCommandTimeout(Math.max(minTimeout, Number(e.target.value)))}
                    style={{ width: 100 }}
                    suffix="秒"
                  />
                  <span>脚本类型:</span>
                  <Tag>{isWindows ? 'BAT' : 'Shell'}</Tag>
                  <span>执行用户:</span>
                  {isWindows ? (
                    <Tag>system</Tag>
                  ) : (
                    <Select
                      value={executeUser}
                      onChange={(v) => setExecuteUser(v)}
                      style={{ width: 140 }}
                      options={[
                        { label: 'root', value: 'root' },
                        { label: 'ecs-user', value: 'ecs-user' },
                      ]}
                    />
                  )}
                  <span>Agent:</span>
                  {renderAgentTag(agentState)}
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={executing}
                    disabled={!commandText.trim()}
                    onClick={async () => {
                      if (!commandText.trim() || !serverId) return
                      setExecuting(true)
                      setCmdResult('')
                      setCmdError('')
                      setExecStatus('RUNNING')
                      setJobId('')
                      setPollCount(0)
                      setLastUpdateAt('')
                      try {
                        const r = await invoke('coc:runCommandAndWait', {
                          serverId,
                          command: commandText.trim(),
                          timeout: commandTimeout,
                          executeUser: isWindows ? 'system' : executeUser,
                          osType: server.osType,
                        })
                        if (!r.success) {
                          message.error(r.error || '执行失败')
                          setExecuting(false)
                          setExecStatus('ERROR')
                          return
                        }
                        const data = (r.data || {}) as any
                        setJobId(data.jobId || '')
                        setPollCount(Number(data.polls || 0))
                        setExecStatus(String(data.status || 'ERROR').toUpperCase())
                        setLastUpdateAt(new Date().toLocaleTimeString('zh-CN'))
                        if (data.error) setCmdError(String(data.error))
                        if (data.output) setCmdResult(String(data.output))
                        if (!data.output && !data.error && String(data.status || '').toUpperCase() === 'FINISHED') {
                          setCmdResult('(无输出)')
                        }
                        appendCmdHistory({
                          id: data.jobId || `${Date.now()}`,
                          command: commandText.trim(),
                          status: String(data.status || 'ERROR').toUpperCase(),
                          output: data.output || data.error || '(无输出)',
                          time: new Date().toLocaleString('zh-CN'),
                        })
                        setExecuting(false)
                      } catch (err: any) {
                        message.error(err.message || String(err))
                        setExecuting(false)
                        setExecStatus('ERROR')
                        setCmdError(err.message || String(err))
                      }
                    }}
                  >
                    {t('huawei.ecs.execute')}
                  </Button>
                </Space>
              </Space>
            </Card>

            <Card size="small" title="任务状态">
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="任务 ID">
                  {jobId ? <Text code copyable>{jobId}</Text> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="当前状态">
                  <Tag color={execStatus === 'RUNNING' || execStatus === 'PROCESSING' ? 'processing' : execStatus === 'FINISHED' ? 'green' : execStatus === 'TIMEOUT' ? 'orange' : execStatus ? 'red' : 'default'}>
                    {execStatus || '未开始'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="超时设置">{commandTimeout} 秒</Descriptions.Item>
                <Descriptions.Item label="轮询次数">{pollCount}</Descriptions.Item>
                <Descriptions.Item label="最近更新时间">{lastUpdateAt || '-'}</Descriptions.Item>
                <Descriptions.Item label="脚本类型">{isWindows ? 'BAT' : 'Shell'}</Descriptions.Item>
                <Descriptions.Item label="执行用户">{isWindows ? 'system' : executeUser}</Descriptions.Item>
                <Descriptions.Item label="UniAgent">{renderAgentTag(agentState)}</Descriptions.Item>
              </Descriptions>
            </Card>

            {cmdError && (
              <Alert
                type="error"
                message="执行失败"
                description={cmdError}
                closable
                onClose={() => setCmdError('')}
              />
            )}

            <Card size="small" title="输出结果">
              {cmdResult ? (
                <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
                  {cmdResult}
                </div>
              ) : (
                <Empty description={execStatus === 'FINISHED' ? '命令执行完成，但未产生标准输出' : '暂无输出'} />
              )}
            </Card>
          </Space>
        </div>
      ),
    },
    {
      key: 'network', label: t('huawei.ecs.network'), children: (
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label={t('ec2.vpcId')}>{server.vpcId || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('ec2.subnetId')}>{server.subnetId || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('ec2.publicIp')}>
              <Space>
                <Text copyable>{server.publicIp || '-'}</Text>
                {server.publicIp ? (
                  <Popconfirm title={t('huawei.ecs.confirmUnbindEip')} onConfirm={handleUnbindEip}>
                    <Button size="small" danger loading={eipBinding}>{t('huawei.ecs.unbindEip')}</Button>
                  </Popconfirm>
                ) : (
                  <Button size="small" type="primary" onClick={() => { setEipModalOpen(true); loadEipList() }}>{t('huawei.ecs.bindEip')}</Button>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={t('ec2.privateIp')}><Text copyable>{server.privateIp || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label={t('sidebar.sg')}>{(server.securityGroupIds || []).join(', ') || '-'}</Descriptions.Item>
          </Descriptions>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/huawei/ecs')}>{t('ec2.backToList')}</Button>
          <Title level={4} style={{ margin: 0 }}>{server.name || server.id}</Title>
          <Tag color={statusMap[server.status]?.color}>{statusMap[server.status]?.text || server.status}</Tag>
        </Space>
        <Space>
          {isStopped && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleAction('ecs:start', '启动')}>{t('huawei.ecs.start')}</Button>
          )}
          {isRunning && (
            <>
              <Popconfirm title={t('huawei.ecs.confirmStop')} onConfirm={() => handleAction('ecs:stop', '停止')}>
                <Button danger icon={<PauseCircleOutlined />}>{t('huawei.ecs.stop')}</Button>
              </Popconfirm>
              <Popconfirm title={t('huawei.ecs.confirmReboot')} onConfirm={() => handleAction('ecs:reboot', '重启')}>
                <Button icon={<SyncOutlined />}>{t('huawei.ecs.reboot')}</Button>
              </Popconfirm>
            </>
          )}
          <Popconfirm title={t('huawei.ecs.confirmDelete')} onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
          </Popconfirm>
          <Button icon={<KeyOutlined />} onClick={loadPassword} disabled={!server || loading}>{t('huawei.ecs.viewPassword')}</Button>
          <Button icon={<ReloadOutlined />} onClick={loadServer}>{t('common.refresh')}</Button>
        </Space>
      </div>
      <Card><Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={tabItems} destroyOnHidden /></Card>

      <Modal
        title={t('huawei.ecs.password')}
        open={passwordVisible}
        onCancel={() => { setPasswordVisible(false); setPassword(null); setPasswordError(null) }}
        footer={[
          <Button key="close" onClick={() => { setPasswordVisible(false); setPassword(null); setPasswordError(null) }}>{t('common.close')}</Button>,
          password && !passwordError ? (
            <Button key="copy" type="primary" onClick={() => {
              navigator.clipboard.writeText(password)
              message.success(t('huawei.ecs.copyPassword'))
            }}>{t('huawei.ecs.copyPassword')}</Button>
          ) : null,
        ]}
      >
        {passwordLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : passwordError ? (
          <Alert type="error" message={passwordError} showIcon />
        ) : password ? (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <Alert type="info" message={t('huawei.ecs.passwordHint')} showIcon style={{ marginBottom: 16 }} />
            <Input.Password value={password} readOnly style={{ fontSize: 16, fontFamily: 'monospace' }} />
          </div>
        ) : (
          <Empty description={t('huawei.ecs.noPassword')} />
        )}
      </Modal>

      <Modal
        title={t('huawei.ecs.attachVolumeTitle')}
        open={attachModalOpen}
        onCancel={() => { setAttachModalOpen(false); setAttachVolumeId(undefined); setAttachDevice('/dev/vdb') }}
        onOk={handleAttachVolume}
        confirmLoading={attachLoading}
        okButtonProps={{ disabled: !attachVolumeId }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 4 }}>{t('huawei.ecs.selectVolume')}</div>
            <Select
              style={{ width: '100%' }}
              value={attachVolumeId}
              onChange={(v) => setAttachVolumeId(v)}
              loading={availVolLoading}
              placeholder={t('huawei.ecs.selectVolume')}
              options={availableVolumes.map((v: any) => ({
                label: `${v.name || v.id} (${v.size}GB, ${v.type})`,
                value: v.id,
              }))}
              notFoundContent={<Empty description={t('huawei.ecs.noAvailableVol')} />}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>{t('huawei.ecs.deviceName')}</div>
            <Input value={attachDevice} onChange={(e) => setAttachDevice(e.target.value)} placeholder="/dev/vdb" />
          </div>
        </Space>
      </Modal>

      <Modal
        title={t('huawei.ecs.bindEip')}
        open={eipModalOpen}
        onCancel={() => setEipModalOpen(false)}
        footer={null}
      >
        <Table dataSource={eipList} rowKey="id" loading={eipLoading} pagination={false} size="small"
          locale={{
            emptyText: (
              <Empty description={
                eipSummary && eipSummary.total > 0
                  ? `当前区域共 ${eipSummary.total} 个弹性 IP，均已占用（ACTIVE ${eipSummary.active} 个，ELB ${eipSummary.elb} 个，DOWN ${eipSummary.down} 个）。绑定 ECS 需要状态为 DOWN 且未绑定的 EIP，请先在华为云 VPC 控制台申请新的弹性 IP。`
                  : t('huawei.ecs.noAvailableEip')
              } />
            ),
          }}
          columns={[
            { title: 'IP 地址', dataIndex: 'publicIpAddress', render: (ip: string, r: any) => <Text code copyable>{ip || r.public_ip_address || '-'}</Text> },
            { title: t('ec2.type'), dataIndex: 'type', width: 70 },
            { title: t('common.status'), dataIndex: 'status', width: 80, render: (s: string) => <Tag color={s === 'DOWN' ? 'default' : 'green'}>{s}</Tag> },
            { title: t('common.actions'), width: 80, render: (_: any, r: any) => (
              <Button size="small" type="primary" loading={eipBinding} onClick={() => handleBindEip(r.id)}>{t('huawei.ecs.bindEip')}</Button>
            )},
          ]}
        />
      </Modal>
    </div>
  )
}
