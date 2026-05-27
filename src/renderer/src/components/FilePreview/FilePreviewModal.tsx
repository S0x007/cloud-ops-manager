import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Modal, Spin, Alert, Button, Space, App, Typography, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  EditOutlined, SaveOutlined, CloseOutlined, FileTextOutlined,
  DownloadOutlined, DesktopOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useT, useTf } from '../../i18n'

const { Text } = Typography

interface FilePreviewModalProps {
  open: boolean
  bucket: string
  fileKey: string
  fileName: string
  startInEditMode?: boolean    // 直接进入编辑模式
  onClose: () => void
  onSaved: () => void
}

type PreviewContent =
  | { type: 'text'; contentType: string; content: string; size: number }
  | { type: 'image'; contentType: string; tmpPath: string; size: number }
  | { type: 'binary'; contentType: string; size: number }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FilePreviewModal({
  open, bucket, fileKey, fileName, startInEditMode, onClose, onSaved,
}: FilePreviewModalProps): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const tf = useTf()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PreviewContent | null>(null)
  const [editing, setEditing] = useState(!!startInEditMode)
  const [editedContent, setEditedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    setError(null)
    setData(null)
    setChanged(false)
    try {
      const result = await window.electronAPI.s3.getObjectContent({
        region: activeRegion, profile: activeProfile, source: activeSource,
        bucket, key: fileKey,
      })
      setData(result as PreviewContent)
      if (result.type === 'text') {
        setEditedContent(result.content)
        setEditing(!!startInEditMode)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setLoading(false) }
  }, [open, bucket, fileKey, activeRegion, activeProfile, activeSource, startInEditMode])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (editing) textareaRef.current?.focus() }, [editing])

  // 行号计算
  const lineCount = useMemo(() => {
    if (!editing) return 0
    return editedContent.split('\n').length
  }, [editing, editedContent])

  // Ctrl/Cmd+S 保存
  useEffect(() => {
    if (!editing) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing, editedContent, data])

  // Tab 键插入空格
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newContent = editedContent.substring(0, start) + '  ' + editedContent.substring(end)
      setEditedContent(newContent)
      setChanged(true)
      // 恢复光标位置
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  // 编辑区滚动时同步行号滚动
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.electronAPI.s3.putObjectContent({
        region: activeRegion, profile: activeProfile, source: activeSource,
        bucket, key: fileKey, content: editedContent,
        contentType: data?.type === 'text' ? data.contentType : 'text/plain',
      })
      message.success(t('filePreview.saved'))
      setEditing(false)
      setChanged(false)
      setData((prev) =>
        prev?.type === 'text'
          ? { ...prev, content: editedContent, size: new Blob([editedContent]).size }
          : prev,
      )
      onSaved()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const handleCancelEdit = () => {
    if (changed) {
      Modal.confirm({
        title: t('filePreview.discardTitle'),
        icon: <ExclamationCircleOutlined />,
        content: t('filePreview.unsavedChanges'),
        okText: t('common.discard'),
        cancelText: t('common.continueEdit'),
        onOk: () => {
          if (data?.type === 'text') setEditedContent(data.content)
          setEditing(false)
          setChanged(false)
        },
      })
    } else {
      if (data?.type === 'text') setEditedContent(data.content)
      setEditing(false)
    }
  }

  const isEditable = data?.type === 'text'

  // 更多操作菜单
  const moreItems: MenuProps['items'] = [
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: t('filePreview.download'),
      onClick: () => window.electronAPI.app.saveFileDialog({ defaultPath: fileName }),
    },
  ]

  const editorHeight = Math.max(400, window.innerHeight * 0.6)

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          <span>{fileName}</span>
          {data && <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>({formatSize(data.size)})</Text>}
          {changed && <Text type="warning" style={{ fontSize: 11 }}>{t('filePreview.modified')}</Text>}
          {editing && <Text type="secondary" style={{ fontSize: 10 }}>{t('filePreview.saveHint')}</Text>}
        </Space>
      }
      open={open}
      onCancel={() => {
        if (changed) {
          Modal.confirm({ title: t('filePreview.discardUnsaved'), okText: t('common.discard'), cancelText: t('common.continueEdit'), onOk: onClose })
        } else { onClose() }
      }}
      width={960}
      footer={
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            {isEditable && !editing && (
              <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
                {t('common.edit')}
              </Button>
            )}
            {editing && (
              <>
                <Button icon={<CloseOutlined />} onClick={handleCancelEdit}>{t('common.cancel')}</Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!changed}>
                  {t('filePreview.saveToS3')}
                </Button>
              </>
            )}
            {isEditable && !editing && (
              <Dropdown menu={{ items: moreItems }}>
                <Button icon={<DesktopOutlined />}>{t('common.more')}</Button>
              </Dropdown>
            )}
          </Space>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </Space>
      }
      styles={{ body: { padding: 0, maxHeight: '75vh', overflow: 'hidden' } }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin tip={t('common.loading')} /></div>
      )}

      {error && (
        <Alert type="error" message={t('filePreview.loadFailed')} description={error}
          action={<Button onClick={load}>{t('common.retry')}</Button>} style={{ margin: 16 }} />
      )}

      {/* 预览模式 */}
      {data && data.type === 'text' && !editing && (
        <div style={{ position: 'relative', maxHeight: '65vh', overflow: 'auto', background: '#1e1e1e' }}>
          <pre style={{
            margin: 0, padding: '16px 20px', color: '#d4d4d4', fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', minHeight: 300,
          }}>
            {data.content}
          </pre>
        </div>
      )}

      {/* 编辑模式：行号 + textarea */}
      {data && data.type === 'text' && editing && (
        <div style={{ display: 'flex', height: editorHeight, background: '#1e1e1e', position: 'relative' }}>
          {/* 行号栏 */}
          <div
            ref={gutterRef}
            style={{
              width: 52, flexShrink: 0, overflow: 'hidden',
              background: '#252526', color: '#858585',
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              fontSize: 13, lineHeight: '20px', padding: '12px 0', textAlign: 'right',
              userSelect: 'none', borderRight: '1px solid #333',
            }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} style={{ paddingRight: 10, lineHeight: '20px', height: 20 }}>
                {i + 1}
              </div>
            ))}
          </div>
          {/* 编辑区 */}
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={(e) => { setEditedContent(e.target.value); setChanged(true) }}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            spellCheck={false}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              background: '#1e1e1e', color: '#d4d4d4',
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              fontSize: 13, lineHeight: '20px', padding: '12px 16px',
              tabSize: 2, whiteSpace: 'pre', overflowWrap: 'normal',
              overflowX: 'auto',
            }}
          />
        </div>
      )}

      {/* 图片预览 */}
      {data && data.type === 'image' && (
        <div style={{ textAlign: 'center', padding: 16, background: '#1e1e1e' }}>
          <img src={`file://${data.tmpPath}`} alt={fileName}
            style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }} />
        </div>
      )}

      {/* 二进制 */}
      {data && data.type === 'binary' && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#8c8c8c' }} />
          <p style={{ marginTop: 16, color: '#8c8c8c' }}>
            {tf('filePreview.binaryCannotPreview', { type: data.contentType })}
          </p>
        </div>
      )}
    </Modal>
  )
}
