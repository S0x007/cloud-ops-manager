import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Table, Button, Space, Tag, Empty, Typography, Tabs, Drawer, Descriptions, App, Spin,
} from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, ContainerOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import type { ColumnsType } from 'antd/es/table'
import { useT } from '../../i18n'

const { Text } = Typography

interface ECSService {
  serviceArn: string
  serviceName: string
  status: string
  desiredCount: number
  runningCount: number
  pendingCount: number
  launchType: string
}

interface ECSTask {
  taskArn: string
  taskId: string
  lastStatus: string
  desiredStatus: string
  cpu: string
  memory: string
  group: string
  launchType: string
  containers?: Array<{
    name: string
    image: string
    lastStatus: string
    exitCode?: number
    cpu: string
    memory: string
  }>
}

export function ECSClusterDetail(): JSX.Element {
  const { clusterName = '' } = useParams<{ clusterName: string }>()
  const cluster = decodeURIComponent(clusterName)
  const navigate = useNavigate()
  const { message } = App.useApp()
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [services, setServices] = useState<ECSService[]>([])
  const [tasks, setTasks] = useState<ECSTask[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [taskDetail, setTaskDetail] = useState<ECSTask | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const baseParams = useMemo(
    () => ({ region: activeRegion, profile: activeProfile, source: activeSource }),
    [activeRegion, activeProfile, activeSource],
  )

  const loadServices = useCallback(async () => {
    if (!cluster) return
    setLoadingServices(true)
    try {
      const result = await window.electronAPI.ecs.listServices({ ...baseParams, cluster })
      setServices(result)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingServices(false)
    }
  }, [cluster, baseParams, message])

  const loadTasks = useCallback(async () => {
    if (!cluster) return
    setLoadingTasks(true)
    try {
      const result = await window.electronAPI.ecs.listTasks({ ...baseParams, cluster })
      setTasks(result)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingTasks(false)
    }
  }, [cluster, baseParams, message])

  const openTaskDetail = useCallback(async (taskId: string) => {
    setDetailLoading(true)
    setTaskDetail(null)
    try {
      const detail = await window.electronAPI.ecs.describeTask({ ...baseParams, cluster, taskId })
      setTaskDetail(detail)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally {
      setDetailLoading(false)
    }
  }, [cluster, baseParams, message])

  useEffect(() => {
    loadServices()
    loadTasks()
  }, [loadServices, loadTasks])

  const serviceColumns = useMemo<ColumnsType<ECSService>>(() => [
    { title: t('ecs.serviceName'), dataIndex: 'serviceName', render: (n: string) => <Text strong>{n}</Text> },
    { title: t('ec2.state'), dataIndex: 'status', width: 100, render: (s: string) => <Tag color={s === 'ACTIVE' ? 'green' : 'default'}>{s}</Tag> },
    { title: t('ecs.desiredCount'), dataIndex: 'desiredCount', width: 80 },
    { title: t('ecs.runningCount'), dataIndex: 'runningCount', width: 80, render: (n: number) => <Tag color="green">{n}</Tag> },
    { title: t('ecs.pendingTasks'), dataIndex: 'pendingCount', width: 80 },
    { title: t('ecs.launchType'), dataIndex: 'launchType', width: 100 },
  ], [t])

  const taskColumns = useMemo<ColumnsType<ECSTask>>(() => [
    {
      title: t('ecs.taskId'),
      dataIndex: 'taskId',
      render: (id: string) => <a onClick={() => openTaskDetail(id)}><Text code>{id}</Text></a>,
    },
    { title: t('ecs.lastStatus'), dataIndex: 'lastStatus', width: 120, render: (s: string) => <Tag>{s}</Tag> },
    { title: t('ecs.group'), dataIndex: 'group', width: 180, ellipsis: true },
    { title: t('ecs.cpu'), dataIndex: 'cpu', width: 70 },
    { title: t('ecs.memory'), dataIndex: 'memory', width: 80 },
    { title: t('ecs.launchType'), dataIndex: 'launchType', width: 100 },
  ], [t, openTaskDetail])

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ecs')}>{t('ecs.backToClusters')}</Button>
        <ContainerOutlined style={{ color: '#1677ff' }} />
        <h2 style={{ margin: 0 }}>{cluster}</h2>
        <Tag color="blue">{activeRegion}</Tag>
      </Space>

      <Tabs
        items={[
          {
            key: 'services',
            label: `${t('ecs.services')} (${services.length})`,
            children: (
              <div>
                <div style={{ marginBottom: 12, textAlign: 'right' }}>
                  <Button icon={<ReloadOutlined />} onClick={loadServices} loading={loadingServices}>{t('common.refresh')}</Button>
                </div>
                <Table
                  rowKey="serviceArn"
                  columns={serviceColumns}
                  dataSource={services}
                  loading={loadingServices}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: <Empty description={t('ecs.noServices')} /> }}
                  size="middle"
                />
              </div>
            ),
          },
          {
            key: 'tasks',
            label: `${t('ecs.runningTasks')} (${tasks.length})`,
            children: (
              <div>
                <div style={{ marginBottom: 12, textAlign: 'right' }}>
                  <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loadingTasks}>{t('common.refresh')}</Button>
                </div>
                <Table
                  rowKey="taskArn"
                  columns={taskColumns}
                  dataSource={tasks}
                  loading={loadingTasks}
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: <Empty description={t('ecs.noTasks')} /> }}
                  size="middle"
                />
              </div>
            ),
          },
        ]}
      />

      <Drawer
        title={t('ecs.taskDetail')}
        open={!!taskDetail || detailLoading}
        onClose={() => setTaskDetail(null)}
        width={560}
      >
        {detailLoading && !taskDetail ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : null}
        {taskDetail && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('ecs.taskId')}>{taskDetail.taskId}</Descriptions.Item>
              <Descriptions.Item label={t('ecs.lastStatus')}>{taskDetail.lastStatus}</Descriptions.Item>
              <Descriptions.Item label={t('ecs.group')}>{taskDetail.group}</Descriptions.Item>
              <Descriptions.Item label={t('ecs.cpu')}>{taskDetail.cpu}</Descriptions.Item>
              <Descriptions.Item label={t('ecs.memory')}>{taskDetail.memory}</Descriptions.Item>
              <Descriptions.Item label={t('ecs.launchType')}>{taskDetail.launchType}</Descriptions.Item>
            </Descriptions>
            <Text strong>{t('ecs.containers')}</Text>
            <Table
              style={{ marginTop: 8 }}
              size="small"
              rowKey="name"
              pagination={false}
              dataSource={taskDetail.containers ?? []}
              columns={[
                { title: t('common.name'), dataIndex: 'name' },
                { title: t('ecs.image'), dataIndex: 'image', ellipsis: true },
                { title: t('ecs.lastStatus'), dataIndex: 'lastStatus', width: 100 },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}
