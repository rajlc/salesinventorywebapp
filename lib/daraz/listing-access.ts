import { createHmac, timingSafeEqual } from 'crypto'
import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { withMemoryCache } from '@/lib/cache/memory-cache'

/**
 * Daraz Listing access control.
 *
 * Staff permission model (table `user_permissions`):
 *   main_page_role = "Daraz Listing"
 *   sub_page_role  = "All"  -> every store (and any store added later)
 *                  = "<seller_account name>" -> one specific store (one row per store)
 *
 * Stores are always resolved from the live `online_stores` table, so:
 *   - a newly added store is available for permission immediately
 *   - a deleted/deactivated store silently drops out of every staff scope
 */

export const LISTING_MAIN_ROLE = 'Daraz Listing'

export type ListingAccessKind =
    | 'admin'    // role = admin, no restriction
    | 'listing'  // has "Daraz Listing" permission -> restricted to allowed stores
    | 'legacy'   // no "Daraz Listing" rows but has Inventory permission (unchanged behaviour)
    | 'none'     // authenticated, but no listing/inventory permission (unchanged behaviour)

export interface ListingScope {
    userId: string | null
    kind: ListingAccessKind
    /** true only for kind === 'listing' */
    restricted: boolean
    canEdit: boolean
    allowAllStores: boolean
    allowedStoreIds: string[]
    allowedStoreNames: string[]
}

const norm = (s: string | null | undefined) => (s || '').toLowerCase().trim().replace(/[-_]/g, ' ')

export const EMPTY_SCOPE: ListingScope = {
    userId: null,
    kind: 'none',
    restricted: false,
    canEdit: false,
    allowAllStores: false,
    allowedStoreIds: [],
    allowedStoreNames: []
}

export async function resolveListingScope(userId: string): Promise<ListingScope> {
    return withMemoryCache(`listing_scope:${userId}`, 15_000, async () => {
        const admin = await createAdminClient()
        const [profileRes, permsRes, storesRes] = await Promise.all([
            admin.from('user_profiles').select('role, status').eq('id', userId).maybeSingle(),
            admin.from('user_permissions').select('main_page_role, sub_page_role, permission_type').eq('user_id', userId),
            admin.from('online_stores').select('id, seller_account').eq('is_active', true)
        ])

        const role = profileRes.data?.role || null
        const status = profileRes.data?.status || null
        const stores = (storesRes.data || []) as { id: string; seller_account: string }[]
        const perms = (permsRes.data || []) as { main_page_role: string | null; sub_page_role: string | null; permission_type: string }[]

        // Disabled / pending staff get nothing (admins are never gated by status here)
        if (role !== 'admin' && status && status !== 'active') {
            return { ...EMPTY_SCOPE, userId }
        }

        if (role === 'admin') {
            return {
                userId,
                kind: 'admin',
                restricted: false,
                canEdit: true,
                allowAllStores: true,
                allowedStoreIds: stores.map(s => s.id),
                allowedStoreNames: stores.map(s => s.seller_account)
            } as ListingScope
        }

        const listingRows = perms.filter(p => norm(p.main_page_role) === norm(LISTING_MAIN_ROLE))

        if (listingRows.length === 0) {
            const hasInventory = perms.some(p => norm(p.main_page_role).includes('inventory'))
            return {
                userId,
                kind: hasInventory ? 'legacy' : 'none',
                restricted: false,
                canEdit: true,
                allowAllStores: true,
                allowedStoreIds: stores.map(s => s.id),
                allowedStoreNames: stores.map(s => s.seller_account)
            } as ListingScope
        }

        const allowAll = listingRows.some(p => {
            const sub = norm(p.sub_page_role)
            return !sub || sub === 'all' || sub === 'all stores' || sub === 'all pages' || sub === norm(LISTING_MAIN_ROLE)
        })

        const wantedNames = new Set(listingRows.map(p => norm(p.sub_page_role)).filter(Boolean))
        const allowedStores = allowAll
            ? stores
            : stores.filter(s => wantedNames.has(norm(s.seller_account)))

        const canEdit = role === 'editor' || listingRows.some(p => p.permission_type === 'edit' || p.permission_type === 'all')

        return {
            userId,
            kind: 'listing',
            restricted: true,
            canEdit,
            allowAllStores: allowAll,
            allowedStoreIds: allowedStores.map(s => s.id),
            allowedStoreNames: allowedStores.map(s => s.seller_account)
        } as ListingScope
    })
}

