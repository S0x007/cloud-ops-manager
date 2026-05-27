<p align="center">
  <img src="resources/icon.png" width="128" alt="AWS Ops Manager" />
</p>

<h1 align="center">AWS Ops Manager</h1>

<p align="center">
  A cross-platform desktop client for day-to-day AWS operations — multi-account, multi-region, offline-friendly caching.
</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/S0x007/aws-ops-manager/actions"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platforms" /></a>
  <a href="https://github.com/S0x007/aws-ops-manager/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <img src="https://img.shields.io/badge/electron-31.x-blue" alt="Electron" />
  <img src="https://img.shields.io/badge/react-18.x-61dafb" alt="React" />
  <img src="https://img.shields.io/badge/i18n-en%20%7C%20zh--CN-orange" alt="i18n" />
</p>

---

## Overview

**AWS Ops Manager** is an Electron desktop app inspired by cloud vendor ops clients (e.g. Alibaba Cloud Client). It wraps common AWS workflows — EC2, S3, EBS, networking, SSM — in a single UI with credential switching, response caching, and bilingual support (**English / 简体中文**).

> **Note:** This tool calls AWS APIs with **your** credentials. It does not provide AWS accounts or bypass IAM. Use only on resources you are authorized to manage.

---

## Features

| Area | Highlights |
|------|------------|
| **EC2** | Multi-region instance list with type hints · start/stop/reboot · 8-tab detail view · CloudWatch charts · SSM terminal & Run Command |
| **S3** | Bucket browser · upload/download with progress · inline file editor · bucket policy, encryption, lifecycle, static website (7 tabs) |
| **EBS & Snapshots** | Volume create/attach/detach · snapshot from volume |
| **Security Groups** | Inbound/outbound rules · 8 presets (SSH/HTTP/HTTPS/…) · create/delete groups & rules |
| **Network** | VPC, subnets, route tables, IGW, NAT gateways |
| **Elastic IPs & Key Pairs** | Allocate/associate/release · create/import key pairs (.pem download) |
| **AMI** | List owned AMIs · cross-region copy · deregister |
| **ECS** | Cluster list with service/task counts |
| **Credentials** | `~/.aws` profiles + **AES-256-GCM** encrypted custom keys (machine-bound) |
| **UX** | `⌘K` command palette · sidebar navigation · breadcrumbs · dark/light theme · API cache (5 min TTL) |

---

## Screenshots

> Add screenshots under `screenshots/` before your first release.

| Dashboard | EC2 | S3 |
|-----------|-----|-----|
| *coming soon* | *coming soon* | *coming soon* |

---

## Installation

### Download (recommended)

Get the latest build from **[Releases](https://github.com/S0x007/aws-ops-manager/releases)**:

| Platform | Format |
|----------|--------|
| macOS (Apple Silicon) | `.dmg` / `.zip` |
| Windows | NSIS installer |
| Linux | AppImage / `.deb` |

### macOS quarantine

If macOS blocks the app as an unverified developer:

```bash
sudo xattr -rd com.apple.quarantine "/Applications/AWS Ops Manager.app"
```

### Build from source

See [Development](#development) below, then:

```bash
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

Artifacts are written to `dist/`.

---

## Development

### Prerequisites

- **Node.js** 18+
- **npm** 9+
- AWS credentials (`~/.aws/config`) or use the in-app credential manager

### Setup

```bash
git clone https://github.com/S0x007/aws-ops-manager.git
cd aws-ops-manager
npm install
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev mode with HMR |
| `npm run build` | Production build → `out/` |
| `npm run preview` | Preview production build |
| `npm run package:mac` | macOS DMG + ZIP |
| `npm run package:win` | Windows NSIS |
| `npm run package:linux` | AppImage + deb |
| `npm run package:all` | All platforms |

### Project layout

```
src/
├── main/          # Electron main: IPC, AWS services, SSM terminal, encrypted store
├── preload/       # contextBridge API (typed)
└── renderer/      # React + Ant Design UI
```

More detail: **[DEVELOPMENT.md](./DEVELOPMENT.md)** · feature roadmap: **[ROADMAP.md](./ROADMAP.md)**

---

## Architecture

```
Renderer (React)  →  window.electronAPI  →  Main (Node.js)  →  AWS SDK v3
```

- **Security:** `contextIsolation: true`, `nodeIntegration: false` — all AWS calls go through IPC.
- **Multi-account:** every IPC call carries `{ region, profile, source }`.
- **Caching:** list endpoints cached ~5 minutes; cleared on credential/region change; `forceRefresh` on manual refresh.

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Command palette |
| Right-click (EC2 row) | Context menu (SSM, stop, copy ID, …) |

Language toggle: globe icon in the header (**中文 ↔ English**).

---

## Contributing

Issues and PRs are welcome. For large changes, open an issue first to discuss scope.

1. Fork → branch → commit → PR
2. Run `npm run build` before submitting
3. Keep UI strings in `src/renderer/src/i18n/index.ts` (both `zh-CN` and `en-US`)

---

## License

[MIT](./LICENSE)

---

## Acknowledgments

- UI patterns inspired by [Alibaba Cloud Client](https://www.alibabacloud.com/help/en/ecs/user-guide/overview-of-alibaba-cloud-client)
- [Ant Design](https://ant.design/) · [xterm.js](https://xtermjs.org/) · [Zustand](https://github.com/pmndrs/zustand) · [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
