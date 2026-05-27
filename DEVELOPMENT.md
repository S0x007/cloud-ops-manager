# AWS Ops Manager - 开发文档

## 项目概述

AWS 运维管理桌面工具，对标阿里云客户端，提供 EC2/S3/ECS/SSM 多账号可视化运维管理。

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
| 打包分发 | electron-builder | 24.x |
| 数据持久化 | electron-store / AES-256-GCM 文件存储 | - |

---

## 项目结构

```
aws-ops-manager/
├── package.json                    # 依赖与脚本
├── electron.vite.config.ts         # Vite 三目标构建配置（main/preload/renderer）
├── electron-builder.yml            # 打包配置（DMG/NSIS/AppImage）
├── tsconfig.json                   # TS 根配置（引用 node + web）
├── tsconfig.node.json              # 主进程 + preload TS 配置
├── tsconfig.web.json               # 渲染进程 TS 配置（React JSX）
├── resources/                      # 平台图标
│   ├── icon.icns                   # macOS
│   ├── icon.ico                    # Windows
│   └── icon.png                    # Linux
│
├── src/
│   ├── main/                       # === Electron 主进程 ===
│   │   ├── index.ts                # 入口：BrowserWindow 创建、生命周期
│   │   │
│   │   ├── ipc/                    # IPC 处理器（13 个模块，80+ 通道）
│   │   │   ├── index.ts            # 注册所有 handler
│   │   │   ├── app.ipc.ts          # 窗口/对话框/文件保存/本地存储
│   │   │   ├── profiles.ipc.ts     # ~/.aws 凭证解析 + 自定义凭证 CRUD
│   │   │   ├── ec2.ipc.ts          # EC2 实例查询/启动/停止/重启/控制台输出
│   │   │   ├── ec2-addresses.ipc.ts # 弹性 IP 列表/分配/释放/关联/解绑
│   │   │   ├── ec2-keypairs.ipc.ts  # 密钥对 列表/创建/删除/导入
│   │   │   ├── ec2-security-groups.ipc.ts # 安全组 列表/规则增删/创建/删除
│   │   │   ├── ec2-volumes.ipc.ts   # EBS 卷 列表/创建/挂载/卸载 + 快照 CRUD
│   │   │   ├── s3.ipc.ts           # S3 桶/对象/上传/下载/预览/编辑/批量操作
│   │   │   ├── s3-bucket.ipc.ts    # S3 桶管理：策略/加密/版本/标签/生命周期/网站
│   │   │   ├── ecs.ipc.ts          # ECS 集群/服务/任务/任务定义
│   │   │   ├── ssm.ipc.ts          # SSM 会话管理 + 端口转发
│   │   │   ├── ssm-command.ipc.ts  # SSM Run Command 命令下发/结果查询
│   │   │   └── cloudwatch.ipc.ts   # CloudWatch 指标查询
│   │   │
│   │   ├── aws/                    # AWS SDK 服务封装
│   │   │   ├── client.factory.ts   # 单例工厂：凭证解析 + 客户端缓存 + 切换清缓存
│   │   │   ├── sts.service.ts      # GetCallerIdentity 凭证验证
│   │   │   ├── ec2.service.ts      # EC2：实例/类型规格/安全组
│   │   │   ├── s3.service.ts       # S3 CRUD + Bucket Region 四层回退解析 + 5min缓存
│   │   │   ├── ecs.service.ts      # ECS 集群/服务/任务
│   │   │   ├── ssm.service.ts      # SSM：Run Command/Session/Agent检查
│   │   │   └── cloudwatch.service.ts # CloudWatch GetMetricData
│   │   │
│   │   ├── terminal/               # SSM WebSocket 终端引擎
│   │   │   ├── ssm-protocol.ts     # SSM 消息编解码（Base64 + JSON）
│   │   │   ├── ssm-session.ts      # 会话生命周期 + keepalive + 指数退避重连
│   │   │   └── port-forwarding.ts  # 本地 TCP Server → SSM WebSocket 隧道
│   │   │
│   │   └── store/                  # 持久化存储
│   │       ├── credential-store.ts # AES-256-GCM 加密凭证（scrypt 密钥派生）
│   │       └── api-cache.ts        # API 响应缓存层（5min TTL）
│   │
│   ├── preload/                    # === contextBridge 安全隔离层 ===
│   │   ├── index.ts                # exposeInMainWorld('electronAPI', ...)
│   │   └── api.d.ts                # 类型声明（IPC 契约）
│   │
│   └── renderer/                   # === React 渲染进程 ===
│       ├── index.html              # 入口 HTML
│       └── src/
│           ├── main.tsx            # React DOM 挂载
│           ├── App.tsx             # Router + ConfigProvider（中文/主题）
│           ├── styles/
│           │   └── global.css      # 全局样式 + CSS 变量 + xterm 覆盖
│           │
│           ├── stores/             # Zustand 状态管理
│           │   ├── profileStore.ts # 统一凭证视图（~/.aws + 自定义）
│           │   ├── regionStore.ts  # 当前选中 Region
│           │   ├── ec2Store.ts     # EC2 实例列表 + 过滤
│           │   └── s3Store.ts      # S3 桶列表 + 对象列表
│           │
│           ├── hooks/              # 数据获取 Hook（封装 IPC 调用）
│           │   ├── useProfiles.ts  # 凭证加载/验证/SSO
│           │   ├── useEC2.ts       # fetchInstances/start/stop/reboot
│           │   ├── useS3.ts        # fetchBuckets/fetchObjects/upload/download/delete
│           │   └── useSSM.ts       # startSession/sendData/resize/portForwarding
│           │
│           ├── components/         # 可复用组件
│           │   ├── Layout/
│           │   │   ├── AppLayout.tsx   # 整体布局（Sider + Header + Content）
│           │   │   ├── Sidebar.tsx     # 左侧导航菜单
│           │   │   └── Header.tsx      # 顶部栏：凭证选择器 + Region 选择器 + 状态
│           │   └── FilePreview/
│           │       └── FilePreviewModal.tsx  # 文件预览/编辑器（文本+图片）
│           │
│           └── routes/             # 页面组件（15 个页面）
│               ├── index.tsx       # 路由定义
│               ├── Dashboard.tsx   # 首页：资源概览统计卡片 + 快捷入口
│               ├── EC2/
│               │   ├── EC2Page.tsx           # 实例列表（类型描述/平台图标/右键菜单）
│               │   ├── EC2InstanceDetail.tsx # 实例详情 8 Tab
│               │   ├── EC2MetricsTab.tsx     # CloudWatch 监控条形图
│               │   ├── RunCommand.tsx        # SSM Run Command 命令下发
│               │   └── ConsoleOutput.tsx      # 控制台输出
│               ├── S3/
│               │   ├── S3Page.tsx            # 存储桶列表
│               │   ├── S3ObjectBrowser.tsx   # 对象浏览器（面包屑/上传下载进度/批量删除/重命名/预览编辑）
│               │   └── BucketDetail.tsx      # 桶详情 7 Tab
│               ├── ECS/
│               │   └── ECSPage.tsx           # ECS 集群列表
│               ├── Volumes/
│               │   └── VolumesPage.tsx       # EBS 卷管理
│               ├── Snapshots/
│               │   └── SnapshotsPage.tsx     # 快照列表
│               ├── ElasticIPs/
│               │   └── ElasticIPsPage.tsx    # 弹性 IP 管理
│               ├── KeyPairs/
│               │   └── KeyPairsPage.tsx       # 密钥对管理（创建下载.pem）
│               ├── SecurityGroups/
│               │   └── SecurityGroupsPage.tsx # 安全组管理 + 规则编辑器
│               ├── Terminal/
│               │   ├── SSMTerminalPage.tsx   # xterm.js 终端
│               │   └── PortForwardingPage.tsx # 端口转发配置
│               └── Settings/
│                   ├── SettingsPage.tsx      # 当前凭证状态 + 关于
│                   └── CredentialManager.tsx # 自定义凭证管理（增删改查）
│
└── dist/                           # 打包产物（gitignored）
    ├── AWS Ops Manager-1.0.0-arm64.dmg
    └── AWS Ops Manager-1.0.0-arm64-mac.zip
```

