import { useEffect, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Space,
  Tag,
  Breadcrumb,
  Popconfirm,
  Empty,
  Typography,
  Tooltip,
  Modal,
  Input,
  Alert,
} from 'antd'
import {
  HomeOutlined,
  FolderOutlined,
  FileOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  ReloadOutlined,
  FolderAddOutlined,
} from '@ant-design/icons'
import { useS3 } from '../../hooks/useS3'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useS3Store } from '../../stores/s3Store'
import { FilePreviewModal } from '../../components/FilePreview/FilePreviewModal'
import type { ColumnsType } from 'antd/es/table'
import type { S3Object } from '../../stores/s3Store'
import dayjs from 'dayjs'
import { useT, useTf } from '../../i18n'

const { Text } = Typography

function formatBytes(bytes: number): string {
  if (bytes === 0) return '-'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getFileName(key: string): string {
  const parts = key.split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || key
}

function getParentPrefix(prefix: string): string {
  const parts = prefix.split('/').filter(Boolean)
  parts.pop()
  return parts.length > 0 ? parts.join('/') + '/' : ''
}

export function S3ObjectBrowser(): JSX.Element {
  const { bucket, '*': wildcard } = useParams<{ bucket: string; '*': string }>()
  const navigate = useNavigate()
  const t = useT()
  const tf = useTf()
  const prefix = wildcard ?? ''
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const {
    objects,
    objectsTruncated,
    isLoadingObjects,
    error,
    fetchObjects,
    deleteObject,
    deleteObjects,
    uploadFile,
    downloadFile,
    renameObject,
  } = useS3()

  const [createFolderVisible, setCreateFolderVisible] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ key: string; name: string } | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [renameModal, setRenameModal] = useState<{ key: string; name: string } | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (bucket) fetchObjects(bucket, prefix)
  }, [bucket, prefix, fetchObjects])

  useEffect(() => () => {
    useS3Store.getState().setObjects([], false)
  }, [])

  const handleNavigateTo = useCallback(
    (newPrefix: string) => {
      navigate(`/s3/${bucket}/${newPrefix}`)
    },
    [bucket, navigate],
  )

  const handleUpload = useCallback(async () => {
    const files = await window.electronAPI.app.openFileDialog({ multiSelections: true })
    if (!files || files.length === 0) return
    for (const filePath of files) {
      const fileName = filePath.split('/').pop() ?? filePath
      const remoteKey = prefix ? `${prefix}${fileName}` : fileName
      if (bucket) await uploadFile(bucket, filePath, remoteKey)
    }
    if (bucket) fetchObjects(bucket, prefix)
  }, [bucket, prefix, uploadFile, fetchObjects])

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || !bucket) return
    const folderKey = prefix
      ? `${prefix}${newFolderName.trim()}/`
      : `${newFolderName.trim()}/`
    try {
      await window.electronAPI.s3.createFolder({
        region: activeRegion,
        profile: activeProfile,
        source: activeSource,
        bucket,
        key: folderKey,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('创建文件夹失败:', msg)
    }
    setCreateFolderVisible(false)
    setNewFolderName('')
    fetchObjects(bucket, prefix)
  }, [bucket, prefix, newFolderName, activeRegion, activeProfile, activeSource, fetchObjects])

  const rootPath = `/s3/${bucket}` // 桶根路径

  const breadcrumbItems = [
    {
      title: (
        <a onClick={() => navigate('/s3')}>
          <HomeOutlined /> S3
        </a>
      ),
    },
    {
      title: !prefix ? (
        <span><FolderOutlined /> {bucket}</span>
      ) : (
        <a onClick={() => navigate(rootPath)}>
          <FolderOutlined /> {bucket}
        </a>
      ),
    },
  ]

  if (prefix) {
    const parts = prefix.split('/').filter(Boolean)
    let cumPath = ''
    parts.forEach((part, idx) => {
      cumPath += part + '/'
      const isLast = idx === parts.length - 1
      breadcrumbItems.push({
        title: isLast ? (
          <span>{part}</span>
        ) : (
          <a onClick={() => navigate(`${rootPath}/${cumPath}`)}>{part}</a>
        ),
      })
    })
  }

  const columns: ColumnsType<S3Object> = [
    {
      title: t('s3.name'),
      dataIndex: 'key',
      key: 'key',
      render: (key: string, record) => {
        const isDir = record.storageClass === 'DIRECTORY'
        const displayName = isDir
          ? key.split('/').filter(Boolean).pop() + '/'
          : getFileName(key)
        return (
          <a
            onClick={() => {
              if (isDir) handleNavigateTo(key)
            }}
          >
            {isDir ? (
              <FolderOutlined style={{ marginRight: 8, color: '#faad14' }} />
            ) : (
              <FileOutlined style={{ marginRight: 8, color: '#8c8c8c' }} />
            )}
            {displayName}
          </a>
        )
      },
    },
    {
      title: t('s3.size'),
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number, record) =>
        record.storageClass === 'DIRECTORY' ? '-' : formatBytes(size),
    },
    {
      title: t('s3.storageClass'),
      dataIndex: 'storageClass',
      key: 'storageClass',
      width: 120,
      render: (sc: string) =>
        sc === 'DIRECTORY' ? (
          <Tag color="blue">{t('common.folder')}</Tag>
        ) : (
          <Tag>{sc}</Tag>
        ),
    },
    {
      title: t('s3.lastModified'),
      dataIndex: 'lastModified',
      key: 'lastModified',
      width: 180,
      render: (modified: string) =>
        modified ? dayjs(modified).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: t('common.actionsCol'),
      key: 'actions',
      width: 220,
      render: (_, record) => {
        const isDir = record.storageClass === 'DIRECTORY'
        const fname = getFileName(record.key)
        return (
          <Space size="small">
            {!isDir && (
              <>
                <Tooltip title={t('s3.preview')}>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      setPreviewFile({ key: record.key, name: fname })
                      setEditMode(false)
                      setPreviewVisible(true)
                    }}
                  />
                </Tooltip>
                <Tooltip title={t('s3.edit')}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setPreviewFile({ key: record.key, name: fname })
                      setEditMode(true)
                      setPreviewVisible(true)
                    }}
                  />
                </Tooltip>
                <Tooltip title={t('s3.download')}>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => bucket && downloadFile(bucket, record.key)}
                  />
                </Tooltip>
                <Tooltip title={t('s3.rename')}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setRenameModal({ key: record.key, name: fname })
                      setNewName(fname)
                    }}
                  />
                </Tooltip>
                <Popconfirm
                  title={t('s3.confirmDelete')}
                  onConfirm={() => bucket && deleteObject(bucket, record.key)}
                >
                  <Tooltip title={t('common.delete')}>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
            {isDir && (
              <Popconfirm
                title={t('s3.confirmDeleteFolder')}
                onConfirm={() => bucket && deleteObject(bucket, record.key)}
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
    <div>
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space>
          <h2 style={{ margin: 0 }}>{bucket}</h2>
          {prefix && <Text type="secondary">{prefix}</Text>}
          <Tag>{tf('common.items', { n: objects.length })}</Tag>
        </Space>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title={tf('s3.confirmDeleteSelected', { n: selectedRowKeys.length })}
              onConfirm={() => { if (bucket) deleteObjects(bucket, selectedRowKeys); setSelectedRowKeys([]) }}
            >
              <Button danger icon={<DeleteOutlined />}>
                {tf('s3.deleteSelected', { n: selectedRowKeys.length })}
              </Button>
            </Popconfirm>
          )}
          <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderVisible(true)}>
            {t('s3.newFolder')}
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleUpload}
          >
            {t('s3.uploadFile')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => bucket && fetchObjects(bucket, prefix)}
            loading={isLoadingObjects}
          />
        </Space>
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

      {objectsTruncated && (
        <Alert
          type="warning"
          showIcon
          message={t('s3.listTruncated')}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table<S3Object>
        columns={columns}
        dataSource={objects}
        rowKey="key"
        loading={isLoadingObjects}
        pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: ['50', '100', '200'] }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
          getCheckboxProps: (record) => ({ disabled: record.storageClass === 'DIRECTORY' }),
        }}
        locale={{
          emptyText: (
            <Empty
              description={t('s3.emptyFolder')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<UploadOutlined />} onClick={handleUpload}>
                {t('s3.uploadFile')}
              </Button>
            </Empty>
          ),
        }}
        size="middle"
      />

      <Modal
        title={t('s3.newFolder')}
        open={createFolderVisible}
        onOk={handleCreateFolder}
        onCancel={() => {
          setCreateFolderVisible(false)
          setNewFolderName('')
        }}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
      >
        <Input
          placeholder={t('s3.folderNamePh')}
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
        />
      </Modal>

      <Modal
        title={t('s3.renameTitle')}
        open={!!renameModal}
        onOk={async () => {
          if (renameModal && newName && bucket) {
            const dir = renameModal.key.split('/').slice(0, -1).join('/')
            const newKey = dir ? `${dir}/${newName}` : newName
            await renameObject(bucket, renameModal.key, newKey)
            setRenameModal(null)
          }
        }}
        onCancel={() => setRenameModal(null)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('s3.newFileNamePh')} />
      </Modal>

      {previewFile && bucket && (
        <FilePreviewModal
          open={previewVisible}
          bucket={bucket}
          fileKey={previewFile.key}
          fileName={previewFile.name}
          startInEditMode={editMode}
          onClose={() => {
            setPreviewVisible(false)
            setPreviewFile(null)
          }}
          onSaved={() => {
            if (bucket) fetchObjects(bucket, prefix)
          }}
        />
      )}
    </div>
  )
}
