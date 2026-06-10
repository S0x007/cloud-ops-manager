import { contextBridge, ipcRenderer } from 'electron'

// 类型化 API 暴露给渲染进程
const electronAPI = {
  // EC2（增加 source 参数）
  ec2: {
    listInstances: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('ec2:list-instances', params),
    describeInstance: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ec2:describe-instance', params),
    startInstance: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ec2:start-instance', params),
    stopInstance: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ec2:stop-instance', params),
    rebootInstance: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ec2:reboot-instance', params),
    terminateInstance: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ec2:terminate-instance', params),
    describeInstanceTypes: (params: { region: string; profile: string; source: string; types: string[] }) =>
      ipcRenderer.invoke('ec2:describe-instance-types', params),
    getConsoleOutput: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ec2:get-console-output', params),
  },

  // S3
  s3: {
    listBuckets: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('s3:list-buckets', params),
    listObjects: (params: {
      region: string; profile: string; source: string; bucket: string; prefix: string
      continuationToken?: string; maxItems?: number
    }) => ipcRenderer.invoke('s3:list-objects', params),
    headBucket: (params: { profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:head-bucket', params),
    deleteObject: (params: { region: string; profile: string; source: string; bucket: string; key: string }) =>
      ipcRenderer.invoke('s3:delete-object', params),
    uploadFile: (params: { region: string; profile: string; source: string; bucket: string; key: string; localPath: string }) =>
      ipcRenderer.invoke('s3:upload-file', params),
    downloadFile: (params: { region: string; profile: string; source: string; bucket: string; key: string; savePath: string; versionId?: string }) =>
      ipcRenderer.invoke('s3:download-file', params),
    getSignedUrl: (params: { region: string; profile: string; source: string; bucket: string; key: string; expiresIn?: number }) =>
      ipcRenderer.invoke('s3:get-signed-url', params),
    createFolder: (params: { region: string; profile: string; source: string; bucket: string; key: string }) =>
      ipcRenderer.invoke('s3:create-folder', params),
    getObjectContent: (params: { region: string; profile: string; source: string; bucket: string; key: string; versionId?: string }) =>
      ipcRenderer.invoke('s3:get-object-content', params),
    putObjectContent: (params: { region: string; profile: string; source: string; bucket: string; key: string; content: string; contentType: string }) =>
      ipcRenderer.invoke('s3:put-object-content', params),
    deleteObjects: (params: { region: string; profile: string; source: string; bucket: string; keys: string[] }) =>
      ipcRenderer.invoke('s3:delete-objects', params),
    copyObject: (params: { region: string; profile: string; source: string; sourceBucket: string; sourceKey: string; destBucket: string; destKey: string }) =>
      ipcRenderer.invoke('s3:copy-object', params),
    renameObject: (params: { region: string; profile: string; source: string; bucket: string; oldKey: string; newKey: string }) =>
      ipcRenderer.invoke('s3:rename-object', params),
    getObjectAttributes: (params: { region: string; profile: string; source: string; bucket: string; key: string }) =>
      ipcRenderer.invoke('s3:get-object-attributes', params),
    headObject: (params: { region: string; profile: string; source: string; bucket: string; key: string }) =>
      ipcRenderer.invoke('s3:head-object', params),
    listObjectVersions: (params: { region: string; profile: string; source: string; bucket: string; prefix?: string; key?: string }) =>
      ipcRenderer.invoke('s3:list-object-versions', params),
    deleteObjectVersion: (params: { region: string; profile: string; source: string; bucket: string; key: string; versionId: string }) =>
      ipcRenderer.invoke('s3:delete-object-version', params),
    onUploadProgress: (callback: (data: { key: string; loaded: number; total: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('s3:upload-progress', handler)
      return () => ipcRenderer.removeListener('s3:upload-progress', handler)
    },
    onDownloadProgress: (callback: (data: { key: string; loaded: number; total: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('s3:download-progress', handler)
      return () => ipcRenderer.removeListener('s3:download-progress', handler)
    },
  },

  // S3 Bucket 管理
  s3Bucket: {
    createBucket: (params: { region: string; profile: string; source: string; bucket: string; locationConstraint?: string; enableEncryption?: boolean }) =>
      ipcRenderer.invoke('s3:create-bucket', params),
    deleteBucket: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:delete-bucket', params),
    emptyBucket: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:empty-bucket', params),
    getBucketPolicy: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:get-bucket-policy', params),
    putBucketPolicy: (params: { region: string; profile: string; source: string; bucket: string; policy: string }) =>
      ipcRenderer.invoke('s3:put-bucket-policy', params),
    deleteBucketPolicy: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:delete-bucket-policy', params),
    getPublicAccessBlock: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:get-public-access-block', params),
    putPublicAccessBlock: (params: { region: string; profile: string; source: string; bucket: string; blockPublicAcls: boolean; ignorePublicAcls: boolean; blockPublicPolicy: boolean; restrictPublicBuckets: boolean }) =>
      ipcRenderer.invoke('s3:put-public-access-block', params),
    getBucketEncryption: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:get-bucket-encryption', params),
    putBucketEncryption: (params: { region: string; profile: string; source: string; bucket: string; sseAlgorithm: string; kmsKeyId?: string }) =>
      ipcRenderer.invoke('s3:put-bucket-encryption', params),
    getBucketVersioning: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:get-bucket-versioning', params),
    putBucketVersioning: (params: { region: string; profile: string; source: string; bucket: string; status: string }) =>
      ipcRenderer.invoke('s3:put-bucket-versioning', params),
    getBucketTagging: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:get-bucket-tagging', params),
    putBucketTagging: (params: { region: string; profile: string; source: string; bucket: string; tags: { Key: string; Value: string }[] }) =>
      ipcRenderer.invoke('s3:put-bucket-tagging', params),
    deleteBucketTagging: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:delete-bucket-tagging', params),
    getBucketLifecycle: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:get-bucket-lifecycle', params),
    putBucketLifecycle: (params: { region: string; profile: string; source: string; bucket: string; rules: any[] }) =>
      ipcRenderer.invoke('s3:put-bucket-lifecycle', params),
    getBucketWebsite: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:get-bucket-website', params),
    putBucketWebsite: (params: { region: string; profile: string; source: string; bucket: string; indexDocument?: string; errorDocument?: string; redirectHost?: string }) =>
      ipcRenderer.invoke('s3:put-bucket-website', params),
    deleteBucketWebsite: (params: { region: string; profile: string; source: string; bucket: string }) =>
      ipcRenderer.invoke('s3:delete-bucket-website', params),
  },

  // EC2 Security Groups
  ec2Sg: {
    listSecurityGroups: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('ec2:list-security-groups', params),
    createSecurityGroup: (params: { region: string; profile: string; source: string; name: string; description: string; vpcId: string }) =>
      ipcRenderer.invoke('ec2:create-security-group', params),
    deleteSecurityGroup: (params: { region: string; profile: string; source: string; groupId: string }) =>
      ipcRenderer.invoke('ec2:delete-security-group', params),
    authorizeIngress: (params: { region: string; profile: string; source: string; groupId: string; protocol: string; fromPort: number; toPort: number; cidr: string; description: string }) =>
      ipcRenderer.invoke('ec2:authorize-sg-ingress', params),
    authorizeEgress: (params: { region: string; profile: string; source: string; groupId: string; protocol: string; fromPort: number; toPort: number; cidr: string; description: string }) =>
      ipcRenderer.invoke('ec2:authorize-sg-egress', params),
    revokeIngress: (params: { region: string; profile: string; source: string; groupId: string; protocol: string; fromPort: number; toPort: number; cidr: string }) =>
      ipcRenderer.invoke('ec2:revoke-sg-ingress', params),
    revokeEgress: (params: { region: string; profile: string; source: string; groupId: string; protocol: string; fromPort: number; toPort: number; cidr: string }) =>
      ipcRenderer.invoke('ec2:revoke-sg-egress', params),
  },

  // EC2 Volumes & Snapshots
  ec2Volumes: {
    listVolumes: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('ec2:list-volumes', params),
    listInstanceVolumes: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ec2:list-instance-volumes', params),
    createVolume: (params: any) => ipcRenderer.invoke('ec2:create-volume', params),
    deleteVolume: (params: { region: string; profile: string; source: string; volumeId: string }) =>
      ipcRenderer.invoke('ec2:delete-volume', params),
    attachVolume: (params: any) => ipcRenderer.invoke('ec2:attach-volume', params),
    detachVolume: (params: { region: string; profile: string; source: string; volumeId: string }) =>
      ipcRenderer.invoke('ec2:detach-volume', params),
    listSnapshots: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('ec2:list-snapshots', params),
    createSnapshot: (params: any) => ipcRenderer.invoke('ec2:create-snapshot', params),
    deleteSnapshot: (params: { region: string; profile: string; source: string; snapshotId: string }) =>
      ipcRenderer.invoke('ec2:delete-snapshot', params),
  },

  // EC2 Addresses
  ec2Addresses: {
    listAddresses: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('ec2:list-addresses', params),
    allocateAddress: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('ec2:allocate-address', params),
    releaseAddress: (params: { region: string; profile: string; source: string; allocationId: string }) =>
      ipcRenderer.invoke('ec2:release-address', params),
    associateAddress: (params: { region: string; profile: string; source: string; allocationId: string; instanceId: string }) =>
      ipcRenderer.invoke('ec2:associate-address', params),
    disassociateAddress: (params: { region: string; profile: string; source: string; associationId: string }) =>
      ipcRenderer.invoke('ec2:disassociate-address', params),
  },

  // EC2 KeyPairs
  ec2KeyPairs: {
    listKeyPairs: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('ec2:list-key-pairs', params),
    createKeyPair: (params: { region: string; profile: string; source: string; keyName: string }) =>
      ipcRenderer.invoke('ec2:create-key-pair', params),
    deleteKeyPair: (params: { region: string; profile: string; source: string; keyName: string }) =>
      ipcRenderer.invoke('ec2:delete-key-pair', params),
    importKeyPair: (params: { region: string; profile: string; source: string; keyName: string; publicKey: string }) =>
      ipcRenderer.invoke('ec2:import-key-pair', params),
  },

  // CloudWatch
  cw: {
    getInstanceMetrics: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('cw:get-instance-metrics', params),
  },

  // EC2 Network
  ec2Network: {
    listVpcs: (params: { region: string; profile: string; source: string; forceRefresh?: boolean }) =>
      ipcRenderer.invoke('ec2:list-vpcs', params),
    listSubnets: (params: { region: string; profile: string; source: string; forceRefresh?: boolean }) =>
      ipcRenderer.invoke('ec2:list-subnets', params),
    listRouteTables: (params: { region: string; profile: string; source: string; forceRefresh?: boolean }) =>
      ipcRenderer.invoke('ec2:list-route-tables', params),
    listInternetGateways: (params: { region: string; profile: string; source: string; forceRefresh?: boolean }) =>
      ipcRenderer.invoke('ec2:list-internet-gateways', params),
    listNatGateways: (params: { region: string; profile: string; source: string; forceRefresh?: boolean }) =>
      ipcRenderer.invoke('ec2:list-nat-gateways', params),
  },

  // EC2 AMIs
  ec2Amis: {
    listImages: (params: { region: string; profile: string; source: string; forceRefresh?: boolean }) =>
      ipcRenderer.invoke('ec2:list-images', params),
    deregisterImage: (params: { region: string; profile: string; source: string; imageId: string }) =>
      ipcRenderer.invoke('ec2:deregister-image', params),
    copyImage: (params: { region: string; profile: string; source: string; imageId: string; name: string; destRegion: string }) =>
      ipcRenderer.invoke('ec2:copy-image', params),
  },

  // ECS
  ecs: {
    listClusters: (params: { region: string; profile: string; source: string }) =>
      ipcRenderer.invoke('ecs:list-clusters', params),
    listServices: (params: { region: string; profile: string; source: string; cluster: string }) =>
      ipcRenderer.invoke('ecs:list-services', params),
    listTasks: (params: { region: string; profile: string; source: string; cluster: string }) =>
      ipcRenderer.invoke('ecs:list-tasks', params),
    describeTask: (params: { region: string; profile: string; source: string; cluster: string; taskId: string }) =>
      ipcRenderer.invoke('ecs:describe-task', params),
    describeTaskDefinition: (params: { region: string; profile: string; source: string; taskDefArn: string }) =>
      ipcRenderer.invoke('ecs:describe-task-definition', params),
  },

  // SSM
  ssm: {
    startSession: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ssm:start-session', params),
    sendData: (data: string) => ipcRenderer.send('ssm:send-data', data),
    resize: (params: { cols: number; rows: number }) => ipcRenderer.send('ssm:resize', params),
    closeSession: () => ipcRenderer.send('ssm:close-session'),
    onOutput: (callback: (data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data)
      ipcRenderer.on('ssm:output', handler)
      return () => ipcRenderer.removeListener('ssm:output', handler)
    },
    onSessionEnd: (callback: () => void) => {
      ipcRenderer.on('ssm:session-ended', callback)
      return () => ipcRenderer.removeListener('ssm:session-ended', callback)
    },
    onSessionError: (callback: (error: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('ssm:error', handler)
      return () => ipcRenderer.removeListener('ssm:error', handler)
    },
    onPortForwardStatus: (callback: (status: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: string) => callback(status)
      ipcRenderer.on('ssm:port-forward-status', handler)
      return () => ipcRenderer.removeListener('ssm:port-forward-status', handler)
    },
    startPortForwarding: (params: { region: string; profile: string; source: string; instanceId: string; remotePort: number; localPort: number }) =>
      ipcRenderer.invoke('ssm:start-port-forwarding', params),
    stopPortForwarding: () => ipcRenderer.send('ssm:stop-port-forwarding'),
    checkManaged: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ssm:check-managed', params),
    sendCommand: (params: any) => ipcRenderer.invoke('ssm:send-command', params),
    getInvocation: (params: { region: string; profile: string; source: string; commandId: string; instanceId: string }) =>
      ipcRenderer.invoke('ssm:get-invocation', params),
    listCommands: (params: { region: string; profile: string; source: string; instanceId: string }) =>
      ipcRenderer.invoke('ssm:list-commands', params),
  },

  // Profiles + Credentials
  profiles: {
    listAll: () => ipcRenderer.invoke('profiles:list-all'),
    verify: (params: { id: string; source: string; provider?: string }) => ipcRenderer.invoke('profiles:verify', params),
  },

  credentials: {
    list: () => ipcRenderer.invoke('credentials:list'),
    add: (data: { name: string; accessKeyId: string; secretAccessKey: string; region: string; description: string }) =>
      ipcRenderer.invoke('credentials:add', data),
    update: (params: { id: string; data: { name?: string; accessKeyId?: string; secretAccessKey?: string; region?: string; description?: string; provider?: string; extraFields?: Record<string, string> } }) =>
      ipcRenderer.invoke('credentials:update', params),
    delete: (id: string) => ipcRenderer.invoke('credentials:delete', id),
  },

  // App
  app: {
    getStore: (key: string) => ipcRenderer.invoke('app:get-store', key),
    setStore: (key: string, value: unknown) => ipcRenderer.invoke('app:set-store', key, value),
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('app:download-update'),
    quitAndInstall: () => ipcRenderer.invoke('app:quit-and-install'),
    onUpdateStatus: (callback: (payload: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
      ipcRenderer.on('app:update-status', handler)
      return () => ipcRenderer.removeListener('app:update-status', handler)
    },
    openFileDialog: (options: { filters?: { name: string; extensions: string[] }[]; multiSelections?: boolean }) =>
      ipcRenderer.invoke('app:open-file-dialog', options),
    saveFileDialog: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('app:save-file-dialog', options),
    saveFile: (params: { content: string; defaultName: string }) =>
      ipcRenderer.invoke('app:save-file', params),
    openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  },

  // 通用云 API
  cloud: {
    invoke: (params: { provider: string; credentialId: string; region: string; service: string; action: string; payload: Record<string, unknown> }) =>
      ipcRenderer.invoke('cloud:invoke', params),
    onObsDownloadProgress: (callback: (data: { key: string; loaded: number; total: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data as { key: string; loaded: number; total: number })
      ipcRenderer.on('obs:download-progress', handler)
      return () => ipcRenderer.removeListener('obs:download-progress', handler)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
