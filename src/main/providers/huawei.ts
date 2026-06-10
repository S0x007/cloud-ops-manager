import type { CloudProvider, CloudMenuGroup } from './types'
import { huaweiFactory } from './huawei-client'
import { HUAWEI_MANIFEST } from '../../shared/providers/huawei.manifest'
import * as ecsService from './huawei-services/ecs'
import * as vpcService from './huawei-services/vpc'
import * as evsService from './huawei-services/evs'
import * as imsService from './huawei-services/ims'
import * as iamService from './huawei-services/iam'
import { listAllProjects } from './huawei-services/iam'
import * as rdsService from './huawei-services/rds'
import * as obsService from './huawei-services/obs'
import * as cocService from './huawei-services/coc'
import * as sshService from './huawei-services/ssh-exec'
import * as eipService from './huawei-services/eip'

import { findProjectForRegion, getRegionDisplayName } from './huawei-region'

const REGIONS = HUAWEI_MANIFEST.regions.map((r) => ({ id: r.id, name: r.nameZh }))
const MENU: CloudMenuGroup[] = HUAWEI_MANIFEST.menus

export class HuaweiProvider implements CloudProvider {
  id = 'huawei' as const
  name = HUAWEI_MANIFEST.name
  nameZh = HUAWEI_MANIFEST.nameZh
  color = HUAWEI_MANIFEST.color

  getRegions() { return REGIONS }
  getDefaultRegion() { return HUAWEI_MANIFEST.defaultRegion }
  getMenuGroups() { return MENU }

  async verifyCredential(ak: string, sk: string, region: string, extraFields?: Record<string, string>): Promise<{ accountId: string; projects?: { id: string; name: string }[] }> {
    // IAM 验证不需要 projectId（domain 级 API），不传
    huaweiFactory.setAuth(ak, sk, undefined)
    const info = await iamService.verifyCredential(region)
    return { accountId: info.accountId, projects: info.projects }
  }

