/**
 * 华为云 RDS 服务 — 关系型数据库管理
 */

import { RdsClient } from '@huaweicloud/huaweicloud-sdk-rds/v3/RdsClient'
import { ListInstancesRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/ListInstancesRequest'
import { ListBackupsRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/ListBackupsRequest'
import { CreateManualBackupRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/CreateManualBackupRequest'
import { CreateManualBackupRequestBody } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/CreateManualBackupRequestBody'
import { ListConfigurationsRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/ListConfigurationsRequest'
import { ShowInstanceConfigurationRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/ShowInstanceConfigurationRequest'
import { ListDbUsersRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/ListDbUsersRequest'
import { ResetPwdRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/ResetPwdRequest'
import { PwdResetRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/PwdResetRequest'
import { StartupInstanceRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/StartupInstanceRequest'
import { StopInstanceRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/StopInstanceRequest'
import { StartInstanceRestartActionRequest } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/StartInstanceRestartActionRequest'
import { InstanceRestartRequsetBody } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/InstanceRestartRequsetBody'
import { RestartConfiguration } from '@huaweicloud/huaweicloud-sdk-rds/v3/model/RestartConfiguration'
import { huaweiFactory } from '../huawei-client'

function buildClient(region: string): RdsClient {
  return RdsClient.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('rds', region))
    .build()
}

function mapInstance(r: any) {
  return {
    id: r.id ?? '',
    name: r.name ?? '',
    status: r.status ?? 'UNKNOWN',
    type: r.type ?? '',
    engine: r.datastore?.type ?? '',
    engineVersion: r.datastore?.version ?? '',
    flavor: r.flavorRef ?? '',
    vcpus: r.cpu ?? '',
    memoryMB: parseInt(r.mem ?? '0'),
    size: r.volume?.size ?? 0,
    port: r.port ?? 0,
    privateIps: r.privateIps ?? [],
    publicIps: r.publicIps ?? [],
    vpcId: r.vpcId ?? '',
    subnetId: r.subnetId ?? '',
    created: r.created ?? '',
    updated: r.updated ?? '',
    dbUserName: r.dbUserName ?? '',
    enableSsl: r.enableSsl ?? false,
  }
}

export async function listInstances(region: string): Promise<any[]> {
  const client = buildClient(region)
  const resp = await client.listInstances(new ListInstancesRequest().withLimit(100))
  return (resp.instances ?? []).map(mapInstance)
}

export async function getInstance(region: string, instanceId: string): Promise<any | null> {
  const client = buildClient(region)
  // withId 过滤时部分字段可能缺失，改用全量拉取后本地匹配
  const resp = await client.listInstances(new ListInstancesRequest().withLimit(100))
  const found = (resp.instances ?? []).find((r: any) => (r.id ?? '') === instanceId)
  return found ? mapInstance(found) : null
}

export async function listBackups(region: string, instanceId: string): Promise<any[]> {
  const client = buildClient(region)
  const resp = await client.listBackups(new ListBackupsRequest(instanceId).withLimit(100))
  return (resp.backups ?? []).map((b: any) => ({
    id: b.id ?? '',
    name: b.name ?? '',
    type: b.type ?? '',
    status: b.status ?? '',
    size: b.size ?? 0,
    beginTime: b.beginTime ?? b.begin_time ?? '',
    endTime: b.endTime ?? b.end_time ?? '',
    databases: b.databases ?? [],
  }))
}

export async function createManualBackup(region: string, instanceId: string, name: string, description?: string): Promise<any> {
  const client = buildClient(region)
  const body = new CreateManualBackupRequestBody(instanceId, name)
  if (description) body.withDescription(description)
  const req = new CreateManualBackupRequest().withBody(body)
  const resp = await client.createManualBackup(req)
  return { id: resp.backup?.id ?? '' }
}

export async function listConfigurations(region: string): Promise<any[]> {
  const client = buildClient(region)
  const resp = await client.listConfigurations(new ListConfigurationsRequest())
  return (resp.configurations ?? []).map((c: any) => ({
    id: c.id ?? '',
    name: c.name ?? '',
    description: c.description ?? '',
    datastoreName: c.datastoreName ?? '',
    datastoreVersionName: c.datastoreVersionName ?? '',
    created: c.created ?? '',
    updated: c.updated ?? '',
  }))
}

export async function getInstanceConfiguration(region: string, instanceId: string): Promise<any> {
  const client = buildClient(region)
  const resp = await client.showInstanceConfiguration(new ShowInstanceConfigurationRequest(instanceId).withXLanguage('zh-cn'))
  return {
    datastoreVersionName: resp.datastoreVersionName ?? '',
    datastoreName: resp.datastoreName ?? '',
    created: resp.created ?? '',
    updated: resp.updated ?? '',
    parameters: (resp.configurationParameters ?? []).map((p: any) => ({
      name: p.name ?? '',
      value: p.value ?? '',
      restartRequired: p.restartRequired ?? false,
      readonly: p.readonly ?? false,
      valueRange: p.valueRange ?? '',
      type: p.type ?? '',
      description: p.description ?? '',
    })),
  }
}

export async function listDbUsers(region: string, instanceId: string): Promise<any[]> {
  const client = buildClient(region)
  const resp = await client.listDbUsers(new ListDbUsersRequest(instanceId, 1, 100).withXLanguage('zh-cn'))
  return (resp.users ?? []).map((u: any) => ({
    name: u.name ?? '',
    hosts: u.hosts ?? [],
    databases: (u.databases ?? []).map((d: any) => ({ name: d.name, readonly: d.readonly })),
    comment: u.comment ?? '',
  }))
}

export async function resetDbUserPassword(region: string, instanceId: string, userName: string, newPassword: string): Promise<void> {
  const client = buildClient(region)
  const body = new PwdResetRequest(newPassword)
  const req = new ResetPwdRequest(instanceId).withBody(body).withXLanguage('zh-cn')
  await client.resetPwd(req)
}

export async function startInstance(region: string, instanceId: string): Promise<{ jobId?: string }> {
  const client = buildClient(region)
  const resp = await client.startupInstance(new StartupInstanceRequest(instanceId).withXLanguage('zh-cn'))
  return { jobId: resp.jobId }
}

export async function stopInstance(region: string, instanceId: string): Promise<{ jobId?: string }> {
  const client = buildClient(region)
  const resp = await client.stopInstance(new StopInstanceRequest(instanceId).withXLanguage('zh-cn'))
  return { jobId: resp.jobId }
}

export async function restartInstance(region: string, instanceId: string): Promise<{ jobId?: string }> {
  const client = buildClient(region)
  const restart = new RestartConfiguration().withRestartServer(true)
  const body = new InstanceRestartRequsetBody(restart)
  const resp = await client.startInstanceRestartAction(
    new StartInstanceRestartActionRequest(instanceId).withBody(body).withXLanguage('zh-cn'),
  )
  return { jobId: resp.jobId }
}
