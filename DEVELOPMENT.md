# Cloud Ops Manager — 开发文档

## 项目概述

多云运维管理桌面工具（窗口标题 **Cloud Ops Manager**），对标阿里云客户端。当前支持 **AWS** 与 **华为云**，提供 EC2/S3/SSM、ECS/OBS/RDS 等可视化运维。

- 仓库名：`aws-ops-manager`（历史命名）
- `package.json` description：多云 AKSK 运维管理桌面客户端

## 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 桌面框架 | Electron | 31.x |
| 构建工具 | electron-vite | 2.x |
| 前端框架 | React | 18.x |
| UI 组件库 | Ant Design | 5.x |
| 终端模拟 | xterm.js | 5.x |
| 状态管理 | Zustand | 4.x |
| AWS SDK | @aws-sdk/client-* | 3.x |
| 华为云 SDK | @huaweicloud/huaweicloud-sdk-* | 3.1.x |
| OBS | esdk-obs-nodejs | 3.x |
| SSH（华为） | ssh2 | 1.x |
| 打包分发 | electron-builder | 24.x |
| 凭证持久化 | AES-256-GCM 文件（`credential-store.ts`） | — |
| 配置持久化 | electron-store | 8.x |

---

## 项目结构

```
aws-ops-manager/
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── resources/                      # 平台图标
│
├── src/
│   ├── main/
│   │   ├── index.ts                # 入口 + ProviderRegistry 注册
│   │   │
│   │   ├── ipc/                    # 17 模块，~102 个 AWS IPC handler
│   │   │   ├── index.ts
│   │   │   ├── cloud-router.ts     # cloud:invoke 多云路由
│   │   │   ├── profiles.ipc.ts     # 凭证 list/verify/CRUD
│   │   │   ├── ec2*.ipc.ts         # EC2/EBS/网络/AMI/安全组/EIP/密钥对
│   │   │   ├── s3*.ipc.ts          # S3 对象 + 桶管理
│   │   │   ├── ecs.ipc.ts          # ECS 集群/服务/任务
│   │   │   ├── ssm*.ipc.ts         # SSM 终端 + Run Command
│   │   │   ├── cloudwatch.ipc.ts
│   │   │   └── app.ipc.ts
│   │   │
│   │   ├── aws/                    # AWS SDK 封装
│   │   │   ├── client.factory.ts
│   │   │   ├── ec2.service.ts      # 含 terminateInstance
│   │   │   ├── s3.service.ts
│   │   │   ├── ecs.service.ts
│   │   │   ├── ssm.service.ts
│   │   │   └── cloudwatch.service.ts
│   │   │
│   │   ├── providers/              # 多云 Provider 抽象
│   │   │   ├── registry.ts
│   │   │   ├── types.ts
│   │   │   ├── aws.ts              # 元数据 + verify；executeOperation 拒绝走 cloud 路由
│   │   │   ├── huawei.ts           # executeOperation 分发 ~99 actions
│   │   │   ├── huawei-client.ts
│   │   │   ├── huawei-region.ts
│   │   │   └── huawei-services/    # ecs, obs, evs, vpc, rds, eip, ims, coc, ssh-exec, iam
│   │   │
│   │   ├── terminal/               # SSM WebSocket
│   │   └── store/
│   │       ├── credential-store.ts # AES-256-GCM，provider 字段
│   │       └── api-cache.ts
│   │
│   ├── preload/
│   │   └── index.ts                # electronAPI + cloud.invoke + huawei.* 快捷封装
│   │
│   └── renderer/src/
│       ├── App.tsx                 # HashRouter + 主题/i18n
│       ├── stores/
│       │   ├── providerStore.ts    # 当前云厂商 aws | huawei
│       │   ├── profileStore.ts
│       │   └── regionStore.ts
│       ├── providers/              # 前端 Provider 元数据（菜单/Region）
│       │   ├── aws.ts
│       │   └── huawei.ts
│       ├── components/Layout/
│       │   ├── ProviderSwitcher.tsx
│       │   ├── CommandPalette.tsx  # 随 provider 切换搜索范围
│       │   ├── Sidebar.tsx         # 动态菜单
│       │   └── Header.tsx
│       └── routes/                 # 34 个页面组件
│           ├── Dashboard.tsx
│           ├── EC2/ …
│           ├── S3/ …               # S3Page 含创建/清空/删除桶
│           ├── ECS/
│           │   ├── ECSPage.tsx
│           │   └── ECSClusterDetail.tsx
│           ├── Volumes/ … Network/ … Terminal/ … Settings/
│           └── huawei/
│               ├── ECS/ …
│               ├── OBS/ …
│               ├── RDS/ …
│               ├── EIP/HuaweiEIPPage.tsx
│               └── EVS/ VPC/ IMS/
│
└── out/                            # npm run build
└── dist/                           # electron-builder 产物
```

