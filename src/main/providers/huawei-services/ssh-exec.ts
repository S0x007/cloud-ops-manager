/**
 * SSH 远程命令执行 — 无需云服务 Agent，通过 SSH 直连 ECS 下发命令
 */
import { Client, ConnectConfig } from 'ssh2'
import type { HuaweiServer } from '../huawei-types'

export interface SshResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

/** 在华为云 ECS 上通过 SSH 执行命令 */
export function sshExec(
  host: string, port: number, username: string,
  auth: { password?: string; privateKey?: string; passphrase?: string },
  command: string, timeoutMs: number,
): Promise<SshResult> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const timer = setTimeout(() => {
      conn.destroy()
      reject(new Error(`SSH 连接超时 (${timeoutMs}ms)`))
    }, timeoutMs)

    let resolved = false
    const done = (result: SshResult | Error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      conn.end()
      if (result instanceof Error) reject(result)
      else resolve(result)
    }

    const config: ConnectConfig = {
      host, port, username, readyTimeout: 10000,
    }
    if (auth.password) config.password = auth.password
    if (auth.privateKey) {
      config.privateKey = auth.privateKey
      if (auth.passphrase) config.passphrase = auth.passphrase
    }

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { done(err); return }
        let stdout = ''
        let stderr = ''
        stream.on('data', (data: Buffer) => { stdout += data.toString() })
        stream.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
        stream.on('close', (exitCode: number | null) => {
          done({ stdout, stderr, exitCode })
        })
      })
    })
    conn.on('error', (err) => { done(err) })
    conn.connect(config)
  })
}

/** 检测 ECS 的 SSH 连通性 */
export function checkSshReachable(
  host: string, port: number,
): Promise<{ reachable: boolean; banner?: string }> {
  return new Promise((resolve) => {
    const conn = new Client()
    const timer = setTimeout(() => { conn.destroy(); resolve({ reachable: false }) }, 5000)
    conn.on('ready', () => {
      clearTimeout(timer)
      resolve({ reachable: true, banner: (conn as any)._sock?.remoteAddress })
      conn.end()
    })
    conn.on('error', () => { clearTimeout(timer); resolve({ reachable: false }) })
    conn.connect({ host, port, username: 'root', readyTimeout: 4000 })
  })
}
