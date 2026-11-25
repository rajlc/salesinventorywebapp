import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLiveNetWorth } from '@/features/transaction/actions/networth-actions'
import { getCourierSettlementData, getDarazSettlementData } from '@/features/transaction/actions/settlement-actions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        // Verify authenticated user (cookie or Bearer token from mobile app)
        const supabase = await createClient()
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

        const { data: { user } } = token
            ? await supabase.auth.getUser(token)
            : await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const [netWorth, daraz, courier] = await Promise.all([
            getLiveNetWorth(),
            getDarazSettlementData(),
            getCourierSettlementData(),
        ])

        return NextResponse.json({
            netWorth,
            daraz: {
                weeklyRows: daraz.weeklyRows,
                totalShippedCost: daraz.totalShippedCost,
                totalExpectedDelivered: daraz.totalExpectedDelivered,
            },
            courier: {
                couriers: courier.couriers,
                totalShippedCost: courier.totalShippedCost,
                totalExpectedCod: courier.totalExpectedCod,
            },
        })
    } catch (err: any) {
        console.error('[API /api/transaction/live-summary] Error:', err)
        return NextResponse.json({ error: err?.message || 'Failed to compute live summary' }, { status: 500 })
    }
}
