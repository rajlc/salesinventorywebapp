import { AsyncLocalStorage } from 'async_hooks'
import type { ListingScope } from '@/lib/daraz/listing-access'

/**
 * Carries the authenticated connector caller's Daraz Listing scope through the whole tool execution,
 * so deep service functions (listDarazStores, resolveTargetStores, draft lookups...) can enforce
 * store permissions without threading a parameter through every function.
 * Stored on globalThis so the route bundle and service bundle share one instance.
 */
const globalKey = '__connectorScopeALS'
const g = globalThis as unknown as Record<string, AsyncLocalStorage<ListingScope> | undefined>

function store(): AsyncLocalStorage<ListingScope> {
    if (!g[globalKey]) g[globalKey] = new AsyncLocalStorage<ListingScope>()
    return g[globalKey]!
}

export function runWithConnectorScope<T>(scope: ListingScope, fn: () => Promise<T>): Promise<T> {
    return store().run(scope, fn)
}

/** Returns the active connector scope, or null when running outside a connector request (e.g. the web UI). */
export function getConnectorScope(): ListingScope | null {
    return store().getStore() ?? null
}

