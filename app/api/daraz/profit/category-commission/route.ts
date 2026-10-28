import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_OTHER_FEES, OtherFeeItem } from '@/features/sales/utils/daraz-fee-calculator'

// 10-minute in-memory cache for category commissions map
let cachedMap: Map<string, number> | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 10 * 60 * 1000

async function getOrLoadCommissionMap(supabase: any): Promise<Map<string, number>> {
    const now = Date.now()
    if (cachedMap && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedMap
    }

    try {
        const { data, error } = await supabase
            .from('daraz_category_commissions')
            .select('leaf_category, category_path, commission_rate')

        if (error) {
            console.warn('[CategoryCommissionAPI] Failed to load table, using fallback:', error.message)
            return cachedMap || new Map()
        }

        const map = new Map<string, number>()
        ;(data || []).forEach((row: any) => {
            const rate = Number(row.commission_rate)
            if (!isNaN(rate)) {
                if (row.leaf_category) {
                    map.set(row.leaf_category.toLowerCase().trim(), rate)
                }
                if (row.category_path) {
                    const p = row.category_path.toLowerCase().trim()
                    map.set(p, rate)
                    map.set(p.replace(/\s*>\s*/g, ' > '), rate)
                }
            }
        })

        cachedMap = map
        cacheTimestamp = now
        return map
    } catch (err: any) {
        console.error('[CategoryCommissionAPI] Cache load error:', err)
        return cachedMap || new Map()
    }
}

async function getActiveOtherFees(supabase: any): Promise<OtherFeeItem[]> {
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_other_fees')
            .maybeSingle()
        if (data?.value && Array.isArray(data.value)) {
            return data.value
        }
    } catch (err) {
        console.warn('[CategoryCommissionAPI] Failed to get other fees:', err)
    }
    return DEFAULT_OTHER_FEES
}

function matchCommission(map: Map<string, number>, categoryPath?: string | null): number | null {
    if (!categoryPath || !categoryPath.trim()) return null
    const cleaned = categoryPath.trim().toLowerCase()

    // 1. Exact path match
    if (map.has(cleaned)) return map.get(cleaned)!
    const normalized = cleaned.replace(/\s*>\s*/g, ' > ')
    if (map.has(normalized)) return map.get(normalized)!

    // 2. Leaf category match
    const leaf = categoryPath.split('>').pop()?.trim().toLowerCase()
    if (leaf && map.has(leaf)) return map.get(leaf)!

    // 3. Partial / contains search
    if (leaf) {
        for (const [k, rate] of map.entries()) {
            if (k === leaf || k.endsWith(`> ${leaf}`) || leaf.includes(k)) {
                return rate
            }
        }
    }

    return null
}

// GET /api/daraz/profit/category-commission?path=Electronics > Cables
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const path = searchParams.get('path')
        const supabase = await createAdminClient()

        const [map, otherFees] = await Promise.all([
            getOrLoadCommissionMap(supabase),
            getActiveOtherFees(supabase)
        ])

        const rate = matchCommission(map, path)

        return NextResponse.json({
            success: true,
            commissionRate: rate !== null ? rate : 12.0, // fallback average category commission if unmatched
            isMatched: rate !== null,
            otherFees
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST /api/daraz/profit/category-commission
// Body: { paths: string[] } — Batch lookup
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const paths: string[] = Array.isArray(body.paths) ? body.paths : []
        const supabase = await createAdminClient()

        const [map, otherFees] = await Promise.all([
            getOrLoadCommissionMap(supabase),
            getActiveOtherFees(supabase)
        ])

        const commissions: Record<string, number> = {}
        paths.forEach(p => {
            if (p) {
                const rate = matchCommission(map, p)
                if (rate !== null) {
                    commissions[p] = rate
                }
            }
        })

        return NextResponse.json({
            success: true,
            commissions,
            otherFees
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
