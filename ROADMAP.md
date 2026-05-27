# AWS Ops Manager - S3 + EC2 完整功能开发路线图

> 基于 AWS S3 (215+ API) 和 EC2 (400+ API) 官方文档调研，筛选出桌面运维工具真正需要的高频操作。
> 
> ✅ = 已完成　　📋 = 待实现

### 完成进度总览

| 模块 | 规划功能数 | 已完成 | 完成率 |
|------|:---:|:---:|:---:|
| S3 存储桶管理 | 10 | 10 | 100% |
| S3 对象操作 | 12 | 10 | 83% |
| EC2 实例管理 | 14 | 12 | 86% |
| EBS 卷管理 | 6 | 6 | 100% |
| 快照管理 | 5 | 3 | 60% |
| 安全组管理 | 7 | 7 | 100% |
| 弹性 IP | 5 | 5 | 100% |
| 密钥对 | 4 | 4 | 100% |
| AMI 管理 | 4 | 3 | 75% |
| CloudWatch 监控 | 1 | 1 | 100% |
| 网络总览 | 7 | 5 | 71% |
| **合计** | **75** | **66** | **88%** |

---

## 总体架构：前后端对应表

每个功能模块严格遵循三层对应：

```
前端页面 (Renderer)  →  IPC Handler (Main)  →  AWS Service (Main)  →  AWS SDK API
     ↓                       ↓                       ↓
  路由 + 组件           ipcMain.handle()       *.service.ts         @aws-sdk/client-*
```

所有 API 调用必须携带 `{ region, profile, source }` 三元组以支持多凭证切换。

---

## 一、S3 存储桶管理

### 1.1 存储桶列表页（完善现有 `S3Page.tsx`）

| AWS API | 用途 | 后端文件 | IPC Channel | 前端组件 |
|---------|------|---------|-------------|---------|
| `ListBuckets` | 列出所有桶 | `s3.service.ts` | `s3:list-buckets` ✓已实现 | `S3Page.tsx` |
| `GetBucketLocation` | 解析每个桶的 region | `s3.service.ts` | （内嵌在 list-buckets 中）✓已实现 | Region 列 |

**前端状态矩阵：**

| 状态 | UI 表现 |
|------|---------|
| 加载中 | Table skeleton + Spin |
| 空 | Empty: "当前账号没有 S3 存储桶" |
| 错误 | Alert + 错误详情 + 重试按钮 |
| 正常 | Table(名称/Region/创建时间/操作) |
| 权限不足 | 特定提示："缺少 s3:ListAllMyBuckets 权限" |

### 1.2 存储桶详情页 `BucketDetail.tsx`（新增）

点击桶名称进入详情页，Tab 切换以下面板：

| Tab | 包含功能 | AWS API | IPC Channel | 优先级 |
|-----|---------|---------|-------------|:---:|
| **概览** | Region、创建时间、ARN | `HeadBucket` = 已实现 | `s3:head-bucket` | P0 |
| **权限** | 桶策略 JSON 查看/编辑/删除 | `GetBucketPolicy` `PutBucketPolicy` `DeleteBucketPolicy` | `s3:get-bucket-policy` `s3:put-bucket-policy` `s3:delete-bucket-policy` | P0 |
| **公共访问** | Block Public Access 四个开关查看/编辑 | `GetPublicAccessBlock` `PutPublicAccessBlock` | `s3:get-public-access-block` `s3:put-public-access-block` | P0 |
| **加密** | 默认加密配置查看/编辑 | `GetBucketEncryption` `PutBucketEncryption` | `s3:get-bucket-encryption` `s3:put-bucket-encryption` | P0 |
| **版本控制** | 版本控制状态查看/编辑 | `GetBucketVersioning` `PutBucketVersioning` | `s3:get-bucket-versioning` `s3:put-bucket-versioning` | P1 |
| **标签** | Key-Value 标签表格，增删改 | `GetBucketTagging` `PutBucketTagging` `DeleteBucketTagging` | `s3:get-bucket-tagging` `s3:put-bucket-tagging` `s3:delete-bucket-tagging` | P1 |
| **生命周期** | 生命周期规则列表查看/编辑 | `GetBucketLifecycleConfiguration` `PutBucketLifecycleConfiguration` | `s3:get-bucket-lifecycle` `s3:put-bucket-lifecycle` | P1 |
| **静态网站** | 托管配置查看/编辑 | `GetBucketWebsite` `PutBucketWebsite` | `s3:get-bucket-website` `s3:put-bucket-website` | P2 |

