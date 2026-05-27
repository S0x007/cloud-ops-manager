import { useState, useCallback, useRef } from 'react'
import { Button, Typography, Spin, Alert, Empty } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useT, t as translate } from '../../i18n'

const { Text } = Typography
const MIN_INTERVAL_MS = 15_000

function formatConsoleError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('request limit exceeded') || lower.includes('throttl') || lower.includes('rate exceeded')) {
    return translate('ec2.consoleThrottled')
  }
  if (lower.includes('请求过于频繁') || lower.includes('请') && lower.includes('秒后再试')) {
    return translate('ec2.consoleCooldown')
  }
  return raw
}

export function ConsoleOutput({ instanceId }: { instanceId: string }): JSX.Element {
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const [output, setOutput] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const lastLoadAt = useRef(0)

  const load = useCallback(async () => {
    if (inFlight.current) return
    const now = Date.now()
    if (lastLoadAt.current && now - lastLoadAt.current < MIN_INTERVAL_MS) {
      setError(translate('ec2.consoleCooldown'))
      return
    }
    inFlight.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.ec2.getConsoleOutput({
        region: activeRegion, profile: activeProfile, source: activeSource, instanceId,
      })
      lastLoadAt.current = Date.now()
      setOutput(result.output || translate('ec2.consoleEmpty'))
      setTimestamp(result.timestamp || '')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(formatConsoleError(msg))
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [instanceId, activeRegion, activeProfile, activeSource])

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('ec2.consoleLast64k')}
          {timestamp && ` — ${new Date(timestamp).toLocaleString()}`}
        </Text>
        <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>
          {t('common.refresh')}
        </Button>
      </div>

      <Alert type="info" showIcon message={t('ec2.consoleLoadHint')} style={{ marginBottom: 12 }} />

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}

      {error && !loading && (
        <Alert
          type="error"
          message={error}
          action={<Button onClick={load}>{t('common.retry')}</Button>}
        />
      )}

      {!loading && !error && output === null && (
        <Empty description={t('ec2.consoleLoadHint')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}

      {!loading && !error && output !== null && (
        <pre style={{
          background: '#000', color: '#0f0', padding: 16, borderRadius: 6,
          fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
          maxHeight: 500, overflow: 'auto', minHeight: 200, margin: 0,
        }}>
          {output}
        </pre>
      )}
    </div>
  )
}