---

## 开发命令

```bash
npm install
npm run dev           # 开发 + HMR
npm run build         # 编译 → out/
npm run preview       # 预览生产构建
npm run package:mac   # macOS DMG + ZIP
npm run package:win
npm run package:linux
npm run package:all
```

### 代理下载 Electron（可选）

```bash
export https_proxy=http://127.0.0.1:8234
export http_proxy=http://127.0.0.1:8234
npm run package:mac
```

---

## 核心架构

### 双轨调用模型

```
┌─ 渲染进程 ─────────────────────────────────────────────┐
│  providerStore.currentProvider                         │
│    aws   → window.electronAPI.ec2 / s3 / ecs / …       │
│    huawei → window.electronAPI.cloud.invoke({...})     │
└──────────────────── contextBridge ─────────────────────┘
                          │
┌─ 主进程 ───────────────────────────────────────────────┐
│  AWS: ipcMain.handle('ec2:…') → aws/*.service.ts       │
│  多云: cloud:invoke → ProviderRegistry → HuaweiProvider│
│  凭证: credential-store（解密 SK）                      │
│  SSM:  WebSocket 终端引擎 + 端口转发                    │
└────────────────────────────────────────────────────────┘
```

### 安全模型

- `contextIsolation: true`，`nodeIntegration: false`
- 凭证 AES-256-GCM 加密（scrypt 派生密钥，绑定本机用户）
- 凭证文件权限 `0o600`；SK 仅在主进程内存中解密使用
- 无硬编码 AK/SK

### 凭证流程（当前实现）

```
设置页 CredentialManager
  → credentials:add/update（含 provider: 'aws' | 'huawei'）
  → credential-store 加密写入 userData/credentials.json

profiles:list-all
  → 仅返回 credential-store 中的凭证（非 ~/.aws 文件）

profiles:verify
  → aws: STS GetCallerIdentity
  → huawei: IAM verify + 项目列表

useProfiles.verify / 区域扫描
  → 固定 source: 'custom'
```

> **注意：** `client.factory.ts` 仍保留 `fromIni`（`aws-config`）分支，供 IPC handler 兼容；当前 UI 路径统一使用 `custom` 凭证。

### 多云元数据（阶段 C）

菜单与 Region 定义集中在 **`src/shared/providers/`**（`aws.manifest.ts` / `huawei.manifest.ts`）。主进程 `main/providers/*` 与渲染进程 `renderer/providers/*` 均从此读取，避免双份维护。

华为云页面统一通过 **`useCloudOperation()`**（React）或 **`cloudInvoke()`**（非 React）调用 `electronAPI.cloud.invoke`；OBS 下载进度走 `electronAPI.cloud.onObsDownloadProgress`。

### AWS Client Factory

```
setProfile(profile, source)
  → source === 'custom' → credential-store 解密
  → source === 'aws-config' → fromIni（UI 未使用）
getClient(ServiceClass, { region })
  → 缓存 key: profile:region:ServiceName
```

### 华为云 Region / Project

非 OBS 请求需 IAM 项目 ID。`HuaweiProvider.executeOperation` 每次按 Region 调用 `listAllProjects()` 匹配 `projectId`，不匹配时抛出 `REGION_FORBIDDEN` 友好错误。

---

## IPC 概要

| 类别 | 数量 | 入口 |
|------|------|------|
| AWS 专用 IPC | ~102 | `electronAPI.ec2.*` 等 |
| 多云路由 | 1 | `electronAPI.cloud.invoke` + `cloud.onObsDownloadProgress` |
| 凭证/应用 | ~12 | `profiles.*` / `credentials.*` / `app.*` |

### AWS 常用 Channel（节选）

| Channel | 用途 |
|---------|------|
| `ec2:list-instances` … `ec2:terminate-instance` | EC2 生命周期 |
| `s3:*` / `s3Bucket:*` | S3 对象与桶管理 |
| `ecs:list-clusters` … `ecs:describe-task` | ECS 下钻 |
| `ssm:*` | 终端 / Run Command / 端口转发 |
| `cw:get-instance-metrics` | CloudWatch |

完整列表见 `src/preload/index.ts` 与 `src/main/ipc/*.ts`。

### 多云 Channel

```typescript
cloud:invoke({
  provider: 'huawei',
  credentialId: string,
  region: string,
  service?: string,      // 可选，与 action 拼接
  action: string,        // 如 'ecs:list' 或 'list'
  payload?: Record<string, unknown>,
})
// → { success: boolean, data?: unknown, error?: string }
```

