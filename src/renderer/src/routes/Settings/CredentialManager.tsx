import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Popconfirm, Typography, App, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ReloadOutlined, CloudFilled, CloudOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useI18n, useT } from '../../i18n'
import { ALL_PROVIDERS } from '../../providers/huawei'
import type { ProviderId } from '../../providers/types'

const { Text } = Typography

function maskAK(ak: string): string {
  if (ak.length <= 8) return '****'
  return ak.slice(0, 4) + '****' + ak.slice(-4)
}

// 各厂商特有的额外字段配置
const PROVIDER_EXTRA_SCHEMAS: Record<string, Array<{ name: string; label: string; ph?: string; required?: boolean }>> = {
  huawei: [{ name: 'projectId', label: '项目 ID (Project ID)', ph: '凭证验证后自动获取可用项目' }],
}

function useProviderOptions() {
  const isZh = useI18n((s) => s.lang) === 'zh-CN'
  return useMemo(() =>
    Object.values(ALL_PROVIDERS).map((p) => ({
      value: p.id,
      label: isZh ? `${p.nameZh} (${p.name})` : `${p.name} (${p.nameZh})`,
    })),
  [isZh])
}

export function CredentialManager(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const refreshAllCredentials = useProfileStore((s) => s.setAllCredentials)
  const [credentials, setCredentials] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('aws')
  const [form] = Form.useForm()

  const isZh = lang === 'zh-CN'
  const providerOptions = useProviderOptions()
  const defaultProviderId = Object.keys(ALL_PROVIDERS)[0] || 'aws'
  const defaultRegion = ALL_PROVIDERS[defaultProviderId as ProviderId]?.defaultRegion || 'us-east-1'

  // 当前厂商的区域列表（语言感知）
  const regionOptions = useMemo(() => {
    const meta = ALL_PROVIDERS[selectedProvider as ProviderId] || ALL_PROVIDERS.aws
    return meta.regions.map((r: any) => ({ value: r.id, label: `${isZh ? (r.nameZh || r.name) : r.name} (${r.id})` }))
  }, [selectedProvider, isZh])

  const refreshAll = useCallback(async () => {
    try { refreshAllCredentials(await window.electronAPI.profiles.listAll()) } catch { /* ignore */ }
  }, [refreshAllCredentials])

  const load = useCallback(async () => {
    setLoading(true)
    try { setCredentials(await window.electronAPI.credentials.list()); await refreshAll() }
    catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [refreshAll])

  useEffect(() => { load() }, [load])

  const handleAdd = () => {
    setEditingId(null); setSelectedProvider(defaultProviderId)
    form.resetFields()
    form.setFieldsValue({ provider: defaultProviderId, region: defaultRegion })
    setModalOpen(true)
  }

  const handleEdit = (record: any) => {
    setEditingId(record.id)
    const prov = record.provider || defaultProviderId
    setSelectedProvider(prov)
    const fields: Record<string, string> = {
      provider: prov, name: record.name, accessKeyId: record.accessKeyId,
      secretAccessKey: '', region: record.region, description: record.description,
    }
    // 动态填充 extraFields 到表单
    const schemas = PROVIDER_EXTRA_SCHEMAS[prov] || []
    for (const s of schemas) {
      fields[s.name] = record.extraFields?.[s.name] || ''
    }
    form.setFieldsValue(fields)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try { await window.electronAPI.credentials.delete(id); message.success(t('cred.msgDeleted')); load() }
    catch (err: any) { message.error(err.message) }
  }

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value)
    const meta = ALL_PROVIDERS[value as ProviderId]
    // 收集所有 provider 的 extra field 名称，全部清空后再设新值
    const allExtraFields: string[] = []
    for (const schemas of Object.values(PROVIDER_EXTRA_SCHEMAS)) {
      for (const s of schemas) allExtraFields.push(s.name)
    }
    const fields: Record<string, unknown> = { provider: value, region: meta?.defaultRegion || 'us-east-1' }
    for (const name of allExtraFields) fields[name] = ''
    form.setFieldsValue(fields)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const { provider, ...rest } = values
      const schemas = PROVIDER_EXTRA_SCHEMAS[provider] || []
      const extraFields = schemas.reduce<Record<string, string>>((acc, s) => {
        if (rest[s.name]) acc[s.name] = rest[s.name]
        delete rest[s.name]
        return acc
      }, {})
      const credData = { ...rest, extraFields: Object.keys(extraFields).length ? extraFields : undefined }

      if (editingId) {
        await window.electronAPI.credentials.update({ id: editingId, data: credData })
        message.success(t('cred.msgUpdated'))
      } else {
        await window.electronAPI.credentials.add({ ...credData, provider })
        message.success(t('cred.msgAdded'))
      }
      setModalOpen(false); load()
    } catch (err: any) { message.error(err.message) }
  }

  const columns = useMemo(() => [
    { title: t('common.name'), dataIndex: 'name', key: 'name', render: (n: string) => <Space><KeyOutlined style={{ color: '#faad14' }} /><Text strong>{n}</Text></Space> },
    { title: 'Access Key', dataIndex: 'accessKeyId', key: 'ak', render: (ak: string) => <Text code>{maskAK(ak)}</Text> },
    { title: t('cred.defaultRegion'), dataIndex: 'region', key: 'region', width: 130, render: (r: string) => <Tag color="blue">{r}</Tag> },
    { title: t('cred.provider'), dataIndex: 'provider', key: 'provider', width: 100, render: (p: string) => {
        const meta = ALL_PROVIDERS[(p || defaultProviderId) as ProviderId]
        return <Tag color={meta?.color || '#666'}>{meta?.nameZh || p || 'AWS'}</Tag>
      }},
    { title: t('common.description'), dataIndex: 'description', key: 'desc', render: (d: string) => d || '-' },
    { title: t('common.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (d: string) => new Date(d).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US') },
    { title: t('common.actions'), key: 'actions', width: 100, render: (_: any, r: any) => (
        <Space size="small">
          <Tooltip title={t('common.edit')}><Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} /></Tooltip>
          <Popconfirm title={t('cred.confirmDelete')} onConfirm={() => handleDelete(r.id)}>
            <Tooltip title={t('common.delete')}><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ], [t, lang])

  return (
    <Card title={<Space><KeyOutlined /><span>{t('cred.title')}</span><Tag color="warning">{t('cred.localTag')}</Tag></Space>}
      extra={<Space><Button icon={<ReloadOutlined />} onClick={load}>{t('common.refresh')}</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('cred.add')}</Button></Space>}>
      <p style={{ color: '#8c8c8c', marginBottom: 16 }}>{t('cred.hint')}</p>
      <Table columns={columns} dataSource={credentials} rowKey="id" loading={loading} pagination={false}
        locale={{ emptyText: t('cred.empty') }} size="middle" />
      <Modal title={editingId ? t('cred.edit') : t('cred.add')} open={modalOpen}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)}
        okText={editingId ? t('common.save') : t('common.create')} cancelText={t('common.cancel')} width={540}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="provider" label="云厂商" rules={[{ required: true }]}>
            <Select options={providerOptions} onChange={handleProviderChange} />
          </Form.Item>
          <Form.Item name="name" label={t('cred.displayName')} rules={[{ required: true, message: t('cred.nameRequired') }]}>
            <Input placeholder={t('cred.displayNamePh')} />
          </Form.Item>
          <Form.Item name="accessKeyId" label="Access Key ID" rules={[{ required: true, message: t('cred.akRequired') }]}>
            <Input placeholder={selectedProvider === 'huawei' ? 'H5BZ3X...' : 'AKIAIOSFODNN7EXAMPLE'} />
          </Form.Item>
          <Form.Item name="secretAccessKey" label="Secret Access Key"
            rules={[{ required: !editingId, message: t('cred.skRequired') }]}
            extra={editingId ? t('cred.skHint') : ''}>
            <Input.Password placeholder="wJalrXUtnFEMI/K7MDENG..." />
          </Form.Item>
          {(PROVIDER_EXTRA_SCHEMAS[selectedProvider] || []).map((s) => (
            <Form.Item key={s.name} name={s.name} label={s.label}
              rules={[{ required: !!s.required }]}
              extra={s.ph}>
              <Input />
            </Form.Item>
          ))}
          <Form.Item name="region" label={t('cred.defaultRegion')} rules={[{ required: true }]}>
            <Select options={regionOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} placeholder={t('cred.descPh')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
