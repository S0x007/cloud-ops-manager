/** 华为云区域元数据 + IAM 项目匹配（主进程） */

import { HUAWEI_MANIFEST } from '../../shared/providers/huawei.manifest'

export interface HuaweiRegionMeta {
  id: string
  name: string
}

export const HUAWEI_REGIONS: HuaweiRegionMeta[] = HUAWEI_MANIFEST.regions.map((r) => ({
  id: r.id,
  name: r.nameZh,
}))

export interface HuaweiProjectInfo {
  id: string
  name: string
  enabled: boolean
}

export function getRegionDisplayName(regionId: string): string {
  const meta = HUAWEI_REGIONS.find((r) => r.id === regionId)
  return meta ? `${meta.name}（${regionId}）` : regionId
}

/**
 * 为指定区域查找 IAM 项目。
 * 华为云默认项目名通常等于区域 ID（如 cn-south-1），禁止使用 includes(region) 避免 cn-north-1 误匹配 cn-north-10。
 */
export function findProjectForRegion(projects: HuaweiProjectInfo[], region: string): HuaweiProjectInfo | undefined {
  if (!region) return undefined
  const enabled = projects.filter((p) => p.enabled)
  if (enabled.length === 0) return undefined

  const exact = enabled.find((p) => p.name === region)
  if (exact) return exact

  const lower = region.toLowerCase()
  const exactCi = enabled.find((p) => p.name.toLowerCase() === lower)
  if (exactCi) return exactCi

  const meta = HUAWEI_REGIONS.find((r) => r.id === region)
  if (meta) {
    const byZh = enabled.find((p) => p.name === meta.name)
    if (byZh) return byZh
  }

  return enabled.find((p) => p.id === region)
}
