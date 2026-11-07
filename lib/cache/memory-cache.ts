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
    __bagmatiInFlight?: Map<string, Promise<any>>
}

function getStore(): Map<string, CacheEntry> {
    if (!globalForCache.__bagmatiMemoryCache) {
        globalForCache.__bagmatiMemoryCache = new Map<string, CacheEntry>()
    }
    return globalForCache.__bagmatiMemoryCache
}

function getInFlight(): Map<string, Promise<any>> {
    if (!globalForCache.__bagmatiInFlight) {
        globalForCache.__bagmatiInFlight = new Map<string, Promise<any>>()
    }
    return globalForCache.__bagmatiInFlight
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

export async function withMemoryCache<T>(
    key: string,
    ttlMsOrSec: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const cached = getMemoryCache<T>(key)
    if (cached !== null) {
        return cached
    }

    const inFlight = getInFlight()
    const existing = inFlight.get(key)
    if (existing) {
        return existing as Promise<T>
    }

    const ttlSeconds = ttlMsOrSec >= 1000 ? ttlMsOrSec / 1000 : ttlMsOrSec
    const promise = fetcher()
        .then(res => {
            setMemoryCache(key, res, ttlSeconds)
            inFlight.delete(key)
            return res
        })
        .catch(err => {
            inFlight.delete(key)
            throw err
        })

    inFlight.set(key, promise)
    return promise
}

