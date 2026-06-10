# Cloud Ops Manager v1.0.0

**Cloud Ops Manager** 首个正式版 — 在原有 AWS 运维能力基础上，新增 **华为云** 支持，统一为跨平台多云桌面客户端。

> 仓库名仍为 `aws-ops-manager`（历史原因）；应用名与窗口标题为 **Cloud Ops Manager**。

---

## 下载

| 平台 | 架构 | 文件 |
|------|------|------|
| **macOS** | Apple Silicon (M 系列) | `Cloud.Ops.Manager-1.0.0-arm64.dmg` |
| **macOS** | Intel | `Cloud.Ops.Manager-1.0.0.dmg` |
| **macOS** | 便携 ZIP（arm64 / x64） | `Cloud.Ops.Manager-1.0.0-arm64-mac.zip` / `Cloud.Ops.Manager-1.0.0-mac.zip` |
| **Windows** | x64 | `Cloud.Ops.Manager.Setup.1.0.0.exe` |
| **Linux** | x64 / arm64 | `Cloud.Ops.Manager-1.0.0.AppImage` / `Cloud.Ops.Manager-1.0.0-arm64.AppImage` |

### macOS 首次打开提示

未签名应用可能被 Gatekeeper 拦截，安装后可执行：

```bash
sudo xattr -rd com.apple.quarantine "/Applications/Cloud Ops Manager.app"
```

### 使用说明

1. 安装并启动应用  
2. 进入 **设置 → 凭证管理**，添加 **AWS** 或 **华为云** AK/SK（本地 AES-256-GCM 加密存储）  
3. 顶栏切换云厂商与区域后开始使用  

---

## 更新说明

### 产品

- 产品更名为 **Cloud Ops Manager**，更新应用图标与界面品牌  
- 顶栏支持 **AWS / 华为云** 一键切换，Dashboard 与侧栏随厂商动态变化  
- 界面支持 **简体中文 / English**  

### AWS（沿用并增强）

- **EC2**：列表、启停、重启、终止、详情多 Tab、CloudWatch、SSM 终端与 Run Command  
- **S3**：桶管理、对象浏览、上传下载、版本管理、桶策略/加密/生命周期等  
- **EBS / 快照、安全组、VPC 网络、弹性 IP、密钥对、AMI、ECS** 等模块  
- 实例规格展示为人类可读格式（如 `1vCPU / 2GB 突增型`），不再显示 `t2.small` 等原始类型名  

### 华为云（新增）

- **ECS**：列表、创建、详情、VNC、COC 命令、卷挂载、EIP 绑定、批量启停  
- **OBS**：桶与对象浏览、上传下载、预览/编辑、新建目录  
- **RDS**：实例列表/详情、备份、参数、数据库用户、启停重启  
- **EIP / EVS / VPC / IMS / COC** 等模块  
- ECS 规格展示为 `4 vCPU / 32 GB` 格式，隐藏 `x2e.4u.32g` 等内部规格名  

### 架构与安全

- 华为云统一走 `cloud:invoke` + ProviderRegistry；AWS 保留专用 IPC  
- `contextIsolation: true`，凭证不写入 `~/.aws` 明文文件  
- 列表 API 约 5 分钟缓存，支持手动强制刷新  

### 其他

- 修复 IMS 镜像「最小磁盘 = 0」的字段映射问题  
- 新增基础单元测试与 GitHub Actions CI（test / typecheck / build）  

---

## 系统要求

- **macOS** 11+（arm64 / x64）  
- **Windows** 10+（x64）  
- **Linux** 主流发行版（AppImage，x64 / arm64）  

---

## 已知限制

- 应用尚未做代码签名 / 公证，macOS 需手动解除隔离  
- 未集成 `electron-updater` 自动更新，请通过 Releases 页手动下载新版本  
- 华为云 OBS 二级目录为对象存储「虚拟目录」，大小与修改时间可能显示为 `-`（API 限制）  

---

## 反馈

问题与建议：[GitHub Issues](https://github.com/S0x007/aws-ops-manager/issues)
