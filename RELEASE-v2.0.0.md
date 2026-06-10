# Cloud Ops Manager v2.0.0

**Cloud Ops Manager** — 支持 **AWS** 与 **华为云** 的统一运维桌面客户端。

---

## 下载

| 平台 | 文件 |
|------|------|
| **Windows** | `Cloud.Ops.Manager.Setup.2.0.0.exe` |
| **macOS** | `Cloud.Ops.Manager-2.0.0-arm64.dmg`（Apple Silicon） |
| **Linux** | `Cloud.Ops.Manager-2.0.0.AppImage`（x64） |

### macOS 首次打开

```bash
sudo xattr -rd com.apple.quarantine "/Applications/Cloud Ops Manager.app"
```

### 使用说明

1. 安装并启动  
2. **设置 → 凭证管理** 添加 AWS 或华为云 AK/SK  
3. 顶栏切换云厂商与区域  

---

## 更新说明

- 支持 **AWS / 华为云** 顶栏切换  
- **AWS**：EC2、S3、EBS、安全组、VPC、EIP、密钥对、AMI、ECS、SSM  
- **华为云**：ECS、OBS、RDS、EIP、EVS、VPC、IMS、COC  
- 凭证 AES-256-GCM 加密 · 中英文界面 · `⌘K` 全局搜索  

---

## 免责声明

仅供**合法授权**范围内的云资源运维。请遵守相关法律法规。

反馈：[Issues](https://github.com/S0x007/cloud-ops-manager/issues)
