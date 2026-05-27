import { useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Popconfirm,
  Tooltip,
  Badge,
  Typography,
  Empty,
} from 'antd'
import {
  PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, SyncOutlined,
  CloudServerOutlined, SearchOutlined,
  CopyOutlined, CodeOutlined, StopOutlined,
} from '@ant-design/icons'
import { useEC2 } from '../../hooks/useEC2'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { ContextMenu, useContextMenu } from '../../components/Common/ContextMenu'
import type { ContextMenuItem } from '../../components/Common/ContextMenu'
import type { ColumnsType } from 'antd/es/table'
import type { EC2Instance } from '../../stores/ec2Store'
import dayjs from 'dayjs'
import { useT, useTf } from '../../i18n'

const { Text } = Typography

function describeInstanceType(type: string, t: (key: string) => string): string {
  const base = type.split('.')[0].replace(/\d/g, '')
  const sizePart = type.split('.')[1] || ''
  const famName = t(`ec2.family.${base}`) !== `ec2.family.${base}` ? t(`ec2.family.${base}`) : base.toUpperCase()
  const mult = sizePart.includes('xlarge') ? parseInt(sizePart) || 1 : 0
  const vCpu = mult > 0 ? mult * 4 : sizePart.includes('large') ? 2 : sizePart.includes('medium') ? 2 : 1
  const mem = mult > 0 && base === 'r' ? mult * 32 : mult > 0 && base === 'x' ? mult * 64 :
    mult > 0 && base === 't' ? mult * 4 : mult > 0 ? mult * 16 :
    sizePart.includes('large') ? 8 : sizePart.includes('medium') ? 4 : sizePart.includes('small') ? 2 : 1
  return t('ec2.specFormat').replace('{vcpu}', String(vCpu)).replace('{mem}', String(mem)).replace('{family}', famName)
}

function stateLabel(state: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    running: t('ec2.running'),
    stopped: t('ec2.stopped'),
    pending: t('ec2.pending'),
    stopping: t('ec2.stopping'),
    terminating: t('ec2.terminating'),
    terminated: t('ec2.terminated'),
    rebooting: t('ec2.rebooting'),
  }
  return map[state] ?? state
}

