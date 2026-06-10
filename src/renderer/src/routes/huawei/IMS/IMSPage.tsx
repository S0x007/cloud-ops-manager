import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Typography, Button, Empty, Alert } from 'antd'
import { BuildOutlined, ReloadOutlined } from '@ant-design/icons'
import { HUAWEI_ID_COL, HUAWEI_NAME_COL, renderResourceId, renderResourceName } from '../shared/tableCells'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { useI18n, useT } from '../../../i18n'

const { Title } = Typography

function useStatusMap(): Record<string, { color: string; text: string }> {
  const t = useT()
  return {
    active: { color: 'green', text: t('huawei.status.available') },
    queued: { color: 'blue', text: t('huawei.status.queued') },
    saving: { color: 'blue', text: t('huawei.status.saving') },
    deleted: { color: 'gray', text: t('huawei.status.deleted') },
    killed: { color: 'red', text: t('huawei.status.killed') },
  }
}

export function HuaweiIMSPage(): JSX.Element {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const statusMap = useStatusMap()
  const { invoke, credentialId } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchImages = useCallback(async () => {
    if (!credentialId || currentProvider !== 'huawei') return
    setLoading(true); setError(null)
    try {
      const result = await invoke('ims', 'ims:list', {})
      if (result.success) setImages(result.data as any[])
      else setError(result.error || '未知错误')
    } catch (err: any) { setError(err.message || String(err)) }
    finally { setLoading(false) }
  }, [credentialId, currentProvider, invoke])

  useEffect(() => { if (currentProvider === 'huawei') fetchImages() }, [fetchImages])

  if (currentProvider !== 'huawei') return <div style={{ padding: 24 }}><Empty description={t('huawei.ecs.switchHint')} /></div>

  const columns = [
    {
      title: t('huawei.ims.name'), dataIndex: 'name', key: 'name', ...HUAWEI_NAME_COL,
      render: (n: string) => renderResourceName(n, <BuildOutlined style={{ color: '#CF0A2C' }} />),
    },
    {
      title: t('huawei.ims.id'), dataIndex: 'id', key: 'id', ...HUAWEI_ID_COL,
      render: (id: string) => renderResourceId(id),
    },
    { title: t('huawei.ims.status'), dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => {
        const m = statusMap[s] || { color: 'default', text: s }
        return <Tag color={m.color}>{m.text}</Tag>
      },
    },
    { title: t('huawei.ims.type'), dataIndex: 'type', key: 'type', width: 80, render: (tp: string) => tp === 'private' ? <Tag color="blue">{t('huawei.ims.typePrivate')}</Tag> : <Tag>{tp}</Tag> },
    { title: t('huawei.ims.os'), key: 'os', width: 150, render: (_: any, r: any) => `${r.osType || '-'} ${r.osVersion || ''}` },
    { title: t('huawei.ims.arch'), dataIndex: 'architecture', key: 'arch', width: 90 },
    { title: t('huawei.ims.minDisk'), dataIndex: 'minDisk', key: 'minDisk', width: 110,
      render: (v: number) => (v > 0 ? v : '-'),
    },
    { title: t('huawei.ims.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 170, render: (d: string) => d ? new Date(d).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US') : '-' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <BuildOutlined style={{ marginRight: 8, color: '#CF0A2C' }} />
          {t('huawei.ims')}
          {!loading && <Tag style={{ marginLeft: 8 }}>{t('huawei.ims.total').replace('{n}', String(images.length))}</Tag>}
        </Title>
        <Button icon={<ReloadOutlined />} onClick={fetchImages} loading={loading}>{t('common.refresh')}</Button>
      </div>
      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
      <Table columns={columns} dataSource={images} rowKey="id" loading={loading}
        pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description={t('huawei.ims.noImages')} /> }}
        size="middle" scroll={{ x: 1200 }} tableLayout="fixed" />
    </div>
  )
}
