export * from './types'
export { AWS_MANIFEST } from './aws.manifest'
export { HUAWEI_MANIFEST } from './huawei.manifest'

import { AWS_MANIFEST } from './aws.manifest'
import { HUAWEI_MANIFEST } from './huawei.manifest'
import type { ProviderId, ProviderManifest } from './types'

export const ALL_PROVIDER_MANIFESTS: Record<ProviderId, ProviderManifest> = {
  aws: AWS_MANIFEST,
  huawei: HUAWEI_MANIFEST,
}

export function getProviderManifest(id: ProviderId): ProviderManifest {
  return ALL_PROVIDER_MANIFESTS[id]
}