/**
 * Internal server-to-server calls (the connector invoking /api/daraz/products/create) carry no browser cookie.
 * They pass the already-authenticated staff user id plus an HMAC signature that only this server can produce.
 */
const INTERNAL_USER_HEADER = 'x-internal-user-id'
const INTERNAL_SIG_HEADER = 'x-internal-user-sig'

function internalSecret(): string {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export function signInternalUser(userId: string): Record<string, string> {
    const sig = createHmac('sha256', internalSecret()).update(`listing-internal:${userId}`).digest('hex')
    return { [INTERNAL_USER_HEADER]: userId, [INTERNAL_SIG_HEADER]: sig }
}

async function getInternalUserId(): Promise<string | null> {
    try {
        const h = await headers()
        const uid = h.get(INTERNAL_USER_HEADER)
        const sig = h.get(INTERNAL_SIG_HEADER)
        if (!uid || !sig || !internalSecret()) return null
        const expected = createHmac('sha256', internalSecret()).update(`listing-internal:${uid}`).digest('hex')
        const a = Buffer.from(sig)
        const b = Buffer.from(expected)
        if (a.length !== b.length || !timingSafeEqual(a, b)) return null
        return uid
    } catch {
        return null
    }
}

/** Scope of the currently signed-in web user (cookie session) or a signed internal call. userId is null when not signed in. */
export async function getRequestListingScope(): Promise<ListingScope> {
    try {
        const internalUserId = await getInternalUserId()
        if (internalUserId === '__master__') {
            // Legacy server-wide connector key: unrestricted (owner/admin)
            return { userId: '__master__', kind: 'admin', restricted: false, canEdit: true, allowAllStores: true, allowedStoreIds: [], allowedStoreNames: [] }
        }
        if (internalUserId) return await resolveListingScope(internalUserId)

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return EMPTY_SCOPE
        return await resolveListingScope(user.id)
    } catch {
        return EMPTY_SCOPE
    }
}


export function isDraftVisible(scope: ListingScope, draft: { target_stores?: any; created_by?: string | null; attributes?: any }): boolean {
    if (!scope.restricted) return true
    const targets: string[] = Array.isArray(draft?.target_stores) ? draft.target_stores : []
    const creator = draft?.created_by || draft?.attributes?.created_by || null
    if (targets.length === 0) {
        return !!scope.userId && !!creator && creator === scope.userId
    }
    const allowed = new Set(scope.allowedStoreIds)
    return targets.some(id => allowed.has(id))
}

export function filterVisibleDrafts<T extends { target_stores?: any; created_by?: string | null; attributes?: any }>(scope: ListingScope, drafts: T[]): T[] {
    if (!scope.restricted) return drafts
    return drafts.filter(d => isDraftVisible(scope, d))
}

export function filterStoresForScope<T extends { id: string }>(scope: ListingScope, stores: T[]): T[] {
    if (!scope.restricted) return stores
    const allowed = new Set(scope.allowedStoreIds)
    return stores.filter(s => allowed.has(s.id))
}

/** True when every store id is inside the scope (always true for unrestricted users). */
export function storesAllowed(scope: ListingScope, storeIds: string[]): boolean {
    if (!scope.restricted) return true
    const allowed = new Set(scope.allowedStoreIds)
    return storeIds.every(id => allowed.has(id))
}

export function sellerAccountAllowed(scope: ListingScope, sellerAccount: string): boolean {
    if (!scope.restricted) return true
    const target = norm(sellerAccount)
    return scope.allowedStoreNames.some(n => norm(n) === target)
}

/**
 * Computes the new target_stores for a restricted user's write.
 * Stores outside the user's scope that are already on the draft are preserved untouched;
 * the user can only add/remove stores inside their scope.
 */
export function mergeTargetStoresForScope(scope: ListingScope, existing: string[] | undefined | null, provided: string[] | undefined | null): string[] {
    const provide = Array.isArray(provided) ? provided : []
    if (!scope.restricted) return provide
    const allowed = new Set(scope.allowedStoreIds)
    const outside = (Array.isArray(existing) ? existing : []).filter(id => !allowed.has(id))
    const inside = provide.filter(id => allowed.has(id))
    return Array.from(new Set([...outside, ...inside]))
}

export class ListingAccessError extends Error {
    status: number
    constructor(message: string, status = 403) {
        super(message)
        this.status = status
    }
}
