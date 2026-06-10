# Cloud Ops Manager v2.0.2

稳定性修复版本 — 修复开发环境启动失败、S3/OBS 图片预览裂开，并通过全量 TypeScript 类型检查。

---

## 下载

| 平台 | 文件 |
|------|------|
| **Windows** | `Cloud.Ops.Manager.Setup.2.0.2.exe` |
| **macOS** | `Cloud.Ops.Manager-2.0.2-arm64.dmg`（Apple Silicon） |
| **Linux** | `Cloud.Ops.Manager-2.0.2.AppImage`（x64） |

另附 `latest*.yml` 与 `*-arm64-mac.zip` 供应用内更新。

---

## 更新说明

### v2.0.2

#### 修复

- **开发环境无法启动**：主进程打包 `ws` 时会静态解析可选依赖 `bufferutil` 导致崩溃；将 `ws`、`ssh2` 设为 external，运行时从 `node_modules` 加载
- **AWS S3 图片预览裂开**：开发模式页面为 `http://localhost`，`file://` 临时路径被浏览器拦截；改为 base64 data URL 预览
- **华为 OBS 图片无法预览**：OBS SDK 默认将对象体转为 UTF-8 字符串，破坏二进制图片；预览改用 `SaveAsFile` 读取原始字节
- **华为 OBS 误报「二进制文件无法预览」**：统一预览分类逻辑，按 Content-Type、扩展名、文件头魔数识别图片

#### 改进

- 新增 `src/shared/object-preview.ts`，AWS S3 与华为 OBS 共用文本 / 图片 / 二进制分类
- 图片识别支持 PNG、JPEG、GIF、WebP、BMP 文件头魔数；data URL 自动剥离 MIME 中的 `charset` 等参数
- **TypeScript**：修复主进程、渲染进程、华为 Provider 等 170+ 项类型错误，`npm run typecheck` 可通过
- AWS IPC 类型修正：EC2 实例类型、卷类型、S3 桶区域、密钥导入、AMI 跨区域复制等
- 华为云 SDK 调用修正：ECS 重置密码 API、EVS 创建卷响应、RDS 备份响应字段

#### 已知限制（与 v2.0.1 相同）

- macOS 未做 notarization，首次打开可能需 `xattr` 去隔离
- 大图片预览上限约 20MB；文本编辑上限约 5MB

---

### v2.0.1

- S3 预签名链接（15 分钟 / 1 小时 / 24 小时）
- 华为 RDS 规格可读展示
- 华为 OBS 目录大小聚合统计
- 设置页应用内自动更新

### v2.0.0

- 首发多云版：AWS + 华为云、凭证加密、双语界面

---

## 升级建议

从 v2.0.1 升级的用户若主要使用 **对象存储预览** 或遇到 **开发/调试启动报错**，建议尽快更新。

---

## 免责声明

仅供**合法授权**范围内的云资源运维。请遵守相关法律法规。

反馈：[Issues](https://github.com/S0x007/cloud-ops-manager/issues)
