import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Tag, Typography, Button, Empty, Alert } from 'antd'
import { DatabaseOutlined, ReloadOutlined } from '@ant-design/icons'
import { HUAWEI_ID_COL, HUAWEI_NAME_COL, renderResourceId, renderResourceName } from '../shared/tableCells'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { formatHuaweiFlavorSpec } from '../../../lib/instanceSpec'
import { useI18n, useT } from '../../../i18n'

const { Title } = Typography

function useStatusMap(): Record<string, { color: string; text: string }> {
  const t = useT()
  return {
    ACTIVE: { color: 'green', text: t('huawei.status.active') },
    BUILD: { color: 'blue', text: t('huawei.status.build') },
    FAILED: { color: 'red', text: t('huawei.status.failed') },
    FROZEN: { color: 'purple', text: t('huawei.status.frozen') },
    MODIFYING: { color: 'orange', text: t('huawei.status.modifying') },
    REBOOTING: { color: 'orange', text: t('huawei.status.rebooting') },
    RESTORING: { color: 'blue', text: t('huawei.status.restoring') },
    BACKINGUP: { color: 'blue', text: t('huawei.status.backingup') },
    STORAGEFULL: { color: 'red', text: t('huawei.status.storagefull') },
    DELETED: { color: 'gray', text: t('huawei.status.deleted') },
  }
}

export function HuaweiRDSPage(): JSX.Element {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const statusMap = useStatusMap()
  const navigate = useNavigate()
  const { invoke, credentialId } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [instances, setInstances] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInstances = useCallback(async () => {
    if (!credentialId || currentProvider !== 'huawei') return
    setLoading(true); setError(null)
    try {
      const result = await invoke('rds', 'rds:list', {})
      if (result.success) setInstances(result.data as any[])
      else setError(result.error || '未知错误')
    } catch (err: any) { setError(err.message || String(err)) }
    finally { setLoading(false) }
  }, [credentialId, currentProvider, invoke])

  useEffect(() => { if (currentProvider === 'huawei') fetchInstances() }, [fetchInstances])

  if (currentProvider !== 'huawei') return <div style={{ padding: 24 }}><Empty description={t('huawei.ecs.switchHint')} /></div>

  const columns = [
    {
      title: t('huawei.rds.name'), dataIndex: 'name', key: 'name', ...HUAWEI_NAME_COL,
      render: (n: string, r: any) => renderResourceName(n || r.id, <DatabaseOutlined style={{ color: '#CF0A2C' }} />, {
        onClick: () => navigate(`/huawei/rds/${r.id}`),
      }),
    },
    {
      title: t('huawei.rds.id'), dataIndex: 'id', key: 'id', ...HUAWEI_ID_COL,
      render: (id: string) => renderResourceId(id),
    },
    { title: t('huawei.rds.status'), dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => {
        const m = statusMap[s] || { color: 'default', text: s }
        return <Tag color={m.color}>{m.text}</Tag>
      },
    },
    { title: t('huawei.rds.engine'), key: 'engine', width: 140, render: (_: any, r: any) => `${r.engine} ${r.engineVersion}` },
    { title: t('ec2.spec'), key: 'spec', width: 140,
      render: (_: unknown, r: { vcpus?: number | string; memoryMB?: number | string }) => (
        <span style={{ fontSize: 12 }}>{formatHuaweiFlavorSpec(r.vcpus, r.memoryMB)}</span>
      ),
    },
    { title: t('huawei.rds.storage'), dataIndex: 'size', key: 'size', width: 90 },
    { title: t('huawei.rds.port'), dataIndex: 'port', key: 'port', width: 70 },
    { title: t('huawei.rds.privateIp'), dataIndex: 'privateIps', key: 'ip', width: 140, render: (ips: string[]) => ips?.join(', ') || '-' },
    { title: t('huawei.rds.ssl'), dataIndex: 'enableSsl', key: 'ssl', width: 60, render: (e: boolean) => e ? <Tag color="green">{t('huawei.rds.sslEnabled')}</Tag> : '-' },
    { title: t('huawei.rds.createdAt'), dataIndex: 'created', key: 'created', width: 170, render: (d: string) => d ? new Date(d).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US') : '-' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <DatabaseOutlined style={{ marginRight: 8, color: '#CF0A2C' }} />
          {t('huawei.rds')}
          {!loading && <Tag style={{ marginLeft: 8 }}>{t('huawei.rds.total').replace('{n}', String(instances.length))}</Tag>}
        </Title>
        <Button icon={<ReloadOutlined />} onClick={fetchInstances} loading={loading}>{t('common.refresh')}</Button>
      </div>
      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
      <Table columns={columns} dataSource={instances} rowKey="id" loading={loading}
        pagination={{ pageSize: 20, showTotal: (n) => t('huawei.rds.total').replace('{n}', String(n)) }}
        locale={{ emptyText: <Empty description={t('huawei.rds.noInstances')} /> }} size="middle"
        scroll={{ x: 1400 }} tableLayout="fixed" />
    </div>
  )
}
