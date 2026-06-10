import { describe, expect, it } from 'vitest'
import {
  findProjectForRegion,
  getRegionDisplayName,
  HUAWEI_REGIONS,
} from '../src/main/providers/huawei-region'

describe('huawei-region', () => {
  it('exports regions from shared manifest', () => {
    expect(HUAWEI_REGIONS.length).toBeGreaterThan(10)
    expect(HUAWEI_REGIONS.some((r) => r.id === 'cn-north-4')).toBe(true)
  })

  it('formats display name with region id', () => {
    expect(getRegionDisplayName('cn-south-1')).toContain('cn-south-1')
    expect(getRegionDisplayName('unknown-region')).toBe('unknown-region')
  })

  it('matches project by exact region id name', () => {
    const projects = [
      { id: 'p1', name: 'cn-north-1', enabled: true },
      { id: 'p10', name: 'cn-north-10', enabled: true },
    ]
    expect(findProjectForRegion(projects, 'cn-north-1')?.id).toBe('p1')
    expect(findProjectForRegion(projects, 'cn-north-10')?.id).toBe('p10')
  })

  it('does not fuzzy-match cn-north-1 to cn-north-10', () => {
    const projects = [{ id: 'p10', name: 'cn-north-10', enabled: true }]
    expect(findProjectForRegion(projects, 'cn-north-1')).toBeUndefined()
  })

  it('matches by chinese region name from manifest', () => {
    const meta = HUAWEI_REGIONS.find((r) => r.id === 'cn-south-1')
    expect(meta).toBeDefined()
    const projects = [{ id: 'p-gz', name: meta!.name, enabled: true }]
    expect(findProjectForRegion(projects, 'cn-south-1')?.id).toBe('p-gz')
  })

  it('matches by project id when name differs', () => {
    const projects = [{ id: 'cn-east-3', name: 'custom-label', enabled: true }]
    expect(findProjectForRegion(projects, 'cn-east-3')?.name).toBe('custom-label')
  })

  it('ignores disabled projects', () => {
    const projects = [{ id: 'p1', name: 'cn-north-4', enabled: false }]
    expect(findProjectForRegion(projects, 'cn-north-4')).toBeUndefined()
  })
})
