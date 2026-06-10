import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tabs,
  Button,
  Space,
  Tag,
  Spin,
  Empty,
  Table,
  Popconfirm,
  Typography,
} from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  SyncOutlined,
  ArrowLeftOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useEC2 } from '../../hooks/useEC2'
import type { EC2Instance } from '../../stores/ec2Store'
import { RunCommand } from './RunCommand'
import { ConsoleOutput } from './ConsoleOutput'
import { EC2MetricsTab } from './EC2MetricsTab'
import { InlineVolumes } from './InlineVolumes'
import { useT } from '../../i18n'
import { formatAwsInstanceSpec } from '../../lib/instanceSpec'
import dayjs from 'dayjs'

const { Text } = Typography

const stateColorMap: Record<string, string> = {
  running: 'green',
  stopped: 'red',
  pending: 'orange',
  stopping: 'orange',
  terminating: 'red',
  terminated: 'default',
}

function stateLabel(state: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    running: t('ec2.running'),
    stopped: t('ec2.stopped'),
    pending: t('ec2.pending'),
    stopping: t('ec2.stopping'),
    terminating: t('ec2.terminating'),
    terminated: t('ec2.terminated'),
  }
  return map[state] ?? state
}

export function EC2InstanceDetail(): JSX.Element {
  const { instanceId } = useParams<{ instanceId: string }>()
  const navigate = useNavigate()
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const { startInstance, stopInstance, rebootInstance } = useEC2()

  const [instance, setInstance] = useState<EC2Instance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [specDisplay, setSpecDisplay] = useState('-')

  const loadInstance = useCallback(async () => {
    if (!instanceId) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.ec2.describeInstance({
        region: activeRegion,
        profile: activeProfile,
        source: activeSource,
        instanceId,
      })
      setInstance(result)
      if (result?.instanceType) {
        window.electronAPI.ec2.describeInstanceTypes({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          types: [result.instanceType],
        }).then((map: Record<string, { vcpu: number; memoryGiB: number }>) => {
          setSpecDisplay(formatAwsInstanceSpec(result.instanceType, t, map[result.instanceType]))
        }).catch(() => {
          setSpecDisplay(formatAwsInstanceSpec(result.instanceType, t))
        })
      } else {
        setSpecDisplay('-')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [instanceId, activeRegion, activeProfile, activeSource, t])

  useEffect(() => {
    loadInstance()
  }, [loadInstance])

  const handleAction = async (action: 'start' | 'stop' | 'reboot') => {
    if (!instanceId) return
    try {
      if (action === 'start') await startInstance(instanceId)
      else if (action === 'stop') await stopInstance(instanceId)
      else await rebootInstance(instanceId)
      await loadInstance()
    } catch (err) {
      console.error(err)
    }
  }

  const tabItems = useMemo(
    () =>
      instance
        ? [
            {
              key: 'details',
              label: t('ec2.basicInfo'),
              children: (
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label={t('ec2.instanceId')}>{instance.instanceId}</Descriptions.Item>
                  <Descriptions.Item label={t('common.name')}>{instance.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('ec2.spec')}>{specDisplay}</Descriptions.Item>
                  <Descriptions.Item label={t('ec2.platform')}>
                    {instance.platform === 'windows' ? 'Windows' : 'Linux'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('ec2.privateIp')}>
                    <Text copyable>{instance.privateIpAddress}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('ec2.publicIp')}>
                    {instance.publicIpAddress ? (
                      <Text copyable>{instance.publicIpAddress}</Text>
                    ) : (
                      '-'
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('ec2.vpcId')}>{instance.vpcId}</Descriptions.Item>
                  <Descriptions.Item label={t('ec2.subnetId')}>{instance.subnetId}</Descriptions.Item>
                  <Descriptions.Item label={t('ec2.az')}>{instance.availabilityZone}</Descriptions.Item>
                  <Descriptions.Item label={t('ec2.launchTime')}>
                    {instance.launchTime ? dayjs(instance.launchTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('ec2.ssmManaged')}>
                    {instance.ssmManaged ? (
                      <Tag color="green">{t('ec2.ssmAvailable')}</Tag>
                    ) : (
                      <Tag color="default">{t('ec2.ssmUnavailable')}</Tag>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'tags',
              label: t('ec2.tags'),
              children: (
                <Table
                  size="small"
                  dataSource={instance.tags}
                  columns={[
                    { title: t('ec2.tagKey'), dataIndex: 'key', key: 'key' },
                    { title: t('ec2.tagValue'), dataIndex: 'value', key: 'value' },
                  ]}
                  rowKey="key"
                  pagination={false}
                  locale={{ emptyText: t('ec2.noTags') }}
                />
              ),
            },
            {
              key: 'monitoring',
              label: t('ec2.monitoring'),
              children: <EC2MetricsTab instanceId={instance.instanceId} />,
            },
            {
              key: 'run-command',
              label: t('ec2.runCommand'),
              children: <RunCommand instanceId={instance.instanceId} />,
            },
            {
              key: 'console',
              label: t('ec2.console'),
              children: <ConsoleOutput instanceId={instance.instanceId} />,
            },
            {
              key: 'volumedetail',
              label: t('ec2.volumes'),
              children: <InlineVolumes instanceId={instance.instanceId} />,
            },
            {
              key: 'network',
              label: t('ec2.network'),
              children: (
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label={t('ec2.vpcId')}>{instance.vpcId}</Descriptions.Item>
                  <Descriptions.Item label={t('ec2.subnetId')}>{instance.subnetId}</Descriptions.Item>
                  <Descriptions.Item label={t('ec2.privateIp')}>{instance.privateIpAddress}</Descriptions.Item>
                  <Descriptions.Item label={t('ec2.publicIp')}>
                    {instance.publicIpAddress || t('ec2.none')}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
          ]
        : [],
    [instance, specDisplay, t],
  )

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip={t('ec2.loadingDetail')} />
      </div>
    )
  }

  if (error) {
    return (
      <Empty description={error}>
        <Button onClick={loadInstance}>{t('common.retry')}</Button>
      </Empty>
    )
  }

  if (!instance) {
    return <Empty description={t('ec2.notFound')} />
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ec2')}>
          {t('ec2.backToList')}
        </Button>
        <Tag color={stateColorMap[instance.state] ?? 'default'}>
          {stateLabel(instance.state, t)}
        </Tag>
        {instance.state === 'stopped' && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handleAction('start')}
          >
            {t('ec2.start')}
          </Button>
        )}
        {instance.state === 'running' && (
          <>
            <Popconfirm title={t('ec2.confirmStop')} onConfirm={() => handleAction('stop')}>
              <Button danger icon={<PauseCircleOutlined />}>
                {t('ec2.stop')}
              </Button>
            </Popconfirm>
            <Popconfirm title={t('ec2.confirmReboot')} onConfirm={() => handleAction('reboot')}>
              <Button icon={<SyncOutlined />}>{t('ec2.reboot')}</Button>
            </Popconfirm>
            <Button
              type="primary"
              icon={<CodeOutlined />}
              onClick={() => navigate(`/terminal/ssm/${instance.instanceId}`)}
            >
              {t('ec2.ssm')}
            </Button>
          </>
        )}
      </Space>

      <Card>
        <Tabs items={tabItems} destroyInactiveTabPane />
      </Card>
    </div>
  )
}
