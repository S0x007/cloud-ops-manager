import { useCallback } from 'react'
import { useProfileStore } from '../stores/profileStore'
import { useRegionStore } from '../stores/regionStore'
import { useS3Store } from '../stores/s3Store'
import { App } from 'antd'
import { useT, useTf } from '../i18n'

export function useS3() {
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const activeSource = useProfileStore((s) => s.activeSource)
  const activeRegion = useRegionStore((s) => s.activeRegion)
  const store = useS3Store()
  const { message } = App.useApp()
  const t = useT()
  const tf = useTf()

  const fetchBuckets = useCallback(async (forceRefresh = false) => {
    store.setBuckets([])
    store.setLoadingBuckets(true)
    store.setError(null)
    try {
      const buckets = await window.electronAPI.s3.listBuckets({
        region: activeRegion,
        profile: activeProfile,
        source: activeSource,
        forceRefresh,
      })
      store.setBuckets(buckets)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      store.setBuckets([])
      store.setError(msg)
    } finally {
      store.setLoadingBuckets(false)
    }
  }, [activeProfile, activeSource, activeRegion])

  const fetchObjects = useCallback(
    async (bucket: string, prefix?: string) => {
      const s = useS3Store.getState()
      s.setObjects([], false, null)
      s.setLoadingObjects(true)
      s.setError(null)
      s.setCurrentBucket(bucket)
      s.setCurrentPrefix(prefix ?? '')
      try {
        const result = await window.electronAPI.s3.listObjects({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          bucket,
          prefix: prefix ?? '',
        })
        useS3Store.getState().setObjects(result.objects, result.truncated, result.nextContinuationToken ?? null)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        useS3Store.getState().setObjects([], false, null)
        useS3Store.getState().setError(msg)
      } finally {
        useS3Store.getState().setLoadingObjects(false)
      }
    },
    [activeProfile, activeSource, activeRegion],
  )

  const loadMoreObjects = useCallback(async () => {
    const s = useS3Store.getState()
    const bucket = s.currentBucket
    const token = s.listContinuationToken
    if (!bucket || !token) return
    s.setLoadingObjects(true)
    try {
      const result = await window.electronAPI.s3.listObjects({
        region: activeRegion,
        profile: activeProfile,
        source: activeSource,
        bucket,
        prefix: s.currentPrefix,
        continuationToken: token,
        maxItems: 1000,
      })
      useS3Store.getState().appendObjects(result.objects, result.truncated, result.nextContinuationToken ?? null)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally {
      useS3Store.getState().setLoadingObjects(false)
    }
  }, [activeProfile, activeSource, activeRegion, message])

  const deleteObject = useCallback(
    async (bucket: string, key: string) => {
      try {
        await window.electronAPI.s3.deleteObject({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          bucket,
          key,
        })
        message.success(tf('s3.msg.deleted', { key }))
        await fetchObjects(bucket, store.currentPrefix)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        message.error(msg)
      }
    },
    [activeProfile, activeSource, activeRegion, fetchObjects],
  )

  const uploadFile = useCallback(
    async (bucket: string, localPath: string, remoteKey: string) => {
      try {
        message.loading({ content: tf('s3.msg.uploading', { key: remoteKey }), key: 'upload' })
        await window.electronAPI.s3.uploadFile({
          region: activeRegion,
          profile: activeProfile,
          source: activeSource,
          bucket,
          key: remoteKey,
          localPath,
        })
        message.success({ content: tf('s3.msg.uploadDone', { key: remoteKey }), key: 'upload' })
        await fetchObjects(bucket, store.currentPrefix)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        message.error({ content: msg, key: 'upload' })
      }
    },
    [activeProfile, activeSource, activeRegion, fetchObjects],
  )

  const downloadFile = useCallback(
    async (bucket: string, key: string) => {
      try {
        const savePath = await window.electronAPI.app.saveFileDialog({
          defaultPath: key.split('/').pop() ?? 'download',
        })
        if (!savePath) return

        const fileName = key.split('/').pop() ?? key
        const unsub = window.electronAPI.s3.onDownloadProgress((data: { key: string; loaded: number; total: number }) => {
          const pct = data.total > 0 ? Math.round((data.loaded / data.total) * 100) : 0
          message.loading({
            content: tf('s3.msg.downloading', {
              name: fileName,
              pct,
              loaded: (data.loaded / 1024 / 1024).toFixed(1),
              total: (data.total / 1024 / 1024).toFixed(1),
            }),
            key: 'download',
            duration: 0,
          })
        })

        try {
          await window.electronAPI.s3.downloadFile({
            region: activeRegion,
            profile: activeProfile,
            source: activeSource,
            bucket,
            key,
            savePath,
          })
          message.success({ content: tf('s3.msg.downloadDone', { name: fileName }), key: 'download', duration: 3 })
        } finally {
          unsub()
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        message.error({ content: msg, key: 'download' })
      }
    },
    [activeProfile, activeSource, activeRegion],
  )

  const deleteObjects = useCallback(
    async (bucket: string, keys: string[]) => {
      try {
        message.loading({ content: tf('s3.msg.deletingBatch', { n: keys.length }), key: 'batch-delete' })
        await window.electronAPI.s3.deleteObjects({
          region: activeRegion, profile: activeProfile, source: activeSource, bucket, keys,
        })
        message.success({ content: tf('s3.msg.deletedBatch', { n: keys.length }), key: 'batch-delete' })
        await fetchObjects(bucket, store.currentPrefix)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        message.error({ content: msg, key: 'batch-delete' })
      }
    },
    [activeProfile, activeSource, activeRegion, fetchObjects],
  )

  const copyObject = useCallback(
    async (sourceBucket: string, sourceKey: string, destBucket: string, destKey: string) => {
      try {
        await window.electronAPI.s3.copyObject({
          region: activeRegion, profile: activeProfile, source: activeSource,
          sourceBucket, sourceKey, destBucket, destKey,
        })
        message.success(t('s3.msg.copied'))
        await fetchObjects(destBucket, store.currentPrefix)
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : String(err))
      }
    },
    [activeProfile, activeSource, activeRegion, fetchObjects],
  )

  const renameObject = useCallback(
    async (bucket: string, oldKey: string, newKey: string) => {
      try {
        await window.electronAPI.s3.renameObject({
          region: activeRegion, profile: activeProfile, source: activeSource,
          bucket, oldKey, newKey,
        })
        message.success(t('s3.msg.renamed'))
        await fetchObjects(bucket, store.currentPrefix)
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : String(err))
      }
    },
    [activeProfile, activeSource, activeRegion, fetchObjects],
  )

  return {
    ...store,
    fetchBuckets,
    fetchObjects,
    loadMoreObjects,
    deleteObject,
    deleteObjects,
    uploadFile,
    downloadFile,
    copyObject,
    renameObject,
  }
}
