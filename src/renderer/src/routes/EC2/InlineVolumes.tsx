import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Table, Tag, Spin, Empty, Typography, Alert, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useT, t as translate } from '../../i18n'

const { Text } = Typography

function formatApiError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('request limit exceeded') || lower.includes('throttl') || lower.includes('rate exceeded')) {
    return translate('ec2.apiThrottled')
  }
  return raw
}

export function InlineVolumes({ instanceId }: { instanceId: string }): JSX.Element {
  const t = useT()
  const ap = useProfileStore((s) => s.activeProfile)
  const as = useProfileStore((s) => s.activeSource)
  const ar = useRegionStore((s) => s.activeRegion)
  const [volumes, setVolumes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.ec2Volumes.listInstanceVolumes({
        region: ar, profile: ap, source: as, instanceId,
      })
      setVolumes(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(formatApiError(msg))
      setVolumes([])
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [ar, ap, as, instanceId])

  useEffect(() => { load() }, [load])

  const columns = useMemo(
    () => [
      { title: t('ec2.volumeId'), dataIndex: 'volumeId', width: 180, render: (id: string) => <Text code>{id}</Text> },
      { title: t('ec2.volumeSize'), dataIndex: 'size', width: 60, render: (s: number) => `${s} GB` },
      { title: t('ec2.volumeType'), dataIndex: 'volumeType', width: 70, render: (vt: string) => <Tag>{vt}</Tag> },
      { title: t('ec2.state'), dataIndex: 'state', width: 80, render: (s: string) => <Tag color={s === 'in-use' ? 'green' : 'default'}>{s}</Tag> },
      { title: t('ec2.deviceName'), render: (_: unknown, r: any) => r.attachments?.map((a: any) => <Tag key={a.device}>{a.device}</Tag>) },
      { title: t('ec2.encrypted'), dataIndex: 'encrypted', width: 60, render: (e: boolean) => e ? <Tag color="green">{t('common.yes')}</Tag> : '-' },
    ],
    [t],
  )

  if (loading) return <Spin />

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('ec2.volumesLoadFailed')}
        description={error}
        action={<Button icon={<ReloadOutlined />} onClick={load}>{t('common.retry')}</Button>}
      />
    )
  }

  if (volumes.length === 0) return <Empty description={t('ec2.noVolumes')} />

  return (
    <Table size="small" dataSource={volumes} rowKey="volumeId" pagination={false} columns={columns} />
  )
}
