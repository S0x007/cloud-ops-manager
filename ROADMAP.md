# Cloud Ops Manager — 开发路线图

> 以**代码实际状态**为准（非 README 历史描述）。  
> 图例：**✅** 前后端已打通 · **🔶** 后端/IPC 有、前端未接或未完整 · **📋** 待实现 · **—** 只读/列表

最后更新：2026-06-08（v2.0.1 backlog 已添加）

---

## 一、产品定位

| 项 | 说明 |
|----|------|
| 产品名 | **Cloud Ops Manager**（窗口标题；仓库名 `aws-ops-manager`） |
| 云厂商 | AWS（专用 IPC）+ 华为云（`cloud:invoke`） |
| 凭证 | 应用内 AES-256-GCM 加密 AK/SK，按 `provider` 字段区分 |
| 测试 | vitest 单测 + CI（`credential-store` / `cloud-router` / `huawei-region`）|

---

## 二、架构概览

```
Renderer
  ├─ providerStore (aws | huawei)
  ├─ useCloudOperation / cloudInvoke（华为云统一调用层）
  ├─ src/shared/providers/*（菜单 + Region 单一数据源）
  ├─ AWS 路由 /ec2 /s3 …     → electronAPI.ec2.* / s3.* …  → 102 IPC handlers
  └─ 华为路由 /huawei/*       → cloud.invoke                 → HuaweiProvider (~99 actions)
```

**双轨说明：** AWS 历史模块走专用 IPC（阶段 C 评估后保留）；华为云及未来厂商走 `ProviderRegistry` + `cloud:invoke`。

---

## 三、AWS 模块进度

### 3.1 计算与远程

| 功能 | 后端 | 前端 | 状态 |
|------|------|------|------|
| EC2 列表/启停/重启 | ✅ | ✅ | ✅ |
| EC2 **终止实例** | ✅ `ec2:terminate-instance` | ✅ 输入 ID 确认 | ✅ |
| EC2 详情（概览/监控/命令/控制台/卷/标签/网络） | ✅ | ✅ | ✅ |
| SSM 终端 / 端口转发 / Run Command | ✅ | ✅ | ✅ |
| ECS 集群列表 | ✅ | ✅ | ✅ |
| ECS **服务 + 任务下钻** | ✅ | ✅ `ECSClusterDetail` | ✅ |
| ECS 任务详情 Drawer | ✅ `describe-task` | ✅ | ✅ |
| AMI 列表/复制/注销 | ✅ | ✅ | ✅ |
| AMI 从实例创建 | 📋 | 📋 | 📋 |
| EC2 批量操作 | 📋 | 📋 | 📋 |

### 3.2 存储

| 功能 | 后端 | 前端 | 状态 |
|------|------|------|------|
| S3 桶列表 | ✅ | ✅ | ✅ |
| S3 **创建/清空/删除桶** | ✅ | ✅ `S3Page` | ✅ |
| S3 桶详情 7 Tab | ✅ | ✅ | ✅ |
| S3 对象浏览（上传/下载/批量删/重命名/预览编辑） | ✅ | ✅ | ✅ |
| S3 预签名 URL | ✅ `get-signed-url` | ✅ 对象行下拉复制 | ✅ |
| S3 对象版本管理 | ✅ `list-object-versions` | ✅ `VersionPanel` | ✅ |
| S3 对象属性面板 | ✅ `head-object` / `get-object-attributes` | 🔶 | 🔶 |
| EBS 卷 CRUD + 挂载 | ✅ | ✅ | ✅ |
| EBS 卷 modifyVolume | 📋 | 📋 | 📋 |
| 快照 列表/删除/从卷创建 | ✅ | ✅ 列表+删 | 🔶 无跨区域复制 UI |

### 3.3 网络与安全

| 功能 | 状态 |
|------|------|
| 安全组 CRUD + 规则编辑 | ✅ |
| 弹性 IP 完整生命周期 | ✅ |
| 密钥对 CRUD + 导入 | ✅ |
| VPC/子网/路由/IGW/NAT 只读 | ✅ |
| NACL / VPC Endpoint / Peering | 📋 |

### 3.4 体验

| 功能 | 状态 |
|------|------|
| Cmd+K 搜索 EC2/S3 | ✅ |
| Cmd+K **随 provider 搜华为 ECS/OBS/RDS** | ✅ |
| Dashboard 双厂商统计 | ✅ |
| 操作审计日志 / 收藏夹 | 📋 |

---

## 四、华为云模块进度

