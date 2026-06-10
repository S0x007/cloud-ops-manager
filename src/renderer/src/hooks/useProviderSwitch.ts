import { useCallback } from 'react'
import { useProviderStore, type ProviderId } from '../stores/providerStore'
import { useProfileStore } from '../stores/profileStore'
import { useRegionStore } from '../stores/regionStore'
import { resetResourceStores } from '../stores/resetResourceStores'
import { ALL_PROVIDER_MANIFESTS } from '../../../shared/providers'

export function useProviderSwitch() {
  const currentProvider = useProviderStore((s) => s.currentProvider)
  const setCurrentProvider = useProviderStore((s) => s.setCurrentProvider)

  const switchProvider = useCallback((providerId: ProviderId) => {
    if (providerId === currentProvider) return false

    resetResourceStores()
    useRegionStore.getState().clearRegionCounts()
    setCurrentProvider(providerId)

    const allCreds = useProfileStore.getState().allCredentials
    const providerCreds = allCreds.filter(
      (c: { provider?: string }) => (c.provider || 'aws') === providerId,
    )

    const profileState = useProfileStore.getState()
    const manifest = ALL_PROVIDER_MANIFESTS[providerId]
    const defaultRegion = manifest?.defaultRegion || 'us-east-1'
    const validRegions = (manifest?.regions || []).map((r) => r.id)

    if (providerCreds.length > 0) {
      const first = providerCreds[0]
      profileState.setActiveCredential(first.id, first.source as 'custom')
      const region = validRegions.includes(first.region) ? first.region : defaultRegion
      useRegionStore.getState().setActiveRegion(region)
    } else {
      profileState.setActiveCredential('', 'custom')
      profileState.setAccountId(null)
      profileState.setVerifyError(null)
      useRegionStore.getState().setActiveRegion(defaultRegion)
    }
    profileState.setVerifying(false)
    return true
  }, [currentProvider, setCurrentProvider])

  const getProviderCredentials = useCallback(() => {
    const allCreds = useProfileStore.getState().allCredentials
    return allCreds.filter((c: { provider?: string }) => (c.provider || 'aws') === currentProvider)
  }, [currentProvider])

  return { currentProvider, switchProvider, getProviderCredentials }
}
