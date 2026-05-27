

# AWS Ops Manager

跨平台 AWS 运维桌面客户端 — 多账号、多区域、本地缓存，日常运维一个窗口搞定。

[English](./README.md)



---

## 项目简介

**AWS Ops Manager** 是一款基于 Electron 的 AWS 运维桌面工具。它将 EC2、S3、EBS、网络、SSM 等高频操作整合到统一界面，支持凭证切换、API 响应缓存，以及 **简体中文 / English** 双语界面。

> **说明：** 本工具使用**您自己的** AWS 凭证调用 API，不提供账号、不绕过 IAM。请仅在您有权管理的资源上使用。

---

## 功能概览


| 模块             | 说明                                                                    |
| -------------- | --------------------------------------------------------------------- |
| **EC2**        | 多区域实例列表（含规格说明）· 启停/重启 · 8 标签页详情 · CloudWatch 图表 · SSM 终端与 Run Command |
| **S3**         | 桶/对象浏览 · 上传下载（进度条）· 在线编辑 · 桶策略/加密/生命周期/静态网站等 7 个管理标签                  |
| **EBS 与快照**    | 卷创建/挂载/卸载 · 从卷创建快照                                                    |
| **安全组**        | 入站/出站规则 · 8 种预设（SSH/HTTP/HTTPS/…）· 创建/删除安全组与规则                        |
| **网络总览**       | VPC、子网、路由表、Internet 网关、NAT 网关                                         |
| **弹性 IP 与密钥对** | 分配/关联/释放 · 创建/导入密钥对（支持下载 .pem）                                        |
| **AMI**        | 自有镜像列表 · 跨区域复制 · 注销                                                   |
| **ECS**        | 集群列表（服务数、任务数）                                                         |
| **凭证管理**       | 读取 `~/.aws` Profile · **AES-256-GCM** 加密存储自定义 AK/SK（绑定本机）             |
| **体验**         | `⌘K` 全局搜索 · 分组侧栏 · 面包屑 · 深色/浅色主题 · 列表 API 缓存（5 分钟 TTL）                |


---

## 截图

> 首次发布前可将截图放入 `screenshots/` 目录。


| 仪表盘   | EC2   | S3    |
| ----- | ----- | ----- |
| *待补充* | *待补充* | *待补充* |


---

## 安装

### 下载安装（推荐）

从 **[Releases](https://github.com/S0x007/aws-ops-manager/releases)** 获取最新版本：


| 平台                   | 格式                |
| -------------------- | ----------------- |
| macOS（Apple Silicon） | `.dmg` / `.zip`   |
| Windows              | NSIS 安装包          |
| Linux                | AppImage / `.deb` |


### macOS 安全提示

若提示「无法验证开发者」：

```bash
sudo xattr -rd com.apple.quarantine "/Applications/AWS Ops Manager.app"
```

### 从源码打包

见下方 [开发](#开发)，然后执行：

```bash
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

产物输出到 `dist/` 目录。

---

## 开发

### 环境要求

- **Node.js** 18+
- **npm** 9+
- 已配置 AWS 凭证（`~/.aws/config`）或使用应用内凭证管理

### 快速开始

```bash
git clone https://github.com/S0x007/aws-ops-manager.git
cd aws-ops-manager
npm install
npm run dev
```

### 常用命令


| 命令                      | 说明                 |
| ----------------------- | ------------------ |
| `npm run dev`           | 开发模式（热更新）          |
| `npm run build`         | 生产构建 → `out/`      |
| `npm run preview`       | 预览生产构建             |
| `npm run package:mac`   | 打包 macOS DMG + ZIP |
| `npm run package:win`   | 打包 Windows NSIS    |
| `npm run package:linux` | 打包 AppImage + deb  |
| `npm run package:all`   | 全平台打包              |


### 目录结构

```
src/
├── main/          # Electron 主进程：IPC、AWS 服务、SSM 终端、加密存储
├── preload/       # contextBridge 安全桥（类型化 API）
└── renderer/      # React + Ant Design 界面
```

更多细节见 **[DEVELOPMENT.md](./DEVELOPMENT.md)** · 功能路线图：**[ROADMAP.md](./ROADMAP.md)**

---

## 架构简述

```
渲染进程 (React)  →  window.electronAPI  →  主进程 (Node.js)  →  AWS SDK v3
```

- **安全模型：** `contextIsolation: true`、`nodeIntegration: false`，所有 AWS 调用经 IPC 转发。
- **多凭证：** 每次 IPC 携带 `{ region, profile, source }`。
- **缓存：** 列表接口默认缓存约 5 分钟；切换凭证/区域时清空；手动刷新使用 `forceRefresh`。

---

## 快捷键


| 快捷键             | 功能                    |
| --------------- | --------------------- |
| `⌘K` / `Ctrl+K` | 全局命令面板                |
| EC2 行右键         | 上下文菜单（SSM、停止、复制 ID 等） |


语言切换：顶栏地球图标（**中文 ↔ English**）。

---

## 参与贡献

欢迎 Issue 与 Pull Request。较大改动建议先开 Issue 讨论。

1. Fork → 分支 → 提交 → PR
2. 提交前请运行 `npm run build`
3. 界面文案请同时维护 `src/renderer/src/i18n/index.ts` 中的 **zh-CN** 与 **en-US**

---

## 许可证

[MIT](./LICENSE)

---

## 致谢

- [Ant Design](https://ant.design/) · [xterm.js](https://xtermjs.org/) · [Zustand](https://github.com/pmndrs/zustand) · [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)

