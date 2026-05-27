import { create } from 'zustand'

interface RegionState {
  activeRegion: string
  regionCounts: Record<string, number | null>  // 各区域 EC2 数量缓存
  setActiveRegion: (region: string) => void
  setRegionCount: (region: string, count: number) => void
  clearRegionCounts: () => void
}

export const useRegionStore = create<RegionState>((set) => ({
  activeRegion: 'us-east-1',
  regionCounts: {},
  setActiveRegion: (region) => set({ activeRegion: region }),
  setRegionCount: (region, count) =>
    set((s) => ({ regionCounts: { ...s.regionCounts, [region]: count } })),
  clearRegionCounts: () => set({ regionCounts: {} }),
}))
