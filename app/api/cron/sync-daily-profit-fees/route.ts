import { NextRequest, NextResponse } from 'next/server'
import { syncDailyOrdersProfitFees } from '@/features/sales/actions/report-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Allow execution up to 300s if running on supported runtime

async function handleSync(request: NextRequest) {
    const startTime = Date.now()

    // 1. Authorization: check CRON_SECRET if configured
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get('x-cron-secret') || request.headers.get('authorization')
        const querySecret = request.nextUrl.searchParams.get('secret')

        const isAuthorized =
            authHeader === cronSecret ||
            authHeader === `Bearer ${cronSecret}` ||
            querySecret === cronSecret

        if (!isAuthorized) {
            console.warn('[Cron-DailyProfitFees] Unauthorized attempt to trigger daily profit sync')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    try {
        const searchParams = request.nextUrl.searchParams
        const customDate = searchParams.get('date') || undefined
        const includeYesterdayParam = searchParams.get('includeYesterday')
        const includeYesterday = includeYesterdayParam !== null ? includeYesterdayParam !== 'false' : true
        const sellerAccount = searchParams.get('store') || undefined
        const concurrencyParam = searchParams.get('concurrency')
        const concurrency = concurrencyParam ? parseInt(concurrencyParam, 10) : 4

        console.log(`[Cron-DailyProfitFees] Triggered bulk fees sync. Target Date: ${customDate || 'Today (Nepal Time)'}, Include Yesterday: ${includeYesterday}`)

        const result = await syncDailyOrdersProfitFees({
            targetDate: customDate,
            includeYesterday,
            sellerAccount,
            concurrency
        })

        return NextResponse.json({
            ...result,
            triggered_at: new Date().toISOString()
        }, { status: 200 })

    } catch (err: any) {
        console.error('[Cron-DailyProfitFees] Error in automated daily fees sync:', err.message)
        // Return 200 with error details so external cron services (e.g. cron-job.org) don't auto-disable the job
        return NextResponse.json({
            success: false,
            error: err.message,
            elapsed_ms: Date.now() - startTime
        }, { status: 200 })
    }
}

export async function GET(request: NextRequest) {
    return handleSync(request)
}

export async function POST(request: NextRequest) {
    return handleSync(request)
}
