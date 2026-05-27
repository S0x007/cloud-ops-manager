import { useState, useMemo, useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { AppLayout } from './components/Layout/AppLayout'
import { AppRoutes } from './routes'
import { ErrorBoundary } from './components/Common/ErrorBoundary'
import { useI18n } from './i18n'

export function App(): JSX.Element {
  const [isDark, setIsDark] = useState(false)
  const lang = useI18n((s) => s.lang)

  // 同步 data-theme 属性到 document，触发 CSS 变量切换
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const themeConfig = useMemo(
    () => ({
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
      },
    }),
    [isDark],
  )

  const toggleTheme = () => setIsDark(!isDark)
  const antdLocale = lang === 'zh-CN' ? zhCN : enUS

  return (
    <ErrorBoundary>
      <ConfigProvider theme={themeConfig} locale={antdLocale}>
        <AntApp>
          {/* HashRouter：Electron 在 Windows file:// 下 BrowserRouter 会把 C: 盘符写进路径，导致子路由空白 */}
          <HashRouter>
            <AppLayout isDark={isDark} onToggleTheme={toggleTheme}>
              <AppRoutes />
            </AppLayout>
          </HashRouter>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  )
}
