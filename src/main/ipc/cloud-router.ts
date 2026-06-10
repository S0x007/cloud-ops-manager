import { ipcMain } from 'electron'
import { ProviderRegistry } from '../providers/registry'
import { formatHuaweiCloudError } from '../providers/huawei-errors'
import type { CloudProvider } from '../providers/types'

export interface CloudInvokeParams {
  provider: string
  service?: string
  action: string
  credentialId: string
  region: string
  payload?: Record<string, unknown>
}

export interface CloudRegistry {
  get(id: string): CloudProvider
}

/** 解析 cloud:invoke 的 action（支持 `ecs:list` 或 service + action 拼接） */
export function resolveCloudAction(params: Pick<CloudInvokeParams, 'service' | 'action'>): string {
  if (params.action?.includes(':')) return params.action
  if (params.service) return `${params.service}:${params.action}`
  return params.action
}

export async function executeCloudInvoke(
  params: CloudInvokeParams,
  registry: CloudRegistry = ProviderRegistry.getInstance(),
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const provider = registry.get(params.provider)
    const fullAction = resolveCloudAction(params)
    const result = await provider.executeOperation(
      fullAction,
      params.credentialId,
      params.region,
      { ...params.payload },
    )
    return { success: true, data: result }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const error = params.provider === 'huawei'
      ? formatHuaweiCloudError(raw, params.region)
      : raw
    return { success: false, error }
  }
}

export function registerCloudRouter(): void {
  ipcMain.handle('cloud:invoke', async (_e, params: CloudInvokeParams) =>
    executeCloudInvoke(params),
  )
}
