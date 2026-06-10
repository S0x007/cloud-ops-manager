import { useCallback, useEffect, useState } from 'react'
import {
  Drawer,
  Table,
  Button,
  Space,
  Tag,
  Tooltip,
  Popconfirm,
  Alert,
  Typography,
  App,
} from 'antd'
import {
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { FilePreviewModal } from '../../components/FilePreview/FilePreviewModal'
import { useT, useTf } from '../../i18n'

const { Text } = Typography

interface ObjectVersion {
  key: string
  versionId?: string | null
  size: number
  lastModified?: string
  isLatest?: boolean
  isDeleteMarker?: boolean
}

function hasVersionId(version: ObjectVersion): version is ObjectVersion & { versionId: string } {
  return typeof version.versionId === 'string' && version.versionId.length > 0
}

interface VersionPanelProps {
  open: boolean
  bucket: string
  objectKey: string
  fileName: string
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function VersionPanel({
  open,
  bucket,
  objectKey,
  fileName,
  onClose,
}: VersionPanelProps): JSX.Element {
  const t = useT()
  const tf = useTf()
  const { message } = App.useApp()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [versions, setVersions] = useState<ObjectVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewVersionId, setPreviewVersionId] = useState<string | undefined>(undefined)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [versioningEnabled, setVersioningEnabled] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    if (!open || !bucket || !objectKey) return
    setLoading(true)
    setError(null)
    try {
      const [list, versioning] = await Promise.all([
        window.electronAPI.s3.listObjectVersions({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          bucket,
          key: objectKey,
        }),
        window.electronAPI.s3Bucket.getBucketVersioning({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          bucket,
        }),
      ])
      setVersions(list as ObjectVersion[])
      setVersioningEnabled(versioning?.status === 'Enabled')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [open, bucket, objectKey, activeRegion, activeProfile, activeSource])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleDownload = useCallback(
    async (version: ObjectVersion) => {
      if (version.isDeleteMarker) return
      try {
        const baseName = fileName || objectKey.split('/').pop() || 'download'
        const defaultPath =
          hasVersionId(version) && !version.isLatest
            ? `${baseName.replace(/(\.[^./]+)?$/, '')}_${version.versionId.slice(0, 8)}${
                baseName.includes('.') ? baseName.slice(baseName.lastIndexOf('.')) : ''
              }`
            : baseName
        const savePath = await window.electronAPI.app.saveFileDialog({ defaultPath })
        if (!savePath) return

        const unsub = window.electronAPI.s3.onDownloadProgress((data: { key: string; loaded: number; total: number }) => {
          const pct = data.total > 0 ? Math.round((data.loaded / data.total) * 100) : 0
          message.loading({
            content: tf('s3.msg.downloading', {
              name: baseName,
              pct,
              loaded: (data.loaded / 1024 / 1024).toFixed(1),
              total: (data.total / 1024 / 1024).toFixed(1),
            }),
            key: 'version-download',
            duration: 0,
          })
        })

        try {
          await window.electronAPI.s3.downloadFile({
            region: activeRegion,
            profile: activeProfile,
            source: activeSource,
            bucket,
            key: objectKey,
            savePath,
            ...(hasVersionId(version) ? { versionId: version.versionId } : {}),
          })
          message.success({
            content: tf('s3.msg.downloadDone', { name: baseName }),
            key: 'version-download',
            duration: 3,
          })
        } finally {
          unsub()
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        message.error({ content: msg, key: 'version-download' })
      }
    },
    [activeRegion, activeProfile, activeSource, bucket, objectKey, fileName, message, tf],
  )

  const handleDelete = useCallback(
    async (version: ObjectVersion) => {
      if (!hasVersionId(version)) return
      try {
        await window.electronAPI.s3.deleteObjectVersion({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          bucket,
          key: objectKey,
          versionId: version.versionId,
        })
        message.success(t('s3.versions.deleted'))
        await load()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        message.error(msg)
      }
    },
    [activeRegion, activeProfile, activeSource, bucket, objectKey, load, message, t],
  )

  const columns: ColumnsType<ObjectVersion> = [
    {
      title: t('s3.versions.versionId'),
      dataIndex: 'versionId',
      key: 'versionId',
      ellipsis: true,
      render: (_id: string | null | undefined, record) => (
        <Space size={4} wrap>
          {hasVersionId(record) ? (
            <Text code copyable={{ text: record.versionId }} style={{ fontSize: 11 }}>
              {record.versionId.length > 16
                ? `${record.versionId.slice(0, 16)}…`
                : record.versionId}
            </Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('s3.versions.noVersionId')}
            </Text>
          )}
          {record.isLatest && <Tag color="green">{t('s3.versions.latest')}</Tag>}
          {record.isDeleteMarker && <Tag color="red">{t('s3.versions.deleteMarker')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('s3.size'),
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number, record) =>
        record.isDeleteMarker ? '-' : formatBytes(size),
    },
    {
      title: t('s3.lastModified'),
      dataIndex: 'lastModified',
      key: 'lastModified',
      width: 170,
      render: (modified?: string) =>
        modified ? dayjs(modified).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: t('common.actionsCol'),
      key: 'actions',
      width: 130,
      render: (_, record) => {
        if (record.isDeleteMarker) {
          if (!hasVersionId(record)) return null
          return (
            <Popconfirm
              title={t('s3.versions.confirmDeleteMarker')}
              onConfirm={() => handleDelete(record)}
            >
              <Tooltip title={t('common.delete')}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )
        }
        return (
          <Space size="small">
            <Tooltip title={t('s3.preview')}>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setPreviewVersionId(hasVersionId(record) ? record.versionId : undefined)
                  setPreviewOpen(true)
                }}
              />
            </Tooltip>
            <Tooltip title={t('s3.download')}>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record)}
              />
            </Tooltip>
            {hasVersionId(record) && (
              <Popconfirm
                title={
                  record.isLatest
                    ? t('s3.versions.confirmDeleteLatest')
                    : t('s3.versions.confirmDelete')
                }
                onConfirm={() => handleDelete(record)}
              >
                <Tooltip title={t('common.delete')}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <Drawer
        title={
          <Space direction="vertical" size={0}>
            <span>{t('s3.versions.title')}</span>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
              {fileName}
            </Text>
          </Space>
        }
        open={open}
        onClose={onClose}
        width={720}
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
        }
      >
        {error && (
          <Alert
            type="error"
            message={error}
            action={<Button size="small" onClick={load}>{t('common.retry')}</Button>}
            style={{ marginBottom: 16 }}
          />
        )}

        {versioningEnabled === false && (
          <Alert
            type="warning"
            message={t('s3.versions.versioningDisabled')}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {versions.length === 0 && !loading && !error && (
          <Alert type="info" message={t('s3.versions.empty')} showIcon />
        )}

        <Table<ObjectVersion>
          rowKey={(record) =>
            hasVersionId(record)
              ? record.versionId
              : `${record.key}-${record.lastModified ?? '0'}-${record.isDeleteMarker ? 'dm' : 'obj'}`
          }
          size="small"
          loading={loading}
          columns={columns}
          dataSource={versions}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Drawer>

      <FilePreviewModal
        open={previewOpen}
        bucket={bucket}
        fileKey={objectKey}
        fileName={fileName}
        versionId={previewVersionId}
        readOnly
        onClose={() => {
          setPreviewOpen(false)
          setPreviewVersionId(undefined)
        }}
        onSaved={() => {}}
      />
    </>
  )
}
