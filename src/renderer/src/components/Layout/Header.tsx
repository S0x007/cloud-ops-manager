import { useCallback, useEffect, useMemo } from 'react'
import { Layout, Select, Button, Space, Tag, Tooltip, Breadcrumb, Input } from 'antd'
import {
  BulbOutlined, BulbFilled, ReloadOutlined,
  UserOutlined, KeyOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, SearchOutlined,
  HomeOutlined, GlobalOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProfileStore } from '../../stores/profileStore'
import { useProviderStore, type ProviderId } from '../../stores/providerStore'
import { useRegionStore } from '../../stores/regionStore'
import { useProfiles } from '../../hooks/useProfiles'
import { useProviderSwitch } from '../../hooks/useProviderSwitch'
import { resetResourceStores } from '../../stores/resetResourceStores'
import { useI18n, useT, useTf } from '../../i18n'
import { ALL_PROVIDERS } from '../../providers/huawei'
import { ProviderSwitcher } from './ProviderSwitcher'

const { Header } = Layout

// 面包屑路径映射
function useBreadcrumbMap(): Record<string, string> {
  const t = useT()
  return useMemo(() => ({
    'ec2': t('sidebar.ec2'), 's3': t('sidebar.s3'), 'ecs': t('sidebar.ecs'),
    'volumes': t('sidebar.ebs'), 'snapshots': t('sidebar.snapshots'),
    'security-groups': t('sidebar.sg'), 'elastic-ips': t('sidebar.eip'),
    'key-pairs': t('sidebar.keypairs'), 'amis': t('sidebar.ami'),
    'network': t('sidebar.network2'), 'settings': t('settings.title'),
    'terminal': t('ec2.ssm'),
    'huawei': '华为云', 'obs': t('huawei.obs'), 'evs': t('huawei.evs'),
    'vpc': t('huawei.vpc'), 'ims': t('huawei.ims'), 'rds': t('huawei.rds'), 'eip': t('huawei.eip'),
  }), [t])
}

export interface HeaderBarProps {
  isDark: boolean
  onToggleTheme: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenSearch: () => void
}

