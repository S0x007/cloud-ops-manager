import { useState, useCallback, useEffect, useMemo } from 'react'
import { Spin, Alert, Button, Empty } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useT, useTf } from '../../i18n'

interface MetricData { label: string; timestamps: string[]; values: number[] }

function MetricBar({ data }: { data: MetricData }) {
  const t = useT()
  const tf = useTf()
  if (!data.values.length) {
    return <Empty description={t('ec2.noMetricsData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }
  const max = Math.max(...data.values, 1)
  const latest = data.values[data.values.length - 1]
  const avg = data.values.reduce((a, b) => a + b, 0) / data.values.length
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{data.label}</span>
        <span>
          {tf('ec2.metricsStats', {
            latest: latest.toFixed(2),
            avg: avg.toFixed(2),
            max: max.toFixed(2),
          })}
        </span>
      </div>
      <div style={{ height: 28, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        {data.values.map((v, i) => (
          <div key={i} title={`${new Date(data.timestamps[i]).toLocaleTimeString()}: ${v.toFixed(2)}`}
            style={{
              height: '100%', flex: 1, marginRight: 1,
              background: v > max * 0.8 ? '#ff4d4f' : v > max * 0.5 ? '#faad14' : '#1677ff',
              opacity: 0.8,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function EC2MetricsTab({ instanceId }: { instanceId: string }): JSX.Element {
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const [data, setData] = useState<MetricData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const result = await window.electronAPI.cw.getInstanceMetrics({
        region: activeRegion, profile: activeProfile, source: activeSource, instanceId,
      })
      setData(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setLoading(false) }
  }, [instanceId, activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const metricBars = useMemo(
    () => data.map((d) => <MetricBar key={d.label} data={d} />),
    [data],
  )

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{t('ec2.metricsPeriod')}</span>
        <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>
          {t('common.refresh')}
        </Button>
      </div>
      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
      {error && (
        <Alert type="error" message={error} action={<Button onClick={load}>{t('common.retry')}</Button>} />
      )}
      {!loading && !error && metricBars}
    </div>
  )
}
