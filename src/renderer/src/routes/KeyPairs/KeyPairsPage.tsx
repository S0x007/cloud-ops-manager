import { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Button, Space, Tag, Popconfirm, Modal, Form, Input, Empty, Typography, App } from 'antd'
import { ReloadOutlined, PlusOutlined, DeleteOutlined, KeyOutlined, UploadOutlined, CopyOutlined, DownloadOutlined } from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import type { ColumnsType } from 'antd/es/table'
import { useT, useI18n } from '../../i18n'

const { TextArea } = Input
const { Text } = Typography

interface KeyPair { keyName: string; keyFingerprint: string; keyType: string; createTime?: string }

export function KeyPairsPage(): JSX.Element {
  const { message } = App.useApp()
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const [keys, setKeys] = useState<KeyPair[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [newKey, setNewKey] = useState<{ name: string; material: string; fingerprint: string } | null>(null)
  const [createForm] = Form.useForm()
  const [importForm] = Form.useForm()

  const countLabel = t('common.count')
    ? `${keys.length} ${t('common.count')}`
    : String(keys.length)

  const load = useCallback(async (forceRefresh = false) => {
    setKeys([])
    setLoading(true)
    try {
      const result = await window.electronAPI.ec2KeyPairs.listKeyPairs({ region: activeRegion, profile: activeProfile, source: activeSource, forceRefresh })
      setKeys(result)
    } catch (err: any) { message.error(err.message) }
    finally { setLoading(false) }
  }, [activeRegion, activeProfile, activeSource])
  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    const vals = await createForm.validateFields()
    try {
      const result = await window.electronAPI.ec2KeyPairs.createKeyPair({ region: activeRegion, profile: activeProfile, source: activeSource, keyName: vals.keyName })
      setNewKey(result)
      setCreateOpen(false)
    } catch (err: any) { message.error(err.message) }
  }

  const handleImport = async () => {
    const vals = await importForm.validateFields()
    try {
      await window.electronAPI.ec2KeyPairs.importKeyPair({ region: activeRegion, profile: activeProfile, source: activeSource, keyName: vals.keyName, publicKey: vals.publicKey })
      message.success(t('keypairs.msgImported'))
      setImportOpen(false); load(true)
    } catch (err: any) { message.error(err.message) }
  }

  const handleDelete = useCallback(async (name: string) => {
    try {
      await window.electronAPI.ec2KeyPairs.deleteKeyPair({ region: activeRegion, profile: activeProfile, source: activeSource, keyName: name })
      message.success(t('keypairs.msgDeleted'))
      load()
    } catch (err: any) { message.error(err.message) }
  }, [activeRegion, activeProfile, activeSource, message, t, load])

  const columns = useMemo<ColumnsType<KeyPair>>(() => [
    { title: t('keypairs.name'), dataIndex: 'keyName', render: (n: string) => <Space><KeyOutlined style={{ color: '#faad14' }} /><Text strong>{n}</Text></Space> },
    { title: t('keypairs.fingerprint'), dataIndex: 'keyFingerprint', width: 280, render: (f: string) => <Text code style={{ fontSize: 11 }}>{f}</Text> },
    { title: t('eip.type'), dataIndex: 'keyType', width: 80, render: (kt: string) => <Tag>{kt}</Tag> },
    {
      title: t('common.createdAt'), dataIndex: 'createTime', width: 170,
      render: (time: string) => {
        if (!time) return '-'
        const date = new Date(time)
        return isNaN(date.getTime()) ? '-' : date.toLocaleString(lang === 'zh-CN' ? 'zh-CN' : 'en-US')
      },
    },
    {
      title: t('common.actions'), width: 80,
      render: (_: unknown, r: KeyPair) => (
        <Popconfirm title={t('keypairs.confirmDelete')} onConfirm={() => handleDelete(r.keyName)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ], [t, lang, handleDelete])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space><h2 style={{ margin: 0 }}>{t('keypairs.title')}</h2><Tag>{countLabel}</Tag></Space>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); createForm.resetFields() }}>{t('keypairs.create')}</Button>
          <Button icon={<UploadOutlined />} onClick={() => { setImportOpen(true); importForm.resetFields() }}>{t('keypairs.import')}</Button>
          <Button icon={<ReloadOutlined />} onClick={() => load(true)} loading={loading}>{t('common.refresh')}</Button>
        </Space>
      </div>
      <Table dataSource={keys} rowKey="keyName" columns={columns} loading={loading} size="middle" pagination={false}
        locale={{ emptyText: <Empty description={t('keypairs.noKeyPairs')} /> }} />

      <Modal title={t('keypairs.createTitle')} open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} okText={t('keypairs.create')}>
        <Form form={createForm} layout="vertical"><Form.Item name="keyName" label={t('keypairs.name')} rules={[{ required: true }]}><Input placeholder="my-key" /></Form.Item></Form>
      </Modal>

      <Modal title={t('keypairs.importTitle')} open={importOpen} onOk={handleImport} onCancel={() => setImportOpen(false)} okText={t('keypairs.import')}>
        <Form form={importForm} layout="vertical">
          <Form.Item name="keyName" label={t('keypairs.name')} rules={[{ required: true }]}><Input placeholder="my-key" /></Form.Item>
          <Form.Item name="publicKey" label={t('keypairs.publicKey')} rules={[{ required: true }]} extra={t('keypairs.publicKeyHint')}>
            <TextArea rows={4} placeholder="ssh-rsa AAAAB3NzaC1yc2E..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('keypairs.createTitle')} open={!!newKey} onCancel={() => setNewKey(null)} footer={[
        <Button key="copy" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(newKey?.material ?? ''); message.success(t('keypairs.copy')) }}>{t('keypairs.copy')}</Button>,
        <Button key="download" icon={<DownloadOutlined />} onClick={async () => {
          if (!newKey) return
          const path = await window.electronAPI.app.saveFile({ content: newKey.material, defaultName: `${newKey.name}.pem` })
          if (path) message.success(`${t('common.save')}: ${path}`)
        }}>{t('keypairs.download')}</Button>,
        <Button key="close" type="primary" onClick={() => setNewKey(null)}>{t('common.close')}</Button>,
      ]}>
        <p style={{ color: '#ff4d4f', fontWeight: 600 }}>{t('keypairs.copy')} · {t('keypairs.download')}</p>
        <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 6, fontSize: 11, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {newKey?.material}
        </pre>
        <p>{t('keypairs.fingerprint')}: <Text code>{newKey?.fingerprint}</Text></p>
      </Modal>
    </div>
  )
}
