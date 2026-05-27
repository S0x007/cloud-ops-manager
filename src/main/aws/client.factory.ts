import { fromIni, fromNodeProviderChain } from '@aws-sdk/credential-providers'
import type { AwsCredentialIdentityProvider } from '@smithy/types'
import { getCredentialWithSecret } from '../store/credential-store'
import { clearAllCache } from '../store/api-cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AwsClientConstructor<T = any> = new (config: any) => T

interface ClientFactoryConfig {
  profile: string         // ~/.aws profile 名称，或自定义凭证 ID
  region: string
  source: 'aws-config' | 'custom'  // 凭证来源
}

class AwsClientFactory {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clients = new Map<string, any>()
  private config: ClientFactoryConfig = {
    profile: 'default',
    region: 'us-east-1',
    source: 'aws-config',
  }

  private cacheKey(service: string, region: string, profile: string): string {
    return `${profile}:${region}:${service}`
  }

  private resolveCredentials(): AwsCredentialIdentityProvider {
    // 自定义凭证：从加密存储中读取
    if (this.config.source === 'custom') {
      const cred = getCredentialWithSecret(this.config.profile)
      if (!cred) {
        throw new Error(`自定义凭证不存在: ${this.config.profile}`)
      }
      // 返回静态凭证提供者
      return () =>
        Promise.resolve({
          accessKeyId: cred.accessKeyId,
          secretAccessKey: cred.secretAccessKey,
        })
    }

    // ~/.aws 凭证
    if (this.config.profile === 'default') {
      return fromNodeProviderChain()
    }
    return fromIni({ profile: this.config.profile })
  }

  getClient<T>(ctor: AwsClientConstructor<T>, options?: { region?: string }): T {
    const region = options?.region ?? this.config.region
    const key = this.cacheKey(ctor.name, region, this.config.profile)

    if (this.clients.has(key)) {
      return this.clients.get(key) as T
    }

    const client = new ctor({
      region,
      credentials: this.resolveCredentials(),
    })

    this.clients.set(key, client)
    return client
  }

  setProfile(profile: string, source: 'aws-config' | 'custom' = 'aws-config'): void {
    if (this.config.profile !== profile || this.config.source !== source) {
      this.config.profile = profile
      this.config.source = source
      this.clients.clear()
      clearAllCache() // 凭证变了，所有缓存失效
    }
  }

  setRegion(region: string): void {
    if (this.config.region !== region) {
      this.config.region = region
      this.clients.clear()
      clearAllCache() // 区域变了，所有缓存失效
    }
  }

  getActiveProfile(): string {
    return this.config.profile
  }

  getActiveSource(): 'aws-config' | 'custom' {
    return this.config.source
  }

  getActiveRegion(): string {
    return this.config.region
  }
}

export const clientFactory = new AwsClientFactory()
