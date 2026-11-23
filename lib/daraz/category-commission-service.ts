import { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_OTHER_FEES, type OtherFeeItem } from '@/features/sales/utils/daraz-fee-calculator'

// 10-minute in-memory cache for ALL category commissions (paginated past Supabase's 1,000-row limit)
interface CommissionCache {
    exactPathMap: Map<string, number>
    exactLeafMap: Map<string, number>
    loadedAt: number
}

let cachedCommissions: CommissionCache | null = null
const CACHE_TTL_MS = 10 * 60 * 1000
const PAGE_SIZE = 1000

function normalizePath(path: string): string {
    return path
        .trim()
        .toLowerCase()
        .replace(/\s*>\s*/g, ' > ')
        .replace(/\s+/g, ' ')
}

export async function loadAllCategoryCommissions(
    supabase: Awaited<ReturnType<typeof createAdminClient>>
): Promise<CommissionCache> {
    const now = Date.now()
    if (cachedCommissions && now - cachedCommissions.loadedAt < CACHE_TTL_MS) {
        return cachedCommissions
    }

    const exactPathMap = new Map<string, number>()
    const exactLeafMap = new Map<string, number>()

    try {
        let from = 0
        while (true) {
            const { data, error } = await supabase
                .from('daraz_category_commissions')
                .select('leaf_category, category_path, commission_rate')
                .order('id', { ascending: true })
                .range(from, from + PAGE_SIZE - 1)

            if (error) {
                console.warn('[CategoryCommissionService] Load error:', error.message)
                break
            }

            if (!data || data.length === 0) break

            for (const row of data) {
                const rate = Number(row.commission_rate)
                if (Number.isNaN(rate)) continue

                if (row.category_path) {
                    const normPath = normalizePath(String(row.category_path))
                    if (normPath) exactPathMap.set(normPath, rate)
                }
                if (row.leaf_category) {
                    const normLeaf = String(row.leaf_category).trim().toLowerCase()
                    // Keep first exact leaf match (exact path always wins over leaf)
                    if (normLeaf && !exactLeafMap.has(normLeaf)) {
                        exactLeafMap.set(normLeaf, rate)
                    }
                }
            }

            if (data.length < PAGE_SIZE) break
            from += PAGE_SIZE
        }

        if (exactPathMap.size > 0 || exactLeafMap.size > 0) {
            cachedCommissions = {
                exactPathMap,
                exactLeafMap,
                loadedAt: now,
            }
            return cachedCommissions
        }
    } catch (err) {
        console.error('[CategoryCommissionService] Unexpected load error:', err)
    }

    return cachedCommissions || { exactPathMap, exactLeafMap, loadedAt: now }
}

export async function getActiveDarazOtherFees(
    supabase: Awaited<ReturnType<typeof createAdminClient>>
): Promise<OtherFeeItem[]> {
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_other_fees')
            .maybeSingle()

        if (data?.value && Array.isArray(data.value) && data.value.length > 0) {
            return data.value as OtherFeeItem[]
        }
    } catch (err) {
        console.warn('[CategoryCommissionService] Failed to load daraz_other_fees:', err)
    }
    return DEFAULT_OTHER_FEES
}

/**
 * Exact-match category commission lookup:
 * 1. Exact normalized full category_path match (e.g. "sports & outdoors > exercise & fitness > fitness accessories > fitness gloves")
 * 2. Exact leaf category match (e.g. "fitness gloves")
 * 3. Suffix match on full path ending with "> {leaf}"
 * NOTE: Deliberately avoids loose substring `leaf.includes(k)` which caused false matches (e.g. 1.96% Digital Goods).
 */
export function matchExactCategoryCommission(
    cache: CommissionCache,
    categoryPath?: string | null
): number | null {
    if (!categoryPath || !categoryPath.trim()) return null

    const normPath = normalizePath(categoryPath)

    // 1. Exact full category path match
    if (cache.exactPathMap.has(normPath)) {
        return cache.exactPathMap.get(normPath)!
    }

    // 2. Exact leaf category match
    const leaf = normPath.split('>').pop()?.trim() || ''
    if (leaf && cache.exactLeafMap.has(leaf)) {
        return cache.exactLeafMap.get(leaf)!
    }

    // 3. Exact suffix match on full path (e.g. "> fitness gloves")
    if (leaf) {
        const suffix = `> ${leaf}`
        for (const [k, rate] of cache.exactPathMap.entries()) {
            if (k === leaf || k.endsWith(suffix)) {
                return rate
            }
        }
    }

    return null
}

/**
 * Computes the Total Commission (%) shown in /dashboard/settings/daraz-commission:
 *   rawCommissionRate * 1.13 + sum(active percentage otherFees with VAT if apply_vat)
 */
export function calculateTotalCommissionPercent(
    rawCommissionRate: number,
    otherFees: OtherFeeItem[]
): {
    rawCommissionRate: number
    commissionWithVat: number
    otherFeesPct: number
    totalCommissionPercent: number
} {
    const commissionWithVat = rawCommissionRate * 1.13
    const otherFeesPct = (otherFees || [])
        .filter(f => f.is_active && f.type === 'percentage')
        .reduce((sum, f) => sum + (f.apply_vat ? f.rate * 1.13 : f.rate), 0)

    return {
        rawCommissionRate: parseFloat(rawCommissionRate.toFixed(2)),
        commissionWithVat: parseFloat(commissionWithVat.toFixed(2)),
        otherFeesPct: parseFloat(otherFeesPct.toFixed(2)),
        totalCommissionPercent: parseFloat((commissionWithVat + otherFeesPct).toFixed(2)),
    }
}

export async function lookupExactDarazCommission(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    categoryPath?: string | null
) {
    const [cache, otherFees] = await Promise.all([
        loadAllCategoryCommissions(supabase),
        getActiveDarazOtherFees(supabase),
    ])

    const matchedRate = matchExactCategoryCommission(cache, categoryPath)
    const rawRate = matchedRate !== null ? matchedRate : 12.0
    const totals = calculateTotalCommissionPercent(rawRate, otherFees)

    return {
        commissionRate: rawRate,
        isMatched: matchedRate !== null,
        otherFees,
        ...totals,
    }
}
