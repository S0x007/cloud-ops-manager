import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Alert,
  Typography,
  Divider,
} from 'antd'
import {
  LinkOutlined,
  DisconnectOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import { useProfileStore } from '../../stores/profileStore'
import { useRegionStore } from '../../stores/regionStore'
import { useSSM } from '../../hooks/useSSM'
import { useT, useTf } from '../../i18n'

const { Text } = Typography

export function PortForwardingPage(): JSX.Element {
  const navigate = useNavigate()
  const t = useT()
  const tf = useTf()
  const [form] = Form.useForm()
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const { startPortForwarding, stopPortForwarding } = useSSM()

  const [status, setStatus] = useState<'idle' | 'active' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [activeConfig, setActiveConfig] = useState<{
    instanceId: string
    remotePort: number
    localPort: number
  } | null>(null)

  const handleStart = useCallback(
    async (values: { instanceId: string; remotePort: number; localPort: number }) => {
      try {
        await startPortForwarding(
          values.instanceId,
          values.remotePort,
          values.localPort,
        )
        setStatus('active')
        setActiveConfig(values)
        setStatusMessage(
          tf('terminal.portForwardStarted', {
            local: values.localPort,
            instance: values.instanceId,
            remote: values.remotePort,
          }),
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setStatus('error')
        setStatusMessage(msg)
      }
    },
    [startPortForwarding, tf],
  )

  const handleStop = useCallback(async () => {
    await stopPortForwarding()
    setStatus('idle')
    setActiveConfig(null)
    setStatusMessage(t('terminal.portForwardStopped'))
  }, [stopPortForwarding, t])

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        {t('terminal.back')}
      </Button>
      <Card title={t('terminal.portForwardTitle')}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleStart}
          initialValues={{
            instanceId: '',
            remotePort: 5432,
            localPort: 15432,
          }}
        >
          <Form.Item
            label={t('terminal.instanceId')}
            name="instanceId"
            rules={[{ required: true, message: t('terminal.instanceIdRequired') }]}
          >
            <Input placeholder="i-0123456789abcdef" />
          </Form.Item>

          <Space size="large">
            <Form.Item
              label={t('terminal.remotePort')}
              name="remotePort"
              rules={[{ required: true, message: t('terminal.remotePortRequired') }]}
            >
              <InputNumber min={1} max={65535} style={{ width: 120 }} />
            </Form.Item>

            <Form.Item
              label={t('terminal.localPort')}
              name="localPort"
              rules={[{ required: true, message: t('terminal.localPortRequired') }]}
            >
              <InputNumber min={1024} max={65535} style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<LinkOutlined />}
                disabled={status === 'active'}
              >
                {t('terminal.startForward')}
              </Button>
              <Button
                danger
                icon={<DisconnectOutlined />}
                onClick={handleStop}
                disabled={status !== 'active'}
              >
                {t('terminal.stopForward')}
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {statusMessage && (
          <>
            <Divider />
            {status === 'active' ? (
              <Alert
                type="success"
                message={t('terminal.portForwardRunning')}
                description={
                  <div>
                    <p>{statusMessage}</p>
                    {activeConfig && (
                      <Text type="secondary">
                        {tf('terminal.portForwardUse', {
                          local: activeConfig.localPort,
                          instance: activeConfig.instanceId,
                          remote: activeConfig.remotePort,
                        })}
                      </Text>
                    )}
                  </div>
                }
              />
            ) : status === 'error' ? (
              <Alert type="error" message={t('terminal.portForwardFailed')} description={statusMessage} />
            ) : (
              <Alert type="info" message={statusMessage} />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
