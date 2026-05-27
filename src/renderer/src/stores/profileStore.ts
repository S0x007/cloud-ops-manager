import { create } from 'zustand'

export interface UnifiedCredential {
  id: string
  name: string
  source: 'aws-config' | 'custom'
  type?: 'basic' | 'sso' | 'role'
  region: string
  accountId?: string
  isExpired?: boolean
}

interface ProfileState {
  allCredentials: UnifiedCredential[]
  activeProfile: string          // credential id 或 profile name
  activeSource: 'aws-config' | 'custom'
  activeRegion: string
  accountId: string | null
  isVerifying: boolean
  verifyError: string | null
  isLoading: boolean

  setAllCredentials: (creds: UnifiedCredential[]) => void
  setActiveCredential: (id: string, source: 'aws-config' | 'custom') => void
  setActiveRegion: (region: string) => void
  setAccountId: (id: string | null) => void
  setVerifying: (v: boolean) => void
  setVerifyError: (e: string | null) => void
  setLoading: (l: boolean) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  allCredentials: [],
  activeProfile: 'default',
  activeSource: 'aws-config',
  activeRegion: 'us-east-1',
  accountId: null,
  isVerifying: false,
  verifyError: null,
  isLoading: false,

  setAllCredentials: (allCredentials) => set({ allCredentials }),
  setActiveCredential: (id, source) =>
    set({ activeProfile: id, activeSource: source, accountId: null, verifyError: null }),
  setActiveRegion: (region) => set({ activeRegion: region }),
  setAccountId: (id) => set({ accountId: id }),
  setVerifying: (v) => set({ isVerifying: v }),
  setVerifyError: (e) => set({ verifyError: e }),
  setLoading: (l) => set({ isLoading: l }),
}))