  async executeOperation(action: string, credentialId: string, region: string, payload: Record<string, unknown>) {
    // 从 credential store 获取 AK/SK
    const { getCredentialWithSecret } = await import('../store/credential-store')
    const cred = getCredentialWithSecret(credentialId)
    const ak = cred?.accessKeyId ?? ''
    const sk = cred?.secretAccessKey ?? ''
    // COC 使用 GlobalCredentials 认证，但仍需 projectId 作为请求头
    const isCocApi = action.startsWith('coc:')
    // COC 虽然使用 GlobalCredentials 鉴权，但请求依然依赖项目作用域（x-project-id）
    const isProjectApi = !action.startsWith('obs:') && !action.startsWith('iam:')

    // 每个区域独立匹配项目，不使用凭证中保存的 projectId（跨区域不通用）
    let projectId: string | undefined
    if (isProjectApi) {
      try {
        huaweiFactory.setAuth(ak, sk, undefined)
        const allProjects = await listAllProjects()
        const matched = findProjectForRegion(allProjects, region)
        projectId = matched?.id
      } catch { /* IAM 不可用 */ }
    }

    if (isProjectApi && !projectId) {
      let hint = '请确认该区域已开通，且 IAM 用户已授权'
      try {
        huaweiFactory.setAuth(ak, sk, undefined)
        const names = (await listAllProjects()).map((p) => p.name).slice(0, 6)
        if (names.length > 0) hint += `。当前账号可见项目：${names.join('、')}`
      } catch { /* ignore */ }
      throw new Error(`REGION_FORBIDDEN:${region}:当前区域未找到可用项目（${getRegionDisplayName(region)}）。${hint}`)
    }

    // 非 OBS 服务使用 HcClient 体系
    if (!action.startsWith('obs:')) {
      huaweiFactory.setAuth(ak, sk, projectId)
      huaweiFactory.setRegion(region)
    }

    try {
      switch (action) {
        case 'ecs:list':
        case 'ecs:list-servers':
        case 'ecs:listServers': return await ecsService.listServers(region)
        case 'ecs:get':
        case 'ecs:get-server': return await ecsService.getServer(region, payload['serverId'] as string)
        case 'ecs:start':
        case 'ecs:start-server': return await ecsService.startServer(region, payload['serverId'] as string)
        case 'ecs:stop':
        case 'ecs:stop-server': return await ecsService.stopServer(region, payload['serverId'] as string)
        case 'ecs:reboot':
        case 'ecs:reboot-server': return await ecsService.rebootServer(region, payload['serverId'] as string)
        case 'ecs:batchStart':
        case 'ecs:batch-start': return await ecsService.batchStartServers(region, (payload['serverIds'] as string[]) || [])
        case 'ecs:batchStop':
        case 'ecs:batch-stop': return await ecsService.batchStopServers(region, (payload['serverIds'] as string[]) || [])
        case 'ecs:delete':
        case 'ecs:delete-server': return await ecsService.deleteServer(region, payload['serverId'] as string, (payload['deletePublicIp'] as boolean) ?? true, (payload['deleteVolume'] as boolean) ?? false)
        case 'ecs:listFlavors':
        case 'ecs:list-flavors': return await ecsService.listFlavors(region, payload['az'] as string)
        case 'ecs:resize':
        case 'ecs:resize-server': return await ecsService.resizeServer(region, payload['serverId'] as string, payload['newFlavorId'] as string)
        case 'ecs:updateName':
        case 'ecs:update-name': return await ecsService.updateServerName(region, payload['serverId'] as string, payload['name'] as string)
        case 'ecs:resetPassword':
        case 'ecs:reset-password': return await ecsService.resetPassword(region, payload['serverId'] as string, payload['newPassword'] as string)
        case 'ecs:vncConsole':
        case 'ecs:vnc-console': return await ecsService.getVncConsole(region, payload['serverId'] as string)
        case 'ecs:listVolumes':
        case 'ecs:list-volumes': return await ecsService.listServerVolumes(region, payload['serverId'] as string)
        case 'ecs:getPassword':
        case 'ecs:get-password': return await ecsService.getServerPassword(region, payload['serverId'] as string)
        case 'ecs:attachVolume':
        case 'ecs:attach-volume': return await ecsService.attachVolume(region, payload['serverId'] as string, payload['volumeId'] as string, payload['device'] as string)
        case 'ecs:detachVolume':
        case 'ecs:detach-volume': return await ecsService.detachVolume(region, payload['serverId'] as string, payload['volumeId'] as string)
        case 'ecs:createServer':
        case 'ecs:create-server': return await ecsService.createServer(region, payload as any)

        case 'vpc:list':
        case 'vpc:list-vpcs': return await vpcService.listVpcs(region)
        case 'vpc:subnets':
        case 'vpc:list-subnets': return await vpcService.listSubnets(region)
        case 'vpc:sg':
        case 'vpc:list-sg': return await vpcService.listSecurityGroups(region)
        case 'vpc:createSgRule':
        case 'vpc:create-sg-rule': return await vpcService.createSecurityGroupRule(region, payload as any)
        case 'vpc:deleteSgRule':
        case 'vpc:delete-sg-rule': return await vpcService.deleteSecurityGroupRule(region, payload['ruleId'] as string)

        case 'evs:list':
        case 'evs:list-volumes': return await evsService.listVolumes(region)
        case 'evs:create':
        case 'evs:create-volume': return await evsService.createVolume(region, payload as any)
        case 'evs:delete':
        case 'evs:delete-volume': return await evsService.deleteVolume(region, payload['volumeId'] as string)
        case 'evs:resize':
        case 'evs:resize-volume': return await evsService.resizeVolume(region, payload['volumeId'] as string, payload['newSize'] as number)

        case 'rds:list':
        case 'rds:list-instances': return await rdsService.listInstances(region)
        case 'rds:get':
        case 'rds:get-instance': return await rdsService.getInstance(region, payload['instanceId'] as string)
        case 'rds:listBackups':
        case 'rds:list-backups': return await rdsService.listBackups(region, payload['instanceId'] as string)
        case 'rds:createBackup':
        case 'rds:create-backup': return await rdsService.createManualBackup(region, payload['instanceId'] as string, payload['name'] as string, payload['description'] as string)
        case 'rds:listConfigs':
        case 'rds:list-configurations': return await rdsService.listConfigurations(region)
        case 'rds:getConfig':
        case 'rds:get-configuration': return await rdsService.getInstanceConfiguration(region, payload['instanceId'] as string)
        case 'rds:listUsers':
        case 'rds:list-users': return await rdsService.listDbUsers(region, payload['instanceId'] as string)
        case 'rds:resetPassword':
        case 'rds:reset-password': return await rdsService.resetDbUserPassword(region, payload['instanceId'] as string, payload['userName'] as string, payload['newPassword'] as string)
        case 'rds:start':
        case 'rds:start-instance': return await rdsService.startInstance(region, payload['instanceId'] as string)
        case 'rds:stop':
        case 'rds:stop-instance': return await rdsService.stopInstance(region, payload['instanceId'] as string)
        case 'rds:restart':
        case 'rds:restart-instance': return await rdsService.restartInstance(region, payload['instanceId'] as string)

        case 'obs:listBuckets': return await obsService.listBuckets(ak, sk, region)
        case 'obs:listObjects': return await obsService.listObjects(ak, sk, region, payload['bucket'] as string, (payload['prefix'] as string) || '')
        case 'obs:headBucket': return await obsService.headBucket(ak, sk, payload['bucket'] as string)
        case 'obs:getBucketDetail': return await obsService.getBucketDetail(ak, sk, region, payload['bucket'] as string)
        case 'obs:deleteObject': return await obsService.deleteObject(ak, sk, region, payload['bucket'] as string, payload['key'] as string)
        case 'obs:getObjectContent': return await obsService.getObjectContent(ak, sk, region, payload['bucket'] as string, payload['key'] as string)
        case 'obs:putObject': return await obsService.putObjectContent(ak, sk, region, payload['bucket'] as string, payload['key'] as string, payload['content'] as string, payload['contentType'] as string)
        case 'obs:uploadFile': return await obsService.uploadFile(ak, sk, region, payload['bucket'] as string, payload['key'] as string, payload['localPath'] as string)
        case 'obs:downloadFile': {
          const { BrowserWindow } = await import('electron')
          const win = BrowserWindow.getAllWindows()[0]
          const key = payload['key'] as string
          return await obsService.downloadFile(ak, sk, region, payload['bucket'] as string, key, payload['savePath'] as string,
            (loaded, total) => { win?.webContents.send('obs:download-progress', { key, loaded, total }) })
        }
        case 'obs:deleteObjects': return await obsService.deleteObjects(ak, sk, region, payload['bucket'] as string, (payload['keys'] as string[]) || [])
        case 'obs:createFolder': return await obsService.createFolder(ak, sk, region, payload['bucket'] as string, payload['key'] as string)
        case 'obs:copyObject': return await obsService.copyObject(ak, sk, region, payload['sourceBucket'] as string, payload['sourceKey'] as string, payload['destBucket'] as string, payload['destKey'] as string)
        case 'obs:headObject': return await obsService.headObject(ak, sk, region, payload['bucket'] as string, payload['key'] as string)

        case 'ims:list':
        case 'ims:list-images': return await imsService.listImages(region)

        case 'eip:list':
        case 'eip:list-eips': return await eipService.listEips(region, projectId!)
        case 'eip:allocate':
        case 'eip:allocate-eip': return await eipService.allocateEip(region, projectId!, payload as any)
        case 'eip:release':
        case 'eip:release-eip': return await eipService.releaseEip(region, projectId!, payload['publicipId'] as string)
        case 'eip:associate':
        case 'eip:associate-eip': return await eipService.associateEip(region, projectId!, payload['serverId'] as string, payload['publicipId'] as string)
        case 'eip:disassociate':
        case 'eip:disassociate-eip': return await eipService.disassociateEip(region, projectId!, payload['publicipId'] as string)

        case 'coc:listScripts':
        case 'coc:list-scripts': return await cocService.listPublicScripts(ak, sk, projectId, payload['name'] as string, payload['type'] as string)
        case 'coc:executeScript':
        case 'coc:execute-script': return await cocService.executeScript(ak, sk, projectId, payload['serverId'] as string, region, payload['scriptUuid'] as string, (payload['timeout'] as number) || 300, (payload['executeUser'] as string) || 'root', payload['scriptParams'] as any)
        case 'coc:getJobInfo':
        case 'coc:get-job-info': return await cocService.getScriptJobInfo(ak, sk, projectId, payload['jobId'] as string)
        case 'coc:getJobBatch':
        case 'coc:get-job-batch': return await cocService.getScriptJobBatch(ak, sk, projectId, payload['jobId'] as string, (payload['batchIndex'] as number) || 1)
        case 'coc:runCommand':
        case 'coc:run-command': {
          const resolved = cocService.resolveCocExec(payload['osType'] as string, payload['executeUser'] as string, payload['scriptType'] as cocService.CocScriptType)
          return await cocService.createAndExecute(ak, sk, projectId, payload['serverId'] as string, region, payload['command'] as string, (payload['timeout'] as number) || 300, resolved.executeUser, resolved.scriptType)
        }
        case 'coc:runCommandAndWait':
        case 'coc:run-command-and-wait': {
          const resolved = cocService.resolveCocExec(payload['osType'] as string, payload['executeUser'] as string, payload['scriptType'] as cocService.CocScriptType)
          return await cocService.runCommandAndWait(ak, sk, projectId, payload['serverId'] as string, region, payload['command'] as string, (payload['timeout'] as number) || 300, resolved.executeUser, resolved.scriptType)
        }
        case 'coc:checkAgent':
        case 'coc:check-agent': return await cocService.checkAgentStatus(ak, sk, projectId, (payload['serverIds'] as string[]) || [], region)

        case 'ssh:exec':
        case 'ssh:execute': return await sshService.sshExec(
          payload['host'] as string, (payload['port'] as number) || 22,
          (payload['username'] as string) || 'root',
          { password: payload['password'] as string, privateKey: payload['privateKey'] as string, passphrase: payload['passphrase'] as string },
          payload['command'] as string, (payload['timeout'] as number) || 30000,
        )
        case 'ssh:check':
        case 'ssh:reachable': return await sshService.checkSshReachable(
          payload['host'] as string, (payload['port'] as number) || 22,
        )

        default:
          throw new Error(
            `华为云不支持的操作: ${action}。主进程可能未加载最新代码，请完全退出应用后重新执行 npm run dev（或 npm run build 后再启动）。`,
          )
      }
    } catch (err: any) {
      // 统一：IAM 用户被禁止访问该区域 或 区域不匹配 → 都转为 REGION_FORBIDDEN
      const msg = err.message || String(err)
      if (msg.includes('forbidden') || msg.includes('does not match')) {
        throw new Error(`REGION_FORBIDDEN:${region}:${msg}`)
      }
      throw err
    }
  }
}
