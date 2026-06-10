import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Card, Table, Tag, Typography, Space, Button, Popconfirm, Tooltip, Skeleton, Empty, Alert, Input } from 'antd'
import { CloudServerOutlined, ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined, SyncOutlined, SearchOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { useI18n, useT } from '../../../i18n'
import { formatHuaweiFlavorSpec } from '../../../lib/instanceSpec'

const { Title, Text } = Typography

function useStatusMap(): Record<string, { color: string; text: string }> {
  const t = useT()
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
}

export function HuaweiECSListPage(): JSX.Element {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const statusMap = useStatusMap()
  const { invoke, credentialId } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const navigate = useNavigate()
  const { message } = App.useApp()
  const [servers, setServers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])

  const goToDetail = useCallback((serverId: string) => {
    navigate(`/huawei/ecs/${serverId}`)
  }, [navigate])

  const fetchServers = useCallback(async () => {
    if (!credentialId || currentProvider !== 'huawei') return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke('ecs', 'ecs:list', {})
      if (result.success) {
        const list = result.data as any[]
        const ids = list.map((s: any) => s.id)
        try {
          const agentR = await invoke('coc', 'coc:checkAgent', { serverIds: ids })
          if (agentR.success && agentR.data) {
            const agentMap = agentR.data as Record<string, string>
            for (const s of list) {
              s._agentState = String(agentMap[s.id] ?? 'UNKNOWN').toUpperCase()
            }
          }
        } catch { /* Agent 查询失败不影响列表 */ }
        setServers(list)
      } else {
        setError(result.error || '未知错误')
      }
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [credentialId, currentProvider, invoke])

  const invokeAction = useCallback(async (action: string, serverId: string, label: string) => {
    try {
      const result = await invoke('ecs', action, { serverId })
      if (result.success) {
        message.success(`${label}成功`)
        fetchServers()
      } else {
        message.error(result.error || `${label}失败`)
      }
    } catch (err: any) {
      message.error(err.message || String(err))
    }
  }, [invoke, fetchServers, message])

  const handleStart = useCallback((id: string) => invokeAction('ecs:start', id, '启动'), [invokeAction])
  const handleStop = useCallback((id: string) => invokeAction('ecs:stop', id, '停止'), [invokeAction])
  const handleReboot = useCallback((id: string) => invokeAction('ecs:reboot', id, '重启'), [invokeAction])

  const handleBatchAction = useCallback(async (action: 'ecs:batchStart' | 'ecs:batchStop', label: string) => {
    if (selectedRowKeys.length === 0) return
    try {
      const result = await invoke('ecs', action, { serverIds: selectedRowKeys })
      if (result.success) {
        message.success(`${label}成功 (${selectedRowKeys.length})`)
        setSelectedRowKeys([])
        fetchServers()
      } else {
        message.error(result.error || `${label}失败`)
      }
    } catch (err: any) {
      message.error(err.message || String(err))
    }
  }, [invoke, selectedRowKeys, fetchServers, message])

  const handleDelete = useCallback(async (serverId: string) => {
    try {
      const result = await invoke('ecs', 'ecs:delete', { serverId, deletePublicIp: true, deleteVolume: false })
      if (result.success) { message.success('删除成功'); fetchServers() }
      else message.error(result.error || '删除失败')
    } catch (err: any) { message.error(err.message || String(err)) }
  }, [invoke, fetchServers, message])

  useEffect(() => {
    if (currentProvider === 'huawei') fetchServers()
  }, [currentProvider, fetchServers])

  const filteredServers = useMemo(() => {
    if (!filterText.trim()) return servers
    const q = filterText.toLowerCase()
    return servers.filter((s: any) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q) ||
      (s.privateIp || '').includes(q)
    )
  }, [servers, filterText])

  const columns = useMemo(() => [
    {
      title: t('huawei.ecs.name'), dataIndex: 'name', key: 'name', width: 200,
      render: (n: string, r: any) => {
        const label = n || r.id
        return (
          <Button
            type="link"
            size="small"
            icon={<CloudServerOutlined style={{ color: '#CF0A2C' }} />}
            title={label}
            style={{
              padding: 0,
              height: 'auto',
              maxWidth: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goToDetail(r.id)
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {label}
            </span>
          </Button>
        )
      },
    },
    { title: t('huawei.ecs.id'), dataIndex: 'id', key: 'id', width: 200, render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text> },
    { title: t('huawei.ecs.status'), dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const m = statusMap[s] || { color: 'default', text: s }
        return <Tag color={m.color}>{m.text}</Tag>
      },
    },
    { title: 'Agent', dataIndex: '_agentState', key: 'agent', width: 80,
      render: (s: string) => {
        if (!s || s === 'UNKNOWN') return <Tag>未知</Tag>
        if (s === 'ONLINE') return <Tag color="green">在线</Tag>
        if (s === 'OFFLINE') return <Tag color="red">离线</Tag>
        if (s === 'INSTALLING') return <Tag color="processing">安装中</Tag>
        if (s === 'FAILED') return <Tag color="error">异常</Tag>
        if (s === 'UNINSTALLED') return <Tag color="default">未安装</Tag>
        return <Tag>{s}</Tag>
      },
    },
    { title: t('ec2.spec'), key: 'spec', width: 140, render: (_: any, r: any) => (
      <span style={{ fontSize: 12 }}>{formatHuaweiFlavorSpec(r.vcpus, r.memoryMB)}</span>
    )},
    { title: t('huawei.ecs.az'), dataIndex: 'availabilityZone', key: 'az', width: 120 },
    { title: t('huawei.ecs.privateIp'), dataIndex: 'privateIp', key: 'ip', width: 140, render: (ip: string) => <Text copyable style={{ fontSize: 12 }}>{ip || '-'}</Text> },
    { title: t('huawei.ecs.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 170, render: (d: string) => d ? new Date(d).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US') : '-' },
    { title: t('common.actions'), key: 'actions', width: 220,
      render: (_: any, record: any) => (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          <Button size="small" type="link" style={{ padding: 0 }}
            onClick={() => goToDetail(record.id)}>{t('common.detail')}</Button>
          {record.status === 'SHUTOFF' && (
            <Tooltip title={t('huawei.ecs.start')}>
              <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStart(record.id)} />
            </Tooltip>
          )}
          {record.status === 'ACTIVE' && (
            <>
              <Popconfirm title={t('huawei.ecs.confirmStop')} onConfirm={() => handleStop(record.id)}>
                <Tooltip title={t('huawei.ecs.stop')}>
                  <Button size="small" danger icon={<PauseCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
              <Popconfirm title={t('huawei.ecs.confirmReboot')} onConfirm={() => handleReboot(record.id)}>
                <Tooltip title={t('huawei.ecs.reboot')}>
                  <Button size="small" icon={<SyncOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title={t('common.delete')}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ], [t, lang, statusMap, goToDetail, handleStart, handleStop, handleReboot, handleDelete])

  if (currentProvider !== 'huawei') {
    return <Card><Empty description={t('huawei.ecs.switchHint')} /></Card>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <CloudServerOutlined style={{ marginRight: 8, color: '#CF0A2C' }} />
          {t('huawei.ecs')}
          {!loading && <Tag style={{ marginLeft: 8 }}>{t('huawei.ecs.total').replace('{n}', String(servers.length))}</Tag>}
        </Title>
        <Space>
          {selectedRowKeys.length > 0 && (
            <>
              <Popconfirm title={t('huawei.ecs.batchStartConfirm').replace('{n}', String(selectedRowKeys.length))} onConfirm={() => handleBatchAction('ecs:batchStart', t('huawei.ecs.start'))}>
                <Button type="primary" icon={<PlayCircleOutlined />}>{t('huawei.ecs.batchStart')} ({selectedRowKeys.length})</Button>
              </Popconfirm>
              <Popconfirm title={t('huawei.ecs.batchStopConfirm').replace('{n}', String(selectedRowKeys.length))} onConfirm={() => handleBatchAction('ecs:batchStop', t('huawei.ecs.stop'))}>
                <Button danger icon={<PauseCircleOutlined />}>{t('huawei.ecs.batchStop')} ({selectedRowKeys.length})</Button>
              </Popconfirm>
            </>
          )}
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索名称/ID/IP..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/huawei/ecs/create')}>{t('huawei.ecs.createInstance')}</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchServers} loading={loading}>{t('common.refresh')}</Button>
        </Space>
      </div>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 12 }} />}

      {loading && !servers.length ? (
        <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
      ) : (
        <Table columns={columns} dataSource={filteredServers} rowKey="id"
          loading={loading} pagination={{ pageSize: 20, showTotal: (n) => t('huawei.ecs.total').replace('{n}', String(n)) }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          locale={{ emptyText: <Empty description={filterText ? '无匹配的服务器' : t('huawei.ecs.noServers')} /> }}
          size="middle" scroll={{ x: 1200 }}
          onRow={(record) => ({
            onClick: (e) => {
              const target = e.target as HTMLElement
              if (target.closest('button, a, .ant-btn, .ant-popover, .ant-popconfirm')) return
              goToDetail(record.id)
            },
            style: { cursor: 'pointer' },
          })}
        />
      )}
    </div>
  )
}
