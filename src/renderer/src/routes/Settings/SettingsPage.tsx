import { Descriptions, Card, Space, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useProfileStore } from '../../stores/profileStore'
import { useProviderStore } from '../../stores/providerStore'
import { ALL_PROVIDERS } from '../../providers/huawei'
import { CredentialManager } from './CredentialManager'
import { UpdateSettings } from './UpdateSettings'
import { useT } from '../../i18n'

const { Text } = Typography

export function SettingsPage(): JSX.Element {
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const accountId = useProfileStore((s) => s.accountId)
  const allCredentials = useProfileStore((s) => s.allCredentials)
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const active = allCredentials.find((c) => c.id === activeProfile)
  const meta = ALL_PROVIDERS[currentProvider] || ALL_PROVIDERS['aws']
  const providerTag = <Tag color={meta.color}>{meta.nameZh || meta.name}</Tag>
  const [appVersion, setAppVersion] = useState('…')

  useEffect(() => {
    window.electronAPI.app.getVersion()
      .then((info: { version: string }) => setAppVersion(info.version))
      .catch(() => setAppVersion('—'))
  }, [])

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>{t('settings.title')}</h2>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title={t('settings.currentCred')}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="云厂商">{providerTag}</Descriptions.Item>
            <Descriptions.Item label={t('common.name')}>
              {active ? (
                <Space>
                  <Tag color="orange">{t('settings.custom')}</Tag>
                  <Text strong>{active.name}</Text>
                </Space>
              ) : (
                <Text type="secondary">未选择凭证，请在下方添加并选择</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('settings.source')}>
              {t('settings.localEncrypted')}
            </Descriptions.Item>
            <Descriptions.Item label="Account ID">
              {accountId ? <Tag color="green">{accountId}</Tag> : <Tag color="default">{t('common.unverified')}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('settings.storage')}>
              {t('settings.storageEncrypted')}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <CredentialManager />

        <UpdateSettings />

        <Card title={t('settings.about')}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('settings.appName')}>Cloud Ops Manager</Descriptions.Item>
            <Descriptions.Item label={t('settings.version')}>{appVersion}</Descriptions.Item>
            <Descriptions.Item label={t('settings.techStack')}>
              Electron + React + TypeScript + Ant Design 5 + xterm.js + 多云 AKSK SDK
            </Descriptions.Item>
            <Descriptions.Item label={t('settings.platform')}>{t('settings.platformName')}</Descriptions.Item>
            <Descriptions.Item label={t('settings.author')}>{t('settings.authorName')}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Space>
    </div>
  )
}