### 1.3 存储桶操作（右键菜单/工具栏）

| 操作 | AWS API | 确认方式 | IPC Channel |
|------|---------|---------|-------------|
| 创建存储桶 | `CreateBucket` | Modal 表单(名称+区域+加密+锁) | `s3:create-bucket` |
| 删除存储桶 | `DeleteBucket` | Popconfirm "桶 xx 为空才可删除" | `s3:delete-bucket` |
| 清空存储桶 | `DeleteObjects`(批量) | 双重确认 "永久删除所有对象" | `s3:empty-bucket` |

---

## 二、S3 对象浏览与管理

### 2.1 对象列表（完善现有 `S3ObjectBrowser.tsx`）

| AWS API | 用途 | IPC Channel | 状态 |
|---------|------|-------------|:---:|
| `ListObjectsV2` | 分页列出对象（支持 Delimiter='/' 目录模拟） | `s3:list-objects` | ✓已实现 |
| `HeadObject` | 获取单个对象元数据 | `s3:head-object` | P1 |
| `GetObjectAttributes` | 获取对象完整属性（校验和/存储类/大小/ETag/部件数） | `s3:get-object-attributes` | P1 |

**前端列：**
名称(图标+链接) | 大小 | 存储类型 | 最后修改 | 操作(预览/下载/删除/复制/重命名/属性)

### 2.2 对象操作（工具栏 + 行内按钮）

| 操作 | AWS API | 说明 | IPC Channel | 状态 |
|------|---------|------|-------------|:---:|
| 上传文件 | `PutObject` (流式) | 支持拖拽/多选/进度条 | `s3:upload-file` | ✓已实现 |
| 上传文件夹 | `PutObject` (逐文件) | 递归上传本地文件夹 | `s3:upload-folder` | P1 |
| 下载 | `GetObject` (流式) | 另存为对话框 | `s3:download-file` | ✓已实现 |
| 删除 | `DeleteObject` | 单个确认 | `s3:delete-object` | ✓已实现 |
| 批量删除 | `DeleteObjects` | 最多 1000 个，进度提示 | `s3:delete-objects` | P0 |
| 复制/移动 | `CopyObject` | 同桶/跨桶复制，可选目标路径 | `s3:copy-object` | P0 |
| 重命名 | `CopyObject` + `DeleteObject` | 本质是复制+删除原对象 | `s3:rename-object` | P0 |
| **预览** | `GetObject` → 临时文件 | 文本(编辑)/图片(查看)/二进制(提示) | `s3:get-object-content` | ✓已实现 |
| **编辑并保存** | `GetObject` → 编辑 → `PutObject` | 仅文本文件 | `s3:put-object-content` | ✓已实现 |
| 属性面板 | `HeadObject` | 元数据/标签/权限/存储类/加密 | `s3:get-object-attributes` | P1 |
| 预签名 URL | `GetObject` 预签名 | 生成临时下载链接(可设过期时间) | `s3:get-signed-url` | ✓已实现 |
| 恢复归档 | `RestoreObject` | 从 Glacier/Deep Archive 恢复 | `s3:restore-object` | P2 |
| 修改存储类 | `CopyObject` (同 key,不同 StorageClass) | STANDARD→IA→Glacier | `s3:change-storage-class` | P2 |
| 对象标签 | `GetObjectTagging` `PutObjectTagging` | Key-Value 编辑 | `s3:get-object-tagging` `s3:put-object-tagging` | P2 |

### 2.3 对象预览与编辑（完善现有 `FilePreviewModal.tsx`）

| 文件类型 | 预览方式 | 编辑 | 大小限制 |
|---------|---------|:---:|------|
| `text/*` `application/json` `application/xml` `text/yaml` | Monaco/monospace pre，语法高亮 | ✓ | 5MB |
| `image/png` `image/jpeg` `image/gif` `image/webp` `image/svg` | `<img>` 渲染（临时文件路径），缩放+旋转 | ✗ | 20MB |
| `application/pdf` | 内嵌 `<iframe>` 或外部打开 | ✗ | 50MB |
| 其他二进制 | 类型图标 + 大小 + 下载按钮 | ✗ | - |

### 2.4 版本管理面板（P2）

