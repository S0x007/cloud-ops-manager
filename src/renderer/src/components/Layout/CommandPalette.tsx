import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Modal, Input, List, Tag, Typography, Empty, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined, CloudServerOutlined, FolderOutlined,
  CodeOutlined, CameraOutlined, SettingOutlined, DatabaseOutlined,
} from '@ant-design/icons'
import { useCloudOperation } from '../../hooks/useCloudOperation'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useProviderStore } from '../../stores/providerStore'
import { useT } from '../../i18n'
import { formatAwsInstanceSpec, formatHuaweiFlavorSpec } from '../../lib/instanceSpec'

const { Text } = Typography

interface SearchResult {
  id: string; type: string; label: string; desc: string; path: string
}

interface CommandPaletteProps { open: boolean; onClose: () => void }

export function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element {
  const navigate = useNavigate()
  const t = useT()
  const inputRef = useRef<any>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const { invoke } = useCloudOperation()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const quickActions = useMemo(() => {
    if (currentProvider === 'huawei') {
      return [
        { id: 'action-ecs', icon: <CloudServerOutlined />, label: t('huawei.ecs'), path: '/huawei/ecs' },
        { id: 'action-obs', icon: <FolderOutlined />, label: t('huawei.obs'), path: '/huawei/obs' },
        { id: 'action-rds', icon: <DatabaseOutlined />, label: t('huawei.rds'), path: '/huawei/rds' },
        { id: 'action-settings', icon: <SettingOutlined />, label: t('cmd.openSettings'), path: '/settings' },
      ]
    }
    return [
      { id: 'action-ssm', icon: <CodeOutlined />, label: t('cmd.ssmConnect'), path: '/terminal' },
      { id: 'action-snapshot', icon: <CameraOutlined />, label: t('cmd.createSnapshot'), path: '/volumes' },
      { id: 'action-s3', icon: <FolderOutlined />, label: t('cmd.uploadS3'), path: '/s3' },
      { id: 'action-settings', icon: <SettingOutlined />, label: t('cmd.openSettings'), path: '/settings' },
    ]
  }, [currentProvider, t])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery('') }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !activeProfile) { setSearchResults([]); return }
    setSearching(true)
    const results: SearchResult[] = []
    const lower = q.toLowerCase()

    try {
      if (currentProvider === 'huawei') {
        const [ecsR, obsR, rdsR] = await Promise.allSettled([
          invoke('ecs', 'ecs:list', {}),
          invoke('obs', 'obs:listBuckets', {}),
          invoke('rds', 'rds:list', {}),
        ])

        if (ecsR.status === 'fulfilled' && ecsR.value.success && Array.isArray(ecsR.value.data)) {
          for (const s of ecsR.value.data as any[]) {
            const id = String(s.id ?? '')
            const name = String(s.name ?? '')
            if (id.toLowerCase().includes(lower) || name.toLowerCase().includes(lower)) {
              results.push({
                id, type: 'ECS', label: name || id,
                desc: `${formatHuaweiFlavorSpec(s.vcpus, s.memoryMB)} · ${s.status ?? ''}`,
                path: `/huawei/ecs/${id}`,
              })
            }
          }
        }

        if (obsR.status === 'fulfilled' && obsR.value.success && Array.isArray(obsR.value.data)) {
          for (const b of obsR.value.data as any[]) {
            const name = String(b.name ?? b.bucket ?? '')
            if (name.toLowerCase().includes(lower)) {
              results.push({
                id: name, type: 'OBS', label: name,
                desc: b.location ? `Region: ${b.location}` : '',
                path: '/huawei/obs',
              })
            }
          }
        }

        if (rdsR.status === 'fulfilled' && rdsR.value.success && Array.isArray(rdsR.value.data)) {
          for (const r of rdsR.value.data as any[]) {
            const id = String(r.id ?? '')
            const name = String(r.name ?? '')
            if (id.toLowerCase().includes(lower) || name.toLowerCase().includes(lower)) {
              results.push({
                id, type: 'RDS', label: name || id,
                desc: `${r.type ?? ''} · ${r.status ?? ''}`,
                path: `/huawei/rds/${id}`,
              })
            }
          }
        }
      } else {
        const [ec2R, s3R] = await Promise.allSettled([
          window.electronAPI.ec2.listInstances({
            region: activeRegion, profile: activeProfile, source: activeSource,
          }),
          window.electronAPI.s3.listBuckets({
            region: activeRegion, profile: activeProfile, source: activeSource,
          }),
        ])

        if (ec2R.status === 'fulfilled') {
          for (const i of ec2R.value) {
            if (i.instanceId.toLowerCase().includes(lower) || (i.name || '').toLowerCase().includes(lower) || i.publicIpAddress.includes(lower)) {
              results.push({
                id: i.instanceId, type: 'EC2', label: i.name || i.instanceId,
                desc: `${formatAwsInstanceSpec(i.instanceType, t)} · ${i.state}`, path: `/ec2/${i.instanceId}`,
              })
            }
          }
        }

        if (s3R.status === 'fulfilled') {
          for (const b of s3R.value) {
            if (b.name.toLowerCase().includes(lower)) {
              results.push({
                id: b.name, type: 'S3', label: b.name,
                desc: b.region ? `Region: ${b.region}` : '', path: `/s3/${b.name}`,
              })
            }
          }
        }
      }
    } catch { /* ignore */ }

    setSearchResults(results.slice(0, 20))
    setSearching(false)
  }, [invoke, activeRegion, activeProfile, activeSource, currentProvider, t])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const filteredActions = quickActions.filter((a) => !query || a.label.toLowerCase().includes(query.toLowerCase()))

  const typeIcon = (type: string) => {
    if (type === 'S3' || type === 'OBS') return <FolderOutlined style={{ color: '#faad14' }} />
    if (type === 'RDS') return <DatabaseOutlined style={{ color: '#CF0A2C' }} />
    if (type === 'ECS' && currentProvider === 'huawei') return <CloudServerOutlined style={{ color: '#CF0A2C' }} />
    return <CloudServerOutlined style={{ color: '#1677ff' }} />
  }

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
                avatar={typeIcon(item.type)}
                title={<span>{item.label} <Tag style={{ fontSize: 10 }}>{item.type}</Tag></span>}
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
        <Tag style={{ fontSize: 10 }}>{currentProvider === 'huawei' ? 'Huawei Cloud' : 'AWS'}</Tag>
      </div>
    </Modal>
  )
}