---

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式（HMR 热更新）
npm run dev

# 编译
npm run build

# 打包 macOS（Apple Silicon）
npm run package:mac

# 打包 macOS（Intel）
npm run build && electron-builder --mac --x64

# 打包全平台
npm run package:all
```

### 代理下载 Electron

```bash
export https_proxy=http://127.0.0.1:8234
export http_proxy=http://127.0.0.1:8234
export all_proxy=socks5://127.0.0.1:8235
npm run package:mac
```

---

## 核心架构

### 主进程 vs 渲染进程

```
┌─ 渲染进程 (Chromium, 无 Node.js 权限) ─────────────────┐
│  React + Ant Design + xterm.js                          │
│  Zustand Store → Hooks → window.electronAPI.*          │
└─────────────── contextBridge IPC ───────────────────────┘
                          │
┌─ 主进程 (Node.js, 全权限) ──────────────────────────────┐
│  IPC Handlers → AWS Services → AWS SDK v3               │
│  SSM WebSocket 引擎 (ws 库)                              │
│  端口转发 TCP 隧道 (net 库)                               │
│  凭证管理：~/.aws 解析 + AES-256-GCM 加密存储             │
└─────────────────────────────────────────────────────────┘
```

### 安全模型

- `contextIsolation: true` — 渲染进程无法直接访问 Node.js API
- `nodeIntegration: false` — 所有系统调用通过 IPC
- 自定义凭证：AES-256-GCM 加密存储（密钥从本机特征 scrypt 派生），SK 仅内存中解密
- 凭证文件权限：`0o600`
- 零硬编码 AKSK

### Client Factory 模式

```
用户选择凭证 → profileStore.setActiveCredential(id, source)
                    ↓
