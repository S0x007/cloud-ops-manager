import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Button, Space, Tag, Popconfirm, Modal, Form, Input, Select, Empty, Typography, App } from 'antd'
import { ReloadOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import type { ColumnsType } from 'antd/es/table'
import { useT, useI18n } from '../../i18n'

const { Text } = Typography

interface AMI { imageId: string; name: string; description: string; state: string; platform: string; architecture: string; creationDate: string; rootDeviceType: string; blockDevices: any[] }

const REGIONS = ['us-east-1','us-west-2','ap-northeast-1','ap-southeast-1','eu-west-1','eu-central-1']

export function AMIPage(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const ap = useProfileStore((s) => s.activeProfile)
  const as = useProfileStore((s) => s.activeSource)
  const ar = useRegionStore((s) => s.activeRegion)
  const [images, setImages] = useState<AMI[]>([])
  const [loading, setLoading] = useState(false)
  const [copyOpen, setCopyOpen] = useState<AMI | null>(null)
  const [copyForm] = Form.useForm()

  const countLabel = t('common.count')
    ? `${images.length} ${t('common.count')}`
    : String(images.length)

  const load = useCallback(async (force = false) => {
    setImages([])
    setLoading(true)
    try {
      const r = await window.electronAPI.ec2Amis.listImages({ region: ar, profile: ap, source: as, forceRefresh: force })
      setImages(r)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [ar, ap, as])
  useEffect(() => { load() }, [load])

  const handleDeregister = useCallback(async (id: string) => {
    try {
      await window.electronAPI.ec2Amis.deregisterImage({ region: ar, profile: ap, source: as, imageId: id })
      message.success(t('ami.msgDeregistered'))
      load(true)
    } catch (err: any) { message.error(err.message) }
  }, [ar, ap, as, message, t, load])

  const handleCopy = async () => {
    if (!copyOpen) return
    const vals = await copyForm.validateFields()
    try {
      await window.electronAPI.ec2Amis.copyImage({ region: ar, profile: ap, source: as, imageId: copyOpen.imageId, name: vals.name, destRegion: vals.destRegion })
      message.success(t('ami.msgCopyStarted'))
      setCopyOpen(null)
    } catch (err: any) { message.error(err.message) }
  }

  const columns = useMemo<ColumnsType<AMI>>(() => [
    { title: 'AMI ID', dataIndex: 'imageId', width: 200, render: (id: string) => <Text code style={{ whiteSpace: 'nowrap' }}>{id}</Text> },
    { title: t('common.name'), dataIndex: 'name', render: (n: string) => n || '-' },
    { title: t('ami.state'), dataIndex: 'state', width: 80, render: (s: string) => <Tag color={s === 'available' ? 'green' : 'orange'}>{s}</Tag> },
    { title: t('ec2.platform'), dataIndex: 'platform', width: 70 },
    { title: t('ami.arch'), dataIndex: 'architecture', width: 70, render: (a: string) => <Tag>{a}</Tag> },
    {
      title: t('ami.createTime'), dataIndex: 'creationDate', width: 140,
      render: (d: string) => {
        if (!d) return '-'
        const date = new Date(d)
        return isNaN(date.getTime()) ? '-' : date.toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      },
    },
    { title: t('ami.rootDevice'), dataIndex: 'rootDeviceType', width: 60, render: (rdt: string) => <Tag>{rdt}</Tag> },
    {
      title: t('common.actions'), width: 150,
      render: (_: unknown, r: AMI) => (
        <Space size="small">
          <Button size="small" icon={<CopyOutlined />} onClick={() => { setCopyOpen(r); copyForm.resetFields() }}>{t('ami.copy')}</Button>
          <Popconfirm title={t('ami.confirmDeregister')} onConfirm={() => handleDeregister(r.imageId)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [t, lang, copyForm, handleDeregister])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space><h2 style={{ margin: 0 }}>{t('ami.title')}</h2><Tag>{countLabel}</Tag><Tag color="blue">{ar}</Tag></Space>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(true)}>{t('common.refresh')}</Button>
      </div>
      <Table dataSource={images} rowKey="imageId" columns={columns} loading={loading} size="middle" pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description={t('ami.noImages')} /> }} />

      <Modal title={t('ami.copyTitle')} open={!!copyOpen} onOk={handleCopy} onCancel={() => setCopyOpen(null)} okText={t('ami.copy')}>
        <Form form={copyForm} layout="vertical" initialValues={{ name: copyOpen?.name + '-copy' }}>
          <Form.Item name="name" label={t('ami.newName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="destRegion" label={t('ami.destRegion')} rules={[{ required: true }]}>
            <Select options={REGIONS.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
