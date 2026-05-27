import { Descriptions, Card, Space, Tag, Typography } from 'antd'
import { useProfileStore } from '../../stores/profileStore'
import { CredentialManager } from './CredentialManager'
import { useT } from '../../i18n'

const { Text } = Typography

export function SettingsPage(): JSX.Element {
  const t = useT()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const accountId = useProfileStore((s) => s.accountId)
  const allCredentials = useProfileStore((s) => s.allCredentials)

  const active = allCredentials.find(
    (c) => c.id === activeProfile && c.source === activeSource,
  )

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>{t('settings.title')}</h2>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title={t('settings.currentCred')}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('common.name')}>
              <Space>
                {active?.source === 'custom' ? (
                  <Tag color="orange">{t('settings.custom')}</Tag>
                ) : active?.type === 'sso' ? (
                  <Tag color="purple">SSO</Tag>
                ) : (
                  <Tag color="blue">~/.aws</Tag>
                )}
                <Text strong>{active?.name ?? activeProfile}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={t('settings.source')}>
              {activeSource === 'custom'
                ? t('settings.localEncrypted')
                : '~/.aws/config'}
            </Descriptions.Item>
            <Descriptions.Item label="Account ID">
              {accountId ? <Tag color="green">{accountId}</Tag> : <Tag color="default">{t('common.unverified')}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('settings.storage')}>
              {activeSource === 'custom'
                ? t('settings.storageEncrypted')
                : t('settings.storageAwsFile')}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <CredentialManager />

        <Card title={t('settings.about')}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('settings.appName')}>AWS Ops Manager</Descriptions.Item>
            <Descriptions.Item label={t('settings.version')}>1.0.0</Descriptions.Item>
            <Descriptions.Item label={t('settings.techStack')}>
              Electron + React + TypeScript + AWS SDK v3 + Ant Design 5 + xterm.js
            </Descriptions.Item>
            <Descriptions.Item label={t('settings.platform')}>{t('settings.platformName')}</Descriptions.Item>
            <Descriptions.Item label={t('settings.author')}>{t('settings.authorName')}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Space>
    </div>
  )
}
