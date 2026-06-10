import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Tabs, Descriptions, Tag, Typography, Space, Button, Empty, Skeleton, Alert,
} from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, FolderOutlined } from '@ant-design/icons'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useRegionStore } from '../../../stores/regionStore'
import { useProviderStore } from '../../../stores/providerStore'
import { useT } from '../../../i18n'

const { Title } = Typography

export function HuaweiOBSBucketDetail(): JSX.Element {
  const t = useT()
  const navigate = useNavigate()
  const { bucket } = useParams<{ bucket: string }>()
  const { invoke, credentialId } = useCloudOperation()
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!bucket || !credentialId || currentProvider !== 'huawei') return
    setLoading(true); setError(null)
    try {
      const r = await invoke('obs', 'obs:getBucketDetail', { bucket })
      if (r.success) setDetail(r.data)
      else setError(r.error || t('common.error'))
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [bucket, credentialId, currentProvider, invoke, t])

  useEffect(() => { load() }, [load])

  if (currentProvider !== 'huawei') return <Card><Empty description={t('huawei.ecs.switchHint')} /></Card>

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/huawei/obs')}>{t('common.back')}</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>{t('common.refresh')}</Button>
        <Button type="primary" onClick={() => navigate('/huawei/obs', { state: { bucket, region: detail?.region || activeRegion } })}>
          {t('huawei.obs.browseObjects')}
        </Button>
      </Space>

      <Title level={4}>
        <FolderOutlined style={{ marginRight: 8, color: '#CF0A2C' }} />
        {bucket}
      </Title>

      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      {loading && !detail ? <Skeleton active paragraph={{ rows: 6 }} /> : null}

      {detail && (
        <Tabs items={[
          {
            key: 'overview',
            label: t('huawei.obs.tabOverview'),
            children: (
              <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item label={t('huawei.obs.name')}>{bucket}</Descriptions.Item>
                <Descriptions.Item label={t('huawei.obs.region')}>{detail.region || activeRegion}</Descriptions.Item>
                <Descriptions.Item label={t('huawei.obs.storageClass')}>{detail.storageClass || '-'}</Descriptions.Item>
              </Descriptions>
            ),
          },
          {
            key: 'versioning',
            label: t('s3.versioning'),
            children: (
              <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item label={t('s3.versioning')}>
                  <Tag color={detail.versioning === 'Enabled' ? 'green' : 'default'}>{detail.versioning || 'Suspended'}</Tag>
                </Descriptions.Item>
              </Descriptions>
            ),
          },
          {
            key: 'policy',
            label: t('huawei.obs.tabPolicy'),
            children: detail.policy ? (
              <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 480 }}>
                {typeof detail.policy === 'string' ? detail.policy : JSON.stringify(detail.policy, null, 2)}
              </pre>
            ) : (
              <Empty description={t('huawei.obs.noPolicy')} style={{ marginTop: 48 }} />
            ),
          },
        ]} />
      )}
    </div>
  )
}
