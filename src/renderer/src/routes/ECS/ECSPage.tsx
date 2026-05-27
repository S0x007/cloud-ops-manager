import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Button, Space, Tag, Empty, Typography } from 'antd'
import { ReloadOutlined, ContainerOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import type { ColumnsType } from 'antd/es/table'
import { useT } from '../../i18n'

const { Text } = Typography

interface ECSCluster {
  clusterArn: string
  clusterName: string
  status: string
  runningTasksCount: number
  pendingTasksCount: number
  activeServicesCount: number
}

export function ECSPage(): JSX.Element {
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [clusters, setClusters] = useState<ECSCluster[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchClusters = useCallback(async (forceRefresh = false) => {
    setClusters([])
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.ecs.listClusters({
        region: activeRegion,
        profile: activeProfile,
        source: activeSource,
        forceRefresh,
      })
      setClusters(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setClusters([])
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [activeProfile, activeSource, activeRegion])

  useEffect(() => {
    fetchClusters()
  }, [fetchClusters])

  const columns = useMemo<ColumnsType<ECSCluster>>(() => [
    {
      title: t('ecs.clusterName'),
      dataIndex: 'clusterName',
      key: 'clusterName',
      render: (name: string, record) => (
        <div>
          <ContainerOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          <Text strong>{name}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.clusterArn}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: t('ec2.state'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: t('ecs.services'),
      dataIndex: 'activeServicesCount',
      key: 'services',
      width: 80,
    },
    {
      title: t('ecs.runningTasks'),
      dataIndex: 'runningTasksCount',
      key: 'runningTasks',
      width: 100,
      render: (count: number) => <Tag color="green">{count}</Tag>,
    },
    {
      title: t('ecs.pendingTasks'),
      dataIndex: 'pendingTasksCount',
      key: 'pendingTasks',
      width: 100,
      render: (count: number) =>
        count > 0 ? <Tag color="orange">{count}</Tag> : <span>0</span>,
    },
  ], [t])

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space>
          <h2 style={{ margin: 0 }}>{t('ecs.title')}</h2>
          <Tag color="blue">{activeRegion}</Tag>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => fetchClusters(true)} loading={loading}>
          {t('common.refresh')}
        </Button>
      </div>

      {error && (
        <div
          style={{
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            padding: '12px 16px',
            borderRadius: 6,
            marginBottom: 16,
            color: '#cf1322',
          }}
        >
          {error}
        </div>
      )}

      <Table<ECSCluster>
        columns={columns}
        dataSource={clusters}
        rowKey="clusterArn"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{
          emptyText: (
            <Empty description={t('ecs.noClusters')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ),
        }}
        size="middle"
      />
    </div>
  )
}
