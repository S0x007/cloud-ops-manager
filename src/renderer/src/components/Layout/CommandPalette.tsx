import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Modal, Input, List, Tag, Typography, Empty, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined, CloudServerOutlined, FolderOutlined,
  CodeOutlined, CameraOutlined, SettingOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useT } from '../../i18n'

const { Text } = Typography

interface SearchResult {
  id: string; type: 'instance' | 'bucket' | 'action'; label: string; desc: string; path: string
}

interface CommandPaletteProps { open: boolean; onClose: () => void }

export function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element {
  const navigate = useNavigate()
  const t = useT()
  const inputRef = useRef<any>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const quickActions = useMemo(() => [
    { id: 'action-ssm', icon: <CodeOutlined />, label: t('cmd.ssmConnect'), path: '/terminal' },
    { id: 'action-snapshot', icon: <CameraOutlined />, label: t('cmd.createSnapshot'), path: '/volumes' },
    { id: 'action-s3', icon: <FolderOutlined />, label: t('cmd.uploadS3'), path: '/s3' },
    { id: 'action-settings', icon: <SettingOutlined />, label: t('cmd.openSettings'), path: '/settings' },
  ], [t])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery('') }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !activeProfile) { setSearchResults([]); return }
    setSearching(true)
    const results: SearchResult[] = []
    const lower = q.toLowerCase()

    try {
      const instances = await window.electronAPI.ec2.listInstances({
        region: activeRegion, profile: activeProfile, source: activeSource,
      })
      for (const i of instances) {
        if (i.instanceId.toLowerCase().includes(lower) || (i.name || '').toLowerCase().includes(lower) || i.publicIpAddress.includes(lower)) {
          results.push({ id: i.instanceId, type: 'instance', label: i.name || i.instanceId, desc: `${i.instanceType} · ${i.state}`, path: `/ec2/${i.instanceId}` })
        }
      }
    } catch { /* ignore */ }

    try {
      const buckets = await window.electronAPI.s3.listBuckets({
        region: activeRegion, profile: activeProfile, source: activeSource,
      })
      for (const b of buckets) {
        if (b.name.toLowerCase().includes(lower)) {
          results.push({ id: b.name, type: 'bucket', label: b.name, desc: b.region ? `Region: ${b.region}` : '', path: `/s3/${b.name}` })
        }
      }
    } catch { /* ignore */ }

    setSearchResults(results.slice(0, 20))
    setSearching(false)
  }, [activeRegion, activeProfile, activeSource])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const filteredActions = quickActions.filter((a) => !query || a.label.toLowerCase().includes(query.toLowerCase()))

  const execute = (item: SearchResult) => {
    onClose()
    navigate(item.path)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} closable={false} width={560}
      styles={{ body: { padding: 0 } }} style={{ top: 120 }} maskStyle={{ background: 'rgba(0,0,0,0.3)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Input ref={inputRef} prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
          placeholder={t('cmd.searchPlaceholder')}
          bordered={false} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} style={{ fontSize: 14 }} />
      </div>
      <div style={{ maxHeight: 360, overflow: 'auto' }}>
        {searching && <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>}

        {!searching && searchResults.length > 0 && (
          <List size="small" dataSource={searchResults} renderItem={(item) => (
            <List.Item onClick={() => execute(item)} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #fafafa' }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#f5f5f5'}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
              <List.Item.Meta
                avatar={item.type === 'instance' ? <CloudServerOutlined style={{ color: '#1677ff' }} /> : <FolderOutlined style={{ color: '#faad14' }} />}
                title={<span>{item.label} <Tag style={{ fontSize: 10 }}>{item.type === 'instance' ? 'EC2' : 'S3'}</Tag></span>}
                description={item.desc}
              />
            </List.Item>
          )} />
        )}

        {!searching && query && searchResults.length === 0 && (
          <Empty description={t('cmd.noResults')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
        )}

        {!query && (
          <>
            <div style={{ padding: '8px 16px', fontSize: 11, color: '#8c8c8c', fontWeight: 600 }}>{t('cmd.quickActions')}</div>
            {filteredActions.map((a) => (
              <div key={a.id} onClick={() => { onClose(); navigate(a.path) }}
                style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #fafafa' }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#f5f5f5'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}>
                {a.icon}<span>{a.label}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>{t('cmd.footer')}</Text>
      </div>
    </Modal>
  )
}
