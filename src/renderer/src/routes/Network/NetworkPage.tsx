import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Button, Space, Tag, Collapse, Empty, Typography, App } from 'antd'
import { ReloadOutlined, ClusterOutlined, ApartmentOutlined, NodeIndexOutlined, GatewayOutlined, WifiOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import type { ColumnsType } from 'antd/es/table'
import { useT } from '../../i18n'

const { Text } = Typography

export function NetworkPage(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const ap = useProfileStore((s) => s.activeProfile)
  const as = useProfileStore((s) => s.activeSource)
  const ar = useRegionStore((s) => s.activeRegion)
  const [vpcs, setVpcs] = useState<any[]>([])
  const [subnets, setSubnets] = useState<any[]>([])
  const [rts, setRts] = useState<any[]>([])
  const [igws, setIgws] = useState<any[]>([])
  const [nats, setNats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (force = false) => {
    setVpcs([]); setSubnets([]); setRts([]); setIgws([]); setNats([])
    setLoading(true)
    try {
      const [v, s, r, i, n] = await Promise.all([
        window.electronAPI.ec2Network.listVpcs({ region: ar, profile: ap, source: as, forceRefresh: force }),
        window.electronAPI.ec2Network.listSubnets({ region: ar, profile: ap, source: as, forceRefresh: force }),
        window.electronAPI.ec2Network.listRouteTables({ region: ar, profile: ap, source: as, forceRefresh: force }),
        window.electronAPI.ec2Network.listInternetGateways({ region: ar, profile: ap, source: as, forceRefresh: force }),
        window.electronAPI.ec2Network.listNatGateways({ region: ar, profile: ap, source: as, forceRefresh: force }),
      ])
      setVpcs(v); setSubnets(s); setRts(r); setIgws(i); setNats(n)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [ar, ap, as])
  useEffect(() => { load() }, [load])

  const vpcColumns = useMemo<ColumnsType<any>>(() => [
    { title: `${t('network.vpc')} ID`, dataIndex: 'vpcId', width: 180, render: (id: string) => <Text code>{id}</Text> },
    { title: 'CIDR', dataIndex: 'cidr', width: 140, render: (c: string) => <Tag>{c}</Tag> },
    { title: t('network.default'), dataIndex: 'default', width: 60, render: (d: boolean) => d ? <Tag color="green">{t('common.yes')}</Tag> : '-' },
  ], [t])

  const subnetColumns = useMemo<ColumnsType<any>>(() => [
    { title: t('network.subnetId'), dataIndex: 'subnetId', width: 200, render: (id: string) => <Text code>{id}</Text> },
    { title: t('network.vpc'), dataIndex: 'vpcId', width: 150, render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text> },
    { title: 'CIDR', dataIndex: 'cidr', width: 140, render: (c: string) => <Tag>{c}</Tag> },
    { title: t('ebs.az'), dataIndex: 'az', width: 100 },
    { title: t('network.availableIps'), dataIndex: 'availableIps', width: 80 },
  ], [t])

  const routeDetailColumns = useMemo<ColumnsType<any>>(() => [
    { title: t('network.dest'), dataIndex: 'dest', width: 180, render: (d: string) => <Tag>{d}</Tag> },
    { title: t('network.nextHop'), dataIndex: 'target', width: 200, render: (target: string) => <Text code style={{ fontSize: 11 }}>{target}</Text> },
    { title: t('ebs.state'), dataIndex: 'state', width: 60, render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
  ], [t])

  const routeTableColumns = useMemo<ColumnsType<any>>(() => [
    { title: t('network.routeTableId'), dataIndex: 'routeTableId', width: 200, render: (id: string) => <Text code>{id}</Text> },
    { title: t('network.vpc'), dataIndex: 'vpcId', width: 150, render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text> },
    { title: t('network.associatedSubnets'), render: (_: unknown, rt: any) => rt.associations.map((a: any) => <Tag key={a.subnetId}>{a.subnetId || 'main'}</Tag>) },
  ], [t])

  const igwColumns = useMemo<ColumnsType<any>>(() => [
    { title: `${t('network.igw')} ID`, dataIndex: 'igwId', width: 200, render: (id: string) => <Text code>{id}</Text> },
    { title: t('network.vpc'), dataIndex: 'vpcId', width: 150, render: (id: string) => id ? <Text code style={{ fontSize: 11 }}>{id}</Text> : '-' },
    { title: t('ebs.state'), dataIndex: 'state', width: 80, render: (s: string) => <Tag color={s === 'available' ? 'green' : 'default'}>{s}</Tag> },
  ], [t])

  const natColumns = useMemo<ColumnsType<any>>(() => [
    { title: `${t('network.nat')} ID`, dataIndex: 'natId', width: 200, render: (id: string) => <Text code>{id}</Text> },
    { title: t('eip.publicIp'), dataIndex: 'publicIp', width: 140, render: (ip: string) => ip ? <Text copyable>{ip}</Text> : '-' },
    { title: t('ebs.state'), dataIndex: 'state', width: 80, render: (s: string) => <Tag color={s === 'available' ? 'green' : s === 'pending' ? 'orange' : 'red'}>{s}</Tag> },
  ], [t])

  const collapseItems = useMemo(() => [
    { key: 'vpcs', label: <Space><ClusterOutlined />{t('network.vpc')} ({vpcs.length})</Space>, children: (
      <Table size="small" dataSource={vpcs} rowKey="vpcId" pagination={false} locale={{ emptyText: <Empty description={t('network.noVpc')} /> }}
        columns={vpcColumns} />
    )},
    { key: 'subnets', label: <Space><ApartmentOutlined />{t('network.subnet')} ({subnets.length})</Space>, children: (
      <Table size="small" dataSource={subnets} rowKey="subnetId" pagination={false} locale={{ emptyText: <Empty description={t('network.noSubnet')} /> }}
        columns={subnetColumns} />
    )},
    { key: 'rts', label: <Space><NodeIndexOutlined />{t('network.routes')} ({rts.length})</Space>, children: (
      <Table size="small" dataSource={rts} rowKey="routeTableId" pagination={false} locale={{ emptyText: <Empty description={t('network.noRouteTable')} /> }}
        expandable={{ expandedRowRender: (rt: any) => (
          <Table size="small" dataSource={rt.routes} rowKey="dest" pagination={false} columns={routeDetailColumns} />
        ), rowExpandable: () => true }}
        columns={routeTableColumns} />
    )},
    { key: 'igws', label: <Space><GatewayOutlined />{t('network.igw')} ({igws.length})</Space>, children: (
      <Table size="small" dataSource={igws} rowKey="igwId" pagination={false} locale={{ emptyText: <Empty description={t('network.noIgw')} /> }}
        columns={igwColumns} />
    )},
    { key: 'nats', label: <Space><WifiOutlined />{t('network.nat')} ({nats.length})</Space>, children: (
      <Table size="small" dataSource={nats} rowKey="natId" pagination={false} locale={{ emptyText: <Empty description={t('network.noNat')} /> }}
        columns={natColumns} />
    )},
  ], [t, vpcs.length, subnets.length, rts.length, igws.length, nats.length, vpcColumns, subnetColumns, routeDetailColumns, routeTableColumns, igwColumns, natColumns])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space><h2 style={{ margin: 0 }}>{t('network.title')}</h2><Tag color="blue">{ar}</Tag></Space>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(true)}>{t('common.refresh')}</Button>
      </div>
      <Collapse size="small" defaultActiveKey={['vpcs']} items={collapseItems} />
    </div>
  )
}