| 模块 | 后端 | 前端 | 状态 |
|------|------|------|------|
| **ECS** 列表/详情/创建/变配/密码/VNC/卷/COC | ✅ | ✅ | ✅ 较成熟 |
| **ECS 批量启停 + COC 预设/历史** | ✅ | ✅ | ✅ |
| **OBS** 桶+对象 CRUD/上传下载/预览 | ✅ | ✅ | ✅ 较成熟 |
| **OBS 桶详情 Tab** | ✅ `getBucketDetail` | ✅ `/huawei/obs/:bucket/detail` | ✅ |
| **RDS** 列表/详情/备份/参数/用户 | ✅ | ✅ | ✅ 中等 |
| **RDS 实例启停/重启** | ✅ | ✅ | ✅ |
| **EIP** 分配/释放/绑定/解绑 | ✅ | ✅ `/huawei/eip` | ✅ |
| **VPC** 列表（VPC/子网/安全组） | ✅ | ✅ 规则编辑 | ✅ |
| **EVS** 列表 + 创建/删除/挂载/扩容 | ✅ | ✅ | ✅ |
| **IMS** 镜像列表 | ✅ | — 只读 | 🔶 |
| **COC/SSH** 命令执行 | ✅ | ECS 详情内 | ✅ |

---

## 五、分阶段计划

### 阶段 A — 补齐后端已有能力（进行中）

| 任务 | 优先级 | 状态 |
|------|--------|------|
| EC2 终止 | P0 | ✅ 已完成 |
| S3 桶创建/删除/清空 | P0 | ✅ 已完成 |
| ECS 服务/任务下钻 | P0 | ✅ 已完成 |
| Cmd+K 多云搜索 | P0 | ✅ 已完成 |
| 华为 EIP 独立页 | P0 | ✅ 已完成 |
| S3 版本面板 + 预签名 URL UI | P1 | ✅ 已完成 |
| 文档与代码对齐 | P1 | ✅ 本文档 |

### 阶段 B — 华为云 MVP 对齐（2–3 周）✅ 已完成

1. EVS：创建/删除/挂载/卸载/扩容（后端 + 前端）✅
2. VPC 安全组规则编辑器 ✅
3. OBS 桶详情页（概览/版本/策略 Tab）✅
4. ECS 批量启停、COC 预设命令/历史 ✅
5. RDS 实例启停/重启 ✅

### 阶段 C — 架构收敛 ✅

1. 统一 `useCloudOperation` / `cloudInvoke` 前端调用层 ✅
2. `src/shared/providers/*` 合并 main/renderer 菜单与 Region 定义 ✅
3. 清理 preload 死 API（`profiles:ssoLogin`、`profiles:list`、`electronAPI.huawei.*`）✅
4. AWS 保留专用 IPC，不迁入 `cloud:invoke`（评估结论：维持双轨）✅

### 阶段 D — 质量与发布

1. 单测：`credential-store`、`cloud-router`、`huawei-region` ✅
2. GitHub Actions CI（`npm test` + `npm run typecheck` + `npm run build`）✅
3. `electron-updater` + 代码签名 📋 → 见 **[docs/v2.0.1-backlog.md](./docs/v2.0.1-backlog.md)**
4. 发版 **v2.0.0**（多云版）✅ — [Release](https://github.com/S0x007/cloud-ops-manager/releases/tag/v2.0.0)（公开仓仅 README + 安装包）

### 阶段 D.1 — v2.0.1「能放心装、愿意留」🔶 进行中

- P0 #4 electron-updater ✅
- P1 #5 S3 预签名 URL ✅ · #6 RDS 规格 ✅ · #7 OBS 目录统计 ✅ · #8 Release 文档 ✅（待 push 公开仓）

详见 **[docs/v2.0.1-backlog.md](./docs/v2.0.1-backlog.md)**

### 阶段 E — 扩展厂商（按需）

- 阿里云 → 腾讯云，复用 `CloudProvider` + `cloud:invoke` 模板

---

## 六、新增 AWS 功能检查清单

```
[ ] src/main/aws/{service}.service.ts
[ ] src/main/ipc/{service}.ipc.ts → register in ipc/index.ts
[ ] src/preload/index.ts
[ ] src/renderer/.../routes + index.tsx
[ ] src/renderer/.../providers/aws.ts 菜单（若需）
[ ] src/renderer/src/i18n/index.ts (zh-CN + en-US)
[ ] IPC 参数含 { region, profile, source: 'custom' }
```

---

## 七、新增华为云 Action 检查清单

```
[ ] src/main/providers/huawei-services/{svc}.ts
[ ] src/main/providers/huawei.ts → executeOperation case
[ ] src/renderer/src/routes/huawei/…（调用 `useCloudOperation`）
[ ] src/shared/providers/huawei.manifest.ts 菜单/Region（main + renderer 共用）
[ ] i18n
```

---

## 八、已知限制

- 凭证仅应用内加密存储；当前 UI 路径不使用 `~/.aws` profiles
- SSM 依赖实例 Agent + IAM 角色；华为 COC 依赖 Agent 安装
- S3 文本编辑限制约 5MB；macOS 未做 notarization
- 无自动化测试，回归依赖手工冒烟