| 操作 | AWS API |
|------|--------|
| 列出所有版本 | `ListObjectVersions` |
| 查看特定版本 | `GetObject` + `VersionId` |
| 删除特定版本 | `DeleteObject` + `VersionId` |
| 永久删除所有版本 | `DeleteObjects` + 所有 VersionId |

### 2.5 分片上传管理（P2）

| 操作 | AWS API |
|------|--------|
| 查看进行中的分片上传 | `ListMultipartUploads` |
| 查看已上传分片 | `ListParts` |
| 取消分片上传 | `AbortMultipartUpload` |
| 大文件自动分片上传 | `CreateMultipartUpload` → `UploadPart` × N → `CompleteMultipartUpload` （SDK lib-storage 自动处理） |

---

## 三、EC2 实例管理

### 3.1 实例列表页（完善现有 `EC2Page.tsx`）

| AWS API | 用途 | IPC Channel | 状态 |
|---------|------|-------------|:---:|
| `DescribeInstances` | 列出所有实例（分页） | `ec2:list-instances` | ✓已实现 |
| `DescribeInstanceStatus` | 获取实例健康状态(系统/实例检查) | `ec2:get-instance-status` | P1 |

**前端列：**
☐ | 实例ID/名称 | 状态(彩色Badge+图标) | 类型 | 平台(OS图标) | 公有IP | 私有IP | 可用区 | 安全组 | 启动时间 | 操作

**操作按钮（行内）：**
- 连接：SSM 终端 → `/terminal/ssm/:id` ✓已实现
- 连接：RDP 客户端打开 (Windows)
- 连接：EC2 Instance Connect
- 启动/停止/重启 ✓已实现
- 终止（危险操作，双重确认 + 输入实例ID确认）
- 获取 Windows 密码 (`GetPasswordData`)

### 3.2 实例详情页（完善现有 `EC2InstanceDetail.tsx`）

| Tab | 子功能 | AWS API | IPC Channel | 优先级 |
|-----|--------|---------|-------------|:---:|
| **概览** | 全部基础属性(类型/状态/平台/IP/AZ/VPC/子网/启动时间/AMI) | `DescribeInstances` ✓ | `ec2:describe-instance` | P0 |
| **监控** | CloudWatch 指标图表(CPU/网络/磁盘/状态检查) | CloudWatch `GetMetricData` | `cw:get-metric-data` | P0 |
| **安全组** | 关联的安全组列表，入站/出站规则表格，增删规则 | `DescribeSecurityGroups` `DescribeSecurityGroupRules` `Authorize/RevokeSecurityGroupIngress/Egress` | `ec2:describe-security-groups` `ec2:authorize-sg-*` | P0 |
| **存储** | 挂载的卷列表(设备名/大小/类型/IOPS/状态) + 挂载/卸载/创建快照 | `DescribeVolumes` `AttachVolume` `DetachVolume` `CreateSnapshot` | `ec2:describe-volumes` `ec2:attach-volume` `ec2:create-snapshot` | P0 |
| **网络** | ENI 列表(IP/子网/公有IP/弹性IP关联) + 关联/解绑 EIP | `DescribeNetworkInterfaces` `AssociateAddress` `DisassociateAddress` | `ec2:describe-network-interfaces` `ec2:associate-address` | P0 |
| **标签** | Key-Value 表格 + 增删改 | `CreateTags` `DeleteTags` `DescribeTags` | `ec2:*-tags` | P1 |
| **控制台输出** | 最后 64KB 控制台日志（纯文本） | `GetConsoleOutput` | `ec2:get-console-output` | P1 |
| **启动模板** | 当前使用的启动模板版本和数据 | `GetLaunchTemplateData` | `ec2:get-launch-template-data` | P1 |
| **维护与事件** | 实例状态检查详情、计划维护事件 | `DescribeInstanceStatus` | `ec2:get-instance-status` | P1 |
| **IAM 角色** | 关联/解绑/替换 IAM 实例角色 | `DescribeIamInstanceProfileAssociations` `Associate/DisassociateIamInstanceProfile` | `ec2:*-iam-instance-profile` | P1 |
| **元数据选项** | IMDS 版本(v1/v2)/跳数限制查看和修改 | `DescribeInstanceMetadataOptions` `ModifyInstanceMetadataOptions` | `ec2:get-metadata-options` `ec2:modify-metadata-options` | P2 |
| **属性修改** | 修改实例类型/终止保护/源目标检查/用户数据 | `ModifyInstanceAttribute` | `ec2:modify-instance-attribute` | P2 |

