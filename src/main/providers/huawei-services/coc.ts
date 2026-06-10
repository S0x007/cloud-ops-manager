/**
 * 华为云 COC 服务 — 远程命令执行
 * 认证: GlobalCredentials (domain-scoped AK/SK)
 * 路由: x-project-id 请求头 (project-scoped)
 */
import { GlobalCredentials } from '@huaweicloud/huaweicloud-sdk-core'
import { CocClient } from '@huaweicloud/huaweicloud-sdk-coc/v1/CocClient'
import { ListPublicScriptsRequest } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ListPublicScriptsRequest'
import { ExecutePublicScriptRequest } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ExecutePublicScriptRequest'
import { ExecuteScriptRequest } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ExecuteScriptRequest'
import { ScriptExecuteModel } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ScriptExecuteModel'
import { ScriptExecuteParam } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ScriptExecuteParam'
import { ExecuteInstancesBatchInfo } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ExecuteInstancesBatchInfo'
import { ExecuteResourceInstance } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ExecuteResourceInstance'
import { ScriptExecuteInputParam } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ScriptExecuteInputParam'
import { GetScriptJobInfoRequest } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/GetScriptJobInfoRequest'
import { GetScriptJobBatchRequest } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/GetScriptJobBatchRequest'
import { CreateScriptRequest } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/CreateScriptRequest'
import { AddScriptModel } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/AddScriptModel'
import { ScriptPropertiesModel } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ScriptPropertiesModel'
import { ListResourcesRequest } from '@huaweicloud/huaweicloud-sdk-coc/v1/model/ListResourcesRequest'

