import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Col, Row, Statistic, Typography, Space, Tag, Skeleton } from 'antd'
import {
  CloudServerOutlined, FolderOutlined, ContainerOutlined,
  HddOutlined, SafetyOutlined, GlobalOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import { cloudInvoke } from '../lib/cloudInvoke'
import { useProfileStore } from '../stores/profileStore'
import { useProviderStore } from '../stores/providerStore'
import { useRegionStore } from '../stores/regionStore'
import { useT } from '../i18n'

const { Title, Text } = Typography

/** AWS 卡片配置 */
const AWS_CARDS = [
  { key: 'ec2', titleKey: 'dashboard.ec2', icon: <CloudServerOutlined />, color: '#1677ff', path: '/ec2' },
  { key: 's3', titleKey: 'dashboard.s3', icon: <FolderOutlined />, color: '#faad14', path: '/s3' },
  { key: 'volumes', titleKey: 'dashboard.ebs', icon: <HddOutlined />, color: '#52c41a', path: '/volumes' },
  { key: 'sg', titleKey: 'dashboard.sg', icon: <SafetyOutlined />, color: '#722ed1', path: '/security-groups' },
  { key: 'ecs', titleKey: 'dashboard.ecs', icon: <ContainerOutlined />, color: '#13c2c2', path: '/ecs' },
]

/** 华为云卡片配置 */
const HUAWEI_CARDS = [
  { key: 'ecs', titleKey: 'huawei.ecs', icon: <CloudServerOutlined />, color: '#CF0A2C', path: '/huawei/ecs' },
  { key: 'obs', titleKey: 'huawei.obs', icon: <FolderOutlined />, color: '#CF0A2C', path: '/huawei/obs' },
  { key: 'evs', titleKey: 'huawei.evs', icon: <HddOutlined />, color: '#CF0A2C', path: '/huawei/evs' },
  { key: 'rds', titleKey: 'huawei.rds', icon: <DatabaseOutlined />, color: '#CF0A2C', path: '/huawei/rds' },
  { key: 'vpc', titleKey: 'huawei.vpc', icon: <SafetyOutlined />, color: '#CF0A2C', path: '/huawei/vpc' },
]

interface QuickAction {
  icon: React.ReactNode; title: string; desc: string; path: string; color: string
}

function useAwsQuickActions(t: (k: string) => string): QuickAction[] {
  return [
    { icon: <CloudServerOutlined />, title: t('sidebar.ec2'), desc: t('dashboard.view'), path: '/ec2', color: '#1677ff' },
    { icon: <FolderOutlined />, title: t('sidebar.s3'), desc: t('dashboard.viewS3'), path: '/s3', color: '#faad14' },
    { icon: <HddOutlined />, title: t('sidebar.ebs'), desc: t('dashboard.viewEBS'), path: '/volumes', color: '#52c41a' },
    { icon: <SafetyOutlined />, title: t('sidebar.sg'), desc: t('dashboard.viewSG'), path: '/security-groups', color: '#722ed1' },
  ]
}

function useHuaweiQuickActions(t: (k: string) => string): QuickAction[] {
  return [
    { icon: <CloudServerOutlined />, title: t('huawei.ecs'), desc: t('dashboard.view'), path: '/huawei/ecs', color: '#CF0A2C' },
    { icon: <FolderOutlined />, title: t('huawei.obs'), desc: t('dashboard.viewS3'), path: '/huawei/obs', color: '#CF0A2C' },
    { icon: <HddOutlined />, title: t('huawei.evs'), desc: t('dashboard.viewEBS'), path: '/huawei/evs', color: '#CF0A2C' },
    { icon: <DatabaseOutlined />, title: t('huawei.rds'), desc: t('dashboard.viewRDS'), path: '/huawei/rds', color: '#CF0A2C' },
  ]
}

/** 安全获取数组长度 */
function safeLen(data: unknown): number {
  return Array.isArray(data) ? data.length : 0
}

/** 华为云 API 封装 */
function fetchHuaweiStats(profile: string, region: string): Promise<Record<string, number>> {
  const invoke = (svc: string, act: string) =>
    cloudInvoke({ provider: 'huawei', credentialId: profile, region, service: svc, action: act, payload: {} })

  return Promise.allSettled([
    invoke('ecs', 'ecs:list'),
    invoke('obs', 'obs:listBuckets'),
    invoke('evs', 'evs:list'),
    invoke('rds', 'rds:list'),
    invoke('vpc', 'vpc:list'),
  ]).then(([ecs, obs, evs, rds, vpc]) => ({
    ecs: ecs.status === 'fulfilled' && ecs.value.success ? safeLen(ecs.value.data) : 0,
    obs: obs.status === 'fulfilled' && obs.value.success ? safeLen(obs.value.data) : 0,
    evs: evs.status === 'fulfilled' && evs.value.success ? safeLen(evs.value.data) : 0,
    rds: rds.status === 'fulfilled' && rds.value.success ? safeLen(rds.value.data) : 0,
    vpc: vpc.status === 'fulfilled' && vpc.value.success ? safeLen(vpc.value.data) : 0,
  }))
}

export function Dashboard(): JSX.Element {
  const t = useT()
  const navigate = useNavigate()
  const currentProvider = useProviderStore((s) => s.currentProvider)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const accountId = useProfileStore((s) => s.accountId)

  const isHuawei = currentProvider === 'huawei'
  const providerTitle = isHuawei ? t('provider.huawei') : t('provider.aws')

  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const cards = isHuawei ? HUAWEI_CARDS : AWS_CARDS
  const quickActions = isHuawei ? useHuaweiQuickActions(t) : useAwsQuickActions(t)

  useEffect(() => {
    if (!activeProfile) { setLoading(false); setStats({}); return }
    setStats({})
    setLoading(true)

    if (isHuawei) {
      fetchHuaweiStats(activeProfile, activeRegion)
        .then(setStats)
        .finally(() => setLoading(false))
    } else {
      Promise.allSettled([
        window.electronAPI.ec2.listInstances({ region: activeRegion, profile: activeProfile, source: activeSource }),
        window.electronAPI.s3.listBuckets({ region: activeRegion, profile: activeProfile, source: activeSource }),
        window.electronAPI.ecs.listClusters({ region: activeRegion, profile: activeProfile, source: activeSource }),
        window.electronAPI.ec2Volumes.listVolumes({ region: activeRegion, profile: activeProfile, source: activeSource }),
        window.electronAPI.ec2Sg.listSecurityGroups({ region: activeRegion, profile: activeProfile, source: activeSource }),
      ]).then(([ec2, s3, ecs, vol, sg]) => {
        setStats({
          ec2: ec2.status === 'fulfilled' ? ec2.value.length : 0,
          s3: s3.status === 'fulfilled' ? s3.value.length : 0,
          volumes: vol.status === 'fulfilled' ? vol.value.length : 0,
          sg: sg.status === 'fulfilled' ? sg.value.length : 0,
          ecs: ecs.status === 'fulfilled' ? ecs.value.length : 0,
        })
      }).finally(() => setLoading(false))
    }
  }, [activeProfile, activeSource, activeRegion, isHuawei])

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          {providerTitle}
        </Title>
        <Space>
          <Tag color="blue">{activeProfile}</Tag>
          {accountId && <Tag color="green">{accountId}</Tag>}
          <Text type="secondary">{activeRegion}</Text>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        {cards.map((item) => (
          <Col xs={24} sm={12} md={8} lg={4.8} key={item.key}>
            {loading ? (
              <Card size="small"><Skeleton active paragraph={{ rows: 1 }} /></Card>
            ) : (
              <Card
                size="small" hoverable
                onClick={() => navigate(item.path)}
                style={{ cursor: 'pointer', borderTop: `3px solid ${item.color}` }}
              >
                <Statistic
                  title={t(item.titleKey)}
                  value={stats[item.key] ?? 0}
                  prefix={<span style={{ color: item.color }}>{item.icon}</span>}
                  suffix={t('common.count') || undefined}
                  valueStyle={{ fontSize: 24 }}
                />
              </Card>
            )}
          </Col>
        ))}
      </Row>

      <Title level={5} style={{ marginTop: 28, marginBottom: 12 }}>{t('dashboard.quick')}</Title>
      <Row gutter={[12, 12]}>
        {quickActions.map((action) => (
          <Col xs={12} sm={8} md={6} lg={4} key={action.path}>
            <Card size="small" hoverable onClick={() => navigate(action.path)} style={{ cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 28, color: action.color, marginBottom: 8 }}>{action.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{action.title}</div>
              <div style={{ color: '#8c8c8c', fontSize: 11, marginTop: 2 }}>{action.desc}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
