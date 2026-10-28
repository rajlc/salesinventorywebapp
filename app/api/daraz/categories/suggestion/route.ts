import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { createAdminClient } from '@/lib/supabase/server'
import { getValidAccessToken, buildSignedParams, API_URL } from '@/lib/daraz/client'
import { searchDarazCategories, type DarazCategoryLeaf } from '@/lib/daraz/category-service'

/**
 * Category suggestions from a product title — NO AI involved.
 *
 *  1. Try Daraz's own suggestion endpoint (Seller Center source). On the Nepal
 *     gateway this currently answers "InvalidApiPath", so after one failure we
 *     skip it for an hour to keep requests fast. If Daraz ever enables it, it
 *     is picked up automatically.
 *  2. Otherwise rank the real Daraz leaf categories (cached tree, in-memory)
 *     against the title and each "|" / "," segment of it.
 */

let darazSuggestDisabledUntil = 0

async function tryDarazSuggestion(productName: string): Promise<Array<{ id: number; path: string }>> {
    if (Date.now() < darazSuggestDisabledUntil) return []
    try {
        const supabase = await createAdminClient()
        const { data: stores } = await supabase.from('online_stores').select('id').eq('is_active', true).limit(1)
        if (!stores?.length) return []
        const accessToken = await getValidAccessToken(stores[0].id, 'order')
        const params = buildSignedParams('/product/category/suggestion/get', accessToken, { product_name: productName })
        const res = await axios.get(`${API_URL}/product/category/suggestion/get`, { params, timeout: 4000 })
        if (res.data?.code === 'InvalidApiPath') {
            darazSuggestDisabledUntil = Date.now() + 60 * 60 * 1000
            return []
        }
        const list = res.data?.data?.categorySuggestions || []
        return list
            .map((s: any) => ({ id: Number(s.categoryId), path: String(s.categoryPath || s.categoryName || '') }))
            .filter((s: any) => s.id)
    } catch {
        darazSuggestDisabledUntil = Date.now() + 10 * 60 * 1000
        return []
    }
}

export async function GET(request: NextRequest) {
    try {
        const productName = new URL(request.url).searchParams.get('productName')?.trim()
        if (!productName || productName.startsWith('[Image Only]') || productName.length < 2) {
            return NextResponse.json({ success: true, source: 'none', suggestions: [], paths: [] })
        }

        const fromDaraz = await tryDarazSuggestion(productName)
        if (fromDaraz.length > 0) {
            return NextResponse.json({ success: true, source: 'daraz', suggestions: fromDaraz.slice(0, 4), paths: [] })
        }

        const segments = productName
            .split(/[|,\/]/)
            .map(s => s.trim())
            .filter(s => s.length > 2)

        const queries = segments.length > 1 ? [productName, ...segments] : [productName]
        const results = await Promise.all(queries.map(q => searchDarazCategories(q, 6)))

        // Score candidates across all queries/segments
        const candidateMap = new Map<number, { leaf: DarazCategoryLeaf; score: number }>()
        for (let qIdx = 0; qIdx < queries.length; qIdx++) {
            const list = results[qIdx]
            for (let rank = 0; rank < list.length; rank++) {
                const item = list[rank]
                const rankMultiplier = Math.max(0.4, 1 - rank * 0.15)
                const candidateScore = item.score * rankMultiplier
                const existing = candidateMap.get(item.id)
                if (!existing) {
                    candidateMap.set(item.id, { leaf: item, score: candidateScore })
                } else {
                    existing.score = Math.max(existing.score, candidateScore) + candidateScore * 0.35
                }
            }
        }

        const sortedCandidates = Array.from(candidateMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .map(c => ({ id: c.leaf.id, path: c.leaf.path }))

        return NextResponse.json({
            success: true,
            source: 'matched',
            suggestions: sortedCandidates,
            paths: [],
        })
    } catch (error: any) {
        console.error('[DarazCategorySuggestion] Error:', error.message)
        return NextResponse.json({ success: true, source: 'none', suggestions: [], paths: [] })
    }
}
