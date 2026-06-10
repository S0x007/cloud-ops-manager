import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Card, Form, Input, Select, InputNumber, Button, Typography, Space, Switch, Divider, Alert, Skeleton, Empty } from 'antd'
import { ArrowLeftOutlined, CloudServerOutlined } from '@ant-design/icons'
import { useCloudOperation } from '../../../hooks/useCloudOperation'
import { useProviderStore } from '../../../stores/providerStore'
import { useT } from '../../../i18n'
import { formatHuaweiFlavorSpec } from '../../../lib/instanceSpec'

const { Title } = Typography
const ROOT_VOLUME_TYPES = ['SSD', 'GPSSD', 'SAS', 'SATA', 'ESSD', 'GPSSD2', 'ESSD2']

export function CreateECSPage(): JSX.Element {
  const t = useT()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { invoke, credentialId } = useCloudOperation()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // 下拉数据源
  const [flavors, setFlavors] = useState<any[]>([])
  const [images, setImages] = useState<any[]>([])
  const [vpcs, setVpcs] = useState<any[]>([])
  const [subnets, setSubnets] = useState<any[]>([])
  const [sgList, setSgList] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedVpc, setSelectedVpc] = useState<string>()
  const [usePublicIp, setUsePublicIp] = useState(false)
  const [authMode, setAuthMode] = useState<'password' | 'keypair'>('password')

  const loadDropdownData = useCallback(async () => {
    if (!credentialId || currentProvider !== 'huawei') return
    setLoadingData(true); setLoadError(null)
    try {
      const [flR, imR, vpcR, sgR] = await Promise.all([
        invoke('ecs', 'ecs:listFlavors', { az: '' }),
        invoke('ims', 'ims:list', {}),
        invoke('vpc', 'vpc:list', {}),
        invoke('vpc', 'vpc:sg', {}),
      ])
      if (flR.success) setFlavors(flR.data as any[])
      if (imR.success) setImages((imR.data as any[]).filter((i: any) => i.status === 'active'))
      if (vpcR.success) setVpcs(vpcR.data as any[])
      if (sgR.success) setSgList(sgR.data as any[])
    } catch (err: any) {
      setLoadError(err.message || String(err))
    } finally { setLoadingData(false) }
  }, [credentialId, currentProvider, invoke])

  const loadSubnets = useCallback(async (vpcId: string) => {
    if (!vpcId) return
    try {
      const r = await invoke('vpc', 'vpc:subnets', {})
      if (r.success) setSubnets((r.data as any[]).filter((s: any) => s.vpcId === vpcId))
    } catch { /* ignore */ }
  }, [invoke])

  useEffect(() => { loadDropdownData() }, [loadDropdownData])

  const handleVpcChange = useCallback((vpcId: string) => {
    setSelectedVpc(vpcId)
    form.setFieldValue('subnetId', undefined)
    loadSubnets(vpcId)
  }, [form, loadSubnets])

  const handleSubmit = useCallback(async (values: any) => {
    setSubmitting(true)
    try {
      const params: Record<string, unknown> = {
        name: values.name,
        flavorRef: values.flavorRef,
        imageRef: values.imageRef,
        vpcId: values.vpcId,
        subnetId: values.subnetId,
        rootVolumeType: values.rootVolumeType,
        rootVolumeSize: values.rootVolumeSize,
        availabilityZone: values.availabilityZone,
        count: values.count || 1,
      }
      if (values.securityGroupIds?.length) params.securityGroupIds = values.securityGroupIds
      if (authMode === 'password' && values.adminPass) params.adminPass = values.adminPass
      if (authMode === 'keypair' && values.keyName) params.keyName = values.keyName
      if (usePublicIp) {
        params.publicIp = { eipType: '5_bgp', bandwidthSize: values.bandwidthSize || 5 }
      }
      if (values.dataVolumes?.length) {
        params.dataVolumes = values.dataVolumes.filter((dv: any) => dv.type && dv.size)
      }

      const r = await invoke('ecs', 'ecs:createServer', params)
      if (r.success) {
        const data = r.data as any
        message.success(`${t('huawei.ecs.createSuccess')}，实例 ID: ${(data.serverIds || []).join(', ') || '-'}`)
        navigate('/huawei/ecs')
      } else {
        message.error(r.error || '创建失败')
      }
    } catch (err: any) { message.error(err.message || String(err)) }
    finally { setSubmitting(false) }
  }, [invoke, authMode, usePublicIp, navigate, message, t])

  if (currentProvider !== 'huawei') return <Card><Empty description={t('huawei.ecs.switchHint')} /></Card>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/huawei/ecs')}>{t('ec2.backToList')}</Button>
          <CloudServerOutlined style={{ fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>{t('huawei.ecs.createTitle')}</Title>
        </Space>
      </div>

      {loadError && <Alert type="error" message={loadError} style={{ marginBottom: 16 }} />}

      {loadingData ? <Card><Skeleton active paragraph={{ rows: 12 }} /></Card> : (
        <Card>
          <Form form={form} layout="vertical" onFinish={handleSubmit}
            initialValues={{ rootVolumeType: 'GPSSD', rootVolumeSize: 40, bandwidthSize: 5, count: 1 }}
          >
            <Divider orientation="left">{t('ec2.basicInfo')}</Divider>
            <Form.Item name="name" label={t('common.name')} rules={[{ required: true, message: '请输入实例名称' }]}>
              <Input placeholder="my-ecs-instance" maxLength={64} />
            </Form.Item>

            <Space wrap style={{ width: '100%' }} size="large">
              <Form.Item name="flavorRef" label={t('huawei.ecs.flavor')} rules={[{ required: true }]} style={{ minWidth: 280 }}>
                <Select showSearch placeholder={t('huawei.ecs.flavorSelect')}
                  options={flavors.map((f: any) => ({
                    label: formatHuaweiFlavorSpec(f.vcpus, f.ram),
                    value: f.id,
                  }))}
                  filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  notFoundContent={<Empty description={t('common.empty')} />}
                />
              </Form.Item>

              <Form.Item name="availabilityZone" label={t('ec2.az')} style={{ minWidth: 160 }}>
                <Select allowClear placeholder="(默认)" options={
                  Array.from(new Set(flavors.map((f: any) => f.availabilityZone).filter(Boolean))).map((az: any) => ({ label: az, value: az }))
                } />
              </Form.Item>

              <Form.Item name="count" label={t('huawei.ecs.count')} style={{ minWidth: 100 }}>
                <InputNumber min={1} max={100} />
              </Form.Item>
            </Space>

            <Form.Item name="imageRef" label={t('huawei.ecs.imageSelect')} rules={[{ required: true }]}>
              <Select showSearch placeholder={t('huawei.ecs.imageSelect')}
                options={images.map((i: any) => ({
                  label: `${i.name} (${i.osType || ''}, ${i.platform || ''})`,
                  value: i.id,
                }))}
                filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                notFoundContent={<Empty description={t('common.empty')} />}
              />
            </Form.Item>

            <Divider orientation="left">{t('sidebar.network')}</Divider>
            <Space wrap style={{ width: '100%' }} size="large">
              <Form.Item name="vpcId" label={t('sidebar.network2')} rules={[{ required: true }]} style={{ minWidth: 200 }}>
                <Select placeholder={t('huawei.ecs.vpcSelect')} onChange={handleVpcChange}
                  options={vpcs.map((v: any) => ({ label: `${v.name} (${v.cidr})`, value: v.id }))}
                />
              </Form.Item>

              <Form.Item name="subnetId" label={t('ec2.subnetId')} rules={[{ required: true }]} style={{ minWidth: 220 }}>
                <Select placeholder={t('huawei.ecs.subnetSelect')} disabled={!selectedVpc}
                  options={subnets.map((s: any) => ({ label: `${s.name} (${s.cidr})`, value: s.id }))}
                />
              </Form.Item>
            </Space>

            <Form.Item name="securityGroupIds" label={t('sidebar.sg')}>
              <Select mode="multiple" placeholder={t('huawei.ecs.sgSelect')} allowClear
                options={sgList.map((sg: any) => ({ label: `${sg.name} (${sg.id})`, value: sg.id }))}
              />
            </Form.Item>

            <Divider orientation="left">{t('ec2.volumes')}</Divider>
            <Space wrap size="large">
              <Form.Item name="rootVolumeType" label={t('huawei.ecs.rootVolumeType')} rules={[{ required: true }]} style={{ minWidth: 140 }}>
                <Select options={ROOT_VOLUME_TYPES.map((vt) => ({ label: vt, value: vt }))} />
              </Form.Item>
              <Form.Item name="rootVolumeSize" label={t('huawei.ecs.rootVolumeSize')} rules={[{ required: true }]} style={{ minWidth: 120 }}>
                <InputNumber min={40} max={32768} suffix="GB" />
              </Form.Item>
            </Space>

            <Form.List name="dataVolumes">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} wrap align="baseline">
                      <Form.Item {...rest} name={[name, 'type']} label={t('ebs.type')} style={{ minWidth: 140 }}>
                        <Select options={ROOT_VOLUME_TYPES.map((vt) => ({ label: vt, value: vt }))} placeholder={t('ebs.type')} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'size']} label={t('ebs.size')} style={{ minWidth: 120 }}>
                        <InputNumber min={10} max={32768} suffix="GB" placeholder="100" />
                      </Form.Item>
                      <Button danger onClick={() => remove(name)}>{t('common.delete')}</Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} style={{ marginTop: 8 }}>{t('huawei.ecs.addDataVolume')}</Button>
                </>
              )}
            </Form.List>

            <Divider orientation="left">{t('common.credential')}</Divider>
            <Space style={{ marginBottom: 16 }}>
              <Button type={authMode === 'password' ? 'primary' : 'default'} onClick={() => setAuthMode('password')}>{t('huawei.ecs.adminPass')}</Button>
              <Button type={authMode === 'keypair' ? 'primary' : 'default'} onClick={() => setAuthMode('keypair')}>{t('huawei.ecs.keyPair')}</Button>
            </Space>

            {authMode === 'password' && (
              <Form.Item name="adminPass" label={t('huawei.ecs.adminPass')} rules={[{ pattern: /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;:',.<>?]{8,26}$/, message: '密码长度 8-26 位，须包含大小写字母、数字和特殊字符中至少两种' }]}>
                <Input.Password placeholder="Windows: 8-26字符 / Linux: 8-26字符" />
              </Form.Item>
            )}
            {authMode === 'keypair' && (
              <Form.Item name="keyName" label={t('huawei.ecs.keyPair')}>
                <Input placeholder="输入已有密钥对名称" />
              </Form.Item>
            )}

            <Divider orientation="left">{t('huawei.ecs.publicIp')}</Divider>
            <Space align="center" style={{ marginBottom: 16 }}>
              <Switch checked={usePublicIp} onChange={setUsePublicIp} />
              <span>{usePublicIp ? t('common.enable') : t('common.no')}</span>
            </Space>
            {usePublicIp && (
              <Form.Item name="bandwidthSize" label={t('huawei.ecs.bandwidthSize')} style={{ maxWidth: 200 }}>
                <InputNumber min={1} max={2000} suffix="Mbit/s" />
              </Form.Item>
            )}

            <Divider />
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting} icon={<CloudServerOutlined />}>
                {t('huawei.ecs.createInstance')}
              </Button>
              <Button onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
            </Space>
          </Form>
        </Card>
      )}
    </div>
  )
}
