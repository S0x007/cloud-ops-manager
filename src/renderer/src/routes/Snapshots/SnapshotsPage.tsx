import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Button, Space, Tag, Popconfirm, Empty, Typography, App } from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import type { ColumnsType } from 'antd/es/table'
import { useT, useI18n } from '../../i18n'

const { Text } = Typography

interface Snapshot {
  snapshotId: string; volumeId: string; volumeSize: number
  state: string; description: string; startTime: string; encrypted: boolean
}

function formatBytes(gb: number): string {
  return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb} GB`
}

export function SnapshotsPage(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)

  const countLabel = t('common.count')
    ? `${snapshots.length} ${t('common.count')}`
    : String(snapshots.length)

  const load = useCallback(async (forceRefresh = false) => {
    setSnapshots([])
    setLoading(true)
    try {
      const result = await window.electronAPI.ec2Volumes.listSnapshots({
        region: activeRegion, profile: activeProfile, source: activeSource, forceRefresh,
      })
      setSnapshots(result)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await window.electronAPI.ec2Volumes.deleteSnapshot({
        region: activeRegion, profile: activeProfile, source: activeSource, snapshotId: id,
      })
      message.success(t('snapshots.msgDeleted'))
      load()
    } catch (err: any) { message.error(err.message) }
  }, [activeRegion, activeProfile, activeSource, message, t, load])

  const columns = useMemo<ColumnsType<Snapshot>>(() => [
    { title: t('snapshots.id'), dataIndex: 'snapshotId', width: 180, render: (id: string) => <Text code>{id}</Text> },
    { title: t('snapshots.volumeId'), dataIndex: 'volumeId', width: 180, render: (id: string) => <Text code>{id}</Text> },
    { title: t('ebs.size'), dataIndex: 'volumeSize', width: 80, render: (s: number) => formatBytes(s) },
    { title: t('ebs.state'), dataIndex: 'state', width: 90, render: (s: string) => <Tag color={s === 'completed' ? 'green' : s === 'pending' ? 'orange' : 'default'}>{s}</Tag> },
    { title: t('ebs.encrypted'), dataIndex: 'encrypted', width: 60, render: (e: boolean) => e ? <Tag color="green">{t('common.yes')}</Tag> : <span>-</span> },
    { title: t('common.description'), dataIndex: 'description', render: (d: string) => d || '-' },
    {
      title: t('snapshots.startTime'), dataIndex: 'startTime', width: 170,
      render: (time: string) => {
        if (!time) return '-'
        const date = new Date(time)
        return isNaN(date.getTime()) ? '-' : date.toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US')
      },
    },
    {
      title: t('common.actions'), width: 80,
      render: (_: unknown, r: Snapshot) => (
        <Popconfirm title={t('snapshots.confirmDelete')} onConfirm={() => handleDelete(r.snapshotId)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ], [t, lang, handleDelete])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space><h2 style={{ margin: 0 }}>{t('snapshots.title')}</h2><Tag>{countLabel}</Tag></Space>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>{t('common.refresh')}</Button>
      </div>
      <Table dataSource={snapshots} rowKey="snapshotId" columns={columns} loading={loading} size="middle"
        pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description={t('snapshots.noSnapshots')} /> }} />
    </div>
  )
}
