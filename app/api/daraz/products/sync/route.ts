import { NextRequest, NextResponse } from 'next/server'
import { syncAllDarazProductsAction } from '@/features/inventory/actions/daraz-sync-products'

export async function POST(request: NextRequest) {
    try {
        const result = await syncAllDarazProductsAction()

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Products Sync API Error:', error.message)
        return NextResponse.json({
            error: 'Failed to sync products',
            details: error.message
        }, { status: 500 })
    }
}
