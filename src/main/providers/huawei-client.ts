/**
 * 华为云 Client 工厂 — 管理 SDK 客户端生命周期
 */

import { BasicCredentials } from '@huaweicloud/huaweicloud-sdk-core'

const ENDPOINTS: Record<string, string> = {
  ecs: 'https://ecs.{region}.myhuaweicloud.com',
  vpc: 'https://vpc.{region}.myhuaweicloud.com',
  evs: 'https://evs.{region}.myhuaweicloud.com',
  ims: 'https://ims.{region}.myhuaweicloud.com',
  iam: 'https://iam.{region}.myhuaweicloud.com',
  rds: 'https://rds.{region}.myhuaweicloud.com',
  coc: 'https://coc.{region}.myhuaweicloud.com',
}

export class HuaweiClientFactory {
  private credentials: InstanceType<typeof BasicCredentials> | null = null
  private currentRegion = 'cn-north-4'

  setAuth(ak: string, sk: string, projectId?: string): void {
    const cred = new BasicCredentials().withAk(ak).withSk(sk)
    if (projectId) cred.withProjectId(projectId)
    this.credentials = cred
  }

  getCredentials(): InstanceType<typeof BasicCredentials> {
    if (!this.credentials) throw new Error('华为云凭证未设置')
    return this.credentials
  }

  setRegion(region: string): void { this.currentRegion = region }

  getEndpoint(service: string, region?: string): string {
    const r = region || this.currentRegion
    const tpl = ENDPOINTS[service]
    if (tpl) return tpl.replace('{region}', r)
    return `https://${service}.${r}.myhuaweicloud.com`
  }

  clear(): void { this.credentials = null }
}

export const huaweiFactory = new HuaweiClientFactory()
