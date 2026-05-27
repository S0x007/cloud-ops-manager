import { randomUUID } from 'crypto'

/**
 * SSM Session Manager WebSocket 消息协议
 * 直接实现 AWS SSM 的 WebSocket 通信协议，无外部依赖
 */

export interface SsmMessage {
  MessageSchemaVersion: string
  RequestId: string
  Type: 'session_token' | 'input_stream_data' | 'output_stream_data' | 'size' | 'session_ready' | 'session_terminated' | 'error'
  Payload: string // Base64 编码
}

export function encodeToken(token: string): string {
  const msg: SsmMessage = {
    MessageSchemaVersion: '1.0',
    RequestId: randomUUID(),
    Type: 'session_token',
    Payload: Buffer.from(token).toString('base64'),
  }
  return JSON.stringify(msg)
}

export function encodeInput(data: string): string {
  const msg: SsmMessage = {
    MessageSchemaVersion: '1.0',
    RequestId: randomUUID(),
    Type: 'input_stream_data',
    Payload: Buffer.from(data).toString('base64'),
  }
  return JSON.stringify(msg)
}

export function encodeResize(cols: number, rows: number): string {
  const msg: SsmMessage = {
    MessageSchemaVersion: '1.0',
    RequestId: randomUUID(),
    Type: 'size',
    Payload: Buffer.from(JSON.stringify({ cols, rows })).toString('base64'),
  }
  return JSON.stringify(msg)
}

export function decodeOutput(raw: string): { type: string; payload: string } | null {
  try {
    const msg: SsmMessage = JSON.parse(raw)
    if (msg.Type === 'output_stream_data') {
      return {
        type: 'output',
        payload: Buffer.from(msg.Payload, 'base64').toString('utf-8'),
      }
    }
    if (msg.Type === 'session_terminated') {
      return { type: 'terminated', payload: '' }
    }
    if (msg.Type === 'error') {
      return { type: 'error', payload: Buffer.from(msg.Payload, 'base64').toString('utf-8') }
    }
    if (msg.Type === 'session_ready') {
      return { type: 'ready', payload: '' }
    }
    return null // 忽略 keepalive 等其他类型
  } catch {
    return null
  }
}