### 3.3 实例批量操作（工具栏）

| 操作 | 选中多个实例 | AWS API |
|------|:---:|---------|
| 批量启动 | ✓ | `StartInstances` |
| 批量停止 | ✓ | `StopInstances` |
| 批量重启 | ✓ | `RebootInstances` |
| 批量终止 | ✓（危险确认） | `TerminateInstances` |
| 批量打标签 | ✓ | `CreateTags` |

---

## 四、EBS 卷管理

### 4.1 卷列表页 `VolumesPage.tsx`（新增）

| AWS API | 用途 | IPC Channel |
|---------|------|-------------|
| `DescribeVolumes` | 列出所有卷 | `ec2:list-volumes` |
| `CreateVolume` | 创建新卷(大小/类型/IOPS/AZ/快照) | `ec2:create-volume` |
| `DeleteVolume` | 删除未挂载的卷 | `ec2:delete-volume` |
| `AttachVolume` | 挂载到实例 | `ec2:attach-volume` |
| `DetachVolume` | 从实例卸载 | `ec2:detach-volume` |
| `ModifyVolume` | 修改大小/类型/IOPS | `ec2:modify-volume` |

### 4.2 快照管理（卷列表内联面板）

| AWS API | 用途 |
|---------|------|
| `DescribeSnapshots` | 列出快照（可按卷ID过滤） |
| `CreateSnapshot` | 为卷创建快照 |
| `DeleteSnapshot` | 删除快照 |
| `CopySnapshot` | 跨区域复制 |
| `ModifySnapshotAttribute` | 共享权限管理 |

---

## 五、安全组管理

### 5.1 安全组列表页 `SecurityGroupsPage.tsx`（新增）

| AWS API | 用途 | IPC Channel |
|---------|------|-------------|
| `DescribeSecurityGroups` | 列出安全组(名称/ID/VPC/描述/规则摘要) | `ec2:list-security-groups` |
| `DescribeSecurityGroupRules` | 获取规则详情(协议/端口/来源/描述) | `ec2:get-security-group-rules` |
| `CreateSecurityGroup` | 创建安全组 | `ec2:create-security-group` |
| `DeleteSecurityGroup` | 删除安全组 | `ec2:delete-security-group` |

### 5.2 规则编辑器（安全组详情面板）

| 操作 | AWS API |
|------|--------|
| 添加入站规则 | `AuthorizeSecurityGroupIngress` |
| 添加出站规则 | `AuthorizeSecurityGroupEgress` |
| 删除规则 | `RevokeSecurityGroupIngress/Egress` |
| 修改规则描述 | `UpdateSecurityGroupRuleDescriptionsIngress/Egress` |

**规则编辑表单：**
类型(SSH/HTTP/HTTPS/Custom) | 协议(TCP/UDP/ICMP/ALL) | 端口范围 | 来源(Any/MyIP/CIDR/安全组ID) | 描述

---

## 六、弹性 IP 管理

### 6.1 弹性 IP 列表 `ElasticIPsPage.tsx`（新增）

| AWS API | 用途 | IPC Channel |
|---------|------|-------------|
| `DescribeAddresses` | 列出所有 EIP(公有IP/分配ID/关联实例/域名) | `ec2:list-addresses` |
| `AllocateAddress` | 分配新 EIP | `ec2:allocate-address` |
| `ReleaseAddress` | 释放未使用的 EIP | `ec2:release-address` |
| `AssociateAddress` | 关联到实例/ENI | `ec2:associate-address` |
| `DisassociateAddress` | 解除关联 | `ec2:disassociate-address` |

---

## 七、AMI 管理

### 7.1 AMI 列表页 `AMIPage.tsx`（新增）

| AWS API | 用途 | IPC Channel |
|---------|------|-------------|
| `DescribeImages` | 列出 AMI(自有/公共/共享)，支持过滤(平台/架构/名称) | `ec2:list-images` |
| `CreateImage` | 从实例创建 AMI(可选 NoReboot) | `ec2:create-image` |
| `DeregisterImage` | 注销 AMI | `ec2:deregister-image` |
| `CopyImage` | 跨区域复制 AMI | `ec2:copy-image` |

