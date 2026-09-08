import { NextRequest, NextResponse } from 'next/server'
import { extractCompetitorProduct } from '@/lib/daraz/link-extractor'

// POST /api/daraz/extract-link — Extract product info from Daraz or competitor product link
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const rawUrl = (body.url || '').trim()

        if (!rawUrl) {
            return NextResponse.json({ success: false, error: 'Product URL is required' }, { status: 400 })
        }

        const data = await extractCompetitorProduct(rawUrl)
        return NextResponse.json({
            success: true,
            data
        })
    } catch (err: any) {
        console.error('[ExtractLink] Error extracting product link:', err)
        return NextResponse.json({
            success: false,
            error: `Failed to extract product link: ${err.message}`
        }, { status: 500 })
    }
}
