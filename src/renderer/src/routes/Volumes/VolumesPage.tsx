import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Button, Space, Tag, Popconfirm, Modal, Form, Input, InputNumber, Select, Empty, App } from 'antd'
import { ReloadOutlined, PlusOutlined, DeleteOutlined, LinkOutlined, DisconnectOutlined, CameraOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import type { ColumnsType } from 'antd/es/table'
import { useT, useTf } from '../../i18n'
import dayjs from 'dayjs'

interface Volume {
  volumeId: string; size: number; volumeType: string; state: string; iops: number;
  availabilityZone: string; encrypted: boolean; createTime: string;
  attachments: { instanceId: string; device: string; state: string }[];
  tags: { key: string; value: string }[]; snapshotId?: string;
}

export function VolumesPage(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const tf = useTf()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [volumes, setVolumes] = useState<Volume[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState<Volume | null>(null)
  const [createForm] = Form.useForm()
  const [attachForm] = Form.useForm()

  const countLabel = t('common.count')
    ? `${volumes.length} ${t('common.count')}`
    : String(volumes.length)

  const load = useCallback(async (forceRefresh = false) => {
    setVolumes([])
    setLoading(true)
    try {
      const result = await window.electronAPI.ec2Volumes.listVolumes({
        region: activeRegion, profile: activeProfile, source: activeSource, forceRefresh,
      })
      setVolumes(result)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await window.electronAPI.ec2Volumes.deleteVolume({
        region: activeRegion, profile: activeProfile, source: activeSource, volumeId: id,
      })
      message.success(t('ebs.msgDeleted'))
      load(true)
    } catch (err: any) { message.error(err.message) }
  }, [activeRegion, activeProfile, activeSource, message, t, load])

  const handleCreate = async () => {
    const vals = await createForm.validateFields()
    try {
      await window.electronAPI.ec2Volumes.createVolume({
        region: activeRegion, profile: activeProfile, source: activeSource, ...vals,
      })
      message.success(t('ebs.msgCreated'))
      setCreateOpen(false); createForm.resetFields(); load(true)
    } catch (err: any) { message.error(err.message) }
  }

  const handleAttach = async () => {
    if (!attachOpen) return
    const vals = await attachForm.validateFields()
    try {
      await window.electronAPI.ec2Volumes.attachVolume({
        region: activeRegion, profile: activeProfile, source: activeSource,
        volumeId: attachOpen.volumeId, ...vals,
      })
      message.success(t('ebs.msgAttached'))
      setAttachOpen(null); load(true)
    } catch (err: any) { message.error(err.message) }
  }

  const handleDetach = useCallback(async (id: string) => {
    try {
      await window.electronAPI.ec2Volumes.detachVolume({
        region: activeRegion, profile: activeProfile, source: activeSource, volumeId: id,
      })
      message.success(t('ebs.msgDetached'))
      load(true)
    } catch (err: any) { message.error(err.message) }
  }, [activeRegion, activeProfile, activeSource, message, t, load])

  const handleSnapshot = useCallback(async (id: string) => {
    try {
      await window.electronAPI.ec2Volumes.createSnapshot({
        region: activeRegion, profile: activeProfile, source: activeSource,
        volumeId: id, description: `Snapshot of ${id} - ${dayjs().format('YYYY-MM-DD HH:mm')}`,
      })
      message.success(t('ebs.msgSnapshot'))
    } catch (err: any) { message.error(err.message) }
  }, [activeRegion, activeProfile, activeSource, message, t])

  const columns = useMemo<ColumnsType<Volume>>(() => [
    { title: t('ebs.volumeId'), dataIndex: 'volumeId', width: 180 },
    { title: t('ebs.size'), dataIndex: 'size', width: 60, render: (s: number) => `${s} GB` },
    { title: t('ebs.type'), dataIndex: 'volumeType', width: 80, render: (vt: string) => <Tag>{vt}</Tag> },
    { title: t('ebs.state'), dataIndex: 'state', width: 100, render: (s: string) => <Tag color={s === 'in-use' ? 'green' : s === 'available' ? 'blue' : 'default'}>{s}</Tag> },
    { title: t('ebs.iops'), dataIndex: 'iops', width: 60 },
    { title: t('ebs.az'), dataIndex: 'availabilityZone', width: 100 },
    { title: t('ebs.encrypted'), dataIndex: 'encrypted', width: 60, render: (e: boolean) => e ? <Tag color="green">{t('common.yes')}</Tag> : <Tag>{t('common.no')}</Tag> },
    {
      title: t('ebs.attachedTo'), width: 200,
      render: (_: unknown, r: Volume) => r.attachments.length > 0
        ? r.attachments.map((a) => <Tag key={a.instanceId}>{a.instanceId} ({a.device})</Tag>)
        : '-',
    },
    {
      title: t('common.actions'), width: 220,
      render: (_: unknown, r: Volume) => (
        <Space size="small">
          {r.state === 'available' && (
            <Button size="small" icon={<LinkOutlined />} onClick={() => { setAttachOpen(r); attachForm.resetFields() }}>{t('ebs.attach')}</Button>
          )}
          {r.state === 'in-use' && (
            <Popconfirm title={t('ebs.confirmDetach')} onConfirm={() => handleDetach(r.volumeId)}>
              <Button size="small" icon={<DisconnectOutlined />}>{t('ebs.detach')}</Button>
            </Popconfirm>
          )}
          <Button size="small" icon={<CameraOutlined />} onClick={() => handleSnapshot(r.volumeId)}>{t('ebs.snapshot')}</Button>
          {r.state !== 'in-use' && (
            <Popconfirm title={t('ebs.confirmDelete')} onConfirm={() => handleDelete(r.volumeId)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [t, attachForm, handleDetach, handleDelete, handleSnapshot])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space><h2 style={{ margin: 0 }}>{t('ebs.title')}</h2><Tag>{countLabel}</Tag></Space>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); createForm.resetFields() }}>{t('ebs.create')}</Button>
          <Button icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>{t('common.refresh')}</Button>
        </Space>
      </div>
      <Table dataSource={volumes} rowKey="volumeId" columns={columns} loading={loading} size="middle"
        pagination={{ pageSize: 20 }} locale={{ emptyText: <Empty description={t('ebs.noVolumes')} /> }} />

      <Modal title={t('ebs.create')} open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} okText={t('common.create')}>
        <Form form={createForm} layout="vertical" initialValues={{ size: 10, volumeType: 'gp3', encrypted: false }}>
          <Form.Item name="size" label={t('ebs.sizeGb')} rules={[{ required: true }]}><InputNumber min={1} max={16384} /></Form.Item>
          <Form.Item name="volumeType" label={t('ebs.type')} rules={[{ required: true }]}>
            <Select options={[{ value: 'gp3', label: 'gp3' }, { value: 'gp2', label: 'gp2' }, { value: 'io2', label: 'io2' }]} />
          </Form.Item>
          <Form.Item name="availabilityZone" label={t('ebs.az')} rules={[{ required: true }]}>
            <Input placeholder={activeRegion + 'a'} />
          </Form.Item>
          <Form.Item name="encrypted" label={t('ebs.encrypted')} valuePropName="checked">
            <Select options={[{ value: true, label: t('common.yes') }, { value: false, label: t('common.no') }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={attachOpen ? tf('ebs.attachTitle', { id: attachOpen.volumeId }) : ''} open={!!attachOpen} onOk={handleAttach} onCancel={() => setAttachOpen(null)} okText={t('ebs.attach')}>
        <Form form={attachForm} layout="vertical">
          <Form.Item name="instanceId" label={t('ebs.instanceId')} rules={[{ required: true }]}>
            <Input placeholder="i-0123456789abcdef" />
          </Form.Item>
          <Form.Item name="device" label={t('ebs.deviceName')} rules={[{ required: true }]}>
            <Input placeholder="/dev/sdf" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
