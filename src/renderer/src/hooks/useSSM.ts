import { useCallback, useRef } from 'react'
import { useProfileStore } from '../stores/profileStore'
import { useRegionStore } from '../stores/regionStore'

export function useSSM() {
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)

  const startSession = useCallback(
    async (instanceId: string) => {
      await window.electronAPI.ssm.startSession({
        instanceId,
        region: activeRegion,
        profile: activeProfile,
        source: activeSource,
      })
    },
    [activeProfile, activeSource, activeRegion],
  )

  const sendData = useCallback((data: string) => {
    window.electronAPI.ssm.sendData(data)
  }, [])

  const resize = useCallback((cols: number, rows: number) => {
    window.electronAPI.ssm.resize({ cols, rows })
  }, [])

  const closeSession = useCallback(() => {
    window.electronAPI.ssm.closeSession()
  }, [])

  const startPortForwarding = useCallback(
    async (instanceId: string, remotePort: number, localPort: number) => {
      return await window.electronAPI.ssm.startPortForwarding({
        instanceId,
        region: activeRegion,
        profile: activeProfile,
        source: activeSource,
        remotePort,
        localPort,
      })
    },
    [activeProfile, activeSource, activeRegion],
  )

  const stopPortForwarding = useCallback(() => {
    window.electronAPI.ssm.stopPortForwarding()
  }, [])

  const onOutput = useCallback((callback: (data: string) => void) => {
    return window.electronAPI.ssm.onOutput(callback)
  }, [])

  const onSessionEnd = useCallback((callback: () => void) => {
    return window.electronAPI.ssm.onSessionEnd(callback)
  }, [])

  const onSessionError = useCallback((callback: (error: string) => void) => {
    return window.electronAPI.ssm.onSessionError(callback)
  }, [])

  return {
    startSession,
    sendData,
    resize,
    closeSession,
    startPortForwarding,
    stopPortForwarding,
    onOutput,
    onSessionEnd,
    onSessionError,
  }
}
