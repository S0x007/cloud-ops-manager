import type { ProviderId } from '../../../shared/providers/types'

export interface CloudInvokeResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface CloudInvokeParams {
  provider: string
  credentialId: string
  region: string
  service: string
  action: string
  payload?: Record<string, unknown>
}

/** 非 React 场景也可用的 cloud:invoke 封装 */
export async function cloudInvoke<T = unknown>(
  params: CloudInvokeParams,
): Promise<CloudInvokeResult<T>> {
  try {
    const result = await window.electronAPI.cloud.invoke({
      ...params,
      payload: params.payload ?? {},
    })
    return result as CloudInvokeResult<T>
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export interface UseCloudOperationOptions {
  provider?: ProviderId
  credentialId?: string
  region?: string
}
