import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Button, Space, Tag, Popconfirm, Modal, Form, Input, Empty, Typography, App } from 'antd'
import { ReloadOutlined, PlusOutlined, DeleteOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import type { ColumnsType } from 'antd/es/table'
import { useT, useI18n } from '../../i18n'

const { Text } = Typography

interface Address { publicIp: string; allocationId: string; instanceId: string; associationId: string; domain: string; networkInterfaceId?: string; networkBorderGroup?: string; allocationDate?: string }

export function ElasticIPsPage(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(false)
  const [assocOpen, setAssocOpen] = useState<Address | null>(null)
  const [assocForm] = Form.useForm()

  const countLabel = t('common.count')
    ? `${addresses.length} ${t('common.count')}`
    : String(addresses.length)

  const load = useCallback(async (forceRefresh = false) => {
    setAddresses([])
    setLoading(true)
    try {
      const result = await window.electronAPI.ec2Addresses.listAddresses({ region: activeRegion, profile: activeProfile, source: activeSource, forceRefresh })
      setAddresses(result)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [activeRegion, activeProfile, activeSource])
  useEffect(() => { load() }, [load])

  const handleAllocate = async () => {
    try {
      await window.electronAPI.ec2Addresses.allocateAddress({ region: activeRegion, profile: activeProfile, source: activeSource })
      message.success(t('eip.msgAllocated'))
      load()
    } catch (err: any) { message.error(err.message) }
  }

  const handleRelease = useCallback(async (id: string) => {
    try {
      await window.electronAPI.ec2Addresses.releaseAddress({ region: activeRegion, profile: activeProfile, source: activeSource, allocationId: id })
      message.success(t('eip.msgReleased'))
      load()
    } catch (err: any) { message.error(err.message) }
  }, [activeRegion, activeProfile, activeSource, message, t, load])

  const handleAssociate = async () => {
    if (!assocOpen) return
    const vals = await assocForm.validateFields()
    try {
      await window.electronAPI.ec2Addresses.associateAddress({ region: activeRegion, profile: activeProfile, source: activeSource, allocationId: assocOpen.allocationId, instanceId: vals.instanceId })
      message.success(t('eip.msgAssociated'))
      setAssocOpen(null); load(true)
    } catch (err: any) { message.error(err.message) }
  }

  const handleDisassociate = useCallback(async (assocId: string) => {
    try {
      await window.electronAPI.ec2Addresses.disassociateAddress({ region: activeRegion, profile: activeProfile, source: activeSource, associationId: assocId })
      message.success(t('eip.msgDisassociated'))
      load()
    } catch (err: any) { message.error(err.message) }
  }, [activeRegion, activeProfile, activeSource, message, t, load])

  const columns = useMemo<ColumnsType<Address>>(() => [
    { title: t('eip.publicIp'), dataIndex: 'publicIp', width: 160, render: (ip: string) => <Text copyable style={{ fontFamily: 'monospace' }}>{ip}</Text> },
    { title: t('eip.allocationId'), dataIndex: 'allocationId', width: 200, render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text> },
    { title: t('eip.location'), dataIndex: 'networkBorderGroup', width: 140, render: (g: string) => g ? <Tag>{g}</Tag> : '-' },
    {
      title: t('eip.allocTime'), dataIndex: 'allocationDate', width: 150,
      render: (d: string) => {
        if (!d) return '-'
        const date = new Date(d)
        return isNaN(date.getTime()) ? '-' : date.toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      },
    },
    { title: t('eip.instance'), dataIndex: 'instanceId', render: (id: string) => id ? <Tag color="green">{id}</Tag> : <Tag color="default">{t('eip.notAssociated')}</Tag> },
    { title: t('eip.type'), dataIndex: 'domain', width: 70, render: (d: string) => <Tag>{d}</Tag> },
    {
      title: t('common.actions'), width: 200,
      render: (_: unknown, r: Address) => (
        <Space size="small">
          {!r.instanceId && (
            <Button size="small" icon={<LinkOutlined />} onClick={() => { setAssocOpen(r); assocForm.resetFields() }}>{t('eip.associate')}</Button>
          )}
          {r.associationId && (
            <Popconfirm title={t('eip.confirmDisassociate')} onConfirm={() => handleDisassociate(r.associationId)}>
              <Button size="small" icon={<DisconnectOutlined />}>{t('eip.disassociate')}</Button>
            </Popconfirm>
          )}
          {!r.instanceId && (
            <Popconfirm title={t('eip.confirmRelease')} onConfirm={() => handleRelease(r.allocationId)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [t, lang, assocForm, handleDisassociate, handleRelease])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space><h2 style={{ margin: 0 }}>{t('eip.title')}</h2><Tag>{countLabel}</Tag></Space>
        <Space>
          <Button icon={<PlusOutlined />} onClick={handleAllocate}>{t('eip.allocate')}</Button>
          <Button icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>{t('common.refresh')}</Button>
        </Space>
      </div>
      <Table dataSource={addresses} rowKey="allocationId" columns={columns} loading={loading} size="middle" pagination={false}
        locale={{ emptyText: <Empty description={t('eip.noAddresses')} /> }} />
      <Modal title={`${t('eip.associate')} ${t('eip.instance')}`} open={!!assocOpen} onOk={handleAssociate} onCancel={() => setAssocOpen(null)} okText={t('eip.associate')}>
        <Form form={assocForm} layout="vertical">
          <Form.Item name="instanceId" label={t('ebs.instanceId')} rules={[{ required: true }]}>
            <Input placeholder="i-0123456789abcdef" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