export function EC2Page(): JSX.Element | null {
  const navigate = useNavigate()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const t = useT()
  const tf = useTf()

  const {
    instances,
    isLoading,
    error,
    filterText,
    selectedInstances,
    setFilterText,
    setSelectedInstances,
    fetchInstances,
    startInstance,
    stopInstance,
    rebootInstance,
  } = useEC2()

  const contextMenu = useContextMenu()
  const handleRowContextMenu = useCallback((record: EC2Instance, e: React.MouseEvent) => {
    const items: ContextMenuItem[] = [
      { key: 'copy-id', label: t('ec2.copyId'), icon: <CopyOutlined />, onClick: () => navigator.clipboard.writeText(record.instanceId) },
      { key: 'div1', label: '', divider: true, onClick: () => {} },
      ...(record.state === 'running' ? [
        { key: 'ssm', label: t('ec2.ssm'), icon: <CodeOutlined />, disabled: !record.ssmManaged, onClick: () => navigate(`/terminal/ssm/${record.instanceId}`) },
        { key: 'stop', label: t('ec2.stopInstance'), icon: <PauseCircleOutlined />, danger: true, onClick: () => stopInstance(record.instanceId) },
        { key: 'reboot', label: t('ec2.rebootInstance'), icon: <SyncOutlined />, onClick: () => rebootInstance(record.instanceId) },
      ] : []),
      ...(record.state === 'stopped' ? [
        { key: 'start', label: t('ec2.startInstance'), icon: <PlayCircleOutlined />, onClick: () => startInstance(record.instanceId) },
        { key: 'terminate', label: t('ec2.terminateInstance'), icon: <StopOutlined />, danger: true, onClick: () => {/* TODO */} },
      ] : []),
      { key: 'div2', label: '', divider: true, onClick: () => {} },
      { key: 'detail', label: t('ec2.viewDetail'), onClick: () => navigate(`/ec2/${record.instanceId}`) },
    ]
    contextMenu.show(e, items)
  }, [contextMenu, navigate, startInstance, stopInstance, rebootInstance, t])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  const columns = useMemo<ColumnsType<EC2Instance>>(
    () => [
      {
        title: t('ec2.idName'),
        key: 'identity',
        width: 240,
        render: (_, record) => (
          <div>
            <a onClick={() => navigate(`/ec2/${record.instanceId}`)}>
              {record.instanceId}
            </a>
            {record.name && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.name}
                </Text>
              </div>
            )}
          </div>
        ),
      },
      {
        title: t('ec2.state'),
        dataIndex: 'state',
        key: 'state',
        width: 100,
        render: (s: string) => (
          <Badge
            status={s === 'running' ? 'success' : s === 'stopped' ? 'error' : 'processing'}
            text={stateLabel(s, t)}
          />
        ),
      },
      {
        title: t('ec2.type'),
        key: 'instanceType',
        width: 160,
        render: (_: unknown, record: EC2Instance) => {
          const desc = describeInstanceType(record.instanceType, t)
          return (
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: '18px' }}>{record.instanceType}</div>
              <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: '14px', marginTop: 2 }}>{desc}</div>
            </div>
          )
        },
      },
      {
        title: t('ec2.platform'),
        dataIndex: 'platform',
        key: 'platform',
        width: 70,
        render: (p: string) => {
          const os = (p || 'linux').toLowerCase()
          if (os === 'windows') return <Tag color="blue">Windows</Tag>
          return <Tag color="default">Linux</Tag>
        },
      },
      {
        title: t('ec2.publicIp'),
        dataIndex: 'publicIpAddress',
        key: 'publicIp',
        width: 140,
        render: (ip: string) =>
          ip ? <Text copyable>{ip}</Text> : <Text type="secondary">-</Text>,
      },
      {
        title: t('ec2.privateIp'),
        dataIndex: 'privateIpAddress',
        key: 'privateIp',
        width: 155,
        render: (ip: string) => <Text copyable style={{ whiteSpace: 'nowrap' }}>{ip}</Text>,
      },
      {
        title: t('ec2.az'),
        dataIndex: 'availabilityZone',
        key: 'az',
        width: 140,
      },
      {
        title: t('ec2.launchTime'),
        dataIndex: 'launchTime',
        key: 'launchTime',
        width: 160,
        render: (time: string) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: t('common.actions'),
        key: 'actions',
        width: 200,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            {record.state === 'stopped' && (
              <Tooltip title={t('ec2.start')}>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => startInstance(record.instanceId)}
                />
              </Tooltip>
            )}
            {record.state === 'running' && (
              <>
                <Popconfirm
                  title={t('ec2.confirmStop')}
                  onConfirm={() => stopInstance(record.instanceId)}
                >
                  <Tooltip title={t('ec2.stop')}>
                    <Button
                      size="small"
                      danger
                      icon={<PauseCircleOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
                <Popconfirm
                  title={t('ec2.confirmReboot')}
                  onConfirm={() => rebootInstance(record.instanceId)}
                >
                  <Tooltip title={t('ec2.reboot')}>
                    <Button
                      size="small"
                      icon={<SyncOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
            <Tooltip title={t('ec2.ssm')}>
              <Button
                size="small"
                type="link"
                onClick={() => navigate(`/terminal/ssm/${record.instanceId}`)}
                disabled={!record.ssmManaged}
              >
                SSH
              </Button>
            </Tooltip>
          </Space>
        ),
      },
    ],
    [startInstance, stopInstance, rebootInstance, navigate, t],
  )

  const countLabel = t('common.unit')
    ? `${instances.length} ${t('common.unit')}`
    : String(instances.length)

  if (!activeProfile) {
    return (
      <Empty
        description={t('common.configureProfile')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <Button type="primary" onClick={() => navigate('/settings')}>
          {t('common.goToSettings')}
        </Button>
      </Empty>
    )
  }

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
          <h2 style={{ margin: 0 }}>{t('ec2.title')}</h2>
          <Tag color="blue">{activeRegion}</Tag>
          <Tag>{countLabel}</Tag>
        </Space>
        <Space>
          <Input
            placeholder={t('ec2.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchInstances(true)}
            loading={isLoading}
          >
            {t('common.refresh')}
          </Button>
        </Space>
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
          <Button type="link" onClick={fetchInstances} style={{ marginLeft: 12 }}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      <Table<EC2Instance>
        columns={columns}
        dataSource={instances}
        rowKey="instanceId"
        loading={isLoading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => tf('common.total', { n: total }),
        }}
        scroll={{ x: 1300 }}
        onRow={(record) => ({
          onContextMenu: (e) => handleRowContextMenu(record, e),
        })}
        rowSelection={{
          selectedRowKeys: selectedInstances,
          onChange: (keys) => setSelectedInstances(keys as string[]),
        }}
        locale={{
          emptyText: (
            <Empty
              description={t('ec2.noInstances')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        size="middle"
      />
      <ContextMenu {...contextMenu} />
    </div>
  )
}
