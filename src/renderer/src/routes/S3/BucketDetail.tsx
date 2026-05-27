import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Tabs, Descriptions, Table, Button, Space, Tag, Switch, Modal,
  Form, Input, InputNumber, Select, Popconfirm, Empty, Spin, Alert, Typography, App, Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined,
  EditOutlined, SaveOutlined, LockOutlined, GlobalOutlined,
  KeyOutlined, TagOutlined, HistoryOutlined, FileTextOutlined,
  CloudOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useT, useTf } from '../../i18n'
import dayjs from 'dayjs'

const { Text } = Typography
const { TextArea } = Input

// ---- 权限 Tab ----
function PermissionsTab({ bucket }: { bucket: string }) {
  const t = useT()
  const { message } = App.useApp()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [loading, setLoading] = useState(false)
  const [policy, setPolicy] = useState<string>('')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.s3Bucket.getBucketPolicy({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setPolicy(result.policy || '')
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [bucket, activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.electronAPI.s3Bucket.putBucketPolicy({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket, policy: editContent,
      })
      setPolicy(editContent)
      setEditing(false)
      message.success(t('s3.policySaved'))
    } catch (err: any) { message.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await window.electronAPI.s3Bucket.deleteBucketPolicy({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setPolicy('')
      message.success(t('s3.policyDeleted'))
    } catch (err: any) { message.error(err.message) }
  }

  if (loading) return <Spin />
  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        {policy && !editing && (
          <>
            <Button icon={<EditOutlined />} onClick={() => { setEditContent(policy); setEditing(true) }}>{t('common.edit')}</Button>
            <Popconfirm title={t('s3.confirmDeletePolicy')} onConfirm={handleDelete}>
              <Button danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
            </Popconfirm>
          </>
        )}
        {!policy && !editing && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditContent(''); setEditing(true) }}>{t('s3.addPolicy')}</Button>
        )}
        {editing && (
          <>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>{t('common.save')}</Button>
            <Button onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
          </>
        )}
      </Space>
      {editing && (
        <TextArea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={16}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
          placeholder='{"Version":"2012-10-17","Statement":[...]}'
        />
      )}
      {!editing && (
        <pre style={{
          background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 6,
          fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 400, overflow: 'auto',
        }}>
          {policy || t('s3.noBucketPolicy')}
        </pre>
      )}
    </div>
  )
}

