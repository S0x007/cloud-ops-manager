import { useEffect, useState, useCallback, useMemo } from 'react'
import { App, Table, Tag, Typography, Button, Space, Popconfirm, Modal, Form, InputNumber, Input, Empty, Alert } from 'antd'
import { GlobalOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { useT } from '../../../i18n'

const { Title, Text } = Typography

interface HuaweiEip {
  id: string
  publicIpAddress: string
  status: string
  type: string
  bandwidthSize: number
  portId: string
  privateIpAddress: string
  createTime: string
}

function isBindable(e: HuaweiEip): boolean {
  return e.status === 'DOWN' && !e.portId
}

export function HuaweiEIPPage(): JSX.Element {
  const t = useT()
  const { message } = App.useApp()
  const { invoke: cloudInvoke, credentialId } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [eips, setEips] = useState<HuaweiEip[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allocOpen, setAllocOpen] = useState(false)
  const [assocOpen, setAssocOpen] = useState<HuaweiEip | null>(null)
  const [allocForm] = Form.useForm()
  const [assocForm] = Form.useForm()

  const invoke = useCallback(
    (action: string, payload: Record<string, unknown> = {}) =>
      cloudInvoke('eip', action, payload),
    [cloudInvoke],
  )

  const load = useCallback(async () => {
    if (!credentialId || currentProvider !== 'huawei') return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke('eip:list')
      if (result.success) setEips(result.data as HuaweiEip[])
      else setError(result.error || '未知错误')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [credentialId, currentProvider, invoke])

  useEffect(() => {
    if (currentProvider === 'huawei') load()
  }, [load, currentProvider])

  const handleAllocate = async () => {
    const vals = await allocForm.validateFields()
    try {
      const result = await invoke('eip:allocate', { bandwidthSize: vals.bandwidthSize || 5 })
      if (result.success) {
        message.success(t('eip.msgAllocated'))
        setAllocOpen(false)
        allocForm.resetFields()
        load()
      } else {
        message.error(result.error)
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRelease = async (publicipId: string) => {
    const result = await invoke('eip:release', { publicipId })
    if (result.success) {
      message.success(t('eip.msgReleased'))
      load()
    } else {
      message.error(result.error)
    }
  }

  const handleAssociate = async () => {
    if (!assocOpen) return
    const vals = await assocForm.validateFields()
    const result = await invoke('eip:associate', { publicipId: assocOpen.id, serverId: vals.serverId.trim() })
    if (result.success) {
      message.success(t('eip.msgAssociated'))
      setAssocOpen(null)
      load()
    } else {
      message.error(result.error)
    }
  }

  const handleDisassociate = async (publicipId: string) => {
    const result = await invoke('eip:disassociate', { publicipId })
    if (result.success) {
      message.success(t('eip.msgDisassociated'))
      load()
    } else {
      message.error(result.error)
    }
  }

  const columns = useMemo(() => [
    {
      title: t('eip.publicIp'),
      dataIndex: 'publicIpAddress',
      width: 160,
      render: (ip: string) => <Text copyable style={{ fontFamily: 'monospace' }}>{ip}</Text>,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      width: 260,
      render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text>,
    },
    {
      title: t('ec2.state'),
      dataIndex: 'status',
      width: 90,
      render: (s: string) => <Tag color={s === 'ACTIVE' ? 'green' : s === 'DOWN' ? 'default' : 'orange'}>{s}</Tag>,
    },
    { title: t('eip.type'), dataIndex: 'type', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('huawei.ecs.bandwidthSize'), dataIndex: 'bandwidthSize', width: 100 },
    {
      title: t('huawei.ecs.privateIp'),
      dataIndex: 'privateIpAddress',
      width: 140,
      render: (ip: string) => ip || '-',
    },
    {
      title: t('common.actions'),
      width: 220,
      render: (_: unknown, r: HuaweiEip) => (
        <Space size="small">
          {isBindable(r) && (
            <>
              <Button size="small" icon={<LinkOutlined />} onClick={() => { setAssocOpen(r); assocForm.resetFields() }}>
                {t('eip.associate')}
              </Button>
              <Popconfirm title={t('eip.confirmRelease')} onConfirm={() => handleRelease(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          {r.status === 'ACTIVE' && r.portId && (
            <Popconfirm title={t('eip.confirmDisassociate')} onConfirm={() => handleDisassociate(r.id)}>
              <Button size="small" icon={<DisconnectOutlined />}>{t('eip.disassociate')}</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [t, assocForm])

  if (currentProvider !== 'huawei') {
    return <Empty description={t('huawei.ecs.switchHint')} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}><GlobalOutlined style={{ color: '#CF0A2C', marginRight: 8 }} />{t('huawei.eip')}</Title>
          <Tag>{eips.length}</Tag>
        </Space>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAllocOpen(true)}>{t('eip.allocate')}</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>{t('common.refresh')}</Button>
        </Space>
      </div>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={eips}
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description={t('eip.noAddresses')} /> }}
        size="middle"
      />

      <Modal title={t('eip.allocate')} open={allocOpen} onCancel={() => setAllocOpen(false)} onOk={handleAllocate} destroyOnClose>
        <Form form={allocForm} layout="vertical" style={{ marginTop: 16 }} initialValues={{ bandwidthSize: 5 }}>
          <Form.Item name="bandwidthSize" label={t('huawei.ecs.bandwidthSize')} rules={[{ required: true }]}>
            <InputNumber min={1} max={2000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('eip.associate')} open={!!assocOpen} onCancel={() => setAssocOpen(null)} onOk={handleAssociate} destroyOnClose>
        <Form form={assocForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="serverId" label={t('huawei.ecs.id')} rules={[{ required: true }]}>
            <Input placeholder="ECS Server ID" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
