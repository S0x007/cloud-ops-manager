import { create } from 'zustand'

export const PROVIDERS = [
  { id: 'aws', name: 'AWS', nameZh: '亚马逊云', color: '#FF9900' },
  { id: 'huawei', name: 'Huawei Cloud', nameZh: '华为云', color: '#CF0A2C' },
] as const

export type ProviderId = (typeof PROVIDERS)[number]['id']

interface ProviderState {
  currentProvider: ProviderId
  setCurrentProvider: (id: ProviderId) => void
}

export const useProviderStore = create<ProviderState>((set) => ({
  currentProvider: 'aws',
  setCurrentProvider: (id) => set({ currentProvider: id }),
}))
