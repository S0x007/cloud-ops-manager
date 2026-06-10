import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

// 本地凭证格式
export interface StoredCredential {
  id: string
  name: string
  accessKeyId: string
  region: string
  description: string
  createdAt: string
  provider?: string                      // 云厂商标识: 'aws' | 'huawei'，缺失时默认 'aws'
  extraFields?: Record<string, string>  // 厂商特有字段（华为云 projectId 等）
}

interface CredentialPayload extends StoredCredential {
  secretAccessKey: string  // AWS SK（加密存储）
}

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16

// 从机器特征派生加密密钥（绑定本机）
function deriveKey(): Buffer {
  const machineId = process.platform + '-' + (process.env.USER || process.env.USERNAME || 'default')
  return scryptSync(machineId, 'aws-ops-manager-salt-' + machineId, KEY_LENGTH)
}

function encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = deriveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = deriveKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

interface StorageFile {
  version: 1
  credentials: Array<{
    id: string
    name: string
    accessKeyId: string
    encryptedSk: string
    iv: string
    tag: string
    region: string
    description: string
    createdAt: string
    provider?: string
    extraFields?: Record<string, string>
  }>
}

function getStorePath(): string {
  const userDataPath = app?.getPath?.('userData') || join(process.env.HOME || '/tmp', '.aws-ops-manager')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }
  return join(userDataPath, 'credentials.json')
}

function readStore(): StorageFile {
  const path = getStorePath()
  if (!existsSync(path)) {
    return { version: 1, credentials: [] }
  }
  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { version: 1, credentials: [] }
  }
}

function writeStore(data: StorageFile): void {
  const path = getStorePath()
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 })
}

// 公开 API

export function listCredentials(): StoredCredential[] {
  const store = readStore()
  return store.credentials.map((c) => ({
    id: c.id,
    name: c.name,
    accessKeyId: c.accessKeyId,
    region: c.region,
    description: c.description,
    createdAt: c.createdAt,
    provider: c.provider || 'aws',
    extraFields: c.extraFields || undefined,
  }))
}

export function getCredentialWithSecret(id: string): CredentialPayload | null {
  const store = readStore()
  const entry = store.credentials.find((c) => c.id === id)
  if (!entry) return null

  const secretAccessKey = decrypt(entry.encryptedSk, entry.iv, entry.tag)
  return {
    id: entry.id,
    name: entry.name,
    accessKeyId: entry.accessKeyId,
    secretAccessKey,
    region: entry.region,
    description: entry.description,
    createdAt: entry.createdAt,
    provider: entry.provider || 'aws',
    extraFields: entry.extraFields || undefined,
  }
}

export function addCredential(data: {
  name: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  description: string
  provider?: string
  extraFields?: Record<string, string>
}): StoredCredential {
  const store = readStore()
  const { encrypted, iv, tag } = encrypt(data.secretAccessKey)

  const entry = {
    id: randomBytes(8).toString('hex'),
    name: data.name,
    accessKeyId: data.accessKeyId,
    encryptedSk: encrypted,
    iv,
    tag,
    region: data.region,
    description: data.description,
    createdAt: new Date().toISOString(),
  }

  // 直接在存储条目上加 provider/extraFields
  const entryWithProvider = { ...entry, provider: data.provider || 'aws', extraFields: data.extraFields || undefined }
  store.credentials.push(entryWithProvider)
  writeStore(store)

  return {
    id: entryWithProvider.id,
    name: entryWithProvider.name,
    accessKeyId: entryWithProvider.accessKeyId,
    region: entryWithProvider.region,
    description: entryWithProvider.description,
    createdAt: entryWithProvider.createdAt,
    provider: entryWithProvider.provider,
    extraFields: entryWithProvider.extraFields,
  }
}

export function updateCredential(
  id: string,
  data: Partial<{
    name: string
    accessKeyId: string
    secretAccessKey: string
    region: string
    description: string
    provider: string
    extraFields: Record<string, string>
  }>,
): StoredCredential | null {
  const store = readStore()
  const entry = store.credentials.find((c) => c.id === id)
  if (!entry) return null

  if (data.name !== undefined) entry.name = data.name
  if (data.accessKeyId !== undefined) entry.accessKeyId = data.accessKeyId
  if (data.region !== undefined) entry.region = data.region
  if (data.description !== undefined) entry.description = data.description
  if (data.provider !== undefined) entry.provider = data.provider
  if (data.extraFields !== undefined) entry.extraFields = data.extraFields

  if (data.secretAccessKey) {
    const { encrypted, iv, tag } = encrypt(data.secretAccessKey)
    entry.encryptedSk = encrypted
    entry.iv = iv
    entry.tag = tag
  }

  writeStore(store)

  return {
    id: entry.id,
    name: entry.name,
    accessKeyId: entry.accessKeyId,
    region: entry.region,
    description: entry.description,
    createdAt: entry.createdAt,
    provider: entry.provider || 'aws',
    extraFields: entry.extraFields || undefined,
  }
}

export function deleteCredential(id: string): boolean {
  const store = readStore()
  const idx = store.credentials.findIndex((c) => c.id === id)
  if (idx === -1) return false

  store.credentials.splice(idx, 1)
  writeStore(store)
  return true
}
