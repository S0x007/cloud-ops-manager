import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { App, Card, Tabs, Descriptions, Tag, Typography, Space, Button, Popconfirm, Empty, Skeleton, Table, Alert, Input, Modal } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, DatabaseOutlined, PlayCircleOutlined, PauseCircleOutlined, SyncOutlined } from '@ant-design/icons'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { useT } from '../../../i18n'
import { formatHuaweiFlavorSpec } from '../../../lib/instanceSpec'

const { Title, Text } = Typography

export function RDSInstanceDetail(): JSX.Element {
  const t = useT()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { instanceId } = useParams<{ instanceId: string }>()
  const { invoke: cloudInvoke } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [instance, setInstance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTabKey, setActiveTabKey] = useState('overview')

  // 备份
  const [backups, setBackups] = useState<any[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupModalOpen, setBackupModalOpen] = useState(false)
  const [backupName, setBackupName] = useState('')
  const [backupDesc, setBackupDesc] = useState('')
  const [backupCreating, setBackupCreating] = useState(false)

  // 参数
  const [configData, setConfigData] = useState<any>(null)
  const [configLoading, setConfigLoading] = useState(false)

  // 数据库用户
  const [dbUsers, setDbUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [resetUserName, setResetUserName] = useState('')
  const [resetUserPwd, setResetUserPwd] = useState('')
  const [pwdResetting, setPwdResetting] = useState(false)

  const invoke = useCallback((action: string, payload: Record<string, unknown> = {}) =>
    cloudInvoke('rds', action, payload), [cloudInvoke])

  const loadInstance = useCallback(async () => {
    if (!instanceId || currentProvider !== 'huawei') return
    setLoading(true); setError(null)
    try {
      const getResult = await invoke('rds:get', { instanceId })
      if (getResult.success) {
        setInstance(getResult.data)
        return
      }
      if (getResult.error?.includes('不支持的操作')) {
        const listResult = await invoke('rds:list', {})
        if (listResult.success) {
          const found = (listResult.data as any[])?.find((i) => i.id === instanceId)
          if (found) { setInstance(found); return }
          setError(t('ec2.notFound'))
          return
        }
        setError(listResult.error || getResult.error || '加载失败')
        return
      }
      setError(getResult.error || '加载失败')
    } catch (err: any) { setError(err.message || String(err)) }
    finally { setLoading(false) }
  }, [instanceId, currentProvider, invoke, t])

  const loadBackups = useCallback(async () => {
    if (!instanceId) return
    setBackupsLoading(true)
    try {
      const r = await invoke('rds:listBackups', { instanceId })
      if (r.success) setBackups(r.data as any[])
    } catch { /* ignore */ }
    finally { setBackupsLoading(false) }
  }, [instanceId, invoke])

  const loadConfig = useCallback(async () => {
    if (!instanceId) return
    setConfigLoading(true)
    try {
      const r = await invoke('rds:getConfig', { instanceId })
      if (r.success) {
        setConfigData(r.data)
      } else {
        setConfigData({ error: r.error || '获取参数失败', parameters: [] })
      }
    } catch (err: any) {
      setConfigData({ error: err.message || String(err), parameters: [] })
    }
    finally { setConfigLoading(false) }
  }, [instanceId, invoke])

  useEffect(() => { loadInstance() }, [loadInstance])

  const loadUsers = useCallback(async () => {
    if (!instanceId) return
    setUsersLoading(true)
    setUsersError(null)
    try {
      const r = await invoke('rds:listUsers', { instanceId })
      if (r.success) setDbUsers(r.data as any[])
      else setUsersError(r.error || '获取用户列表失败')
    } catch (err: any) { setUsersError(err.message || String(err)) }
    finally { setUsersLoading(false) }
  }, [instanceId, invoke])

  const handleTabChange = useCallback((key: string) => {
    setActiveTabKey(key)
    if (key === 'backups') loadBackups()
    if (key === 'params') loadConfig()
    if (key === 'users') loadUsers()
  }, [loadBackups, loadConfig, loadUsers])

  const handleCreateBackup = useCallback(async () => {
    if (!instanceId || !backupName.trim()) return
    setBackupCreating(true)
    try {
      const r = await invoke('rds:createBackup', { instanceId, name: backupName.trim(), description: backupDesc })
      if (r.success) { message.success(t('huawei.rds.backupCreated')); setBackupModalOpen(false); setBackupName(''); setBackupDesc(''); loadBackups() }
      else message.error(r.error || '创建失败')
    } catch (err: any) { message.error(err.message || String(err)) }
    finally { setBackupCreating(false) }
  }, [instanceId, backupName, backupDesc, invoke, loadBackups, message, t])

  const handleResetPwd = useCallback(async () => {
    if (!instanceId || !resetUserName || !resetUserPwd.trim()) return
    if (resetUserPwd.trim().length < 8 || resetUserPwd.trim().length > 32) {
      message.error('密码长度 8-32 位')
      return
    }
    setPwdResetting(true)
    try {
      const r = await invoke('rds:resetPassword', { instanceId, userName: resetUserName, newPassword: resetUserPwd.trim() })
      if (r.success) { message.success(`root 密码重置成功`); setPwdModalOpen(false); setResetUserPwd('') }
      else message.error(r.error || '重置失败')
    } catch (err: any) { message.error(err.message || String(err)) }
    finally { setPwdResetting(false) }
  }, [instanceId, resetUserName, resetUserPwd, invoke, message])

  const handleLifecycle = useCallback(async (action: 'rds:start' | 'rds:stop' | 'rds:restart', label: string) => {
    if (!instanceId) return
    try {
      const r = await invoke(action, { instanceId })
      if (r.success) { message.success(t('huawei.rds.lifecycleOk').replace('{action}', label)); loadInstance() }
      else message.error(r.error || `${label}失败`)
    } catch (err: any) { message.error(err.message || String(err)) }
  }, [instanceId, invoke, loadInstance, message, t])

  if (currentProvider !== 'huawei') return <Card><Empty description={t('huawei.ecs.switchHint')} /></Card>
  if (loading) return <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>
  if (error) return <Card><Empty description={error}><Button icon={<ReloadOutlined />} onClick={loadInstance}>{t('common.retry')}</Button></Empty></Card>
  if (!instance) return <Card><Empty description={t('ec2.notFound')} /></Card>

  const statusMap: Record<string, { color: string }> = {
    ACTIVE: { color: 'green' }, BUILD: { color: 'blue' }, FAILED: { color: 'red' },
    FROZEN: { color: 'cyan' }, MODIFYING: { color: 'orange' }, REBOOTING: { color: 'orange' },
    RESTORING: { color: 'blue' }, BACKINGUP: { color: 'blue' }, STORAGEFULL: { color: 'red' }, DELETED: { color: 'default' },
  }
  const lang = 'zh-CN'

  const tabItems = [
    {
      key: 'overview', label: t('huawei.rds.overview'), children: (
        <>
          <Descriptions bordered column={2} size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label={t('huawei.rds.id')}><Text code>{instance.id}</Text></Descriptions.Item>
            <Descriptions.Item label={t('common.name')}>{instance.name || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('common.status')}><Tag color={statusMap[instance.status]?.color}>{instance.status}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('huawei.rds.engine')}>{instance.engine} {instance.engineVersion}</Descriptions.Item>
            <Descriptions.Item label={t('ec2.spec')}>{formatHuaweiFlavorSpec(instance.vcpus, instance.memoryMB)}</Descriptions.Item>
            <Descriptions.Item label={t('huawei.rds.storage')}>{instance.size ? `${instance.size} GB` : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('huawei.rds.port')}>{instance.port || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('huawei.rds.privateIp')}><Text copyable>{(instance.privateIps || []).join(', ') || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label={t('huawei.rds.publicEndpoint')}><Text copyable>{(instance.publicIps || []).join(', ') || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label={t('ec2.vpcId')}>{instance.vpcId || '-'}</Descriptions.Item>
            <Descriptions.Item label="DB User">{instance.dbUserName || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('huawei.rds.ssl')}><Tag color={instance.enableSsl ? 'green' : 'default'}>{instance.enableSsl ? t('huawei.rds.sslEnabled') : t('common.no')}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('common.createdAt')}>{instance.created ? new Date(instance.created).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US') : '-'}</Descriptions.Item>
          </Descriptions>

          <Card title={t('huawei.rds.connectionInfo')} size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {instance.privateIps?.length > 0 && (
                <>
                  <div>
                    <Text strong>{t('huawei.rds.mysqlCommand')}:</Text>
                    <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 4 }}>
                      mysql -h {instance.privateIps[0]} -P {instance.port || 3306} -u {instance.dbUserName || 'root'} -p
                    </pre>
                  </div>
                  <div>
                    <Text strong>JDBC URL:</Text>
                    <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 4 }}>
                      jdbc:{(() => { const e = (instance.engine || '').toLowerCase(); if (e.includes('postgre')) return 'postgresql'; if (e.includes('sqlserver')) return 'sqlserver'; if (e.includes('mariadb')) return 'mariadb'; return 'mysql'; })()}://{instance.privateIps[0]}:{instance.port || 3306}/{instance.engine?.toLowerCase().includes('postgre') ? '' : '?useSSL=' + (instance.enableSsl ?? false)}
                    </pre>
                  </div>
                </>
              )}
              <div>
                <Text strong>{t('huawei.rds.privateEndpoint')}: </Text>
                <Text code copyable>{(instance.privateIps || []).join(', ') || '-'}:{instance.port || '-'}</Text>
              </div>
              {instance.publicIps?.length > 0 && (
                <div>
                  <Text strong>{t('huawei.rds.publicEndpoint')}: </Text>
                  <Text code copyable>{instance.publicIps.join(', ')}:{instance.port}</Text>
                </div>
              )}
            </Space>
          </Card>
        </>
      ),
    },
    {
      key: 'backups', label: t('huawei.rds.backups'), children: (
        <div style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 12 }}>
            <Button icon={<ReloadOutlined />} loading={backupsLoading} onClick={loadBackups}>{t('common.refresh')}</Button>
            <Button type="primary" onClick={() => { setBackupModalOpen(true); setBackupName(''); setBackupDesc('') }}>{t('huawei.rds.createBackup')}</Button>
          </Space>
          <Table dataSource={backups} rowKey="id" loading={backupsLoading} pagination={false} size="small"
            locale={{ emptyText: <Empty description={t('huawei.rds.noBackups')} /> }}
            columns={[
              { title: 'ID', dataIndex: 'id', render: (id: string) => <Text code style={{ fontSize: 11 }}>{id?.slice(0, 20)}...</Text> },
              { title: t('common.name'), dataIndex: 'name' },
              { title: t('huawei.rds.backupType'), dataIndex: 'type', width: 80, render: (v: string) => <Tag color={v === 'auto' ? 'blue' : 'green'}>{v}</Tag> },
              { title: t('huawei.rds.backupSize'), dataIndex: 'size', width: 80, render: (s: number) => s ? (s >= 1024 ? `${(s / 1024).toFixed(1)} MB` : `${s} KB`) : '-' },
              { title: t('common.status'), dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'COMPLETED' ? 'green' : v === 'BUILDING' ? 'processing' : 'default'}>{v}</Tag> },
              { title: t('huawei.rds.backupStartTime'), dataIndex: 'beginTime', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
              { title: t('huawei.rds.backupEndTime'), dataIndex: 'endTime', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
            ]}
          />
          <Modal
            title={t('huawei.rds.createBackup')}
            open={backupModalOpen}
            onCancel={() => setBackupModalOpen(false)}
            onOk={handleCreateBackup}
            confirmLoading={backupCreating}
            okButtonProps={{ disabled: !backupName.trim() }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ marginBottom: 4 }}>{t('huawei.rds.backupName')}</div>
                <Input value={backupName} onChange={(e) => setBackupName(e.target.value)} placeholder="backup-20260602" />
              </div>
              <div>
                <div style={{ marginBottom: 4 }}>{t('huawei.rds.backupDescription')}</div>
                <Input value={backupDesc} onChange={(e) => setBackupDesc(e.target.value)} placeholder={t('common.description')} />
              </div>
            </Space>
          </Modal>
        </div>
      ),
    },
    {
      key: 'params', label: t('huawei.rds.parameters'), children: (
        <div style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 12 }}>
            <Button icon={<ReloadOutlined />} loading={configLoading} onClick={loadConfig}>{t('common.refresh')}</Button>
            {configData?.datastoreName && (
              <Tag>{configData.datastoreName} {configData.datastoreVersionName}</Tag>
            )}
          </Space>
          {configData?.error && <Alert type="error" message={configData.error} closable style={{ marginBottom: 12 }} />}
          <Table dataSource={configData?.parameters || []} rowKey="name" loading={configLoading} pagination={false} size="small"
            locale={{ emptyText: <Empty description={t('huawei.rds.noParams')} /> }}
            columns={[
              { title: t('huawei.rds.paramName'), dataIndex: 'name', width: 200 },
              { title: t('huawei.rds.paramValue'), dataIndex: 'value', width: 120, render: (v: string) => <Text code>{v}</Text> },
              { title: t('huawei.rds.paramType'), dataIndex: 'type', width: 80, render: (v: string) => <Tag>{v}</Tag> },
              { title: t('huawei.rds.paramDescription'), dataIndex: 'description', ellipsis: true },
              { title: t('huawei.rds.paramRestartRequired'), dataIndex: 'restartRequired', width: 80, render: (v: boolean) => v ? <Tag color="orange">{t('huawei.rds.paramYes')}</Tag> : <Tag>{t('huawei.rds.paramNo')}</Tag> },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'users', label: t('huawei.rds.dbUsers'), children: (
        <div style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 12 }}>
            <Button icon={<ReloadOutlined />} loading={usersLoading} onClick={loadUsers}>{t('common.refresh')}</Button>
          </Space>

          <Card size="small" title={t('huawei.rds.rootAccount')} style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label={t('huawei.rds.userName')}>
                <Text code copyable>{instance.dbUserName || 'root'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color="blue">Root</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('huawei.rds.passwordHint')} span={2}>
                <Text type="secondary">密码仅创建时设置，无法查看明文。如需新密码请点击右侧按钮重置。</Text>
              </Descriptions.Item>
            </Descriptions>
            <Button type="primary" style={{ marginTop: 8 }} onClick={() => {
              setResetUserName(instance.dbUserName || 'root')
              setResetUserPwd('')
              setPwdModalOpen(true)
            }}>{t('huawei.rds.resetPassword')}</Button>
          </Card>

          {usersError && <Alert type="error" message={usersError} closable onClose={() => setUsersError(null)} style={{ marginBottom: 12 }} />}
          <Table dataSource={dbUsers} rowKey="name" loading={usersLoading} pagination={false} size="small"
            locale={{ emptyText: <Empty description={t('huawei.rds.noDbUsers')} /> }}
            columns={[
              { title: t('huawei.rds.userName'), dataIndex: 'name', width: 160 },
              { title: 'Host', dataIndex: 'hosts', width: 180, render: (h: string[]) => h?.join(', ') || '-' },
              { title: t('huawei.rds.userDatabases'), dataIndex: 'databases', render: (dbs: any[]) => dbs?.map((d: any) => `${d.name}${d.readonly ? '(R)' : ''}`).join(', ') || '-' },
              { title: t('common.actions'), width: 120, render: (_: any, r: any) => (
                <Button size="small" onClick={() => { setResetUserName(r.name); setResetUserPwd(''); setPwdModalOpen(true) }}>{t('huawei.rds.resetPassword')}</Button>
              )},
            ]}
          />

          <Modal
            title={t('huawei.rds.resetPasswordTitle')}
            open={pwdModalOpen}
            onCancel={() => setPwdModalOpen(false)}
            onOk={handleResetPwd}
            confirmLoading={pwdResetting}
            okButtonProps={{ disabled: !resetUserPwd.trim() }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>{t('huawei.rds.userName')}: </Text>
                <Text code>{resetUserName}</Text>
              </div>
              <Alert type="warning" showIcon message={resetUserName === (instance.dbUserName || 'root') ? '将重置实例根账号密码，操作立即生效。请确保应用侧同步更新密码。' : '重置后立即生效，请确保应用侧同步更新密码。'} style={{ marginTop: 8 }} />
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 4 }}>{t('huawei.rds.newPassword')}</div>
                <Input.Password value={resetUserPwd} onChange={(e) => setResetUserPwd(e.target.value)}
                  placeholder="8-32 位，须包含大小写字母、数字和特殊字符中至少三种" />
              </div>
            </Space>
          </Modal>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/huawei/rds')}>{t('ec2.backToList')}</Button>
          <DatabaseOutlined style={{ fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>{instance.name || instance.id}</Title>
          <Tag color={statusMap[instance.status]?.color}>{instance.status}</Tag>
        </Space>
        <Space>
          {instance.status !== 'ACTIVE' && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleLifecycle('rds:start', t('huawei.rds.start'))}>
              {t('huawei.rds.start')}
            </Button>
          )}
          {instance.status === 'ACTIVE' && (
            <>
              <Popconfirm title={t('huawei.rds.confirmStop')} onConfirm={() => handleLifecycle('rds:stop', t('huawei.rds.stop'))}>
                <Button danger icon={<PauseCircleOutlined />}>{t('huawei.rds.stop')}</Button>
              </Popconfirm>
              <Popconfirm title={t('huawei.rds.confirmRestart')} onConfirm={() => handleLifecycle('rds:restart', t('huawei.rds.restart'))}>
                <Button icon={<SyncOutlined />}>{t('huawei.rds.restart')}</Button>
              </Popconfirm>
            </>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadInstance}>{t('common.refresh')}</Button>
        </Space>
      </div>
      <Card><Tabs activeKey={activeTabKey} onChange={handleTabChange} items={tabItems} destroyOnHidden /></Card>
    </div>
  )
}
