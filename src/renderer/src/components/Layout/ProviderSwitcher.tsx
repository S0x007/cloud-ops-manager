import { Select } from 'antd'
import { useProviderStore, PROVIDERS, type ProviderId } from '../../stores/providerStore'
import { useT } from '../../i18n'

interface Props {
  onChange: (providerId: ProviderId) => void
}

export function ProviderSwitcher({ onChange }: Props): JSX.Element {
  const t = useT()
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const options = PROVIDERS.map((p) => ({
    value: p.id,
    label: p.id === 'aws' ? t('provider.aws') : t('provider.huawei'),
  }))

  return (
    <Select
      value={currentProvider}
      className="header-provider-select"
      style={{ fontSize: 12 }}
      size="small"
      options={options}
      onChange={onChange}
    />
  )
}
