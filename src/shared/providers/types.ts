/** 多云厂商菜单/区域元数据 — main 与 renderer 共用 */

export interface ProviderRegionDef {
  id: string
  name: string
  nameZh: string
}

export interface ProviderMenuItemDef {
  key: string
  icon: string
  labelKey: string
}

export interface ProviderMenuGroupDef {
  key: string
  labelKey: string
  children: ProviderMenuItemDef[]
}

export interface ProviderManifest {
  id: string
  name: string
  nameZh: string
  color: string
  defaultRegion: string
  regions: ProviderRegionDef[]
  menus: ProviderMenuGroupDef[]
}

export type ProviderId = 'aws' | 'huawei'
