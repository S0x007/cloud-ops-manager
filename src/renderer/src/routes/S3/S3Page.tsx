import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Space, Tag, Empty, Typography } from 'antd'
import { ReloadOutlined, FolderOutlined } from '@ant-design/icons'
import { useS3 } from '../../hooks/useS3'
import { useI18n, useT } from '../../i18n'
import type { ColumnsType } from 'antd/es/table'
import type { S3Bucket } from '../../stores/s3Store'

const { Text } = Typography

export function S3Page(): JSX.Element {
  const navigate = useNavigate()
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const { buckets, isLoadingBuckets, error, fetchBuckets } = useS3()

  useEffect(() => {
    fetchBuckets()
  }, [fetchBuckets])

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
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" onClick={() => navigate(`/s3/${record.name}`)}>
            {t('common.browse')}
          </Button>
          <Button type="link" onClick={() => navigate(`/s3/${record.name}/detail`)}>
            {t('common.detail')}
          </Button>
        </Space>
      ),
    },
  ], [t, lang, navigate])

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
          <h2 style={{ margin: 0 }}>{t('s3.title')}</h2>
          <Tag color="blue">{countLabel}</Tag>
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchBuckets(true)}
          loading={isLoadingBuckets}
        >
          {t('common.refresh')}
        </Button>
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
        </div>
      )}

      <Table<S3Bucket>
        columns={columns}
        dataSource={buckets}
        rowKey="name"
        loading={isLoadingBuckets}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        locale={{
          emptyText: (
            <Empty
              description={t('s3.noBuckets')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        size="middle"
      />
    </div>
  )
}
