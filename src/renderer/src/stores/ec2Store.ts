import { create } from 'zustand'

export interface EC2Instance {
  instanceId: string
  name: string
  state: string
  instanceType: string
  platform: string
  publicIpAddress: string
  privateIpAddress: string
  vpcId: string
  subnetId: string
  launchTime: string
  availabilityZone: string
  tags: { key: string; value: string }[]
  ssmManaged: boolean
}

interface EC2State {
  instances: EC2Instance[]
  selectedInstances: string[]
  isLoading: boolean
  error: string | null
  filterText: string

  setInstances: (instances: EC2Instance[]) => void
  setLoading: (l: boolean) => void
  setError: (e: string | null) => void
  setFilterText: (t: string) => void
  setSelectedInstances: (ids: string[]) => void
  updateInstanceState: (instanceId: string, state: string) => void
  getFilteredInstances: () => EC2Instance[]
  reset: () => void
}

export const useEC2Store = create<EC2State>((set, get) => ({
  instances: [],
  selectedInstances: [],
  isLoading: false,
  error: null,
  filterText: '',

  setInstances: (instances) => set({ instances }),
  setLoading: (l) => set({ isLoading: l }),
  setError: (e) => set({ error: e }),
  setFilterText: (t) => set({ filterText: t }),
  setSelectedInstances: (ids) => set({ selectedInstances: ids }),

  updateInstanceState: (instanceId, state) => {
    const instances = get().instances.map((inst) =>
      inst.instanceId === instanceId ? { ...inst, state } : inst,
    )
    set({ instances })
  },

  getFilteredInstances: () => {
    const { instances, filterText } = get()
    if (!filterText.trim()) return instances
    const q = filterText.toLowerCase()
    return instances.filter(
      (inst) =>
        inst.instanceId.toLowerCase().includes(q) ||
        inst.name.toLowerCase().includes(q) ||
        inst.instanceType.toLowerCase().includes(q) ||
        inst.state.toLowerCase().includes(q) ||
        inst.publicIpAddress.includes(q),
    )
  },

  reset: () =>
    set({
      instances: [],
      selectedInstances: [],
      isLoading: false,
      error: null,
    }),
}))
