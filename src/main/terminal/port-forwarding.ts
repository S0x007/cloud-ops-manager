import * as net from 'net'
import { SSMClient, StartSessionCommand, TerminateSessionCommand } from '@aws-sdk/client-ssm'
import WebSocket from 'ws'
import { randomUUID } from 'crypto'
import { clientFactory } from '../aws/client.factory'
import { encodeToken } from './ssm-protocol'

interface PortForwardingOptions {
  instanceId: string
  region: string
  remotePort: number
  localPort: number
  onStatus: (status: string) => void
  onError: (error: string) => void
}

class PortForwardSession {
  private localServer: net.Server | null = null
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private options: PortForwardingOptions
  private activeConnections = 0
  private running = false

  constructor(options: PortForwardingOptions) {
    this.options = options
  }

  async start(): Promise<void> {
    try {
      const client = clientFactory.getClient(SSMClient, { region: this.options.region })

      // 1. Start SSM Port Forwarding Session
      const startCmd = new StartSessionCommand({
        Target: this.options.instanceId,
        DocumentName: 'AWS-StartPortForwardingSession',
        Parameters: {
          portNumber: [String(this.options.remotePort)],
          localPortNumber: [String(this.options.localPort)],
        },
      })
      const response = await client.send(startCmd)

      if (!response.StreamUrl || !response.TokenValue || !response.SessionId) {
        throw new Error('SSM端口转发会话创建失败')
      }

      this.sessionId = response.SessionId

      // 2. 打开 WebSocket
      this.ws = new WebSocket(response.StreamUrl)
      this.ws.on('open', () => {
        this.ws!.send(encodeToken(response.TokenValue!))
      })
      this.ws.on('error', (err) => {
        this.options.onError(`SSM WebSocket错误: ${err.message}`)
      })
      this.ws.on('close', () => {
        this.options.onStatus('SSM连接已关闭')
      })

      // 3. 创建本地 TCP 服务器
      this.localServer = net.createServer((clientSocket) => {
        this.activeConnections++
        this.options.onStatus(
          `转发连接: localhost:${this.options.localPort} -> ${this.options.instanceId}:${this.options.remotePort} (活跃: ${this.activeConnections})`,
        )

        // 通过 WebSocket 隧道转发数据
        clientSocket.on('data', (data) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(data)
          }
        })

        clientSocket.on('close', () => {
          this.activeConnections--
          this.options.onStatus(`连接关闭 (活跃: ${this.activeConnections})`)
        })

        clientSocket.on('error', (err) => {
          this.options.onError(`客户端连接错误: ${err.message}`)
        })
      })

      this.localServer.listen(this.options.localPort, '127.0.0.1', () => {
        this.running = true
        this.options.onStatus(
          `端口转发已启动: localhost:${this.options.localPort} -> ${this.options.instanceId}:${this.options.remotePort}`,
        )
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      this.options.onError(msg)
    }
  }

  async stop(): Promise<void> {
    this.running = false

    // 关闭本地服务器
    if (this.localServer) {
      await new Promise<void>((resolve) => this.localServer!.close(() => resolve()))
      this.localServer = null
    }

    // 关闭WebSocket
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // 终止SSM会话
    if (this.sessionId) {
      try {
        const client = clientFactory.getClient(SSMClient, { region: this.options.region })
        await client.send(new TerminateSessionCommand({ SessionId: this.sessionId }))
      } catch (err) {
        console.error('停止端口转发失败:', err)
      }
    }

    this.options.onStatus('端口转发已停止')
  }
}

export { PortForwardSession }
