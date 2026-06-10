# Cloud Ops Manager

[简体中文](./README.zh-CN.md)

> Repository name remains `aws-ops-manager` for history; the application window title is **Cloud Ops Manager**.

---

## Disclaimer

**Cloud Ops Manager** is intended for **authorized** day-to-day cloud operations only — inventory, configuration, and maintenance on resources you are permitted to manage.

**Do not use this tool to access any cloud account or system without authorization.** You are solely responsible for any direct or indirect consequences of misuse.

#### Comply with applicable laws (e.g. cybersecurity regulations). Do not use for illegal intrusion or unauthorized testing.

---

## Introduction

A **multi-cloud ops desktop client** with two main areas:

| Module | Scope |
|--------|--------|
| **Object storage** | **S3 / OBS** — buckets, object browser, upload, download, preview, edit, batch delete |
| **Compute & services** | **EC2 / ECS / RDS** — instance list, start/stop, detail, Run Command, SSM terminal, VNC |

Header switcher: **AWS / Huawei Cloud**. Credentials stored with **AES-256-GCM**. UI: **English / 简体中文**.

---

## Architecture

`Electron` + `React` + `Ant Design` + `TypeScript` + `Node.js` + `AWS SDK v3` + `Huawei Cloud SDK` + `OBS SDK` + `Zustand`

```
Renderer (React)
    ├─ AWS pages ──► electronAPI.{ec2,s3,...} ──► IPC ──► AWS SDK v3
    └─ Huawei pages ► electronAPI.cloud.invoke ──► ProviderRegistry ──► Huawei SDK / OBS
```

---

## Overview diagram

> Put screenshots under `image/` and update paths below.

![Overview](./image/overview.png)

---

## Implemented features

**AWS:** EC2 list/start/stop/reboot/terminate, detail tabs, CloudWatch, SSM terminal & Run Command, S3 buckets & objects, EBS volumes & snapshots, security groups, VPC (read-only), Elastic IPs, key pairs, AMI, ECS clusters/services/tasks drill-down

**Huawei Cloud:** ECS list/create/detail, VNC, COC run command, volumes, EIP bind, OBS browser/upload/download/preview, RDS instances/backups/parameters/users, dedicated EIP page, EVS/VPC/IMS lists, COC presets & history

**Cross-cutting:** Credential manager per provider, `⌘K` command palette, dark/light theme, list API cache & manual refresh

---

## Object storage module

![S3 buckets](./image/s3-buckets.png)

![S3 object browser](./image/s3-objects.png)

![OBS browser](./image/obs-browser.png)

---

## Compute & services module

![Dashboard](./image/dashboard.png)

![EC2 list](./image/ec2-list.png)

![EC2 detail & SSM](./image/ec2-detail.png)

![Huawei ECS](./image/huawei-ecs.png)

![Huawei RDS](./image/huawei-rds.png)

---

## Installation

### Download (recommended)

Get the latest build from **[Releases](https://github.com/S0x007/aws-ops-manager/releases)**:

| Platform | Format |
|----------|--------|
| macOS (Apple Silicon / Intel) | `.dmg` / `.zip` |
| Windows | NSIS `.exe` |
| Linux | AppImage |

### Build from source

```bash
git clone https://github.com/S0x007/aws-ops-manager.git
cd aws-ops-manager
npm install
npm run dev
```

**Prerequisites:** Node.js 18+, npm 9+. Add credentials in **Settings → Credential Manager**.

| Command | Description |
|---------|-------------|
| `npm run dev` | Development |
| `npm run build` | Compile → `out/` |
| `npm run package:mac` | Package macOS |
| `npm run package:win` | Package Windows |
| `npm run package:linux` | Package Linux |

---

## FAQ

**1. macOS: “Cloud Ops Manager.app” cannot be opened**

```bash
sudo xattr -rd com.apple.quarantine "/Applications/Cloud Ops Manager.app"
```

**2. macOS: app does not quit from window close**

- Use the red close button, or **`Command + Q`** to quit.

**3. Huawei OBS folder stats show `~`**

Partial aggregate when a folder has more than 10,000 objects (size sum + latest modified time).

**4. Stale list data**

Click **Refresh**, or change region (AWS lists cache ~5 minutes by default).

---

## Docs

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — IPC, providers, troubleshooting  
- **[ROADMAP.md](./ROADMAP.md)** — Roadmap  

---

## License

[MIT](./LICENSE)
