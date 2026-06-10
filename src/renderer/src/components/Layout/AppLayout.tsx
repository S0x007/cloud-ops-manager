import { useState, useCallback } from 'react'
import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { HeaderBar } from './Header'
import { CommandPalette } from './CommandPalette'

const { Content } = Layout

interface AppLayoutProps {
  isDark: boolean
  onToggleTheme: () => void
  children?: React.ReactNode
}

export function AppLayout({ isDark, onToggleTheme, children }: AppLayoutProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleOpenSearch = useCallback(() => setSearchOpen(true), [])
  const handleCloseSearch = useCallback(() => setSearchOpen(false), [])

  return (
    <Layout style={{ height: '100vh' }}>
      {/* 侧边栏 */}
      <Sidebar collapsed={collapsed} />

      <Layout style={{ minWidth: 0, flex: 1 }}>
        {/* 顶部栏 */}
        <HeaderBar
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onOpenSearch={handleOpenSearch}
        />

        {/* 内容区 */}
        <Content
          style={{
            margin: 12,
            padding: 20,
            background: 'var(--bg-content)',
            borderRadius: 8,
            overflow: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {children || <Outlet />}
        </Content>
      </Layout>

      {/* 全局命令面板 */}
      <CommandPalette open={searchOpen} onClose={handleCloseSearch} />
    </Layout>
  )
}