---

## 八、密钥对管理

### 8.1 密钥对列表 `KeyPairsPage.tsx`（新增）

| AWS API | 用途 | IPC Channel |
|---------|------|-------------|
| `DescribeKeyPairs` | 列出密钥对(名称/指纹/类型/创建时间) | `ec2:list-key-pairs` |
| `CreateKeyPair` | 创建新密钥对(下载私钥 PEM) | `ec2:create-key-pair` |
| `DeleteKeyPair` | 删除密钥对 | `ec2:delete-key-pair` |
| `ImportKeyPair` | 导入公钥 | `ec2:import-key-pair` |

---

## 九、网络拓扑浏览

### 9.1 网络资源总览（P1）

| 资源类型 | Discover API |
|---------|-------------|
| VPC 列表 | `DescribeVpcs` |
| 子网列表 | `DescribeSubnets` |
| 路由表 | `DescribeRouteTables` |
| Internet 网关 | `DescribeInternetGateways` |
| NAT 网关 | `DescribeNatGateways` |
| 网络 ACL | `DescribeNetworkAcls` |
| VPC 端点 | `DescribeVpcEndpoints` |
| VPC 对等连接 | `DescribeVpcPeeringConnections` |

这些可以整合到一个统一的"网络"页面，以 VPC 为分组维度展示。

---

## 十、分阶段实施计划

### Phase 0：基础设施巩固（当前已完成）

- [x] Client Factory 多凭证切换
- [x] 凭证加密存储
- [x] IPC 通道基础
- [x] 错误处理框架

### Phase 1：S3 完整功能（~5天）

| 子任务 | 新增 IPC | 新增前端组件 |
|--------|---------|-------------|
| 1.1 桶详情页（7个Tab） | `get-bucket-policy` `put-bucket-policy` `delete-bucket-policy` `get-public-access-block` `put-public-access-block` `get-bucket-encryption` `put-bucket-encryption` `get-bucket-versioning` `put-bucket-versioning` `get-bucket-tagging` `put-bucket-tagging` `delete-bucket-tagging` `get-bucket-lifecycle` `put-bucket-lifecycle` `get-bucket-website` `put-bucket-website` `create-bucket` `delete-bucket` | `BucketDetail.tsx` (Tabs: 权限/公共访问/加密/版本/标签/生命周期/网站) |
| 1.2 对象批量操作 | `delete-objects` `copy-object` `rename-object` | 对象表格增加多选 + 工具栏 |
| 1.3 对象属性面板 | `head-object` `get-object-attributes` | `ObjectPropertiesDrawer.tsx` (元数据/存储类/加密/标签) |
| 1.4 大文件分片上传 | `create-multipart-upload` `upload-part` `complete-multipart-upload` `abort-multipart-upload` | 上传对话框 + 进度条（SDK 自动处理分片） |
| 1.5 版本管理 | `list-object-versions` `delete-object-version` | `VersionPanel.tsx` (版本历史表格) |

### Phase 2：EC2 完整功能（~7天）

| 子任务 | 新增 IPC | 新增前端组件 |
|--------|---------|-------------|
| 2.1 实例详情增强（10个Tab） | 见 3.2 节 IPC 列表 | `EC2InstanceDetail.tsx` 重构为 Tabs |
| 2.2 安全组规则编辑器 | `authorize-sg-ingress` `authorize-sg-egress` `revoke-sg-*` `create-security-group` `delete-security-group` | `SecurityGroupsPage.tsx` + `RuleEditor.tsx` (表单:类型/协议/端口/来源/描述) |
| 2.3 EBS 卷管理 | `list-volumes` `create-volume` `delete-volume` `attach-volume` `detach-volume` `modify-volume` `list-snapshots` `create-snapshot` `delete-snapshot` | `VolumesPage.tsx` + `VolumeDetailDrawer.tsx` |
| 2.4 弹性 IP 管理 | `list-addresses` `allocate-address` `release-address` `associate-address` `disassociate-address` | `ElasticIPsPage.tsx` |
| 2.5 AMI 管理 | `list-images` `create-image` `deregister-image` `copy-image` | `AMIPage.tsx` |
| 2.6 密钥对管理 | `list-key-pairs` `create-key-pair` `delete-key-pair` `import-key-pair` | `KeyPairsPage.tsx` |
| 2.7 CloudWatch 监控图表 | `cw:get-metric-data` (CPU/网络/磁盘/状态) | `EC2MetricsTab.tsx` (用 recharts 绘制时间序列图) |

