import { describe, expect, it, vi } from 'vitest'
import {
  executeCloudInvoke,
  resolveCloudAction,
  type CloudRegistry,
} from '../src/main/ipc/cloud-router'
import type { CloudProvider } from '../src/main/providers/types'

function mockRegistry(executeOperation: CloudProvider['executeOperation']): CloudRegistry {
  return {
    get: () => ({ executeOperation } as CloudProvider),
  }
}

describe('resolveCloudAction', () => {
  it('keeps fully qualified action', () => {
    expect(resolveCloudAction({ action: 'ecs:list' })).toBe('ecs:list')
  })

  it('joins service and short action', () => {
    expect(resolveCloudAction({ service: 'ecs', action: 'list' })).toBe('ecs:list')
    expect(resolveCloudAction({ service: 'obs', action: 'listBuckets' })).toBe('obs:listBuckets')
  })

  it('returns bare action when no service', () => {
    expect(resolveCloudAction({ action: 'ping' })).toBe('ping')
  })
})

describe('executeCloudInvoke', () => {
  it('returns success payload from provider', async () => {
    const executeOperation = vi.fn().mockResolvedValue([{ id: 'i-1' }])
    const result = await executeCloudInvoke({
      provider: 'huawei',
      credentialId: 'cred-1',
      region: 'cn-north-4',
      service: 'ecs',
      action: 'list',
      payload: { foo: 'bar' },
    }, mockRegistry(executeOperation))

    expect(result).toEqual({ success: true, data: [{ id: 'i-1' }] })
    expect(executeOperation).toHaveBeenCalledWith(
      'ecs:list',
      'cred-1',
      'cn-north-4',
      { foo: 'bar' },
    )
  })

  it('formats huawei errors for renderer', async () => {
    const executeOperation = vi.fn().mockRejectedValue(
      new Error('REGION_FORBIDDEN:cn-north-1:403 Forbidden'),
    )
    const result = await executeCloudInvoke({
      provider: 'huawei',
      credentialId: 'cred-1',
      region: 'cn-north-1',
      action: 'ecs:list',
    }, mockRegistry(executeOperation))

    expect(result.success).toBe(false)
    expect(result.error).toContain('不可用')
    expect(result.error).toContain('cn-north-1')
  })

  it('passes through raw error for non-huawei providers', async () => {
    const executeOperation = vi.fn().mockRejectedValue(new Error('boom'))
    const result = await executeCloudInvoke({
      provider: 'aws',
      credentialId: 'cred-1',
      region: 'us-east-1',
      action: 'noop',
    }, mockRegistry(executeOperation))

    expect(result).toEqual({ success: false, error: 'boom' })
  })
})
