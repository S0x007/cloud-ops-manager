import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card, Table, Button, Space, Tag, Popconfirm, Modal, Form, Input, Select,
  InputNumber, Empty, Typography, App, Row, Col,
} from 'antd'
import {
  ReloadOutlined, PlusOutlined, DeleteOutlined, SafetyOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useT } from '../../i18n'
import type { ColumnsType } from 'antd/es/table'

const { Text } = Typography

interface SgRule {
  protocol: string; fromPort: number; toPort: number
  ipRanges: { cidr: string; description?: string }[]
  ipv6Ranges: { cidr: string; description?: string }[]
  userIdGroupPairs: { groupId?: string; groupName?: string; description?: string }[]
}

interface SecurityGroup {
  groupId: string; groupName: string; description: string; vpcId: string
  ipPermissions: SgRule[]; ipPermissionsEgress: SgRule[]
  tags: { key: string; value: string }[]
}

function useProtocols(t: (key: string) => string) {
  return useMemo(() => [
    { value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' },
    { value: 'icmp', label: 'ICMP' }, { value: '-1', label: t('sg.all') },
  ], [t])
}

function usePresetRules(t: (key: string) => string) {
  return useMemo(() => [
    { label: 'SSH (22)', protocol: 'tcp', from: 22, to: 22 },
    { label: 'HTTP (80)', protocol: 'tcp', from: 80, to: 80 },
    { label: 'HTTPS (443)', protocol: 'tcp', from: 443, to: 443 },
    { label: 'MySQL (3306)', protocol: 'tcp', from: 3306, to: 3306 },
    { label: 'PostgreSQL (5432)', protocol: 'tcp', from: 5432, to: 5432 },
    { label: 'Redis (6379)', protocol: 'tcp', from: 6379, to: 6379 },
    { label: t('sg.allTcp'), protocol: 'tcp', from: 1, to: 65535 },
    { label: t('sg.allTraffic'), protocol: '-1', from: 0, to: 65535 },
  ], [t])
}

function RuleTable({
  rules, direction, groupId, onRefresh,
}: {
  rules: SgRule[]; direction: 'ingress' | 'egress'; groupId: string; onRefresh: () => void
}) {
  const { message } = App.useApp()
  const t = useT()
  const protocols = useProtocols(t)
  const presetRules = usePresetRules(t)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()

  const handleDelete = async (rule: SgRule) => {
    const cidr = rule.ipRanges[0]?.cidr || rule.ipv6Ranges[0]?.cidr || '0.0.0.0/0'
    try {
      if (direction === 'ingress') {
        await window.electronAPI.ec2Sg.revokeIngress({
          region: activeRegion, profile: activeProfile, source: activeSource,
          groupId, protocol: rule.protocol, fromPort: rule.fromPort, toPort: rule.toPort, cidr,
        })
      } else {
        await window.electronAPI.ec2Sg.revokeEgress({
          region: activeRegion, profile: activeProfile, source: activeSource,
          groupId, protocol: rule.protocol, fromPort: rule.fromPort, toPort: rule.toPort, cidr,
        })
      }
      message.success(t('sg.msgRuleDeleted'))
      onRefresh()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAdd = async () => {
    const vals = await form.validateFields()
    try {
      if (direction === 'ingress') {
        await window.electronAPI.ec2Sg.authorizeIngress({
          region: activeRegion, profile: activeProfile, source: activeSource,
          groupId, ...vals,
        })
      } else {
        await window.electronAPI.ec2Sg.authorizeEgress({
          region: activeRegion, profile: activeProfile, source: activeSource,
          groupId, ...vals,
        })
      }
      message.success(t('sg.msgRuleAdded'))
      setAddOpen(false)
      form.resetFields()
      onRefresh()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }

  const columns = useMemo<ColumnsType<SgRule>>(() => [
    { title: t('sg.protocol'), dataIndex: 'protocol', width: 70, render: (p: string) => <Tag>{p === '-1' ? 'ALL' : p.toUpperCase()}</Tag> },
    {
      title: t('sg.port'), width: 100,
      render: (_: unknown, r: SgRule) => r.fromPort === 0 && r.toPort === 65535 ? t('sg.all') : r.fromPort === r.toPort ? String(r.fromPort) : `${r.fromPort}-${r.toPort}`,
    },
    {
      title: t('sg.source'), render: (_: unknown, r: SgRule) => {
        const ips = [...r.ipRanges.map((x) => x.cidr), ...r.ipv6Ranges.map((x) => x.cidr)]
        const groups = r.userIdGroupPairs.map((g) => g.groupId || g.groupName).filter(Boolean)
        return [...ips, ...groups].map((v, i) => <Tag key={i}>{v}</Tag>)
      },
    },
    {
      title: t('sg.description'), render: (_: unknown, r: SgRule) => {
        const descs = [...r.ipRanges.map((x) => x.description), ...r.ipv6Ranges.map((x) => x.description)]
        return descs.filter(Boolean).join(', ') || '-'
      },
    },
    {
      title: '', width: 60,
      render: (_: unknown, r: SgRule) => (
        <Popconfirm title={t('sg.confirmDeleteRule')} onConfirm={() => handleDelete(r)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ], [t])

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Text strong>{direction === 'ingress' ? t('sg.ingress') : t('sg.egress')}</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>{t('sg.addRule')}</Button>
      </Space>
      <Table dataSource={rules} rowKey={(_, i) => String(i)} columns={columns} size="small" pagination={false}
        locale={{ emptyText: t('sg.noRules') }} />

      <Modal
        title={direction === 'ingress' ? t('sg.addIngressRule') : t('sg.addEgressRule')}
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
      >
        <Form form={form} layout="vertical" initialValues={{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0', description: '' }}>
          <Form.Item label={t('sg.preset')}>
            <Select options={presetRules} placeholder={t('sg.quickSelect')} onChange={(_, opt: { protocol: string; from: number; to: number }) => {
              form.setFieldsValue({ protocol: opt.protocol, fromPort: opt.from, toPort: opt.to })
            }} allowClear />
          </Form.Item>
          <Space>
            <Form.Item name="protocol" label={t('sg.protocol')} rules={[{ required: true }]}>
              <Select options={protocols} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="fromPort" label={t('sg.fromPort')} rules={[{ required: true }]}>
              <InputNumber min={0} max={65535} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="toPort" label={t('sg.toPort')} rules={[{ required: true }]}>
              <InputNumber min={0} max={65535} style={{ width: 100 }} />
            </Form.Item>
          </Space>
          <Form.Item name="cidr" label="CIDR / IP" rules={[{ required: true }]}>
            <Input placeholder={t('sg.cidrPh')} />
          </Form.Item>
          <Form.Item name="description" label={t('sg.description')}>
            <Input placeholder={t('sg.optional')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export function SecurityGroupsPage(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [groups, setGroups] = useState<SecurityGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<SecurityGroup | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()

  const countLabel = t('common.count')
    ? `${groups.length} ${t('common.count')}`
    : String(groups.length)

  const fetchGroups = useCallback(async (forceRefresh = false) => {
    setGroups([])
    setSelected(null)
    setLoading(true)
    try {
      const result = await window.electronAPI.ec2Sg.listSecurityGroups({
        region: activeRegion, profile: activeProfile, source: activeSource, forceRefresh,
      })
      setGroups(result)
      setSelected((prev) => prev ?? (result.length > 0 ? result[0] : null))
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally { setLoading(false) }
  }, [activeRegion, activeProfile, activeSource])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const handleCreate = async () => {
    const vals = await createForm.validateFields()
    try {
      await window.electronAPI.ec2Sg.createSecurityGroup({
        region: activeRegion, profile: activeProfile, source: activeSource, ...vals,
      })
      message.success(t('sg.msgGroupCreated'))
      setCreateOpen(false)
      createForm.resetFields()
      fetchGroups()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (groupId: string) => {
    try {
      await window.electronAPI.ec2Sg.deleteSecurityGroup({
        region: activeRegion, profile: activeProfile, source: activeSource, groupId,
      })
      if (selected?.groupId === groupId) setSelected(null)
      message.success(t('sg.msgGroupDeleted'))
      fetchGroups()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <h2 style={{ margin: 0 }}>{t('sg.title')}</h2>
          <Tag>{countLabel}</Tag>
        </Space>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>{t('sg.create')}</Button>
          <Button icon={<ReloadOutlined />} onClick={() => fetchGroups(true)} loading={loading}>{t('common.refresh')}</Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card size="small" title={t('sg.list')} style={{ maxHeight: '70vh', overflow: 'auto' }}>
            {groups.map((sg) => (
              <div
                key={sg.groupId}
                onClick={() => setSelected(sg)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', borderRadius: 4,
                  background: selected?.groupId === sg.groupId ? '#e6f4ff' : 'transparent',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <Text strong>{sg.groupName}</Text>
                <br /><Text type="secondary" style={{ fontSize: 12 }}>{sg.groupId}</Text>
                <br /><Text type="secondary">{sg.description}</Text>
              </div>
            ))}
            {groups.length === 0 && <Empty description={t('sg.noGroups')} />}
          </Card>
        </Col>
        <Col span={16}>
          {selected && (
            <Card size="small" title={
              <Space>
                <SafetyOutlined />
                <span>{selected.groupName}</span>
                <Tag>{selected.groupId}</Tag>
                <Tag color="blue">VPC: {selected.vpcId}</Tag>
                <Popconfirm title={t('sg.confirmDeleteGroup')} onConfirm={() => handleDelete(selected.groupId)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
                </Popconfirm>
              </Space>
            }>
              <RuleTable rules={selected.ipPermissions} direction="ingress" groupId={selected.groupId} onRefresh={() => fetchGroups(true)} />
              <div style={{ marginTop: 24 }} />
              <RuleTable rules={selected.ipPermissionsEgress} direction="egress" groupId={selected.groupId} onRefresh={() => fetchGroups(true)} />
            </Card>
          )}
        </Col>
      </Row>

      <Modal title={t('sg.create')} open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} okText={t('common.create')} cancelText={t('common.cancel')}>
        <Form form={createForm} layout="vertical" initialValues={{ description: '' }}>
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}>
            <Input placeholder="my-security-group" />
          </Form.Item>
          <Form.Item name="description" label={t('sg.description')}>
            <Input placeholder={t('sg.descPh')} />
          </Form.Item>
          <Form.Item name="vpcId" label="VPC ID" rules={[{ required: true }]}>
            <Input placeholder="vpc-xxxxxxxx" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
