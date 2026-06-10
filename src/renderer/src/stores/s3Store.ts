import { create } from 'zustand'

export interface S3Bucket {
  name: string
  creationDate: string
  region?: string
}

export interface S3Object {
  key: string
  size: number
  lastModified: string
  storageClass: string
}

interface S3State {
  buckets: S3Bucket[]
  objects: S3Object[]
  currentBucket: string | null
  currentPrefix: string
  isLoadingBuckets: boolean
  isLoadingObjects: boolean
  error: string | null
  objectsTruncated: boolean
  listContinuationToken: string | null
  selectedObject: string | null

  setBuckets: (b: S3Bucket[]) => void
  setObjects: (o: S3Object[], truncated?: boolean, continuationToken?: string | null) => void
  appendObjects: (o: S3Object[], truncated?: boolean, continuationToken?: string | null) => void
  setCurrentBucket: (b: string | null) => void
  setCurrentPrefix: (p: string) => void
  setLoadingBuckets: (l: boolean) => void
  setLoadingObjects: (l: boolean) => void
  setError: (e: string | null) => void
  setSelectedObject: (o: string | null) => void
  reset: () => void
}

export const useS3Store = create<S3State>((set) => ({
  buckets: [],
  objects: [],
  currentBucket: null,
  currentPrefix: '',
  isLoadingBuckets: false,
  isLoadingObjects: false,
  error: null,
  objectsTruncated: false,
  listContinuationToken: null,
  selectedObject: null,

  setBuckets: (buckets) => set({ buckets }),
  setObjects: (objects, truncated = false, continuationToken = null) =>
    set({ objects, objectsTruncated: truncated, listContinuationToken: continuationToken ?? null }),
  appendObjects: (more, truncated = false, continuationToken = null) =>
    set((state) => ({
      objects: [...state.objects, ...more],
      objectsTruncated: truncated,
      listContinuationToken: continuationToken ?? null,
    })),
  setCurrentBucket: (bucket) => set({
    currentBucket: bucket, currentPrefix: '', objects: [], objectsTruncated: false, listContinuationToken: null,
  }),
  setCurrentPrefix: (prefix) => set({ currentPrefix: prefix }),
  setLoadingBuckets: (l) => set({ isLoadingBuckets: l }),
  setLoadingObjects: (l) => set({ isLoadingObjects: l }),
  setError: (e) => set({ error: e }),
  setSelectedObject: (o) => set({ selectedObject: o }),
  reset: () =>
    set({
      buckets: [],
      objects: [],
      currentBucket: null,
      currentPrefix: '',
      isLoadingBuckets: false,
      isLoadingObjects: false,
      error: null,
      objectsTruncated: false,
      listContinuationToken: null,
      selectedObject: null,
    }),
}))
