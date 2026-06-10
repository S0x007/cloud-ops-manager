import type { CloudProvider, ProviderId } from './types'

export class ProviderRegistry {
  private static instance: ProviderRegistry
  private providers = new Map<ProviderId, CloudProvider>()

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) ProviderRegistry.instance = new ProviderRegistry()
    return ProviderRegistry.instance
  }

  register(p: CloudProvider): void {
    if (this.providers.has(p.id)) throw new Error(`Provider '${p.id}' 已注册`)
    this.providers.set(p.id, p)
  }

  get(id: ProviderId): CloudProvider {
    const p = this.providers.get(id)
    if (!p) throw new Error(`Provider '${id}' 未注册`)
    return p
  }

  getAll(): CloudProvider[] { return [...this.providers.values()] }

  isRegistered(id: ProviderId): boolean { return this.providers.has(id) }
}
