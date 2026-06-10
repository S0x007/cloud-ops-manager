import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Space, Tag, Empty, Typography, Modal, Form, Input, Select, Switch, Popconfirm, App } from 'antd'
import { ReloadOutlined, FolderOutlined, PlusOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons'
import { useS3 } from '../../hooks/useS3'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useI18n, useT } from '../../i18n'
import { awsProvider } from '../../providers/aws'
import type { ColumnsType } from 'antd/es/table'
import type { S3Bucket } from '../../stores/s3Store'

const { Text } = Typography

export function S3Page(): JSX.Element {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const { buckets, isLoadingBuckets, error, fetchBuckets } = useS3()

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm()

  const regionOptions = useMemo(
    () => awsProvider.regions.map((r) => ({ value: r.id, label: `${r.name}` })),
    [],
  )

  useEffect(() => {
    fetchBuckets()
  }, [fetchBuckets])

  const invokeParams = useCallback(
    () => ({ region: activeRegion, profile: activeProfile, source: activeSource }),
    [activeRegion, activeProfile, activeSource],
  )

  const handleCreate = async () => {
    const vals = await createForm.validateFields()
    setCreating(true)
    try {
      await window.electronAPI.s3Bucket.createBucket({
        ...invokeParams(),
        bucket: vals.bucket.trim(),
        locationConstraint: vals.region,
        enableEncryption: vals.enableEncryption ?? false,
      })
      message.success(t('s3.msgBucketCreated'))
      setCreateOpen(false)
      createForm.resetFields()
      fetchBuckets(true)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleEmpty = useCallback(async (bucket: string) => {
    try {
      await window.electronAPI.s3Bucket.emptyBucket({ ...invokeParams(), bucket })
      message.success(t('s3.msgBucketEmptied'))
      fetchBuckets(true)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }, [invokeParams, message, t, fetchBuckets])

  const handleDelete = useCallback(async (bucket: string) => {
    try {
      await window.electronAPI.s3Bucket.deleteBucket({ ...invokeParams(), bucket })
      message.success(t('s3.msgBucketDeleted'))
      fetchBuckets(true)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }, [invokeParams, message, t, fetchBuckets])

  const countLabel = t('common.count')
    ? `${buckets.length} ${t('common.count')}`
    : String(buckets.length)

  const columns = useMemo<ColumnsType<S3Bucket>>(() => [
    {
      title: t('s3.bucketName'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <a onClick={() => navigate(`/s3/${name}`)}>
          <FolderOutlined style={{ marginRight: 8, color: '#faad14' }} />
          {name}
        </a>
      ),
    },
    {
      title: t('common.region'),
      dataIndex: 'region',
      key: 'region',
      width: 150,
      render: (r: string | undefined) =>
        r ? <Tag color="blue">{r}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: t('s3.createdAt'),
      dataIndex: 'creationDate',
      key: 'creationDate',
      width: 200,
      render: (d: string) => {
        const date = new Date(d)
        return isNaN(date.getTime()) ? '-' : date.toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US')
      },
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => navigate(`/s3/${record.name}`)}>
            {t('common.browse')}
          </Button>
          <Button type="link" size="small" onClick={() => navigate(`/s3/${record.name}/detail`)}>
            {t('common.detail')}
          </Button>
          <Popconfirm
            title={t('s3.confirmEmptyBucket').replace('{name}', record.name)}
            onConfirm={() => handleEmpty(record.name)}
          >
            <Button type="link" size="small" icon={<ClearOutlined />}>{t('s3.emptyBucket')}</Button>
          </Popconfirm>
          <Popconfirm
            title={t('s3.confirmDeleteBucket').replace('{name}', record.name)}
            onConfirm={() => handleDelete(record.name)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>{t('s3.deleteBucket')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [t, lang, navigate, handleEmpty, handleDelete])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <h2 style={{ margin: 0 }}>{t('s3.title')}</h2>
          <Tag color="blue">{countLabel}</Tag>
        </Space>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => {
            createForm.setFieldsValue({ region: activeRegion, enableEncryption: true })
            setCreateOpen(true)
          }}>
            {t('s3.createBucket')}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => fetchBuckets(true)} loading={isLoadingBuckets}>
            {t('common.refresh')}
          </Button>
        </Space>
      </div>

      {error && (
        <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', padding: '12px 16px', borderRadius: 6, marginBottom: 16, color: '#cf1322' }}>
          {error}
          <Button type="link" onClick={() => fetchBuckets(true)} style={{ marginLeft: 12 }}>{t('common.retry')}</Button>
        </div>
      )}

      <Table<S3Bucket>
        columns={columns}
        dataSource={buckets}
        rowKey="name"
        loading={isLoadingBuckets}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        locale={{ emptyText: <Empty description={t('s3.noBuckets')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        size="middle"
      />

      <Modal
        title={t('s3.createBucket')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="bucket"
            label={t('s3.bucketName')}
            rules={[
              { required: true, message: t('s3.bucketNamePlaceholder') },
              { pattern: /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, message: '3-63 chars, lowercase, numbers, dots, hyphens' },
            ]}
          >
            <Input placeholder={t('s3.bucketNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="region" label={t('common.region')} rules={[{ required: true }]}>
            <Select options={regionOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="enableEncryption" label={t('s3.enableEncryption')} valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
