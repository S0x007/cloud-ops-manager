import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  CloudServerOutlined,
  FolderOutlined,
  ContainerOutlined,
  HddOutlined,
  CameraOutlined, SafetyOutlined, GlobalOutlined, KeyOutlined,
  ApartmentOutlined, BuildOutlined, SettingOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useT } from '../../i18n'

const { Sider } = Layout

type MenuItem = Required<MenuProps>['items'][number]

// 选中的 CSS 高亮
const selectedStyle: React.CSSProperties = {
  background: 'rgba(22, 119, 255, 0.12)',
  borderRadius: 6,
  fontWeight: 600,
}

function useMenuItems(): MenuItem[] {
  const t = useT()
  return [
    { key: 'group-compute', label: t('sidebar.compute'), type: 'group', children: [
      { key: '/ec2', icon: <CloudServerOutlined />, label: t('sidebar.ec2') },
      { key: '/ecs', icon: <ContainerOutlined />, label: t('sidebar.ecs') },
    ]},
    { key: 'group-storage', label: t('sidebar.storage'), type: 'group', children: [
      { key: '/s3', icon: <FolderOutlined />, label: t('sidebar.s3') },
      { key: '/volumes', icon: <HddOutlined />, label: t('sidebar.ebs') },
      { key: '/snapshots', icon: <CameraOutlined />, label: t('sidebar.snapshots') },
    ]},
    { key: 'group-network', label: t('sidebar.network'), type: 'group', children: [
      { key: '/security-groups', icon: <SafetyOutlined />, label: t('sidebar.sg') },
      { key: '/elastic-ips', icon: <GlobalOutlined />, label: t('sidebar.eip') },
      { key: '/key-pairs', icon: <KeyOutlined />, label: t('sidebar.keypairs') },
      { key: '/network', icon: <ApartmentOutlined />, label: t('sidebar.network2') },
    ]},
    { key: 'group-other', label: t('sidebar.other'), type: 'group', children: [
      { key: '/amis', icon: <BuildOutlined />, label: t('sidebar.ami') },
    ]},
    { key: 'group-settings', label: t('sidebar.settings'), type: 'group', children: [
      { key: '/settings', icon: <SettingOutlined />, label: t('sidebar.credentials') },
    ]},
  ]
}

const isMacOS = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

export function Sidebar({ collapsed }: { collapsed: boolean }): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const menuItems = useMenuItems()

  const pathname = location.pathname
  const selectedKey = (() => {
    if (pathname === '/') return '/'
    const parts = pathname.split('/')
    const base = '/' + (parts[1] || '')
    const allKeys = menuItems.flatMap((item: any) =>
      item.children?.map((child: any) => child.key) ?? []
    )
    if (allKeys.includes(pathname)) return pathname
    if (allKeys.includes(base)) return base
    return '/'
  })()

  return (
    <Sider
      width={252}
      collapsedWidth={80}
      collapsed={collapsed}
      theme="dark"
      style={{
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        transition: 'all 0.2s',
      }}
      trigger={null}
    >
      {/* 侧栏顶区：交通灯行 + 品牌行 */}
      <div className={`sidebar-chrome${isMacOS ? '' : ' no-mac-titlebar'}`}>
        {isMacOS && <div className="sidebar-titlebar" aria-hidden />}
        <div className={`sidebar-brand${collapsed ? ' is-collapsed' : ''}`}>
          <div className="sidebar-brand-inner" onClick={() => navigate('/')}>
            <div className="sidebar-brand-mark">
              <CloudServerOutlined />
            </div>
            {!collapsed && <span className="sidebar-brand-text">AWS Ops</span>}
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{
          borderInlineEnd: 'none',
          paddingTop: 8,
        }}
      />
    </Sider>
  )
}
