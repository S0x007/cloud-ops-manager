import { Component, ErrorInfo, ReactNode } from 'react'
import { Result, Button, Typography } from 'antd'
import { t } from '../../i18n'

const { Paragraph } = Typography

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: 24 }}>
          <Result
            status="error"
            title={t('error.title')}
            subTitle={t('error.subtitle')}
            extra={
              <Button type="primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}>
                {t('error.refresh')}
              </Button>
            }
          >
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'left' }}>
              <Paragraph copyable style={{ background: '#fff2f0', padding: 16, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
                {this.state.error?.message || t('error.unknown')}
              </Paragraph>
            </div>
          </Result>
        </div>
      )
    }
    return this.props.children
  }
}
