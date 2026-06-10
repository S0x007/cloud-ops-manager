import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Tag, Typography, Space, Button, Collapse, Skeleton, Empty, Alert,
  Modal, Form, Input, Select, Popconfirm, App,
} from 'antd'
import { ApartmentOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { useT } from '../../../i18n'

const { Title, Text } = Typography

const SG_PRESETS = [
  { label: 'SSH (22)', direction: 'ingress', protocol: 'tcp', multiport: '22', remoteIpPrefix: '0.0.0.0/0' },
  { label: 'HTTP (80)', direction: 'ingress', protocol: 'tcp', multiport: '80', remoteIpPrefix: '0.0.0.0/0' },
  { label: 'HTTPS (443)', direction: 'ingress', protocol: 'tcp', multiport: '443', remoteIpPrefix: '0.0.0.0/0' },
  { label: 'ICMP', direction: 'ingress', protocol: 'icmp', multiport: undefined, remoteIpPrefix: '0.0.0.0/0' },
  { label: 'All egress', direction: 'egress', protocol: 'any', multiport: undefined, remoteIpPrefix: '0.0.0.0/0' },
]

export function HuaweiVPCPage(): JSX.Element {
  const t = useT()
  const { message } = App.useApp()
  const { invoke: cloudInvoke, credentialId } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [vpcs, setVpcs] = useState<any[]>([])
  const [subnets, setSubnets] = useState<any[]>([])
  const [sg, setSg] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ruleModal, setRuleModal] = useState<any | null>(null)
  const [ruleForm] = Form.useForm()

  const invoke = useCallback((action: string, payload: Record<string, unknown> = {}) =>
    cloudInvoke('vpc', action, payload), [cloudInvoke])

  const fetchAll = useCallback(async () => {
    if (!credentialId || currentProvider !== 'huawei') return
    setLoading(true); setError(null)
    try {
      const [v, s, g] = await Promise.all([
        invoke('vpc:list'), invoke('vpc:subnets'), invoke('vpc:sg'),
      ])
      if (v.success) setVpcs(v.data as any[]); else setError(v.error ?? '加载失败')
      if (s.success) setSubnets(s.data as any[]); else setError(s.error ?? '加载失败')
      if (g.success) setSg(g.data as any[]); else setError(g.error ?? '加载失败')
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [credentialId, currentProvider, invoke])

  useEffect(() => { if (currentProvider === 'huawei') fetchAll() }, [fetchAll, currentProvider])

  const handleAddRule = async () => {
    if (!ruleModal) return
    const values = await ruleForm.validateFields()
    const r = await invoke('vpc:createSgRule', {
      securityGroupId: ruleModal.id,
      ...values,
    })
    if (r.success) {
      message.success(t('huawei.vpc.ruleAdded'))
      setRuleModal(null)
      ruleForm.resetFields()
      fetchAll()
    } else message.error(r.error || t('common.error'))
  }

  const handleDeleteRule = async (ruleId: string) => {
    const r = await invoke('vpc:deleteSgRule', { ruleId })
    if (r.success) { message.success(t('huawei.vpc.ruleDeleted')); fetchAll() }
    else message.error(r.error || t('common.error'))
  }

  if (currentProvider !== 'huawei') return <Card><Empty description={t('huawei.ecs.switchHint')} /></Card>

  const collapseItems = [
    { key: 'vpc', label: t('huawei.vpc.sectionVpc').replace('{n}', String(vpcs.length)), children: (
      <Table dataSource={vpcs} rowKey="id" pagination={false} size="small" locale={{ emptyText: t('huawei.vpc.noVpc') }}
        columns={[
          { title: t('huawei.vpc.name'), dataIndex: 'name', key: 'name' },
          { title: t('huawei.vpc.id'), dataIndex: 'id', key: 'id', width: 260, render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text> },
          { title: t('huawei.vpc.cidr'), dataIndex: 'cidr', key: 'cidr', width: 160, render: (c: string) => <Tag>{c}</Tag> },
          { title: t('huawei.vpc.status'), dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === 'OK' ? 'green' : 'default'}>{s}</Tag> },
          { title: t('huawei.vpc.isDefault'), dataIndex: 'isDefault', key: 'dft', width: 70, render: (d: boolean) => d ? <Tag color="blue">{t('common.yes')}</Tag> : '-' },
        ]} />
    )},
    { key: 'subnet', label: t('huawei.vpc.sectionSubnet').replace('{n}', String(subnets.length)), children: (
      <Table dataSource={subnets} rowKey="id" pagination={false} size="small" locale={{ emptyText: t('huawei.vpc.noSubnet') }}
        columns={[
          { title: t('huawei.vpc.name'), dataIndex: 'name', key: 'name' },
          { title: t('huawei.vpc.cidr'), dataIndex: 'cidr', key: 'cidr', width: 160, render: (c: string) => <Tag color="blue">{c}</Tag> },
          { title: t('huawei.vpc.gateway'), dataIndex: 'gatewayIp', key: 'gw', width: 140 },
          { title: t('huawei.vpc.az'), dataIndex: 'availabilityZone', key: 'az', width: 120 },
          { title: t('huawei.vpc.availableIps'), dataIndex: 'availableIpCount', key: 'avail', width: 80 },
        ]} />
    )},
    { key: 'sg', label: t('huawei.vpc.sectionSg').replace('{n}', String(sg.length)), children: (
      <Table dataSource={sg} rowKey="id" pagination={false} size="small" locale={{ emptyText: t('huawei.vpc.noSg') }}
        expandable={{ expandedRowRender: (r: any) => (
          <Table dataSource={r.rules} rowKey="id" pagination={false} size="small"
            columns={[
              { title: t('huawei.vpc.sgDirection'), dataIndex: 'direction', width: 80, render: (d: string) => <Tag color={d === 'ingress' ? 'green' : 'orange'}>{d === 'ingress' ? t('huawei.vpc.sgIngress') : t('huawei.vpc.sgEgress')}</Tag> },
              { title: t('huawei.vpc.sgProtocol'), dataIndex: 'protocol', width: 80 },
              { title: t('huawei.vpc.sgPort'), dataIndex: 'portRange', width: 120 },
              { title: t('huawei.vpc.sgRemote'), dataIndex: 'remoteIpPrefix', width: 180 },
              { title: t('huawei.vpc.sgDesc'), dataIndex: 'description', render: (d: string) => d || '-' },
              {
                title: t('common.actionsCol'), key: 'actions', width: 80,
                render: (_: unknown, rule: any) => (
                  <Popconfirm title={t('huawei.vpc.confirmDeleteRule')} onConfirm={() => handleDeleteRule(rule.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              },
            ]} />
        )}}
        columns={[
          { title: t('huawei.vpc.name'), dataIndex: 'name', key: 'name' },
          { title: t('huawei.vpc.id'), dataIndex: 'id', key: 'id', width: 260, render: (id: string) => <Text code style={{ fontSize: 11 }}>{id}</Text> },
          {
            title: t('common.actionsCol'), key: 'actions', width: 120,
            render: (_: unknown, record: any) => (
              <Button size="small" icon={<PlusOutlined />} onClick={() => {
                setRuleModal(record)
                ruleForm.setFieldsValue({ direction: 'ingress', protocol: 'tcp', ethertype: 'IPv4', remoteIpPrefix: '0.0.0.0/0' })
              }}>
                {t('huawei.vpc.addRule')}
              </Button>
            ),
          },
        ]} />
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <ApartmentOutlined style={{ marginRight: 8, color: '#CF0A2C' }} />
          {t('huawei.vpc')}
        </Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>{t('common.refresh')}</Button>
      </div>
      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
      {loading && !vpcs.length ? <Skeleton active /> : <Collapse items={collapseItems} defaultActiveKey={['vpc', 'subnet', 'sg']} />}

      <Modal
        title={`${t('huawei.vpc.addRule')} · ${ruleModal?.name || ''}`}
        open={!!ruleModal}
        onOk={handleAddRule}
        onCancel={() => setRuleModal(null)}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        width={560}
      >
        <Space wrap style={{ marginBottom: 16 }}>
          {SG_PRESETS.map((p) => (
            <Button key={p.label} size="small" onClick={() => ruleForm.setFieldsValue(p)}>
              {p.label}
            </Button>
          ))}
        </Space>
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="direction" label={t('huawei.vpc.sgDirection')} rules={[{ required: true }]}>
            <Select options={[
              { label: t('huawei.vpc.sgIngress'), value: 'ingress' },
              { label: t('huawei.vpc.sgEgress'), value: 'egress' },
            ]} />
          </Form.Item>
          <Form.Item name="protocol" label={t('huawei.vpc.sgProtocol')} rules={[{ required: true }]}>
            <Select options={['tcp', 'udp', 'icmp', 'any'].map((v) => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="multiport" label={t('huawei.vpc.sgPort')}>
            <Input placeholder="22 或 8000-8080" />
          </Form.Item>
          <Form.Item name="remoteIpPrefix" label={t('huawei.vpc.sgRemote')}>
            <Input placeholder="0.0.0.0/0" />
          </Form.Item>
          <Form.Item name="ethertype" label="Ethertype" initialValue="IPv4">
            <Select options={[{ label: 'IPv4', value: 'IPv4' }, { label: 'IPv6', value: 'IPv6' }]} />
          </Form.Item>
          <Form.Item name="description" label={t('huawei.vpc.sgDesc')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
