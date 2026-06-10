import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { App, Table, Tag, Typography, Space, Button, Popconfirm, Tooltip, Empty, Alert, Input, Modal } from 'antd'
import {
  FolderOutlined, ReloadOutlined, ArrowLeftOutlined, FileOutlined,
  UploadOutlined, DownloadOutlined, DeleteOutlined, EyeOutlined,
  EditOutlined, FolderAddOutlined, SwapOutlined,
} from '@ant-design/icons'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import type { CloudInvokeResult } from '../../../lib/cloudInvoke'
import { useRegionStore } from '../../../stores/regionStore'
import { useProviderStore } from '../../../stores/providerStore'
import { useI18n, useT, useTf } from '../../../i18n'
import { toPreviewDataUrl, type ObjectPreviewContent } from '../../../../../shared/object-preview'

const { Title, Text } = Typography

function formatObsBytes(size: number, partial?: boolean): string {
  if (!size && size !== 0) return '-'
  let text: string
  if (size > 1024 * 1024) text = `${(size / (1024 * 1024)).toFixed(1)} MB`
  else if (size > 1024) text = `${(size / 1024).toFixed(1)} KB`
  else text = `${size} B`
  return partial ? `${text} ~` : text
}

export function HuaweiOBSListPage(): JSX.Element {
  const t = useT()
  const tf = useTf()
  const lang = useI18n((s) => s.lang)
  const { message } = App.useApp()
  const { invoke, credentialId } = useCloudOperation()
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const currentProvider = useProviderStore((s) => s.currentProvider)
  const navigate = useNavigate()
  const location = useLocation()

  const [buckets, setBuckets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [browsingBucket, setBrowsingBucket] = useState<string | null>(null)
  const [browsingBucketRegion, setBrowsingBucketRegion] = useState<string>('')
  const [objects, setObjects] = useState<any[]>([])
  const [prefix, setPrefix] = useState('')
  const [objLoading, setObjLoading] = useState(false)

  // 操作状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [createFolderVisible, setCreateFolderVisible] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameVisible, setRenameVisible] = useState(false)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewData, setPreviewData] = useState<ObjectPreviewContent | null>(null)
  const [previewFileName, setPreviewFileName] = useState('')
  const [previewFileKey, setPreviewFileKey] = useState('')
  const [previewEditContent, setPreviewEditContent] = useState('')

  // OBS 操作统一入口，region 必须显式传入（桶操作使用桶所在区域）
  const invokeObs = useCallback((region: string, action: string, payload: Record<string, unknown> = {}) =>
    invoke('obs', action, payload, { region }), [invoke])

  const fetchObjects = useCallback(async (bucket: string, pf: string, bucketRegion: string) => {
    setObjLoading(true); setError(null); setSelectedRowKeys([])
    try {
      const result = await invokeObs(bucketRegion, 'obs:listObjects', { bucket, prefix: pf })
      if (result.success) setObjects(result.data as any[])
      else setError(result.error || '未知错误')
    } catch (err: any) { setError(err.message || String(err)) }
    finally { setObjLoading(false) }
  }, [invokeObs])

  const refreshObjects = useCallback(() => {
    if (browsingBucket && browsingBucketRegion) {
      fetchObjects(browsingBucket, prefix, browsingBucketRegion)
    }
  }, [browsingBucket, browsingBucketRegion, prefix, fetchObjects])

  const fetchBuckets = useCallback(async () => {
    if (!credentialId || currentProvider !== 'huawei') return
    setLoading(true); setError(null)
    try {
      const result = await invokeObs(activeRegion, 'obs:listBuckets')
      if (result.success) setBuckets(result.data as any[])
      else setError(result.error || '未知错误')
    } catch (err: any) { setError(err.message || String(err)) }
    finally { setLoading(false) }
  }, [credentialId, currentProvider, activeRegion, invokeObs])

  useEffect(() => {
    if (currentProvider !== 'huawei') return
    setBrowsingBucket(null)
    setBrowsingBucketRegion('')
    setObjects([])
    setPrefix('')
    setSelectedRowKeys([])
    fetchBuckets()
  }, [activeRegion, currentProvider, fetchBuckets])

  const invokeBucket = useCallback((action: string, payload: Record<string, unknown> = {}): Promise<CloudInvokeResult> => {
    if (!browsingBucketRegion) {
      return Promise.resolve({ success: false, error: '缺少桶所在区域' })
    }
    return invokeObs(browsingBucketRegion, action, payload)
  }, [browsingBucketRegion, invokeObs])

  if (currentProvider !== 'huawei') return <div style={{ padding: 24 }}><Empty description={t('huawei.ecs.switchHint')} /></div>

  const enterBucket = (bucketName: string, bucketRegion?: string) => {
    const region = bucketRegion || buckets.find((b) => b.name === bucketName)?.region || activeRegion
    setBrowsingBucket(bucketName)
    setBrowsingBucketRegion(region)
    setPrefix('')
    setError(null)
    fetchObjects(bucketName, '', region)
  }

  useEffect(() => {
    const st = location.state as { bucket?: string; region?: string } | null
    if (st?.bucket && !browsingBucket) {
      enterBucket(st.bucket, st.region)
      navigate('/huawei/obs', { replace: true, state: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])
  const enterFolder = (folderKey: string) => {
    if (!browsingBucket || !browsingBucketRegion) return
    setPrefix(folderKey)
    fetchObjects(browsingBucket, folderKey, browsingBucketRegion)
  }

  const prefixParts = prefix ? prefix.replace(/\/$/, '').split('/') : []
  const setBreadcrumbLevel = (level: number) => {
    if (level === -1) { setBrowsingBucket(null); setBrowsingBucketRegion(''); setObjects([]); setPrefix(''); return }
    if (!browsingBucket || !browsingBucketRegion) return
    const newPrefix = prefixParts.slice(0, level + 1).join('/') + '/'
    setPrefix(newPrefix)
    fetchObjects(browsingBucket, newPrefix, browsingBucketRegion)
  }

  // ---- 文件操作 ----

  const handleUpload = async () => {
    if (!credentialId || !browsingBucket) return
    try {
      const filePaths = await window.electronAPI.app.openFileDialog({ multiSelections: true })
      if (!filePaths || !Array.isArray(filePaths) || !filePaths.length) return
      for (const fp of filePaths) {
        const fileName = fp.split(/[/\\]/).pop() || 'file'
        const key = prefix ? `${prefix}${fileName}` : fileName
        message.loading({ content: `上传中: ${fileName}`, key: 'upload' })
        const r = await invokeBucket('obs:uploadFile', { bucket: browsingBucket, key, localPath: fp })
        if (!r.success) { message.error({ content: r.error || '上传失败', key: 'upload' }); return }
      }
      message.success({ content: `上传完成: ${filePaths.length} 个文件`, key: 'upload' })
      refreshObjects()
    } catch (err: any) { message.error(err.message || String(err)) }
  }

  const handleDownload = async (key: string) => {
    if (!browsingBucket) return
    try {
      const fileName = key.split('/').filter(Boolean).pop() || key
      const savePath = await window.electronAPI.app.saveFileDialog({ defaultPath: fileName })
      if (!savePath || typeof savePath !== 'string') return
      message.loading({ content: `下载中: ${fileName} 0%`, key: 'download', duration: 0 })
      const cleanup = window.electronAPI.cloud.onObsDownloadProgress((data: any) => {
        if (data.key === key && data.total > 0) {
          const pct = Math.round((data.loaded / data.total) * 100)
          message.loading({ content: `下载中: ${fileName} ${pct}%`, key: 'download', duration: 0 })
        }
      })
      const r = await invokeBucket('obs:downloadFile', { bucket: browsingBucket, key, savePath })
      cleanup()
      if (r.success) message.success({ content: `下载完成: ${fileName}`, key: 'download' })
      else message.error({ content: r.error || '下载失败', key: 'download' })
    } catch (err: any) { message.error(err.message || String(err)) }
  }

  const openPreview = useCallback(async (key: string) => {
    if (!browsingBucket) return
    const displayName = key.split('/').filter(Boolean).pop() || key
    setPreviewFileName(displayName)
    setPreviewFileKey(key)
    try {
      const r = await invokeBucket('obs:getObjectContent', { bucket: browsingBucket, key })
      if (r.success && r.data) {
        const data = r.data as ObjectPreviewContent
        setPreviewData(data)
        setPreviewEditContent(data.type === 'text' ? data.content : '')
        setPreviewVisible(true)
      } else { message.error(r.error || '预览失败') }
    } catch (err: any) { message.error(err.message || String(err)) }
  }, [browsingBucket, invokeBucket, message])

  const handleEditSave = async (newContent: string) => {
    if (!browsingBucket || !previewFileKey) return
    try {
      const r = await invokeBucket('obs:putObject', { bucket: browsingBucket, key: previewFileKey, content: newContent, contentType: 'text/plain' })
      if (r.success) { message.success('已保存'); setPreviewVisible(false); refreshObjects() }
      else message.error(r.error || '保存失败')
    } catch (err: any) { message.error(err.message || String(err)) }
  }

  const handleDelete = async (key: string) => {
    if (!browsingBucket) return
    try {
      const r = await invokeBucket('obs:deleteObject', { bucket: browsingBucket, key })
      if (r.success) { message.success('已删除'); refreshObjects() }
      else message.error(r.error || '删除失败')
    } catch (err: any) { message.error(err.message || String(err)) }
  }

  const handleBatchDelete = async () => {
    if (!browsingBucket || !selectedRowKeys.length) return
    try {
      const r = await invokeBucket('obs:deleteObjects', { bucket: browsingBucket, keys: selectedRowKeys as string[] })
      if (r.success) {
        message.success(`已删除 ${selectedRowKeys.length} 个对象`)
        setSelectedRowKeys([])
        refreshObjects()
      } else message.error(r.error || '批量删除失败')
    } catch (err: any) { message.error(err.message || String(err)) }
  }

  const handleCreateFolder = async () => {
    if (!browsingBucket || !newFolderName.trim()) return
    const folderKey = prefix ? `${prefix}${newFolderName.trim()}/` : `${newFolderName.trim()}/`
    try {
      const r = await invokeBucket('obs:createFolder', { bucket: browsingBucket, key: folderKey })
      if (r.success) { message.success('目录已创建'); setCreateFolderVisible(false); setNewFolderName(''); refreshObjects() }
      else message.error(r.error || '创建失败')
    } catch (err: any) { message.error(err.message || String(err)) }
  }

  const handleRename = async () => {
    if (!browsingBucket || !renameTarget || !newName.trim()) return
    const oldName = renameTarget.split('/').filter(Boolean).pop() || renameTarget
    if (newName.trim() === oldName) { setRenameVisible(false); return }
    const destKey = renameTarget.replace(new RegExp(`${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), newName.trim())
    try {
      const r = await invokeBucket('obs:copyObject', { sourceBucket: browsingBucket, sourceKey: renameTarget, destBucket: browsingBucket, destKey: destKey })
      if (r.success) {
        await invokeBucket('obs:deleteObject', { bucket: browsingBucket, key: renameTarget })
        message.success('已重命名')
        setRenameVisible(false)
        refreshObjects()
      } else message.error(r.error || '重命名失败')
    } catch (err: any) { message.error(err.message || String(err)) }
  }

  // ---- 桶列表视图 ----
  if (!browsingBucket) {
    const columns = [
      { title: t('huawei.obs.name'), dataIndex: 'name', key: 'name', render: (n: string, r: any) => <a onClick={() => enterBucket(n, r.region)}><FolderOutlined style={{ marginRight: 6, color: '#CF0A2C' }} />{n}</a> },
      { title: t('huawei.obs.region'), dataIndex: 'region', key: 'region', width: 180, render: (r: string) => <Tag>{r}</Tag> },
      { title: t('huawei.obs.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (d: string) => d ? new Date(d).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US') : '-' },
      {
        title: t('common.actionsCol'), key: 'actions', width: 160,
        render: (_: unknown, r: any) => (
          <Space size="small">
            <Button size="small" type="link" onClick={() => navigate(`/huawei/obs/${encodeURIComponent(r.name)}/detail`)}>
              {t('common.detail')}
            </Button>
            <Button size="small" type="link" onClick={() => enterBucket(r.name, r.region)}>
              {t('huawei.obs.browseObjects')}
            </Button>
          </Space>
        ),
      },
    ]
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <FolderOutlined style={{ marginRight: 8, color: '#CF0A2C' }} />
            {t('huawei.obs')}
            {!loading && <Tag style={{ marginLeft: 8 }}>{t('huawei.obs.bucketCount').replace('{n}', String(buckets.length))}</Tag>}
          </Title>
          <Button icon={<ReloadOutlined />} onClick={fetchBuckets} loading={loading}>{t('common.refresh')}</Button>
        </div>
        {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
        <Table columns={columns} dataSource={buckets} rowKey="name" loading={loading}
          pagination={false} locale={{ emptyText: <Empty description={t('huawei.obs.noBuckets')} /> }} size="middle" />
      </div>
    )
  }

  // ---- 对象浏览视图 ----
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    getCheckboxProps: (record: any) => ({ disabled: record.isFolder }),
    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT],
  }

  const columns = [
    { title: t('huawei.ecs.name'), dataIndex: 'key', key: 'key',
      render: (k: string, r: any) => r.isFolder
        ? <a onClick={() => enterFolder(k)}><FolderOutlined style={{ marginRight: 6, color: '#faad14' }} />{k.split('/').filter(Boolean).pop() || k}</a>
        : <span><FileOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />{k.split('/').filter(Boolean).pop() || k}</span>
    },
    { title: t('huawei.obs.size'), dataIndex: 'size', key: 'size', width: 120,
      render: (s: number, r: any) => formatObsBytes(s, r.isFolder && r.statsPartial),
    },
    { title: t('huawei.obs.lastModified'), dataIndex: 'lastModified', key: 'lm', width: 180,
      render: (d: string, r: any) => {
        if (!d) return '-'
        const ts = new Date(d).toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US')
        return r.isFolder && r.statsPartial ? `${ts} ~` : ts
      },
    },
    {
      title: t('common.actions'), key: 'actions', width: 180,
      render: (_: any, r: any) => (
        <Space size="small">
          {!r.isFolder && (
            <>
              <Tooltip title={t('common.detail')}>
                <Button size="small" icon={<EyeOutlined />} onClick={() => openPreview(r.key)} />
              </Tooltip>
              <Tooltip title={t('common.edit')}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openPreview(r.key)} />
              </Tooltip>
              <Tooltip title={t('s3.download')}>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r.key)} />
              </Tooltip>
              <Tooltip title={t('s3.rename')}>
                <Button size="small" icon={<SwapOutlined />} onClick={() => { setRenameTarget(r.key); setNewName(r.key.split('/').filter(Boolean).pop() || r.key); setRenameVisible(true) }} />
              </Tooltip>
            </>
          )}
          <Popconfirm title={r.isFolder ? t('s3.confirmDeleteFolder') : t('s3.confirmDelete')} onConfirm={() => handleDelete(r.key)}>
            <Tooltip title={t('common.delete')}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          <FolderOutlined style={{ marginRight: 8, color: '#CF0A2C' }} />
          {browsingBucket}
        </Title>
        <Space>
          <Tooltip title={t('s3.newFolder')}>
            <Button icon={<FolderAddOutlined />} onClick={() => { setNewFolderName(''); setCreateFolderVisible(true) }} />
          </Tooltip>
          <Tooltip title={t('s3.uploadFile')}>
            <Button type="primary" icon={<UploadOutlined />} onClick={handleUpload}>{t('s3.uploadFile')}</Button>
          </Tooltip>
          {selectedRowKeys.length > 0 && (
            <Popconfirm title={t('s3.confirmDeleteSelected').replace('{n}', String(selectedRowKeys.length))} onConfirm={handleBatchDelete}>
              <Button danger icon={<DeleteOutlined />}>{t('s3.deleteSelected').replace('{n}', String(selectedRowKeys.length))}</Button>
            </Popconfirm>
          )}
          <Button icon={<ArrowLeftOutlined />} onClick={() => setBreadcrumbLevel(-1)}>{t('common.back')}</Button>
          <Button icon={<ReloadOutlined />} onClick={() => fetchObjects(browsingBucket, prefix, browsingBucketRegion)} loading={objLoading} />
        </Space>
      </div>

      {/* 面包屑 */}
      <div style={{ marginBottom: 12, fontSize: 12 }}>
        <a onClick={() => setBreadcrumbLevel(-1)} style={{ color: '#1677ff' }}>{t('huawei.obs.allBuckets')}</a>
        <span style={{ margin: '0 6px', color: '#8c8c8c' }}>/</span>
        <a onClick={() => { setPrefix(''); fetchObjects(browsingBucket, '', browsingBucketRegion) }} style={{ color: '#1677ff' }}>{browsingBucket}</a>
        {prefixParts.map((part, idx) => (
          <span key={idx}>
            <span style={{ margin: '0 6px', color: '#8c8c8c' }}>/</span>
            {idx === prefixParts.length - 1
              ? <span>{part}</span>
              : <a onClick={() => setBreadcrumbLevel(idx)} style={{ color: '#1677ff' }}>{part}</a>}
          </span>
        ))}
      </div>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 12 }} />}

      <Table
        columns={columns} dataSource={objects} rowKey="key" loading={objLoading}
        rowSelection={rowSelection}
        pagination={false}
        locale={{ emptyText: <Empty description={t('huawei.obs.dirEmpty')} /> }}
        size="middle"
      />

      {/* 创建文件夹 Modal */}
      <Modal
        title={t('s3.newFolder')} open={createFolderVisible}
        onOk={handleCreateFolder} onCancel={() => { setCreateFolderVisible(false); setNewFolderName('') }}
        okText={t('common.create')} cancelText={t('common.cancel')}
      >
        <Input placeholder={t('s3.folderNamePh')} value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)} onPressEnter={handleCreateFolder} />
      </Modal>

      {/* 重命名 Modal */}
      <Modal
        title={t('s3.renameTitle')} open={renameVisible}
        onOk={handleRename} onCancel={() => { setRenameVisible(false); setNewName('') }}
        okText={t('common.confirm')} cancelText={t('common.cancel')}
      >
        <Input placeholder={t('s3.newFileNamePh')} value={newName}
          onChange={(e) => setNewName(e.target.value)} onPressEnter={handleRename} />
      </Modal>

      {/* 预览 Modal */}
      <Modal
        title={`${t('s3.preview')}: ${previewFileName}`} open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={800}
        footer={previewData?.type === 'text' ? [
          <Button key="cancel" onClick={() => setPreviewVisible(false)}>{t('common.cancel')}</Button>,
          <Button key="save" type="primary" onClick={() => handleEditSave(previewEditContent)}>{t('common.save')}</Button>,
        ] : [
          <Button key="close" onClick={() => setPreviewVisible(false)}>{t('common.close')}</Button>,
        ]}
      >
        {previewData?.type === 'image' && (
          <div style={{ textAlign: 'center', padding: 16, background: '#1e1e1e' }}>
            <img
              src={toPreviewDataUrl(previewData.contentType, previewData.base64)}
              alt={previewFileName}
              style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
            />
          </div>
        )}
        {previewData?.type === 'text' && (
          <Input.TextArea
            value={previewEditContent}
            onChange={(e) => setPreviewEditContent(e.target.value)}
            rows={20}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        )}
        {previewData?.type === 'binary' && (
          <Empty description={tf('filePreview.binaryCannotPreview', { type: previewData.contentType })} />
        )}
      </Modal>
    </div>
  )
}
