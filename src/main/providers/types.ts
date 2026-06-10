/** CloudProvider 接口 + 共享类型 */

export type ProviderId = 'aws' | 'huawei' | string

export interface CloudRegion {
  id: string
  name: string
}

export interface CloudMenuItem {
  key: string       // 路由路径 e.g. '/ec2', '/huawei/ecs'
  icon: string      // Ant Design icon 名
  labelKey: string  // i18n key
}

export interface CloudMenuGroup {
  key: string
  labelKey: string
  children: CloudMenuItem[]
}

export interface CloudProvider {
  id: ProviderId
  name: string
  nameZh: string
  color: string

  getRegions(): CloudRegion[]
  getDefaultRegion(): string
  getMenuGroups(): CloudMenuGroup[]

  verifyCredential: (ak: string, sk: string, region: string, extraFields?: Record<string, string>) => Promise<{ accountId: string; projects?: { id: string; name: string }[] }>

  executeOperation(action: string, credentialId: string, region: string, payload: Record<string, unknown>): Promise<unknown>
}