function buildClient(ak: string, sk: string): CocClient {
  return CocClient.newBuilder()
    .withCredential(new GlobalCredentials().withAk(ak).withSk(sk))
    .withEndpoint('https://coc.myhuaweicloud.com')
    .build()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type CocScriptType = 'SHELL' | 'BAT' | 'PYTHON'

export function isWindowsOs(osType?: string): boolean {
  return /windows/i.test(String(osType || ''))
}

/** 华为 COC：Windows 固定 BAT + system；Linux 默认 SHELL + root */
export function resolveCocExec(
  osType?: string,
  executeUser?: string,
  scriptType?: CocScriptType,
): { executeUser: string; scriptType: CocScriptType } {
  if (isWindowsOs(osType)) {
    return { executeUser: 'system', scriptType: 'BAT' }
  }
  return {
    executeUser: executeUser || 'root',
    scriptType: scriptType || 'SHELL',
  }
}

export async function listPublicScripts(ak: string, sk: string, projectId?: string, name?: string, type?: string): Promise<any[]> {
  const req = new ListPublicScriptsRequest().withLimit(100).withType((type || 'SHELL') as any)
  if (projectId) req.withXProjectId(projectId)
  if (name) req.withNameLike(name)
  const resp = await buildClient(ak, sk).listPublicScripts(req)
  return (resp as any).data?.records ?? []
}

export async function executeScript(
  ak: string, sk: string, projectId: string | undefined,
  serverId: string, region: string, scriptUuid: string,
  timeoutSec: number, executeUser: string,
  scriptParams?: Array<{ name: string; value: string }>,
): Promise<{ jobId: string }> {
  const target = new ExecuteResourceInstance().withResourceId(serverId).withRegionId(region).withProvider('ECS').withType('ecs' as any)
  const batch = new ExecuteInstancesBatchInfo().withBatchIndex(1).withTargetInstances([target]).withRotationStrategy('CONTINUE')
  const params = (scriptParams || []).map((p) => new ScriptExecuteInputParam(p.name, p.value))
  const execParam = new ScriptExecuteParam(timeoutSec, 100, executeUser)
  execParam.withScriptParams(params)
  const body = new ScriptExecuteModel().withExecuteParam(execParam).withExecuteBatches([batch])
  const req = new ExecutePublicScriptRequest(scriptUuid).withBody(body)
  if (projectId) req.withXProjectId(projectId)
  const resp = await buildClient(ak, sk).executePublicScript(req)
  return { jobId: (resp as any).data ?? '' }
}

export async function createAndExecute(
  ak: string, sk: string, projectId: string | undefined,
  serverId: string, region: string, command: string,
  timeoutSec: number, executeUser: string,
  scriptType: CocScriptType = 'SHELL',
): Promise<{ jobId: string; scriptUuid: string }> {
  const client = buildClient(ak, sk)
  const props = new ScriptPropertiesModel().withRiskLevel('LOW').withVersion('1.0.0')
  const addModel = new AddScriptModel().withName(`temp-cmd-${Date.now()}`).withType(scriptType).withContent(command).withDescription('临时命令执行').withProperties(props)
  const createReq = new CreateScriptRequest().withBody(addModel)
  if (projectId) createReq.withXProjectId(projectId)
  const createResp = await client.createScript(createReq)
  const scriptUuid = (createResp as any).data ?? ''

  const execParam = new ScriptExecuteParam(timeoutSec, 100, executeUser)
  const target = new ExecuteResourceInstance().withResourceId(serverId).withRegionId(region).withProvider('ECS').withType('ecs' as any)
  const batch = new ExecuteInstancesBatchInfo().withBatchIndex(1).withTargetInstances([target]).withRotationStrategy('CONTINUE')
  const body = new ScriptExecuteModel().withExecuteParam(execParam).withExecuteBatches([batch])
  const execReq = new ExecuteScriptRequest(scriptUuid).withBody(body)
  if (projectId) execReq.withXProjectId(projectId)
  const execResp = await client.executeScript(execReq)
  return { jobId: (execResp as any).data ?? '', scriptUuid }
}

export async function runCommandAndWait(
  ak: string, sk: string, projectId: string | undefined,
  serverId: string, region: string, command: string,
  timeoutSec: number, executeUser: string,
  scriptType: CocScriptType = 'SHELL',
): Promise<{
  jobId: string
  scriptUuid: string
  status: string
  output: string
  error: string
  polls: number
}> {
  const { jobId, scriptUuid } = await createAndExecute(ak, sk, projectId, serverId, region, command, timeoutSec, executeUser, scriptType)
  if (!jobId) {
    return { jobId: '', scriptUuid, status: 'ERROR', output: '', error: '未获取到任务 ID', polls: 0 }
  }

  // 官方流程：先查工单状态，再查批次实例明细；FINISHED 后给明细一个短暂落库缓冲窗口
  const maxPolls = Math.max(Math.ceil(timeoutSec / 2) + 2, 3)
  const finishedGracePolls = 8
  let polls = 0
  let finishedNoDetailCount = 0

  while (polls < maxPolls + finishedGracePolls) {
    polls += 1
    const [orderInfo, batchInstances] = await Promise.all([
      getScriptJobInfo(ak, sk, projectId, jobId),
      getScriptJobBatch(ak, sk, projectId, jobId, 1),
    ])
    const orderStatus = String(orderInfo?.status || '').toUpperCase()
    const first = (batchInstances || [])[0] || {}
    const instStatus = String(first?.status || '').toUpperCase()
    const output = String(first?.message || '').trim()

    if (['FINISHED', 'ABNORMAL', 'CANCELED', 'ROLLBACKED'].includes(instStatus)) {
      if (instStatus === 'FINISHED') {
        return { jobId, scriptUuid, status: instStatus, output: output || '(无输出)', error: '', polls }
      }
      return { jobId, scriptUuid, status: instStatus, output: '', error: output || `任务状态: ${instStatus}`, polls }
    }

    if (['ABNORMAL', 'CANCELED'].includes(orderStatus)) {
      return { jobId, scriptUuid, status: orderStatus, output: '', error: `任务状态: ${orderStatus}`, polls }
    }

    if (orderStatus === 'FINISHED' && !instStatus) {
      finishedNoDetailCount += 1
      if (finishedNoDetailCount >= finishedGracePolls) {
        return { jobId, scriptUuid, status: 'FINISHED', output: '(无输出)', error: '', polls }
      }
    }

    if (polls >= maxPolls && orderStatus !== 'FINISHED') {
      return { jobId, scriptUuid, status: 'TIMEOUT', output: '', error: '达到设定超时时间', polls }
    }

    await sleep(2000)
  }

  return { jobId, scriptUuid, status: 'TIMEOUT', output: '', error: '等待结果超时', polls }
}

export async function getScriptJobInfo(ak: string, sk: string, pid: string | undefined, jobId: string): Promise<any> {
  const req = new GetScriptJobInfoRequest(jobId)
  if (pid) req.withXProjectId(pid)
  return (await buildClient(ak, sk).getScriptJobInfo(req) as any).data ?? {}
}

export async function getScriptJobBatch(ak: string, sk: string, pid: string | undefined, jobId: string, batchIndex: number): Promise<any[]> {
  const req = new GetScriptJobBatchRequest(batchIndex, jobId, 100)
  req.withLimit(100)
  if (pid) req.withXProjectId(pid)
  return (await buildClient(ak, sk).getScriptJobBatch(req) as any).data?.execute_instances ?? []
}

export async function checkAgentStatus(
  ak: string, sk: string, projectId: string | undefined,
  serverIds: string[], region: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const req = new ListResourcesRequest().withProvider('ecs').withType('cloudservers').withRegionId(region).withLimit(100)
  req.withResourceIdList(serverIds)
  try {
    const resp = await buildClient(ak, sk).listResources(req)
    const records = (resp as any).data ?? []
    for (const r of records) {
      const id = r.resource_id ?? r.resourceId ?? r.id
      const state = r.agent_state ?? r.agentState
      if (id) result[id] = state ? String(state).toUpperCase() : 'UNINSTALLED'
    }
  } catch (err) { /* listResources 失败时回退 UNKNOWN */ }
  for (const id of serverIds) {
    if (!result[id]) result[id] = 'UNKNOWN'
  }
  return result
}
