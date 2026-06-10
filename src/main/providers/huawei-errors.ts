import { getRegionDisplayName } from './huawei-region'

/** 将华为云原始/API 错误转为用户可读中文（供 IPC 层统一使用） */
export function formatHuaweiCloudError(raw: string, region?: string): string {
  if (raw.startsWith('REGION_FORBIDDEN:')) {
    const rest = raw.slice('REGION_FORBIDDEN:'.length)
    const firstColon = rest.indexOf(':')
    const regionId = firstColon > 0 ? rest.slice(0, firstColon) : (region || '')
    const detail = firstColon > 0 ? rest.slice(firstColon + 1).trim() : rest
    const regionLabel = getRegionDisplayName(regionId || region || '')

    if (/forbidden/i.test(detail)) {
      return `区域 ${regionLabel} 不可用：当前 AK/SK 对应的 IAM 用户未被授权访问该区域。请在华为云 IAM 中为该用户添加该区域权限，或切换到已授权区域。`
    }
    if (/does not match/i.test(detail)) {
      return `区域 ${regionLabel} 与当前 IAM 项目不匹配：请确认顶部区域选择正确，或检查账号是否已在该区域开通。`
    }
    if (detail.includes('未找到可用项目')) {
      return detail
    }
    return `区域 ${regionLabel} 无法访问：${detail}`
  }

  const instanceMatch = raw.match(/Instance\[([^\]]+)\].*could not be found/i)
  if (instanceMatch) {
    const id = instanceMatch[1]
    const shortId = id.length > 12 ? `${id.slice(0, 8)}…` : id
    const regionLabel = region ? getRegionDisplayName(region) : '当前所选区域'
    return `在 ${regionLabel} 找不到实例 ${shortId}。实例可能位于其他区域（请切换到创建时的区域，如华南-广州 cn-south-1），或已被删除。`
  }

  if (/Target instance is not exist/i.test(raw)) {
    const regionLabel = region ? getRegionDisplayName(region) : '当前所选区域'
    return `在 ${regionLabel} 找不到目标实例：请确认区域与实例 ID 匹配，或从 ECS 列表重新进入详情。`
  }

  return raw
}