IPC Handler → clientFactory.setProfile(id, source)
                    ↓
resolveCredentials():
  source === 'custom' → credential-store 解密 SK → 静态凭证
  source === 'aws-config' → fromIni(profile) / fromNodeProviderChain()
                    ↓
getClient(ServiceClass, { region }) → new ServiceClass({ credentials, region })
                    ↓
缓存 key: `${profile}:${region}:${ServiceName}`
profile/region 切换 → clients.clear()
```

---

## IPC 通道清单

### 请求-响应（invoke）

| Channel | 方向 | 参数 | 用途 |
|---------|------|------|------|
| `profiles:list-all` | R→M | - | 获取统一凭证列表（~/.aws + 自定义） |
| `profiles:verify` | R→M | `{ id, source }` | STS 验证凭证并返回 Account ID |
| `profiles:sso-login` | R→M | `profileName` | 启动浏览器 SSO 登录 |
| `credentials:list` | R→M | - | 获取自定义凭证列表（不含 SK） |
| `credentials:add` | R→M | `{ name, accessKeyId, secretAccessKey, region, description }` | 添加自定义凭证（加密存储） |
| `credentials:update` | R→M | `{ id, data }` | 更新凭证（含可选的 SK 重置） |
| `credentials:delete` | R→M | `id` | 删除自定义凭证 |
| `ec2:list-instances` | R→M | `{ region, profile, source }` | 获取 EC2 实例列表 |
| `ec2:describe-instance` | R→M | `{ region, profile, source, instanceId }` | 获取单个实例详情 |
| `ec2:start-instance` | R→M | `{ region, profile, source, instanceId }` | 启动实例 |
| `ec2:stop-instance` | R→M | `{ region, profile, source, instanceId }` | 停止实例 |
| `ec2:reboot-instance` | R→M | `{ region, profile, source, instanceId }` | 重启实例 |
| `s3:list-buckets` | R→M | `{ region, profile, source }` | 获取存储桶列表（含 region） |
| `s3:list-objects` | R→M | `{ region, profile, source, bucket, prefix }` | 获取对象列表 |
| `s3:head-bucket` | R→M | `{ profile, source, bucket }` | 获取 bucket region |
| `s3:delete-object` | R→M | `{ region, profile, source, bucket, key }` | 删除对象 |
| `s3:upload-file` | R→M | `{ region, profile, source, bucket, key, localPath }` | 上传文件（流式） |
| `s3:download-file` | R→M | `{ region, profile, source, bucket, key, savePath }` | 下载文件（流式） |
| `s3:get-object-content` | R→M | `{ region, profile, source, bucket, key }` | 获取文件内容（文本/图片/二进制） |
| `s3:put-object-content` | R→M | `{ region, profile, source, bucket, key, content, contentType }` | 保存编辑后的内容到 S3 |
| `s3:create-folder` | R→M | `{ region, profile, source, bucket, key }` | 创建文件夹（零字节对象） |
| `s3:get-signed-url` | R→M | `{ region, profile, source, bucket, key }` | 生成预签名 URL（1h） |
| `ecs:list-clusters` | R→M | `{ region, profile, source }` | 获取 ECS 集群列表 |
| `ecs:list-services` | R→M | `{ region, profile, source, cluster }` | 获取服务列表 |
| `ecs:list-tasks` | R→M | `{ region, profile, source, cluster }` | 获取任务列表 |
| `ecs:describe-task` | R→M | `{ region, profile, source, cluster, taskId }` | 获取任务详情 |
| `ssm:start-session` | R→M | `{ region, profile, source, instanceId }` | 启动 SSM 终端会话 |
| `ssm:start-port-forwarding` | R→M | `{ region, profile, source, instanceId, remotePort, localPort }` | 启动端口转发 |
| `app:get-store` | R→M | `key` | 读取持久化配置 |
| `app:set-store` | R→M | `{ key, value }` | 写入持久化配置 |
| `app:open-file-dialog` | R→M | `{ filters, multiSelections }` | 打开文件选择对话框 |
| `app:save-file-dialog` | R→M | `{ defaultPath, filters }` | 打开保存对话框 |

### 推送事件（send）

| Channel | 方向 | 数据 | 用途 |
|---------|------|------|------|
| `ssm:output` | M→R | `string` | SSM 终端输出流 |
| `ssm:session-ended` | M→R | - | SSM 会话结束 |
| `ssm:error` | M→R | `string` | SSM 错误消息 |
| `ssm:port-forward-status` | M→R | `string` | 端口转发状态更新 |
| `s3:upload-progress` | M→R | `{ key, loaded, total }` | 文件上传进度 |

---

## S3 Bucket Region 解析策略

`resolveBucketRegion()` 采用四层回退：

```
1. GetBucketLocationCommand  →  最可靠，需要 s3:GetBucketLocation 权限
   ↓ 失败
