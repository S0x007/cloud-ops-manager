import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Tag, Typography, Button, Empty, Alert, Space, Modal, Form, Input,
  InputNumber, Select, Popconfirm, App,
} from 'antd'
import { HddOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined, ExpandAltOutlined, LinkOutlined } from '@ant-design/icons'
import { HUAWEI_ID_COL, HUAWEI_NAME_COL, renderResourceId, renderResourceName } from '../shared/tableCells'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { useI18n, useT } from '../../../i18n'

const { Title } = Typography

const VOLUME_TYPES = ['SSD', 'GPSSD', 'SAS', 'SATA', 'ESSD', 'GPSSD2', 'ESSD2']

function useStatusMap(): Record<string, { color: string; text: string }> {
  const t = useT()
  return {
    available: { color: 'blue', text: t('huawei.status.available') },
    'in-use': { color: 'green', text: t('huawei.status.inUse') },
    error: { color: 'red', text: t('huawei.status.error') },
    attaching: { color: 'orange', text: t('huawei.status.attaching') },
    detaching: { color: 'orange', text: t('huawei.status.detaching') },
    creating: { color: 'blue', text: t('huawei.status.creating') },
  }
}

export function HuaweiEVSPage(): JSX.Element {
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const statusMap = useStatusMap()
  const { message } = App.useApp()
  const { invoke, credentialId } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [volumes, setVolumes] = useState<any[]>([])
  const [servers, setServers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [expandVol, setExpandVol] = useState<any | null>(null)
  const [attachVol, setAttachVol] = useState<any | null>(null)
  const [createForm] = Form.useForm()
  const [expandForm] = Form.useForm()
  const [attachForm] = Form.useForm()

  const fetchVolumes = useCallback(async () => {
    if (!credentialId || currentProvider !== 'huawei') return
    setLoading(true); setError(null)
    try {
      const result = await invoke('evs', 'evs:list')
      if (result.success) setVolumes(result.data as any[])
      else setError(result.error || '未知错误')
    } catch (err: any) { setError(err.message || String(err)) }
    finally { setLoading(false) }
  }, [credentialId, currentProvider, invoke])

  const fetchServers = useCallback(async () => {
    const r = await invoke('ecs', 'ecs:list')
    if (r.success) setServers(r.data as any[])
  }, [invoke])

  useEffect(() => {
    if (currentProvider === 'huawei') {
      fetchVolumes()
      fetchServers()
    }
  }, [fetchVolumes, fetchServers, currentProvider])

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    const r = await invoke('evs', 'evs:create', values)
    if (r.success) {
      message.success(t('huawei.evs.created'))
      setCreateOpen(false)
      createForm.resetFields()
      fetchVolumes()
    } else message.error(r.error || t('common.error'))
  }

  const handleDelete = async (volumeId: string) => {
    const r = await invoke('evs', 'evs:delete', { volumeId })
    if (r.success) { message.success(t('huawei.evs.deleted')); fetchVolumes() }
    else message.error(r.error || t('common.error'))
  }

  const handleExpand = async () => {
    if (!expandVol) return
    const values = await expandForm.validateFields()
    const r = await invoke('evs', 'evs:resize', { volumeId: expandVol.id, newSize: values.newSize })
    if (r.success) {
      message.success(t('huawei.evs.expanded'))
      setExpandVol(null)
      expandForm.resetFields()
      fetchVolumes()
    } else message.error(r.error || t('common.error'))
  }

  const handleAttach = async () => {
    if (!attachVol) return
    const values = await attachForm.validateFields()
    const r = await invoke('ecs', 'ecs:attachVolume', {
      serverId: values.serverId,
      volumeId: attachVol.id,
      device: values.device || '/dev/vdb',
    })
    if (r.success) {
      message.success(t('huawei.ecs.attachSuccess'))
      setAttachVol(null)
      attachForm.resetFields()
      fetchVolumes()
    } else message.error(r.error || t('common.error'))
  }

  const handleDetach = async (volume: any) => {
    const serverId = volume.attachedTo?.[0]
    if (!serverId) return
    const r = await invoke('ecs', 'ecs:detachVolume', { serverId, volumeId: volume.id })
    if (r.success) { message.success(t('huawei.ecs.detachSuccess')); fetchVolumes() }
    else message.error(r.error || t('common.error'))
  }

  if (currentProvider !== 'huawei') return <Card><Empty description={t('huawei.ecs.switchHint')} /></Card>

  const azOptions = [...new Set(volumes.map((v) => v.availabilityZone).filter(Boolean))]

  const columns = [
    {
      title: t('huawei.evs.name'), dataIndex: 'name', key: 'name', ...HUAWEI_NAME_COL,
      render: (n: string) => renderResourceName(n || '-', <HddOutlined style={{ color: '#CF0A2C' }} />),
    },
    {
      title: t('huawei.evs.id'), dataIndex: 'id', key: 'id', ...HUAWEI_ID_COL,
      render: (id: string) => renderResourceId(id),
    },
    { title: t('huawei.evs.status'), dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => { const m = statusMap[s] || { color: 'default', text: s }; return <Tag color={m.color}>{m.text}</Tag> },
    },
    { title: t('huawei.evs.size'), dataIndex: 'size', key: 'size', width: 90, render: (s: number) => `${s} GB` },
    { title: t('huawei.evs.type'), dataIndex: 'type', key: 'type', width: 100 },
    { title: t('huawei.evs.az'), dataIndex: 'availabilityZone', key: 'az', width: 120 },
    { title: t('huawei.evs.attachedTo'), dataIndex: 'attachedTo', key: 'attached', width: 140, render: (a: string[]) => a?.join(', ') || '-' },
    { title: t('huawei.evs.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 170, render: (d: string) => d ? new Date(d).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US') : '-' },
    {
      title: t('common.actionsCol'), key: 'actions', width: 200,
      render: (_: unknown, record: any) => (
        <Space size="small">
          {record.status === 'available' && (
            <>
              <Button size="small" icon={<LinkOutlined />} onClick={() => { setAttachVol(record); attachForm.setFieldsValue({ device: '/dev/vdb' }) }}>
                {t('huawei.ecs.attachVolume')}
              </Button>
              <Popconfirm title={t('huawei.evs.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          {record.status === 'in-use' && (
            <Popconfirm title={t('huawei.ecs.confirmDetach')} onConfirm={() => handleDetach(record)}>
              <Button size="small">{t('huawei.ecs.detachVolume')}</Button>
            </Popconfirm>
          )}
          {record.status !== 'creating' && (
            <Button size="small" icon={<ExpandAltOutlined />} onClick={() => { setExpandVol(record); expandForm.setFieldsValue({ newSize: record.size + 10 }) }}>
              {t('huawei.evs.expand')}
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <HddOutlined style={{ marginRight: 8, color: '#CF0A2C' }} />
          {t('huawei.evs')}
          {!loading && <Tag style={{ marginLeft: 8 }}>{t('huawei.evs.total').replace('{n}', String(volumes.length))}</Tag>}
        </Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>{t('huawei.evs.create')}</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchVolumes} loading={loading}>{t('common.refresh')}</Button>
        </Space>
      </div>
      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
      <Table columns={columns} dataSource={volumes} rowKey="id" loading={loading}
        pagination={{ pageSize: 20, showTotal: (n) => t('huawei.evs.total').replace('{n}', String(n)) }}
        locale={{ emptyText: <Empty description={t('huawei.evs.noVolumes')} /> }} size="middle"
        scroll={{ x: 1300 }} tableLayout="fixed" />

      <Modal title={t('huawei.evs.create')} open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} okText={t('common.create')} cancelText={t('common.cancel')}>
        <Form form={createForm} layout="vertical" initialValues={{ volumeType: 'SSD', size: 40 }}>
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="size" label={t('huawei.evs.sizeGb')} rules={[{ required: true }]}>
            <InputNumber min={10} max={32768} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="volumeType" label={t('huawei.evs.type')} rules={[{ required: true }]}>
            <Select options={VOLUME_TYPES.map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="availabilityZone" label={t('huawei.evs.az')} rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder={t('huawei.evs.azPlaceholder')}
              options={azOptions.map((z) => ({ label: z, value: z }))}
            />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('huawei.evs.expand')} open={!!expandVol} onOk={handleExpand} onCancel={() => setExpandVol(null)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
        <Form form={expandForm} layout="vertical">
          <Alert type="info" message={`${expandVol?.name || expandVol?.id} · ${t('huawei.evs.currentSize')}: ${expandVol?.size} GB`} style={{ marginBottom: 16 }} />
          <Form.Item name="newSize" label={t('huawei.evs.newSizeGb')} rules={[{ required: true }]}>
            <InputNumber min={(expandVol?.size || 10) + 1} max={32768} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('huawei.ecs.attachVolumeTitle')} open={!!attachVol} onOk={handleAttach} onCancel={() => setAttachVol(null)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
        <Form form={attachForm} layout="vertical">
          <Form.Item name="serverId" label={t('huawei.ecs.selectServer')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={servers.filter((s) => s.status === 'ACTIVE').map((s) => ({
                label: `${s.name || s.id} (${s.id})`,
                value: s.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="device" label={t('huawei.ecs.deviceName')}>
            <Input placeholder="/dev/vdb" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
