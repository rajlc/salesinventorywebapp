/**
 * Process-wide In-Memory LRU + TTL Cache (persists across requests via globalThis).
 * Provides 0ms Redis-like read speed for hot queries inside a single deployment
 * with instant prefix-based invalidation on writes.
 */

interface CacheEntry<T = any> {
    value: T
    expiresAt: number
}

const MAX_ENTRIES = 500

const globalForCache = globalThis as unknown as {
    __bagmatiMemoryCache?: Map<string, CacheEntry>
}

function getStore(): Map<string, CacheEntry> {
    if (!globalForCache.__bagmatiMemoryCache) {
        globalForCache.__bagmatiMemoryCache = new Map<string, CacheEntry>()
    }
    return globalForCache.__bagmatiMemoryCache
}

export function getMemoryCache<T>(key: string): T | null {
    const store = getStore()
    const entry = store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
        store.delete(key)
        return null
    }
    return entry.value as T
}

export function setMemoryCache<T>(key: string, value: T, ttlSeconds = 60): void {
    const store = getStore()
    if (store.size >= MAX_ENTRIES && !store.has(key)) {
        const oldestKey = store.keys().next().value
        if (oldestKey) store.delete(oldestKey)
    }
    store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    })
}

export function invalidateMemoryCachePrefix(prefix: string): void {
    const store = getStore()
    for (const k of Array.from(store.keys())) {
        if (k.startsWith(prefix)) {
            store.delete(k)
        }
    }
}

export function clearAllMemoryCache(): void {
    getStore().clear()
}

