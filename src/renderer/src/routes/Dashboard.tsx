import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Col, Row, Statistic, Typography, Space, Tag, Skeleton, List } from 'antd'
import {
  CloudServerOutlined, FolderOutlined, ContainerOutlined,
  HddOutlined, SafetyOutlined, GlobalOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../stores/profileStore'
import { useRegionStore } from '../stores/regionStore'
import { useT } from '../i18n'

const { Title, Text } = Typography

interface QuickAction {
  icon: React.ReactNode; title: string; desc: string; path: string; color: string
}

function useQuickActions(t: (k: string) => string): QuickAction[] {
  return [
    { icon: <CloudServerOutlined />, title: t('sidebar.ec2'), desc: t('dashboard.view'), path: '/ec2', color: '#1677ff' },
    { icon: <FolderOutlined />, title: t('sidebar.s3'), desc: t('dashboard.viewS3'), path: '/s3', color: '#faad14' },
    { icon: <HddOutlined />, title: t('sidebar.ebs'), desc: t('dashboard.viewEBS'), path: '/volumes', color: '#52c41a' },
    { icon: <SafetyOutlined />, title: t('sidebar.sg'), desc: t('dashboard.viewSG'), path: '/security-groups', color: '#722ed1' },
    { icon: <ContainerOutlined />, title: t('sidebar.ecs'), desc: t('dashboard.viewECS'), path: '/ecs', color: '#13c2c2' },
    { icon: <GlobalOutlined />, title: t('sidebar.eip'), desc: t('dashboard.viewEIP'), path: '/elastic-ips', color: '#eb2f96' },
  ]
}

export function Dashboard(): JSX.Element {
  const t = useT()
  const navigate = useNavigate()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const accountId = useProfileStore((s) => s.accountId)

  const [stats, setStats] = useState({ ec2: 0, s3: 0, ecs: 0, volumes: 0, sg: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeProfile) { setLoading(false); setStats({ ec2: 0, s3: 0, ecs: 0, volumes: 0, sg: 0 }); return }
    setStats({ ec2: 0, s3: 0, ecs: 0, volumes: 0, sg: 0 })
    setLoading(true)
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
        ecs: ecs.status === 'fulfilled' ? ecs.value.length : 0,
        volumes: vol.status === 'fulfilled' ? vol.value.length : 0,
        sg: sg.status === 'fulfilled' ? sg.value.length : 0,
      })
    }).finally(() => setLoading(false))
  }, [activeProfile, activeSource, activeRegion])

  return (
    <div>
      {/* 欢迎区 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>{t('dashboard.title')}</Title>
        <Space>
          <Tag color="blue">{activeProfile}</Tag>
          {accountId && <Tag color="green">{accountId}</Tag>}
          <Text type="secondary">{activeRegion}</Text>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        {[
          { title: t('dashboard.ec2'), value: stats.ec2, icon: <CloudServerOutlined />, color: '#1677ff', path: '/ec2' },
          { title: t('dashboard.s3'), value: stats.s3, icon: <FolderOutlined />, color: '#faad14', path: '/s3' },
          { title: t('dashboard.ebs'), value: stats.volumes, icon: <HddOutlined />, color: '#52c41a', path: '/volumes' },
          { title: t('dashboard.sg'), value: stats.sg, icon: <SafetyOutlined />, color: '#722ed1', path: '/security-groups' },
          { title: t('dashboard.ecs'), value: stats.ecs, icon: <ContainerOutlined />, color: '#13c2c2', path: '/ecs' },
        ].map((item) => (
          <Col xs={24} sm={12} md={8} lg={4.8} key={item.title}>
            {loading ? (
              <Card size="small"><Skeleton active paragraph={{ rows: 1 }} /></Card>
            ) : (
              <Card
                size="small" hoverable
                onClick={() => navigate(item.path)}
                style={{ cursor: 'pointer', borderTop: `3px solid ${item.color}` }}
              >
                <Statistic
                  title={item.title}
                  value={item.value}
                  prefix={<span style={{ color: item.color }}>{item.icon}</span>}
                  suffix={t('common.count') || undefined}
                  valueStyle={{ fontSize: 24 }}
                />
              </Card>
            )}
          </Col>
        ))}
      </Row>

      {/* 快捷入口 */}
      <Title level={5} style={{ marginTop: 28, marginBottom: 12 }}>{t('dashboard.quick')}</Title>
      <Row gutter={[12, 12]}>
        {useQuickActions(t).map((action) => (
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
