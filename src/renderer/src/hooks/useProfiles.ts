import { useCallback, useEffect, useRef } from 'react'
import { useProfileStore } from '../stores/profileStore'
import { useProviderStore } from '../stores/providerStore'
import { useRegionStore } from '../stores/regionStore'
import { ALL_PROVIDER_MANIFESTS } from '../../../shared/providers'
import { cloudInvoke } from '../lib/cloudInvoke'

function getProviderRegions(provider: string): string[] {
  const meta = ALL_PROVIDER_MANIFESTS[provider as keyof typeof ALL_PROVIDER_MANIFESTS]
  return meta ? meta.regions.map((r) => r.id) : []
}

export function useProfiles() {
  const store = useProfileStore()
  const setRegionCount = useRegionStore((s) => s.setRegionCount)
  const clearRegionCounts = useRegionStore((s) => s.clearRegionCounts)
  const lastScanKey = useRef('')

  const loadProfiles = useCallback(async () => {
    const ps = useProfileStore.getState()
    ps.setLoading(true)
    try {
      const all = await window.electronAPI.profiles.listAll()
      ps.setAllCredentials(all)
      const fresh = useProfileStore.getState()
      if (!fresh.activeProfile || !all.find((c: { id: string }) => c.id === fresh.activeProfile)) {
        const cp = useProviderStore.getState().currentProvider
        const creds = all.filter((c: { provider?: string }) => (c.provider || 'aws') === cp)
        if (creds.length > 0) {
          fresh.setActiveCredential(creds[0].id, creds[0].source as 'custom')
          if (creds[0].region) useRegionStore.getState().setActiveRegion(creds[0].region)
        }
      }
    } catch (err) { console.error('加载凭证列表失败:', err) }
    finally { ps.setLoading(false) }
  }, [])

  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('timeout')), ms))])

  const scanRegions = useCallback(async (profile: string, provider: string) => {
    const regions = getProviderRegions(provider)
    const scanKey = `${provider}::${profile}`
    if (lastScanKey.current === scanKey) return
    lastScanKey.current = scanKey
    clearRegionCounts()
    const CONCURRENCY = 5
    for (let i = 0; i < regions.length; i += CONCURRENCY) {
      const batch = regions.slice(i, i + CONCURRENCY)
      await Promise.allSettled(batch.map(async (region) => {
        try {
          if (provider === 'huawei') {
            const result = await withTimeout(cloudInvoke({
              provider: 'huawei', credentialId: profile, region,
              service: 'ecs', action: 'ecs:list', payload: {},
            }), 15000)
            if (result.success && Array.isArray(result.data)) {
              setRegionCount(region, result.data.length)
            } else {
              const msg = (result.error || '').toLowerCase()
              const na = msg.includes('forbidden') || msg.includes('does not match') || msg.includes('region_forbidden') || msg.includes('not able to validate')
              setRegionCount(region, na ? -2 : -1)
            }
          } else {
            const instances = await withTimeout(
              window.electronAPI.ec2.listInstances({ region, profile, source: 'custom' }), 15000) as unknown[]
            setRegionCount(region, instances.length)
          }
        } catch { setRegionCount(region, -1) }
      }))
    }
  }, [clearRegionCounts, setRegionCount])

  const resetRegionScan = useCallback(() => {
    lastScanKey.current = ''
    clearRegionCounts()
  }, [clearRegionCounts])

  const verify = useCallback(async (id?: string) => {
    const ps = useProfileStore.getState()
    const target = id ?? ps.activeProfile
    const region = useRegionStore.getState().activeRegion
    const currentProvider = useProviderStore.getState().currentProvider
    ps.setVerifying(true); ps.setVerifyError(null)
    try {
      const result = await window.electronAPI.profiles.verify({ id: target, source: 'custom', provider: currentProvider })
      ps.setAccountId(result.accountId)
      resetRegionScan()
      if (currentProvider === 'aws') {
        window.electronAPI.ec2.listInstances({ region, profile: target, source: 'custom' })
          .then((instances: unknown[]) => setRegionCount(region, instances.length))
          .catch(() => setRegionCount(region, -1))
      } else if (currentProvider === 'huawei') {
        cloudInvoke({
          provider: 'huawei', credentialId: target, region,
          service: 'ecs', action: 'ecs:list', payload: {},
        }).then((r) =>
          setRegionCount(region, r.success && Array.isArray(r.data) ? r.data.length : -1),
        ).catch(() => setRegionCount(region, -1))
      }
      scanRegions(target, currentProvider).catch(() => { /* 扫描区域异步，忽略个别失败 */ })
    } catch (err: unknown) {
      ps.setVerifyError(err instanceof Error ? err.message : String(err))
      ps.setAccountId(null)
    } finally { ps.setVerifying(false) }
  }, [resetRegionScan, scanRegions, setRegionCount])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  return { ...store, loadProfiles, verify, scanAllRegions: scanRegions, resetRegionScan }
}
