import { useCallback, useEffect, useRef } from 'react'
import { useProfileStore } from '../stores/profileStore'
import { useRegionStore } from '../stores/regionStore'

const ALL_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-east-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ap-south-1', 'ap-south-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-central-1', 'eu-central-2', 'eu-north-1', 'eu-south-1',
  'sa-east-1', 'me-south-1', 'me-central-1',
  'af-south-1', 'ca-central-1',
]

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
    } catch (err) {
      console.error('加载凭证列表失败:', err)
    } finally {
      ps.setLoading(false)
    }
  }, [])

  const scanAllRegions = useCallback(async (profile: string, source: string) => {
    const scanKey = `${source}::${profile}`
    if (lastScanKey.current === scanKey) return
    lastScanKey.current = scanKey
    clearRegionCounts()
    const CONCURRENCY = 5

    for (let i = 0; i < ALL_REGIONS.length; i += CONCURRENCY) {
      const batch = ALL_REGIONS.slice(i, i + CONCURRENCY)
      await Promise.allSettled(
        batch.map(async (region) => {
          try {
            const instances = await window.electronAPI.ec2.listInstances({
              region, profile, source,
            })
            setRegionCount(region, instances.length)
          } catch {
            setRegionCount(region, -1)
          }
        }),
      )
    }
  }, [clearRegionCounts, setRegionCount])

  const resetRegionScan = useCallback(() => {
    lastScanKey.current = ''
    clearRegionCounts()
  }, [clearRegionCounts])

  const verify = useCallback(async (id?: string, source?: string) => {
    const ps = useProfileStore.getState()
    const target = id ?? ps.activeProfile
    const src = source ?? ps.activeSource
    const region = useRegionStore.getState().activeRegion
    ps.setVerifying(true)
    ps.setVerifyError(null)
    try {
      const result = await window.electronAPI.profiles.verify({ id: target, source: src })
      ps.setAccountId(result.accountId)
      resetRegionScan()
      try {
        const instances = await window.electronAPI.ec2.listInstances({
          region, profile: target, source: src,
        })
        setRegionCount(region, instances.length)
      } catch { /* ignore */ }
      scanAllRegions(target, src)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      ps.setVerifyError(msg)
      ps.setAccountId(null)
    } finally {
      ps.setVerifying(false)
    }
  }, [resetRegionScan, scanAllRegions, setRegionCount])

  const ssoLogin = useCallback(async (profile: string) => {
    const ps = useProfileStore.getState()
    ps.setVerifying(true)
    try {
      await window.electronAPI.profiles.ssoLogin(profile)
      await verify(profile, 'aws-config')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      ps.setVerifyError(msg)
    } finally {
      ps.setVerifying(false)
    }
  }, [verify])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  return {
    ...store,
    loadProfiles,
    verify,
    scanAllRegions,
    resetRegionScan,
    ssoLogin,
  }
}
