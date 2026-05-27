import WebSocket from 'ws'
import { SSMClient, StartSessionCommand, TerminateSessionCommand } from '@aws-sdk/client-ssm'
import { randomUUID } from 'crypto'
import { clientFactory } from '../aws/client.factory'
import { encodeToken, encodeInput, encodeResize, decodeOutput } from './ssm-protocol'

export interface SsmSessionOptions {
  instanceId: string
  region: string
  onOutput: (data: string) => void
  onError: (error: string) => void
  onEnd: () => void
}

export class SsmSession {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private options: SsmSessionOptions
  private keepaliveTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private closed = false

  constructor(options: SsmSessionOptions) {
    this.options = options
  }

  async start(): Promise<void> {
    try {
      const client = clientFactory.getClient(SSMClient, { region: this.options.region })

      // 1. 创建 SSM Session
      const startCmd = new StartSessionCommand({
        Target: this.options.instanceId,
        DocumentName: 'SSM-SessionManagerRunShell',
        Parameters: {},
      })
      const response = await client.send(startCmd)

      if (!response.StreamUrl || !response.TokenValue || !response.SessionId) {
        throw new Error('SSM StartSession 返回了无效的响应')
      }

      this.sessionId = response.SessionId

      // 2. 打开 WebSocket 连接
      this.ws = new WebSocket(response.StreamUrl)

      this.ws.on('open', () => {
        // 发送 token 进行认证
        this.ws!.send(encodeToken(response.TokenValue!))
        this.startKeepalive()
      })

      this.ws.on('message', (data: Buffer) => {
        const decoded = decodeOutput(data.toString())
        if (decoded) {
          if (decoded.type === 'output') {
            this.options.onOutput(decoded.payload)
          } else if (decoded.type === 'terminated') {
            this.cleanup()
            this.options.onEnd()
          } else if (decoded.type === 'error') {
            this.options.onError(decoded.payload)
          }
          // 'ready' 类型不需要特别处理
        }
      })

      this.ws.on('error', (err) => {
        console.error('SSM WebSocket error:', err.message)
        this.options.onError(`SSM 连接错误: ${err.message}`)
        this.attemptReconnect()
      })

      this.ws.on('close', (code) => {
        console.log(`SSM WebSocket closed: ${code}`)
        if (!this.closed) {
          this.attemptReconnect()
        }
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      this.options.onError(msg)
    }
  }

  sendData(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeInput(data))
    }
  }

  resize(cols: number, rows: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeResize(cols, rows))
    }
  }

  async close(): Promise<void> {
    this.closed = true
    this.cleanup()

    if (this.sessionId) {
      try {
        const client = clientFactory.getClient(SSMClient, { region: this.options.region })
        await client.send(new TerminateSessionCommand({ SessionId: this.sessionId }))
      } catch (err) {
        console.error('TerminateSession error:', err)
      }
    }

    this.options.onEnd()
  }

  private startKeepalive(): void {
    this.keepaliveTimer = setInterval(() => {
      // 发送空字节 keepalive 消息
      this.sendData('\x00')
    }, 240000) // 每 4 分钟发一次 keepalive
  }

  private cleanup(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.options.onError('SSM 连接断开，已达最大重连次数')
      this.options.onEnd()
      return
    }

    this.reconnectAttempts++
    this.cleanup()

    // 指数退避重连
    const delay = Math.pow(2, this.reconnectAttempts) * 1000
    console.log(`SSM reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      if (!this.closed) {
        this.start()
      }
    }, delay)
  }
}
