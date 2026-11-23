import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
    loadAllCategoryCommissions,
    getActiveDarazOtherFees,
    matchExactCategoryCommission,
    calculateTotalCommissionPercent,
} from '@/lib/daraz/category-commission-service'

// GET /api/daraz/profit/category-commission?path=Sports & Outdoors > ... > Fitness Gloves
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const path = searchParams.get('path')
        const supabase = await createAdminClient()

        const [cache, otherFees] = await Promise.all([
            loadAllCategoryCommissions(supabase),
            getActiveDarazOtherFees(supabase),
        ])

        const matchedRate = matchExactCategoryCommission(cache, path)
        const rawRate = matchedRate !== null ? matchedRate : 12.0
        const totals = calculateTotalCommissionPercent(rawRate, otherFees)

        return NextResponse.json({
            success: true,
            commissionRate: rawRate,
            totalCommissionPercent: totals.totalCommissionPercent,
            commissionWithVat: totals.commissionWithVat,
            otherFeesPct: totals.otherFeesPct,
            isMatched: matchedRate !== null,
            otherFees,
        })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch commission'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// POST /api/daraz/profit/category-commission
// Body: { paths: string[] } — Batch lookup
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const paths: string[] = Array.isArray(body.paths) ? body.paths : []
        const supabase = await createAdminClient()

        const [cache, otherFees] = await Promise.all([
            loadAllCategoryCommissions(supabase),
            getActiveDarazOtherFees(supabase),
        ])

        const commissions: Record<string, number> = {}
        const totalCommissions: Record<string, number> = {}

        for (const p of paths) {
            if (!p) continue
            const matchedRate = matchExactCategoryCommission(cache, p)
            const rawRate = matchedRate !== null ? matchedRate : 12.0
            commissions[p] = rawRate
            totalCommissions[p] = calculateTotalCommissionPercent(rawRate, otherFees).totalCommissionPercent
        }

        return NextResponse.json({
            success: true,
            commissions,
            totalCommissions,
            otherFees,
        })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to batch fetch commissions'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
