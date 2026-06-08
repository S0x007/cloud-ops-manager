# Cloud Ops Manager

[English](./README.md)

---

## 免责声明

**Cloud Ops Manager** 仅供在对目标云资源拥有**合法授权**的前提下进行日常运维、资产查看与管理。

**未经授权，请勿利用本工具对任何云账号或计算机系统进行未授权访问或操作。** 利用本工具所提供的信息而造成的直接或间接后果和损失，均由使用者本人负责。

#### 再次声明：遵守《网络安全法》等相关法律法规，切勿用于非法渗透或未授权测试活动！

---

## 介绍

多云运维管理桌面客户端，主要涵盖两大模块：

| 模块 | 说明 |
|------|------|
| **云存储工具** | **S3 / OBS**：桶列表、对象浏览、上传、下载、预览、编辑 |
| **云服务工具** | **EC2 / ECS / RDS**：实例列表、启停、详情、SSM 终端、Run Command、VNC 等 |

支持 **AWS / 华为云** 切换 · 凭证本地 **AES-256-GCM** 加密 · **简体中文 / English**

---

## 软件架构

`Electron` + `React` + `Ant Design` + `TypeScript` + `Node.js` + `AWS SDK v3` + `华为云 SDK` + `OBS SDK`

---

## 目前实现功能

**AWS：** EC2、S3、EBS、快照、安全组、VPC、弹性 IP、密钥对、AMI、ECS、SSM 终端与 Run Command

**华为云：** ECS、OBS、RDS、弹性公网 IP、EVS、VPC、IMS、COC 命令

**通用：** 凭证管理、全局命令面板 `⌘K`、深/浅色主题

---
<img width="2800" height="1744" alt="321" src="https://github.com/user-attachments/assets/57b826bb-bda3-4c92-a588-19ebbccb1d71" />
<img width="2800" height="1744" alt="123" src="https://github.com/user-attachments/assets/5fd56b62-64a6-408f-b114-16ef66dc6e53" />

## 安装

从 **[Releases](https://github.com/S0x007/cloud-ops-manager/releases)** 下载最新版：

| 平台 | 文件 |
|------|------|
| **Windows** | `Cloud.Ops.Manager.Setup.2.0.0.exe` |
| **macOS** | `Cloud.Ops.Manager-2.0.0-arm64.dmg`（Apple Silicon） |
| **Linux** | `Cloud.Ops.Manager-2.0.0.AppImage`（x64） |

### macOS 无法打开

```bash
sudo xattr -rd com.apple.quarantine "/Applications/Cloud Ops Manager.app"
```

---

## 常见问题

**1、macOS 提示无法打开** — 见上方 `xattr` 命令  

**2、macOS 无法关闭** — 使用 `Command + Q` 退出  

**3、OBS 二级目录大小/时间为 `-`** — 对象存储虚拟目录无 API 元数据，属正常  

**4、数据不是最新** — 点击页面刷新按钮  

---

## 许可证

[MIT](./LICENSE)
