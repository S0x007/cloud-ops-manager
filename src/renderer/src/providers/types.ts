import type { ProviderManifest, ProviderRegionDef } from '../../../shared/providers/types'

export type { ProviderId } from '../../../shared/providers/types'
export type RegionInfo = ProviderRegionDef
export type ProviderMenuGroup = ProviderManifest['menus'][number]
export type ProviderMeta = ProviderManifest