export function HeaderBar({
  isDark, onToggleTheme, collapsed, onToggleCollapse, onOpenSearch,
}: HeaderBarProps): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const currentProvider = useProviderStore((s) => s.currentProvider)
  const { switchProvider } = useProviderSwitch()

  // 凭证
  const allCredentials = useProfileStore((s) => s.allCredentials)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const accountId = useProfileStore((s) => s.accountId)
  const isVerifying = useProfileStore((s) => s.isVerifying)
  const verifyError = useProfileStore((s) => s.verifyError)
  const setActiveCredential = useProfileStore((s) => s.setActiveCredential)

  const activeRegion = useRegionStore((s) => s.activeRegion)
  const regionCounts = useRegionStore((s) => s.regionCounts)
  const setActiveRegion = useRegionStore((s) => s.setActiveRegion)
  const { loadProfiles, verify, resetRegionScan } = useProfiles()
  const { lang, setLang } = useI18n()
  const t = useT()
  const tf = useTf()

  // 当前厂商元数据
  const providerMeta = ALL_PROVIDERS[currentProvider] || ALL_PROVIDERS['aws']

  // 按厂商过滤凭证
  const filteredCredentials = useMemo(
    () => allCredentials.filter((c: any) => (c.provider || 'aws') === currentProvider),
    [allCredentials, currentProvider],
  )

  // 区域选项（按厂商，含实例计数，语言感知）
  const regionOptions = useMemo(() =>
    providerMeta.regions.map((r: any) => {
      const count = regionCounts[r.id]
      const scanned = count !== undefined && count !== null
      const displayName = lang === 'zh-CN' ? (r.nameZh || r.name) : r.name
      return {
        value: r.id,
        searchLabel: `${displayName} (${r.id})`,
        label: (
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <span>{displayName}</span>
            <span style={{ color: '#8c8c8c', minWidth: 24, textAlign: 'right', marginLeft: 8 }}>
              {scanned
                ? (count === -1
                  ? <Tooltip title={lang === 'zh-CN' ? '扫描失败或网络超时' : 'Scan failed'}><span style={{ color: '#ff4d4f', fontSize: 10 }}>✕</span></Tooltip>
                  : count === -2
                  ? <Tooltip title={lang === 'zh-CN' ? '无 IAM 权限或未开通该区域' : 'No IAM access or region not enabled'}><span style={{ color: '#8c8c8c', fontSize: 10 }}>—</span></Tooltip>
                  : <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }} color={count > 0 ? 'blue' : 'default'}>{count}</Tag>)
                : <span style={{ color: '#bbb', fontSize: 10 }}>···</span>}
            </span>
          </span>
        ),
      }
    }),
    [providerMeta, regionCounts, lang],
  )

  // 凭证选项
  const credentialOptions = useMemo(() =>
    filteredCredentials.map((c: any) => ({
      value: c.id,
      searchLabel: c.name,
      label: (
        <Space size="small">
          <KeyOutlined style={{ color: '#faad14' }} />
          <span>{c.name}</span>
        </Space>
      ),
    })),
    [filteredCredentials],
  )

  const handleRegionChange = useCallback((region: string) => {
    resetResourceStores()
    setActiveRegion(region)
  }, [setActiveRegion])

  const handleCredentialChange = useCallback(
    (credId: string) => {
      if (!credId) return
      resetResourceStores()
      setActiveCredential(credId, 'custom' as any)
      const cred = filteredCredentials.find((c: any) => c.id === credId)
      if (cred?.region) setActiveRegion(cred.region)
      resetRegionScan()
      setTimeout(() => verify(credId), 50)
    },
    [filteredCredentials, setActiveCredential, verify, resetRegionScan, setActiveRegion],
  )

  // 切换厂商（含路由跳转）
  const handleProviderChange = useCallback((providerId: ProviderId) => {
    if (providerId === currentProvider) return
    switchProvider(providerId)
    // 跳转：如果当前路由属于旧厂商，回首页
    const path = location.pathname
    if (path !== '/' && !path.startsWith('/settings')) {
      if (providerId === 'huawei' && !path.startsWith('/huawei')) navigate('/')
      if (providerId === 'aws' && path.startsWith('/huawei')) navigate('/')
    }
  }, [currentProvider, switchProvider, location.pathname, navigate])

  // 面包屑
  const breadcrumbMap = useBreadcrumbMap()
  const pathParts = location.pathname.split('/').filter(Boolean)
    .filter((p) => !/^[a-zA-Z]:$/.test(p) && !p.endsWith('.html'))
  const breadcrumbItems = [
    { title: <a onClick={() => navigate('/')}><HomeOutlined /></a> },
    ...pathParts.map((part, idx) => {
      const isLast = idx === pathParts.length - 1
      const fullPath = '/' + pathParts.slice(0, idx + 1).join('/')
      const label = (() => {
        if (part === 'ecs' && pathParts[0] === 'huawei') return t('huawei.ecs')
        if (part === 'rds' && pathParts[0] === 'huawei') return t('huawei.rds')
        return breadcrumbMap[part] || part
      })()
      return { title: isLast ? label : <a onClick={() => navigate(fullPath)}>{label}</a> }
    }),
  ]

  // Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); onOpenSearch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpenSearch])

  return (
    <Header style={{
      background: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)',
      padding: '0 16px', height: 'calc(var(--sidebar-titlebar-height) + var(--sidebar-brand-height))',
      lineHeight: 'normal', display: 'flex', flexDirection: 'column',
      minWidth: 0, overflow: 'visible',
    }}>
      <div className="header-titlebar-row">
        <div className="header-titlebar-left">
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapse} style={{ fontSize: 15, width: 28, height: 24, flexShrink: 0 }} />
          <Input prefix={<SearchOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />}
            className="header-search-input"
            placeholder={`${t('common.searchPlaceholder')} (⌘K)`}
            onClick={onOpenSearch} readOnly
            suffix={<Tag style={{ fontSize: 10, lineHeight: '14px', padding: '0 4px', margin: 0 }}>⌘K</Tag>} />
        </div>

        <div className="header-titlebar-right">
          <Space size="small" className="header-controls-wrap">
            <ProviderSwitcher onChange={handleProviderChange} />
            <Select value={activeProfile || undefined}
              className="header-cred-select"
              style={{ fontSize: 12 }} size="small"
              options={credentialOptions} optionLabelProp="searchLabel"
              placeholder={t('common.selectCred')} onChange={handleCredentialChange}
              />
            <Select value={activeRegion}
              className="header-region-select"
              style={{ fontSize: 12 }} size="small"
              options={regionOptions} placeholder={t('common.selectRegion')}
              onChange={handleRegionChange} />
            <Tooltip title={accountId ? tf('common.verifiedAccount', { id: accountId }) : verifyError || t('common.clickToVerify')}>
              <Tag color={accountId ? 'green' : isVerifying ? 'processing' : 'default'}
                className="header-verify-tag"
                style={{ cursor: 'pointer', margin: 0, fontSize: 11, lineHeight: '18px' }}
                onClick={() => verify()}>
                {isVerifying ? t('common.verifying') : accountId || t('common.unverified')}
              </Tag>
            </Tooltip>
          </Space>
          <Space size={4} className="header-icon-actions">
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={loadProfiles} />
            <Button size="small" type="text" icon={<SettingOutlined />} onClick={() => navigate('/settings')} />
            <Button size="small" type="text" icon={<GlobalOutlined />}
              onClick={() => setLang(lang === 'zh-CN' ? 'en-US' : 'zh-CN')}
              title={lang === 'zh-CN' ? t('common.switchToEn') : t('common.switchToZh')} />
            <Button size="small" type="text"
              icon={isDark ? <BulbFilled /> : <BulbOutlined />} onClick={onToggleTheme} />
          </Space>
        </div>
      </div>
      <div className="header-toolbar-row">
        <Breadcrumb items={breadcrumbItems} style={{ fontSize: 12 }} />
      </div>
    </Header>
  )
}
