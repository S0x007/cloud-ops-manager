import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Typography,
  App,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useI18n, useT } from '../../i18n'

const { Text } = Typography

interface Credential {
  id: string
  name: string
  accessKeyId: string
  region: string
  description: string
  createdAt: string
}

const regions = [
  { value: 'us-east-1', label: 'us-east-1' },
  { value: 'us-east-2', label: 'us-east-2' },
  { value: 'us-west-2', label: 'us-west-2' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1 (Tokyo)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' },
  { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  { value: 'eu-central-1', label: 'eu-central-1 (Frankfurt)' },
]

function maskAK(ak: string): string {
  if (ak.length <= 8) return '****'
  return ak.slice(0, 4) + '****' + ak.slice(-4)
}

export function CredentialManager(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const refreshAllCredentials = useProfileStore((s) => s.setAllCredentials)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form] = Form.useForm()

  const refreshAll = useCallback(async () => {
    try {
      const all = await window.electronAPI.profiles.listAll()
      refreshAllCredentials(all)
    } catch { /* ignore */ }
  }, [refreshAllCredentials])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI.credentials.list()
      setCredentials(list)
      await refreshAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }, [refreshAll])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = () => {
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue({ region: 'us-east-1' })
    setModalOpen(true)
  }

  const handleEdit = (record: Credential) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      accessKeyId: record.accessKeyId,
      secretAccessKey: '',
      region: record.region,
      description: record.description,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.credentials.delete(id)
      message.success(t('cred.msgDeleted'))
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      message.error(msg)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingId) {
        await window.electronAPI.credentials.update({
          id: editingId,
          data: values,
        })
        message.success(t('cred.msgUpdated'))
      } else {
        await window.electronAPI.credentials.add(values)
        message.success(t('cred.msgAdded'))
      }
      setModalOpen(false)
      load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      message.error(msg)
    }
  }

  const columns = useMemo(() => [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <KeyOutlined style={{ color: '#faad14' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Access Key',
      dataIndex: 'accessKeyId',
      key: 'accessKeyId',
      render: (ak: string) => <Text code>{maskAK(ak)}</Text>,
    },
    {
      title: t('cred.defaultRegion'),
      dataIndex: 'region',
      key: 'region',
      width: 160,
      render: (r: string) => <Tag color="blue">{r}</Tag>,
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      render: (d: string) => d || '-',
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (d: string) => new Date(d).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Credential) => (
        <Space size="small">
          <Tooltip title={t('common.edit')}>
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title={t('cred.confirmDelete')} onConfirm={() => handleDelete(record.id)}>
            <Tooltip title={t('common.delete')}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ], [t, lang])

  return (
    <Card
      title={
        <Space>
          <KeyOutlined />
          <span>{t('cred.title')}</span>
          <Tag color="warning">{t('cred.localTag')}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            {t('common.refresh')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            {t('cred.add')}
          </Button>
        </Space>
      }
    >
      <p style={{ color: '#8c8c8c', marginBottom: 16 }}>
        {t('cred.hint')}
      </p>

      <Table
        columns={columns}
        dataSource={credentials}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{ emptyText: t('cred.empty') }}
        size="middle"
      />

      <Modal
        title={editingId ? t('cred.edit') : t('cred.addAws')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingId ? t('common.save') : t('common.create')}
        cancelText={t('common.cancel')}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t('cred.displayName')}
            rules={[{ required: true, message: t('cred.nameRequired') }]}
          >
            <Input placeholder={t('cred.displayNamePh')} />
          </Form.Item>

          <Form.Item
            name="accessKeyId"
            label="Access Key ID"
            rules={[{ required: true, message: t('cred.akRequired') }]}
          >
            <Input placeholder="AKIAIOSFODNN7EXAMPLE" />
          </Form.Item>

          <Form.Item
            name="secretAccessKey"
            label="Secret Access Key"
            rules={[{ required: !editingId, message: t('cred.skRequired') }]}
            extra={editingId ? t('cred.skHint') : ''}
          >
            <Input.Password placeholder="wJalrXUtnFEMI/K7MDENG..." />
          </Form.Item>

          <Form.Item
            name="region"
            label={t('cred.defaultRegion')}
            rules={[{ required: true }]}
          >
            <Select options={regions} />
          </Form.Item>

          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} placeholder={t('cred.descPh')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