---

## S3 Bucket Region 解析

`resolveBucketRegion()` 四层回退：GetBucketLocation → 错误消息正则 → HeadBucket 遍历常用 Region → 抛错。结果缓存 5 分钟。

---

## SSM WebSocket 协议

```
StartSession → WebSocket(StreamUrl)
  → session_token → session_ready
  → input_stream_data / output_stream_data
  → keepalive 每 4 分钟
  → 关闭时 TerminateSession
```

---

## 当前实现状态（2026-06-08）

### AWS

| 模块 | 状态 | 备注 |
|------|:---:|------|
| EC2 启停/重启/终止 | ✅ | 终止需输入实例 ID 确认 |
| EC2 详情 + SSM | ✅ | |
| S3 桶 CRUD + 对象浏览 + 桶 7 Tab | ✅ | 版本/预签名 URL 的 IPC 已有，UI 未接 |
| EBS / 快照 / 安全组 / EIP / 密钥对 / AMI | ✅ | 快照无复制 UI；AMI 无 createImage |
| ECS 集群→服务→任务 | ✅ | `/ecs/:clusterName` |
| 网络总览 | ✅ | 只读，缺 NACL 等 |
| Cmd+K | ✅ | EC2 + S3 |

### 华为云

| 模块 | 状态 | 备注 |
|------|:---:|------|
| ECS / OBS / RDS | ✅ | |
| EIP 独立页 | ✅ | `/huawei/eip` |
| EVS / VPC / IMS | 🔶 | 只读列表 |
| Cmd+K | ✅ | ECS + OBS + RDS |

### 跨厂商

| 模块 | 状态 |
|------|:---:|
| Provider 切换 + 凭证按厂商过滤 | ✅ |
| Dashboard 双厂商统计 | ✅ |
| 双语 i18n | ✅ |
| 自动化测试 / CI | 📋 |

路线图详见 **[ROADMAP.md](./ROADMAP.md)**。

---

## 添加 AWS 模块

1. `src/main/aws/{service}.service.ts`
2. `src/main/ipc/{service}.ipc.ts` → `ipc/index.ts`
3. `src/preload/index.ts`
4. `src/renderer/src/routes/…` + `routes/index.tsx`
5. 菜单：`src/shared/providers/aws.manifest.ts`（或 `renderer/providers/aws.ts` re-export）
6. i18n：`zh-CN` + `en-US`
7. IPC 参数：`{ region, profile, source: 'custom' }`

## 添加华为云模块

1. `src/main/providers/huawei-services/{svc}.ts`
2. `src/main/providers/huawei.ts` → `executeOperation` case
3. `src/renderer/src/routes/huawei/…`（`useCloudOperation`）
4. 菜单/Region：`src/shared/providers/huawei.manifest.ts`
5. i18n

## 添加新云厂商（模板）

1. 实现 `CloudProvider`（`src/main/providers/{vendor}.ts`）
2. `ProviderRegistry.register()` in `main/index.ts`
3. `src/renderer/src/providers/{vendor}.ts` + `providerStore` PROVIDERS 数组
4. 路由前缀 `/vendor/…`

---

## 代码审计记录

### v1.2.1（2026-05-26）

IPC / Preload / 前端三层审计，41 项问题已修 38 项。详见 git 历史。

### 多云改造（2026-06）

- 新增 `ProviderRegistry`、`cloud:invoke`、华为云 9 类服务
- 凭证 store 增加 `provider` 字段
- 未提交前建议：`npm run build` 冒烟 + 双厂商手工测试

---

## 故障排查

| 症状 | 可能原因 | 处理 |
|------|---------|------|
| 华为云报「当前区域未找到可用项目」 | Region 未开通或 RAM 权限不足 | 控制台开通区域；检查 IAM 项目权限 |
| S3 桶无 Region | ListBuckets 不返回 region | 需 `s3:GetBucketLocation` |
| S3 删除桶失败 | 桶非空 | 先「清空存储桶」 |
| SSM 终端黑屏 | Agent/IAM 未配置 | 安装 SSM Agent + `AmazonSSMManagedInstanceCore` |
| 切换 AWS 后仍见华为菜单项 | 未切换 Provider | 顶栏下拉选择 AWS |
| macOS 无法打开 | 未签名 | `xattr -rd com.apple.quarantine …` |

---

## 相关文档

- **[README.md](./README.md)** / **[README.zh-CN.md](./README.zh-CN.md)** — 用户向介绍
- **[ROADMAP.md](./ROADMAP.md)** — 模块进度与迭代计划
- **[UX-DESIGN.md](./UX-DESIGN.md)** — 信息架构与交互规范（部分章节仍偏 AWS 单云，待更新）