### Phase 3：网络管理（~3天）

| 子任务 | 新增 IPC | 新增前端组件 |
|--------|---------|-------------|
| 3.1 VPC/子网/路由/网关总览 | `list-vpcs` `list-subnets` `list-route-tables` `list-internet-gateways` `list-nat-gateways` `list-network-acls` `list-vpc-endpoints` | `NetworkPage.tsx` (VPC 为分组维度的树形视图) |
| 3.2 流日志 | `list-flow-logs` `create-flow-logs` `delete-flow-logs` | `FlowLogsPanel.tsx` |

### Phase 4：高级功能 + 打磨（~3天）

| 子任务 | 说明 |
|--------|------|
| 4.1 全局搜索 | 跨所有服务的资源搜索（实例ID/桶名/EIP/安全组名/AMI ID） |
| 4.2 操作历史 | 记录用户的操作(启动/停止/删除)，本地存储 |
| 4.3 快捷操作栏 | Favorites 功能：收藏常用实例/桶，Dashboard 一键直达 |
| 4.4 S3 归档恢复 | `RestoreObject` (Glacier→Standard, 可选天数) |
| 4.5 预签名 URL 管理 | 可设定过期时间的下载链接生成器 |

---

## 十一、新增文件清单（预计 ~25 个新文件）

```
src/main/ipc/
  ├── s3-bucket.ipc.ts          # 桶管理 IPC (策略/加密/版本/标签/生命周期/网站)
  ├── s3-objects.ipc.ts         # 对象操作 IPC (批量删除/复制/重命名/属性)
  ├── ec2-volumes.ipc.ts        # EBS 卷 IPC
  ├── ec2-security-groups.ipc.ts # 安全组 IPC
  ├── ec2-addresses.ipc.ts      # 弹性 IP IPC
  ├── ec2-amis.ipc.ts           # AMI IPC
  ├── ec2-keypairs.ipc.ts       # 密钥对 IPC
  ├── ec2-network.ipc.ts        # VPC/子网/路由/网关 IPC
  └── cloudwatch.ipc.ts         # CloudWatch 指标 IPC

src/main/aws/
  ├── cloudwatch.service.ts     # CloudWatch GetMetricData

src/renderer/src/routes/
  ├── S3/
  │   └── BucketDetail.tsx      # 桶详情页(7 Tab)
  ├── EC2/
  │   ├── EC2MetricsTab.tsx     # 监控图表
  │   └── SecurityGroupRules.tsx # 安全组规则编辑器
  ├── Volumes/
  │   └── VolumesPage.tsx       # EBS 卷管理
  ├── ElasticIPs/
  │   └── ElasticIPsPage.tsx    # 弹性 IP 管理
  ├── AMI/
  │   └── AMIPage.tsx           # AMI 管理
  ├── KeyPairs/
  │   └── KeyPairsPage.tsx      # 密钥对管理
  ├── Network/
  │   └── NetworkPage.tsx       # VPC 网络总览
  └── SecurityGroups/
      └── SecurityGroupsPage.tsx # 安全组管理

src/renderer/src/components/
  ├── ObjectPropertiesDrawer.tsx # S3 对象属性抽屉
  ├── VersionPanel.tsx           # S3 版本管理面板
  ├── RuleEditor.tsx             # 安全组规则编辑表单
  └── MonitorChart.tsx           # CloudWatch 时序图表
```

---

## 十二、IPC Channel 完整清单（新增 ~60 个）

详见各模块表格。命名规范：`{service}:{action}-{resource}` 格式，如 `s3:get-bucket-policy`, `ec2:authorize-sg-ingress`。

---

## 十三、状态管理扩展

新增 Zustand Store：

| Store | 管理状态 |
|-------|---------|
| `volumeStore.ts` | EBS 卷列表 + 过滤 + 选中 |
| `securityGroupStore.ts` | 安全组列表 + 规则缓存 |
| `addressStore.ts` | 弹性 IP 列表 |
| `amiStore.ts` | AMI 列表 + 过滤(平台/架构) |
| `networkStore.ts` | VPC/子网/路由表/网关 树形数据 |
| `bucketDetailStore.ts` | 桶详情各 Tab 数据缓存 |
