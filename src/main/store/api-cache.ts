/**
 * API 响应缓存层
 *
 * - key 格式: `${profile}:${source}:${region}:${channel}`
 * - profile/region 切换时自动清空
 * - 支持 forceRefresh 跳过缓存
 * - 默认 5 分钟 TTL
 */

interface CacheEntry {
  data: unknown
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const DEFAULT_TTL = 5 * 60 * 1000 // 5 分钟

function buildKey(profile: string, source: string, region: string, channel: string): string {
  return `${profile}:${source}:${region}:${channel}`
}

export function getCached<T>(profile: string, source: string, region: string, channel: string): T | null {
  const key = buildKey(profile, source, region, channel)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache(profile: string, source: string, region: string, channel: string, data: unknown): void {
  const key = buildKey(profile, source, region, channel)
  cache.set(key, { data, timestamp: Date.now() })
}

export function clearAllCache(): void {
  cache.clear()
}

export function getCacheSize(): number {
  return cache.size
}
