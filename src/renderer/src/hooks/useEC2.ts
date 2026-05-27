import { useCallback } from 'react'
import { useProfileStore } from '../stores/profileStore'
import { useRegionStore } from '../stores/regionStore'
import { useEC2Store } from '../stores/ec2Store'

export function useEC2() {
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const store = useEC2Store()

  const fetchInstances = useCallback(async (forceRefresh = false) => {
    store.setInstances([])
    store.setSelectedInstances([])
    store.setLoading(true)
    store.setError(null)
    try {
      const instances = await window.electronAPI.ec2.listInstances({
        region: activeRegion,
        profile: activeProfile,
        source: activeSource,
        forceRefresh,
      })
      store.setInstances(instances)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      store.setInstances([])
      store.setError(msg)
    } finally {
      store.setLoading(false)
    }
  }, [activeProfile, activeSource, activeRegion])

  const startInstance = useCallback(
    async (instanceId: string) => {
      try {
        await window.electronAPI.ec2.startInstance({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          instanceId,
        })
        store.updateInstanceState(instanceId, 'pending')
        setTimeout(() => fetchInstances(true), 3000)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setError(msg)
      }
    },
    [activeProfile, activeSource, activeRegion, fetchInstances],
  )

  const stopInstance = useCallback(
    async (instanceId: string) => {
      try {
        await window.electronAPI.ec2.stopInstance({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          instanceId,
        })
        store.updateInstanceState(instanceId, 'stopping')
        setTimeout(() => fetchInstances(true), 3000)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setError(msg)
      }
    },
    [activeProfile, activeSource, activeRegion, fetchInstances],
  )

  const rebootInstance = useCallback(
    async (instanceId: string) => {
      try {
        await window.electronAPI.ec2.rebootInstance({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          instanceId,
        })
        setTimeout(() => fetchInstances(true), 5000)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        store.setError(msg)
      }
    },
    [activeProfile, activeSource, activeRegion, fetchInstances],
  )

  return {
    ...store,
    fetchInstances,
    startInstance,
    stopInstance,
    rebootInstance,
  }
}
