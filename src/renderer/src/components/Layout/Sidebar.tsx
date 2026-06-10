import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  CloudServerOutlined, FolderOutlined, ContainerOutlined,
  HddOutlined, CameraOutlined, SafetyOutlined, GlobalOutlined,
  KeyOutlined, ApartmentOutlined, BuildOutlined, SettingOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useProviderStore } from '../../stores/providerStore'
import { ALL_PROVIDERS } from '../../providers/huawei'
import { useT } from '../../i18n'
import appIcon from '../../../favicon.png'

const { Sider } = Layout

type MenuItem = Required<MenuProps>['items'][number]

/** 图标名 → React 组件 */
const ICONS: Record<string, React.ReactNode> = {
  CloudServerOutlined: <CloudServerOutlined />,
  FolderOutlined: <FolderOutlined />,
  ContainerOutlined: <ContainerOutlined />,
  HddOutlined: <HddOutlined />,
  CameraOutlined: <CameraOutlined />,
  SafetyOutlined: <SafetyOutlined />,
  GlobalOutlined: <GlobalOutlined />,
  KeyOutlined: <KeyOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  BuildOutlined: <BuildOutlined />,
  SettingOutlined: <SettingOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
}

function useMenuItems(): MenuItem[] {
  const t = useT()
  const currentProvider = useProviderStore((s) => s.currentProvider)
  const meta = ALL_PROVIDERS[currentProvider] || ALL_PROVIDERS['aws']
  return meta.menus.map((group) => ({
    key: group.key,
    label: t(group.labelKey),
    type: 'group' as const,
    children: group.children.map((item) => ({
      key: item.key,
      icon: ICONS[item.icon] || null,
      label: t(item.labelKey),
    })),
  }))
}

const isMacOS = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

export function Sidebar({ collapsed }: { collapsed: boolean }): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const menuItems = useMenuItems()

  const pathname = location.pathname
  const selectedKey = (() => {
    if (pathname === '/') return '/'
    const allKeys = menuItems.flatMap((item: any) =>
      item.children?.map((child: any) => child.key) ?? []
    )
    if (allKeys.includes(pathname)) return pathname
    // 详情页等高亮对应列表菜单
    const nested = allKeys.find((key) => key !== '/' && pathname.startsWith(`${key}/`))
    if (nested) return nested
    const base = '/' + (pathname.split('/')[1] || '')
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
        height: '100vh', position: 'sticky', top: 0, left: 0, transition: 'all 0.2s',
      }}
      trigger={null}
    >
      <div className={`sidebar-chrome${isMacOS ? '' : ' no-mac-titlebar'}`}>
        {isMacOS && <div className="sidebar-titlebar" aria-hidden />}
        <div className={`sidebar-brand${collapsed ? ' is-collapsed' : ''}`}>
          <div className="sidebar-brand-inner" onClick={() => navigate('/')}>
            <div className="sidebar-brand-mark">
              <img src={appIcon} alt="" className="sidebar-brand-icon" />
            </div>
            {!collapsed && <span className="sidebar-brand-text">Cloud Ops Manager</span>}
          </div>
        </div>
      </div>

      <Menu
        theme="dark" mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ borderInlineEnd: 'none', paddingTop: 8 }}
      />
    </Sider>
  )
}
