/**
 * 华为云 IAM 服务 — 凭证验证 + 项目列表
 */

import { IamClient } from '@huaweicloud/huaweicloud-sdk-iam/v3/IamClient'
import { KeystoneListAuthDomainsRequest } from '@huaweicloud/huaweicloud-sdk-iam/v3/model/KeystoneListAuthDomainsRequest'
import { KeystoneListProjectsRequest } from '@huaweicloud/huaweicloud-sdk-iam/v3/model/KeystoneListProjectsRequest'
import { huaweiFactory } from '../huawei-client'
import { findProjectForRegion, type HuaweiProjectInfo } from '../huawei-region'

export type ProjectInfo = HuaweiProjectInfo

async function fetchAllProjects(): Promise<ProjectInfo[]> {
  const client = IamClient.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint('https://iam.myhuaweicloud.com')
    .build()
  try {
    const resp = await client.keystoneListProjects(new KeystoneListProjectsRequest())
    return (resp.projects ?? [])
      .filter((p: any) => p.enabled)
      .map((p: any) => ({ id: p.id, name: p.name, enabled: p.enabled }))
  } catch {
    return []
  }
}

/** 获取账号下全部已启用项目 */
export async function listAllProjects(): Promise<ProjectInfo[]> {
  return fetchAllProjects()
}

/** 获取指定区域对应的 IAM 项目（精确匹配，避免 cn-north-1 误匹配 cn-north-10） */
export async function listProjects(region?: string): Promise<ProjectInfo[]> {
  const projects = await fetchAllProjects()
  if (!region) return projects
  const matched = findProjectForRegion(projects, region)
  return matched ? [matched] : []
}

export async function verifyCredential(region: string): Promise<{ accountId: string; accountName?: string; projects: ProjectInfo[] }> {
  const client = IamClient.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint('https://iam.myhuaweicloud.com')
    .build()

  const domainResp = await client.keystoneListAuthDomains(new KeystoneListAuthDomainsRequest())
  const domain = domainResp.domains?.[0]

  let projects: ProjectInfo[] = []
  try {
    projects = await fetchAllProjects()
  } catch { /* 可能因权限不足失败 */ }

  return {
    accountId: domain?.id ?? 'unknown',
    accountName: domain?.name,
    projects,
  }
}
