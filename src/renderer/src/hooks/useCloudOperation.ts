import { useCallback } from 'react'
import type { ProviderId } from '../../../shared/providers/types'
import { useProfileStore } from '../stores/profileStore'
import { useRegionStore } from '../stores/regionStore'
import { useProviderStore } from '../stores/providerStore'
import {
  cloudInvoke,
  type CloudInvokeResult,
  type UseCloudOperationOptions,
} from '../lib/cloudInvoke'

/**
 * 统一多云 API 调用层（华为云及未来厂商走 cloud:invoke）。
 * AWS 专用 IPC 仍走 electronAPI.ec2/s3/... 等通道。
 */
export function useCloudOperation(options: UseCloudOperationOptions = {}) {
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const currentProvider = useProviderStore((s) => s.currentProvider)

  const provider = options.provider ?? currentProvider
  const credentialId = options.credentialId ?? activeProfile
  const region = options.region ?? activeRegion

  const invoke = useCallback(async <T = unknown>(
    service: string,
    action: string,
    payload: Record<string, unknown> = {},
    overrides?: { credentialId?: string; region?: string; provider?: ProviderId },
  ): Promise<CloudInvokeResult<T>> => {
    const cred = overrides?.credentialId ?? credentialId
    const reg = overrides?.region ?? region
    const prov = overrides?.provider ?? provider
    if (!cred) return { success: false, error: '未选择凭证' }
    return cloudInvoke<T>({
      provider: prov,
      credentialId: cred,
      region: reg,
      service,
      action,
      payload,
    })
  }, [credentialId, region, provider])

  return { invoke, provider, credentialId, region }
}