// ---- 公共访问阻止 Tab ----
function PublicAccessTab({ bucket }: { bucket: string }) {
  const t = useT()
  const { message } = App.useApp()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<Record<string, boolean> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.s3Bucket.getPublicAccessBlock({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setConfig(result || {})
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [bucket, activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const handleToggle = async (key: string, value: boolean) => {
    const newConfig = { ...(config || {}), [key]: value }
    setConfig(newConfig)
    setSaving(true)
    try {
      await window.electronAPI.s3Bucket.putPublicAccessBlock({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
        blockPublicAcls: newConfig.BlockPublicAcls ?? true,
        ignorePublicAcls: newConfig.IgnorePublicAcls ?? true,
        blockPublicPolicy: newConfig.BlockPublicPolicy ?? true,
        restrictPublicBuckets: newConfig.RestrictPublicBuckets ?? true,
      })
      message.success(t('common.updated'))
    } catch (err: any) { message.error(err.message); setConfig(config) }
    finally { setSaving(false) }
  }

  const switches = useMemo(() => [
    { key: 'BlockPublicAcls', label: t('s3.pab.blockPublicAcls'), desc: t('s3.pab.blockPublicAclsDesc') },
    { key: 'IgnorePublicAcls', label: t('s3.pab.ignorePublicAcls'), desc: t('s3.pab.ignorePublicAclsDesc') },
    { key: 'BlockPublicPolicy', label: t('s3.pab.blockPublicPolicy'), desc: t('s3.pab.blockPublicPolicyDesc') },
    { key: 'RestrictPublicBuckets', label: t('s3.pab.restrictPublicBuckets'), desc: t('s3.pab.restrictPublicBucketsDesc') },
  ], [t])

  if (loading) return <Spin />
  return (
    <div>
      {switches.map((s) => (
        <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <div>
            <Text strong>{s.label}</Text>
            <br /><Text type="secondary">{s.desc}</Text>
          </div>
          <Switch
            checked={config?.[s.key] ?? true}
            loading={saving}
            onChange={(v) => handleToggle(s.key, v)}
          />
        </div>
      ))}
    </div>
  )
}

// ---- 加密 Tab ----
function EncryptionTab({ bucket }: { bucket: string }) {
  const t = useT()
  const { message } = App.useApp()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [loading, setLoading] = useState(false)
  const [encryption, setEncryption] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [algorithm, setAlgorithm] = useState('AES256')
  const [kmsKeyId, setKmsKeyId] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.s3Bucket.getBucketEncryption({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setEncryption(result)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [bucket, activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.electronAPI.s3Bucket.putBucketEncryption({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
        sseAlgorithm: algorithm, kmsKeyId: algorithm === 'aws:kms' ? kmsKeyId : undefined,
      })
      message.success(t('s3.encryptionUpdated'))
      setEditing(false)
      load()
    } catch (err: any) { message.error(err.message) }
    finally { setSaving(false) }
  }

  if (loading) return <Spin />
  const currentAlgo = encryption?.Rules?.[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm

  return (
    <div>
      {!currentAlgo && !editing ? (
        <Empty description={t('s3.encryptionNotEnabled')}>
          <Button type="primary" onClick={() => setEditing(true)}>{t('s3.enableEncryption')}</Button>
        </Empty>
      ) : editing ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select value={algorithm} onChange={setAlgorithm} style={{ width: 200 }}>
            <Select.Option value="AES256">AES256 (SSE-S3)</Select.Option>
            <Select.Option value="aws:kms">aws:kms (SSE-KMS)</Select.Option>
          </Select>
          {algorithm === 'aws:kms' && (
            <Input placeholder={t('s3.kmsKeyOptional')} value={kmsKeyId} onChange={(e) => setKmsKeyId(e.target.value)} />
          )}
          <Space>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>{t('common.save')}</Button>
            <Button onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
          </Space>
        </Space>
      ) : (
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label={t('s3.encryptionAlgorithm')}>
            <Tag color="green">{currentAlgo === 'aws:kms' ? 'SSE-KMS' : 'SSE-S3 (AES256)'}</Tag>
          </Descriptions.Item>
          {currentAlgo === 'aws:kms' && (
            <Descriptions.Item label="KMS Key">
              {encryption?.Rules?.[0]?.ApplyServerSideEncryptionByDefault?.KMSMasterKeyID ?? '-'}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}
      {currentAlgo && !editing && (
        <Button style={{ marginTop: 12 }} icon={<EditOutlined />} onClick={() => setEditing(true)}>{t('common.modify')}</Button>
      )}
    </div>
  )
}

// ---- 版本控制 Tab ----
function VersioningTab({ bucket }: { bucket: string }) {
  const t = useT()
  const { message } = App.useApp()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [loading, setLoading] = useState(false)
  const [versioning, setVersioning] = useState<{ status: string; mfaDelete: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.s3Bucket.getBucketVersioning({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setVersioning(result)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [bucket, activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const handleToggle = async () => {
    const newStatus = versioning?.status === 'Enabled' ? 'Suspended' : 'Enabled'
    setSaving(true)
    try {
      await window.electronAPI.s3Bucket.putBucketVersioning({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket, status: newStatus,
      })
      setVersioning({ status: newStatus, mfaDelete: versioning?.mfaDelete || 'Disabled' })
      message.success(t(newStatus === 'Enabled' ? 's3.versioningEnabledMsg' : 's3.versioningSuspendedMsg'))
    } catch (err: any) { message.error(err.message) }
    finally { setSaving(false) }
  }

  if (loading) return <Spin />
  const enabled = versioning?.status === 'Enabled'

  return (
    <Descriptions bordered size="small" column={1}>
      <Descriptions.Item label={t('common.status')}>
        <Tag color={enabled ? 'green' : 'default'}>{versioning?.status ?? '-'}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="MFA Delete">{versioning?.mfaDelete ?? '-'}</Descriptions.Item>
      <Descriptions.Item label={t('common.actions')}>
        <Popconfirm
          title={enabled ? t('s3.confirmSuspendVersioning') : t('s3.confirmEnableVersioning')}
          onConfirm={handleToggle}
        >
          <Button loading={saving} type={enabled ? 'default' : 'primary'}>
            {enabled ? t('s3.suspendVersioning') : t('s3.enableVersioning')}
          </Button>
        </Popconfirm>
      </Descriptions.Item>
    </Descriptions>
  )
}

// ---- 标签 Tab ----
function TagsTab({ bucket }: { bucket: string }) {
  const t = useT()
  const { message } = App.useApp()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<{ Key: string; Value: string }[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.s3Bucket.getBucketTagging({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setTags(result || [])
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [bucket, activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const addTag = () => setTags([...tags, { Key: '', Value: '' }])
  const removeTag = (idx: number) => setTags(tags.filter((_, i) => i !== idx))
  const updateTag = (idx: number, field: 'Key' | 'Value', val: string) => {
    const newTags = [...tags]
    newTags[idx] = { ...newTags[idx], [field]: val }
    setTags(newTags)
  }

  const handleSave = async () => {
    const valid = tags.filter((row) => row.Key.trim())
    setSaving(true)
    try {
      if (valid.length > 0) {
        await window.electronAPI.s3Bucket.putBucketTagging({
          region: activeRegion, profile: activeProfile, source: activeSource, bucket, tags: valid,
        })
      } else {
        await window.electronAPI.s3Bucket.deleteBucketTagging({
          region: activeRegion, profile: activeProfile, source: activeSource, bucket,
        })
      }
      setTags(valid)
      message.success(t('s3.tagsSaved'))
    } catch (err: any) { message.error(err.message) }
    finally { setSaving(false) }
  }

  if (loading) return <Spin />
  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} onClick={addTag}>{t('common.addTag')}</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>{t('common.save')}</Button>
      </Space>
      <Table
        size="small" pagination={false}
        dataSource={tags.map((row, i) => ({ ...row, _idx: i }))}
        rowKey="_idx"
        columns={[
          { title: t('ec2.tagKey'), render: (_: any, r: any) => <Input value={r.Key} onChange={(e) => updateTag(r._idx, 'Key', e.target.value)} placeholder={t('ec2.tagKey')} /> },
          { title: t('ec2.tagValue'), render: (_: any, r: any) => <Input value={r.Value} onChange={(e) => updateTag(r._idx, 'Value', e.target.value)} placeholder={t('ec2.tagValue')} /> },
          { title: '', width: 60, render: (_: any, r: any) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeTag(r._idx)} /> },
        ]}
        locale={{ emptyText: t('ec2.noTags') }}
      />
    </div>
  )
}

// ---- 生命周期 Tab ----
function LifecycleTab({ bucket }: { bucket: string }) {
  const t = useT()
  const tf = useTf()
  const { message } = App.useApp()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState<any[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.s3Bucket.getBucketLifecycle({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setRules(result || [])
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [bucket, activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    const vals = await form.validateFields()
    setSaving(true)
    try {
      const newRule = {
        ID: `rule-${Date.now()}`, Status: 'Enabled',
        Filter: { Prefix: vals.prefix || '' },
        Transitions: vals.transitionDays > 0 ? [{ Days: vals.transitionDays, StorageClass: vals.transitionClass }] : undefined,
        Expiration: vals.expireDays > 0 ? { Days: vals.expireDays } : undefined,
      }
      const updated = [...rules.filter((r) => r.Filter?.Prefix !== (vals.prefix || '')), newRule]
      await window.electronAPI.s3Bucket.putBucketLifecycle({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket, rules: updated,
      })
      message.success(t('s3.ruleAdded'))
      setAdding(false); form.resetFields(); load()
    } catch (err: any) { message.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (prefix: string) => {
    const updated = rules.filter((r) => (r.Filter?.Prefix ?? '') !== prefix)
    try {
      await window.electronAPI.s3Bucket.putBucketLifecycle({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket, rules: updated,
      })
      message.success(t('s3.ruleDeleted'))
      load()
    } catch (err: any) { message.error(err.message) }
  }

  if (loading) return <Spin />

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setAdding(true); form.resetFields() }}>{t('common.addRule')}</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>{t('common.refresh')}</Button>
      </Space>

      {adding && (
        <Card size="small" title={t('s3.newLifecycleRule')} style={{ marginBottom: 12, border: '1px solid #1677ff' }}>
          <Form form={form} layout="inline" initialValues={{ prefix: '', transitionDays: 30, transitionClass: 'STANDARD_IA', expireDays: 90 }}>
            <Form.Item name="prefix" label={t('common.prefix')}><Input placeholder={t('common.all')} style={{ width: 120 }} /></Form.Item>
            <Form.Item name="transitionDays" label={t('s3.transitionDays')}><InputNumber min={0} style={{ width: 70 }} /></Form.Item>
            <Form.Item name="transitionClass" label={t('s3.transitionTo')}>
              <Select style={{ width: 140 }} options={[
                { value: 'STANDARD_IA', label: 'Standard-IA' }, { value: 'GLACIER', label: 'Glacier' },
                { value: 'DEEP_ARCHIVE', label: 'Deep Archive' },
              ]} />
            </Form.Item>
            <Form.Item name="expireDays" label={t('s3.expireDays')}><InputNumber min={0} style={{ width: 70 }} /></Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" loading={saving} onClick={handleAdd}>{t('common.save')}</Button>
                <Button onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {rules.length === 0 && !adding ? (
        <Empty description={t('s3.noLifecycleRules')} />
      ) : (
        rules.map((rule, idx) => (
          <Card key={idx} size="small" style={{ marginBottom: 8 }} title={rule.ID || tf('s3.ruleN', { n: idx + 1 })}
            extra={<Popconfirm title={t('s3.confirmDeleteRule')} onConfirm={() => handleDelete(rule.Filter?.Prefix ?? '')}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label={t('common.prefix')}>{rule.Filter?.Prefix || t('common.all')}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}><Tag color={rule.Status === 'Enabled' ? 'green' : 'default'}>{rule.Status}</Tag></Descriptions.Item>
              {rule.Transitions?.map((tr: any, i: number) => (
                <Descriptions.Item key={i} label={t('common.transition')}>{tf('s3.transitionFmt', { days: tr.Days ?? 0, class: tr.StorageClass })}</Descriptions.Item>
              ))}
              {rule.Expiration && (<Descriptions.Item label={t('common.expire')}>{tf('s3.expireFmt', { days: rule.Expiration.Days ?? 0 })}</Descriptions.Item>)}
            </Descriptions>
          </Card>
        ))
      )}
    </div>
  )
}

// ---- 静态网站 Tab ----
function WebsiteTab({ bucket }: { bucket: string }) {
  const t = useT()
  const { message } = App.useApp()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [loading, setLoading] = useState(false)
  const [website, setWebsite] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.s3Bucket.getBucketWebsite({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setWebsite(result)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [bucket, activeRegion, activeProfile, activeSource])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await window.electronAPI.s3Bucket.putBucketWebsite({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket, ...values,
      })
      message.success(t('s3.websiteSaved'))
      setEditing(false)
      load()
    } catch (err: any) { message.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await window.electronAPI.s3Bucket.deleteBucketWebsite({
        region: activeRegion, profile: activeProfile, source: activeSource, bucket,
      })
      setWebsite(null)
      message.success(t('s3.websiteDeleted'))
    } catch (err: any) { message.error(err.message) }
  }

  if (loading) return <Spin />

  return (
    <div>
      {!website && !editing ? (
        <Empty description={t('s3.websiteNotEnabled')}>
          <Button type="primary" onClick={() => setEditing(true)}>{t('common.enable')}</Button>
        </Empty>
      ) : editing ? (
        <Form form={form} layout="vertical" initialValues={{ indexDocument: 'index.html', errorDocument: 'error.html' }}>
          <Form.Item name="indexDocument" label={t('s3.indexDocument')}><Input placeholder="index.html" /></Form.Item>
          <Form.Item name="errorDocument" label={t('s3.errorDocument')}><Input placeholder="error.html" /></Form.Item>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>{t('common.save')}</Button>
            <Button onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
          </Space>
        </Form>
      ) : (
        <div>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t('s3.indexDocument')}>{website?.indexDocument || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('s3.errorDocument')}>{website?.errorDocument || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('s3.endpoint')}>
              <Text copyable>{`http://${bucket}.s3-website-${activeRegion}.amazonaws.com`}</Text>
            </Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 12 }}>
            <Button icon={<EditOutlined />} onClick={() => { form.setFieldsValue(website); setEditing(true) }}>{t('common.modify')}</Button>
            <Popconfirm title={t('s3.confirmDeleteWebsite')} onConfirm={handleDelete}>
              <Button danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
            </Popconfirm>
          </Space>
        </div>
      )}
    </div>
  )
}

// ---- 主页面 ----
export function BucketDetail(): JSX.Element {
  const t = useT()
  const { bucket } = useParams<{ bucket: string }>()
  const navigate = useNavigate()
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const [region, setRegion] = useState('')
  const [activeTab, setActiveTab] = useState('permissions')

  useEffect(() => {
    if (!bucket) return
    const load = async () => {
      try {
        const resp = await window.electronAPI.s3.headBucket({
          profile: useProfileStore.getState().activeProfile,
          source: useProfileStore.getState().activeSource,
          bucket,
        })
        setRegion(resp.region)
      } catch { setRegion(activeRegion) }
    }
    load()
  }, [bucket, activeRegion])

  const tabItems = useMemo(() => {
    if (!bucket) return []
    return [
      { key: 'permissions', label: <span><LockOutlined /> {t('s3.permissions')}</span>, children: <PermissionsTab bucket={bucket} /> },
      { key: 'public-access', label: <span><GlobalOutlined /> {t('s3.publicAccess')}</span>, children: <PublicAccessTab bucket={bucket} /> },
      { key: 'encryption', label: <span><KeyOutlined /> {t('s3.encryption')}</span>, children: <EncryptionTab bucket={bucket} /> },
      { key: 'versioning', label: <span><HistoryOutlined /> {t('s3.versioning')}</span>, children: <VersioningTab bucket={bucket} /> },
      { key: 'tags', label: <span><TagOutlined /> {t('s3.tags')}</span>, children: <TagsTab bucket={bucket} /> },
      { key: 'lifecycle', label: <span><CloudOutlined /> {t('s3.lifecycle')}</span>, children: <LifecycleTab bucket={bucket} /> },
      { key: 'website', label: <span><FileTextOutlined /> {t('s3.website')}</span>, children: <WebsiteTab bucket={bucket} /> },
    ]
  }, [t, bucket])

  if (!bucket) return <Empty description={t('s3.noBucketSpecified')} />

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/s3')}>{t('s3.back')}</Button>
        <h2 style={{ margin: 0 }}>{bucket}</h2>
        {region && <Tag color="blue">{region}</Tag>}
      </Space>
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} destroyInactiveTabPane />
      </Card>
    </div>
  )
}