2. 正则解析错误消息  →  从 'region xx-xxx-x' 模式提取
   ↓ 失败
3. HeadBucket 遍历 12 个常用 region  →  依次尝试 us-east-1/us-west-2/ap-northeast-1...
   ↓ 全部失败
4. 抛出详细错误（含 bucket 名称 + 原始错误）
```

结果缓存 5 分钟 TTL（`Map<bucketName, {region, timestamp}>`）。

---

## SSM WebSocket 协议

```
StartSessionCommand → { StreamUrl, TokenValue, SessionId }
  ↓
WebSocket(StreamUrl)
  ↓ (open)
send: { Type: "session_token", Payload: base64(TokenValue) }
  ↓
recv: { Type: "session_ready" }
  ↓
终端输入: { Type: "input_stream_data", Payload: base64(keystrokes) }
终端输出: { Type: "output_stream_data", Payload: base64(output) }
窗口调整: { Type: "size", Payload: base64({cols, rows}) }
Keepalive: 每 4 分钟发送 \x00
重连策略: 指数退避，最多 3 次（1s/2s/4s）
关闭: ws.close() + TerminateSessionCommand
```

---

## 当前实现状态（v1.2.0）

### 核心功能

| 模块 | 功能 | 状态 |
|------|------|:---:|
| **凭证管理** | ~/.aws profiles + 自定义 AES-256-GCM 加密凭证、手动验证、全区域 EC2 数量扫描 | ✅ |
| **EC2** | 实例列表（类型描述/平台PNG图标/状态徽章）、启动/停止/重启、详情 9 Tab（概览/监控/命令下发/控制台/卷/标签/网络）、右键菜单 | ✅ |
| **S3** | 桶列表+区域解析、对象浏览（面包屑/上传下载进度/批量删除/重命名）、桶详情 7 Tab（策略/公共访问/加密/版本/标签/生命周期编辑器/网站）、文件编辑器（行号/Ctrl+S/Tab缩进） | ✅ |
| **EBS** | 卷列表、创建/删除/挂载/卸载/快照 | ✅ |
| **快照** | 列表、删除 | ✅ |
| **安全组** | 列表+规则表格、预设快速添加、创建/删除安全组和规则 | ✅ |
| **弹性 IP** | 列表、分配（自动标签记录时间）/关联/解绑/释放 | ✅ |
| **密钥对** | 列表、创建（下载.pem）/导入/删除 | ✅ |
| **AMI** | 自有镜像列表、跨区域复制、注销 | ✅ |
| **ECS** | 集群列表 | ✅ |
| **CloudWatch** | EC2 实例 5 项监控指标条形图（CPU/网络/磁盘） | ✅ |
| **网络总览** | VPC/子网/路由表（可展开路由条目）/Internet网关/NAT网关 折叠面板 | ✅ |
| **SSM** | 交互式终端（xterm.js）、Run Command 命令下发（8组预设+自定义+历史）、端口转发 | ✅ |

### UX 特性

| 特性 | 状态 |
|------|:---:|
| Cmd+K 全局资源搜索（实例ID/名称/IP/桶名） | ✅ |
| 侧边栏分组导航（计算/存储/网络/设置） | ✅ |
| 面包屑自动导航 | ✅ |
| ErrorBoundary 全局异常捕获 | ✅ |
| 骨架屏/Empty/错误状态统一组件 | ✅ |
| 暗色/亮色主题切换 | ✅ |
| EC2 右键上下文菜单 | ✅ |
| API 响应缓存 5min TTL × 8 个列表接口 | ✅ |
| 平台专属图标（macOS云朵/Windows服务器/Linux企鹅） | ✅ |

### 安全

| 特性 | 状态 |
|------|:---:|
| contextIsolation + 零 Node.js 权限渲染进程 | ✅ |
| 自定义凭证 AES-256-GCM 加密（scrypt 密钥派生） | ✅ |
| 零硬编码 AKSK | ✅ |
| 凭证必须手动选择+手动验证 | ✅ |

### 已知限制

- SSM Agent 必须运行在 EC2 实例上且配置了正确的 IAM 角色
- 文件编辑仅支持 5MB 以下文本文件
- macOS 签名需 Apple Developer 账号（$99/年），当前跳过签名

### 下版本迭代方向

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P1 | ECS 服务/任务详情 | 集群→服务→任务下钻 |
| P1 | RDS 浏览器 | 查看 RDS 实例列表 |
| P1 | S3 版本管理面板 | 查看/恢复/删除历史版本（IPC 已有） |
| P2 | Lambda 函数列表 | 查看和测试调用 |
| P2 | 多 Terminal 标签 | 同时连接多台实例 |
| P3 | 自动更新 | electron-updater |

---

## 代码审计记录

### v1.2.1 审计（2026-05-26）

全量三层审计：IPC 层（16 文件/104 handler）、Preload/Store 层（5 文件）、前端页面层（23 页面）。

| 层 | 发现问题 | 高危 | 中危 | 低危 | 已修复 |
|------|:---:|:---:|:---:|:---:|:---:|
| IPC Handlers | 15 | 8 | 4 | 3 | 15 |
| Preload/Stores | 4 | 0 | 4 | 0 | 4 |
| 前端页面 | 22 | 1 | 12 | 9 | 19 |
| **合计** | **41** | **9** | **20** | **12** | **38** |

**已修复的高危问题：**
- `profiles.ipc.ts` 6 个 handler 缺失 try/catch → 全部重写，加中文错误消息
- `ssm.ipc.ts` 2 个 handler 缺失 try/catch + `start-session` 无窗口时静默返回 undefined → 改为 throw Error
- `ssm:port-forward-status` 主进程推送但 preload 无监听 → 补上 `onPortForwardStatus`
- `InlineVolumes.tsx` `catch { /* ignore */ }` 静默吞错 → `console.error`

**已修复的中危问题：**
- 12 处写操作后刷新未传 `forceRefresh` → 涉及 ElasticIPs/KeyPairs/Snapshots/SecurityGroups/AMI/BucketDetail
- `BucketDetail.headBucket` 缺失 `region` 参数 → 已补
- `profiles:list-all` 解析错误时静默跳过 → 保留错误抛出行为（用户选择凭证前不自动加载）

**保留的技术债（低危）：**
- 12 处未使用导入（Tooltip/Badge/Alert/SearchOutlined 等）
- 3 个 store 死字段（`s3Store.selectedObject`/`ec2Store.getFilteredInstances`/`profileStore.activeRegion`）
- 17 个 handler 使用无类型 `params`（`any`）
- `ecs:list-services`/`ecs:list-tasks`/`s3:list-objects`/`s3:list-object-versions` 未使用缓存

---

## 添加新服务指南

1. **主进程**：
   - `src/main/aws/{service}.service.ts` — SDK 封装函数
   - `src/main/ipc/{service}.ipc.ts` — IPC handler（注册到 `ipc/index.ts`）

2. **Preload**：
   - `src/preload/index.ts` — 添加 API 方法

3. **渲染进程**：
   - `src/renderer/src/stores/{service}Store.ts` — Zustand 状态
   - `src/renderer/src/hooks/use{Service}.ts` — 数据获取 Hook
   - `src/renderer/src/routes/{Service}/{Service}Page.tsx` — 页面组件
   - `src/renderer/src/routes/index.tsx` — 注册路由
   - `src/renderer/src/components/Layout/Sidebar.tsx` — 添加菜单项

4. **凭证传递**：所有 IPC 方法必须包含 `{ region, profile, source }` 三元组，handler 内调用 `clientFactory.setProfile(profile, source)` 切换凭证上下文。

---

## 故障排查

| 症状 | 可能原因 | 检查 |
|------|---------|------|
| 凭证选择后仍为 "Default Profile" | `::` 分隔符 bug | 确认 Header.tsx 使用 `indexOf('::')` 解析 |
| S3 存储桶无 region | ListBuckets 不返回 region | 确认 `listBuckets()` 调用 `resolveBucketRegion()` |
| S3 点击桶报 UnknownError | region 解析失败 | 确认凭证有 `s3:GetBucketLocation` 权限 |
| SSM 终端黑屏 | SSM Agent 未安装或 IAM 角色不对 | EC2 上 `sudo snap install amazon-ssm-agent` |
| 打包后启动报 Cannot find module | 依赖未打包 | 确认 `electron.vite.config.ts` 主进程仅 external `electron` |
| macOS 无法打开（未验证开发者） | 未签名 | `sudo xattr -rd com.apple.quarantine "/Applications/AWS Ops Manager.app"` |
