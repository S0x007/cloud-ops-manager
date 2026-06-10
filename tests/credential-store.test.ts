import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const testState = { userData: '' }

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.userData,
  },
}))

import {
  addCredential,
  deleteCredential,
  getCredentialWithSecret,
  listCredentials,
  updateCredential,
} from '../src/main/store/credential-store'

describe('credential-store', () => {
  beforeEach(() => {
    testState.userData = mkdtempSync(join(tmpdir(), 'com-cred-test-'))
  })

  afterEach(() => {
    if (testState.userData) {
      rmSync(testState.userData, { recursive: true, force: true })
    }
  })

  it('adds credential with encrypted secret and default provider aws', () => {
    const stored = addCredential({
      name: 'test-aws',
      accessKeyId: 'AKIA123',
      secretAccessKey: 'super-secret',
      region: 'us-east-1',
      description: 'unit test',
    })

    expect(stored.provider).toBe('aws')
    expect(stored.accessKeyId).toBe('AKIA123')

    const listed = listCredentials()
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(stored.id)
    expect(listed[0]).not.toHaveProperty('secretAccessKey')

    const withSecret = getCredentialWithSecret(stored.id)
    expect(withSecret?.secretAccessKey).toBe('super-secret')
  })

  it('persists huawei provider and extraFields', () => {
    const stored = addCredential({
      name: 'test-hw',
      accessKeyId: 'HWAK',
      secretAccessKey: 'hw-secret',
      region: 'cn-north-4',
      description: '',
      provider: 'huawei',
      extraFields: { projectId: 'proj-1' },
    })

    expect(stored.provider).toBe('huawei')
    expect(stored.extraFields).toEqual({ projectId: 'proj-1' })

    const reloaded = getCredentialWithSecret(stored.id)
    expect(reloaded?.provider).toBe('huawei')
    expect(reloaded?.extraFields).toEqual({ projectId: 'proj-1' })
  })

  it('updates fields and re-encrypts secret when changed', () => {
    const stored = addCredential({
      name: 'orig',
      accessKeyId: 'AK',
      secretAccessKey: 'old-secret',
      region: 'us-west-2',
      description: 'd',
    })

    const updated = updateCredential(stored.id, {
      name: 'renamed',
      secretAccessKey: 'new-secret',
      region: 'eu-west-1',
    })

    expect(updated?.name).toBe('renamed')
    expect(updated?.region).toBe('eu-west-1')
    expect(getCredentialWithSecret(stored.id)?.secretAccessKey).toBe('new-secret')
  })

  it('deletes credential by id', () => {
    const stored = addCredential({
      name: 'del-me',
      accessKeyId: 'AK',
      secretAccessKey: 's',
      region: 'us-east-1',
      description: '',
    })

    expect(deleteCredential(stored.id)).toBe(true)
    expect(listCredentials()).toHaveLength(0)
    expect(getCredentialWithSecret(stored.id)).toBeNull()
    expect(deleteCredential('missing')).toBe(false)
  })
})
