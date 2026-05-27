import { useCallback, useEffect, useMemo } from 'react'
import { Layout, Select, Button, Space, Tag, Tooltip, Breadcrumb, Input } from 'antd'
import {
  BulbOutlined,
  BulbFilled,
  ReloadOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  KeyOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  HomeOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useProfiles } from '../../hooks/useProfiles'
import { resetResourceStores } from '../../stores/resetResourceStores'
import { useI18n, useT, useTf } from '../../i18n'

const { Header } = Layout

const regions = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'ap-east-1', label: 'Asia Pacific (Hong Kong)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
]

export interface HeaderBarProps {
  isDark: boolean
  onToggleTheme: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenSearch: () => void
}

// 面包屑路径映射
function useBreadcrumbMap(): Record<string, string> {
  const t = useT()
  return useMemo(() => ({
    'ec2': t('sidebar.ec2'),
    's3': t('sidebar.s3'),
    'ecs': t('sidebar.ecs'),
    'volumes': t('sidebar.ebs'),
    'snapshots': t('sidebar.snapshots'),
    'security-groups': t('sidebar.sg'),
    'elastic-ips': t('sidebar.eip'),
    'key-pairs': t('sidebar.keypairs'),
    'amis': t('sidebar.ami'),
    'network': t('sidebar.network2'),
    'settings': t('settings.title'),
    'terminal': t('ec2.ssm'),
  }), [t])
}

export function HeaderBar({
  isDark, onToggleTheme, collapsed, onToggleCollapse, onOpenSearch,
}: HeaderBarProps): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const allCredentials = useProfileStore((s) => s.allCredentials)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
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

  const handleRegionChange = useCallback((region: string) => {
    resetResourceStores()
    setActiveRegion(region)
  }, [setActiveRegion])

  // 切换凭证：验证 + 全区域扫描
  const handleCredentialChange = useCallback(
    (value: string) => {
      const idx = value.indexOf('::')
      if (idx === -1) return
      const source = value.slice(0, idx)
      const id = value.slice(idx + 2)
      resetResourceStores()
      setActiveCredential(id, source as 'aws-config' | 'custom')
      const cred = allCredentials.find((c) => c.id === id && c.source === source)
      if (cred?.region) {
        setActiveRegion(cred.region)
      }
      resetRegionScan()
      setTimeout(() => {
        verify(id, source as 'aws-config' | 'custom')
      }, 50)
    },
    [allCredentials, setActiveCredential, verify, resetRegionScan, setActiveRegion],
  )

  // 构建面包屑（过滤 Windows file:// 路径里可能出现的 C:、index.html 等段）
  const breadcrumbMap = useBreadcrumbMap()
  const pathParts = location.pathname
    .split('/')
    .filter(Boolean)
    .filter((part) => !/^[a-zA-Z]:$/.test(part))
    .filter((part) => !part.endsWith('.html'))
  const breadcrumbItems = [
    { title: <a onClick={() => navigate('/')}><HomeOutlined /></a> },
    ...pathParts.map((part, idx) => {
      const isLast = idx === pathParts.length - 1
      const fullPath = '/' + pathParts.slice(0, idx + 1).join('/')
      const label = breadcrumbMap[part] || (part.startsWith('i-') ? part : part)
      return {
        title: isLast ? label : <a onClick={() => navigate(fullPath)}>{label}</a>,
      }
    }),
  ]

  const credentialLabel = useCallback(
    (c: (typeof allCredentials)[number]) =>
      c.id === 'default' && c.source === 'aws-config' ? t('profile.defaultProfile') : c.name,
    [t, allCredentials],
  )

  const credentialOptions = allCredentials.map((c) => ({
    value: `${c.source}::${c.id}`,
    searchLabel: credentialLabel(c),
    label: (
      <Space size="small">
        {c.source === 'custom' ? <KeyOutlined style={{ color: '#faad14' }} /> : <UserOutlined style={{ color: '#1677ff' }} />}
        <span>{credentialLabel(c)}</span>
      </Space>
    ),
  }))

  // 区域选项：包含 EC2 数量
  const regionOptions = regions.map((r) => {
    const count = regionCounts[r.value]
    const scanned = count !== undefined && count !== null
    return {
      value: r.value,
      label: (
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11 }}>{r.label}</span>
          <span style={{ fontSize: 10, color: '#8c8c8c', minWidth: 20, textAlign: 'right' }}>
            {scanned ? (
              <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
                color={count > 0 ? 'blue' : 'default'}>
                {count >= 0 ? count : '—'}
              </Tag>
            ) : (
              <span style={{ color: '#bbb' }}>···</span>
            )}
          </span>
        </span>
      ),
    }
  })

  // Cmd+K 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenSearch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpenSearch])

  return (
    <Header
      style={{
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 16px',
        height: 'calc(var(--sidebar-titlebar-height) + var(--sidebar-brand-height))',
        lineHeight: 'normal',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 上排：与侧栏交通灯行对齐 */}
      <div className="header-titlebar-row">
        <Space size="small">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapse}
            style={{ fontSize: 15, width: 28, height: 24 }}
          />
          <Input
            prefix={<SearchOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />}
            placeholder={`${t('common.searchPlaceholder')} (⌘K)`}
            style={{ width: 300, height: 24, fontSize: 12, borderRadius: 6 }}
            onClick={onOpenSearch}
            readOnly
            suffix={<Tag style={{ fontSize: 10, lineHeight: '14px', padding: '0 4px', margin: 0 }}>⌘K</Tag>}
          />
        </Space>

        <Space size="small">
          <Select
            value={`${activeSource}::${activeProfile}`}
            style={{ width: 168, fontSize: 12 }}
            size="small"
            options={credentialOptions}
            optionLabelProp="searchLabel"
            placeholder={t('common.selectCred')}
            onChange={handleCredentialChange}
          />
          <Select
            value={activeRegion}
            style={{ width: 176, fontSize: 11 }}
            size="small"
            options={regionOptions}
            placeholder={t('common.selectRegion')}
            showSearch
            optionFilterProp="label"
            onChange={handleRegionChange}
            optionLabelProp="label"
          />
          <Tooltip title={accountId ? tf('common.verifiedAccount', { id: accountId }) : verifyError || t('common.clickToVerify')}>
            <Tag
              color={accountId ? 'green' : isVerifying ? 'processing' : 'default'}
              style={{ cursor: 'pointer', margin: 0, fontSize: 11, lineHeight: '18px' }}
              onClick={() => verify()}
            >
              {isVerifying ? t('common.verifying') : accountId || t('common.unverified')}
            </Tag>
          </Tooltip>
          <Button size="small" type="text" icon={<ReloadOutlined />} onClick={loadProfiles} />
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={() => navigate('/settings')} />
          <Button
            size="small" type="text"
            icon={<GlobalOutlined />}
            onClick={() => setLang(lang === 'zh-CN' ? 'en-US' : 'zh-CN')}
            title={lang === 'zh-CN' ? t('common.switchToEn') : t('common.switchToZh')}
          />
          <Button
            size="small" type="text"
            icon={isDark ? <BulbFilled /> : <BulbOutlined />}
            onClick={onToggleTheme}
          />
        </Space>
      </div>

      {/* 下排：与侧栏品牌行对齐 */}
      <div className="header-toolbar-row">
        <Breadcrumb items={breadcrumbItems} style={{ fontSize: 12 }} />
      </div>
    </Header>
  )
}
