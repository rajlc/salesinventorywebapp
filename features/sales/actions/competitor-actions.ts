'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import axios from 'axios'

export interface CompetitorItem {
    id?: string
    product_id: string
    competitor_index: number // 1, 2, 3, or 4
    competitor_url: string
    title?: string | null
    current_price?: number | null
    price_display?: string | null
    previous_price?: number | null
    price_changed_at?: string | null
    total_sold?: number
    review_count?: number
    added_at?: string
    updated_at?: string
    is_price_updated_7d?: boolean
    sold_1d?: number
    sold_7d?: number
    sold_30d?: number
    sold_180d?: number
    price_history?: { date: string; price: number; old_price: number | null }[]
}

export interface ExtractResult {
    success: boolean
    price: number | null
    price_display?: string | null
    total_sold: number
    review_count: number
    title: string | null
    error?: string
}

/**
 * Parses and extracts live product data (Price, Total Sold, Reviews, Title) from a Daraz URL.
 * Combines high-speed URL query-parameter regex extraction with server-side HTML scraping.
 */
export async function extractDarazCompetitorInfo(url: string): Promise<ExtractResult> {
    if (!url || !url.trim().startsWith('http')) {
        return { success: false, price: null, total_sold: 0, review_count: 0, title: null, error: 'Invalid URL' }
    }

    const cleanUrl = url.trim()

    // 1. Instant extraction via URL parameter inspection
    let extractedPrice: number | null = null
    let extractedSold: number = 0
    let extractedReviews: number = 0
    let extractedTitle: string | null = null

    // 1. Daraz Catalog API Extraction (100% accurate live special promotional prices & variation prices)
    const itemIdMatch = cleanUrl.match(/-i(\d+)/i) || cleanUrl.match(/[?&]item_?id=(\d+)/i)
    const skuIdMatch = cleanUrl.match(/-s(\d+)\.html/i) || cleanUrl.match(/[?&]sku_?id=(\d+)/i)

    const itemId = itemIdMatch ? itemIdMatch[1] : null
    const skuId = skuIdMatch ? skuIdMatch[1] : null
    const targetId = skuId || itemId

    if (targetId) {
        try {
            const catalogUrl = `https://www.daraz.com.np/catalog/?q=${targetId}&ajax=true`
            const res = await axios.get(catalogUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 6000
            })

            const listItems = res.data?.mods?.listItems || []
            if (listItems.length > 0) {
                const item = listItems[0]
                if (item.price != null) {
                    const parsed = parseFloat(String(item.price).replace(/,/g, ''))
                    if (!isNaN(parsed) && parsed > 0) extractedPrice = parsed
                }
                if (item.review != null) {
                    const parsed = parseInt(String(item.review), 10)
                    if (!isNaN(parsed) && parsed >= 0) extractedReviews = parsed
                }
                if (item.totalSold != null || item.sales != null) {
                    const parsed = parseInt(String(item.totalSold || item.sales), 10)
                    if (!isNaN(parsed) && parsed >= 0) extractedSold = parsed
                }
                if (item.name) {
                    extractedTitle = item.name.trim()
                }
            }
        } catch (catErr) {
            // Fallthrough to URL params and HTML scraper
        }
    }

    // 2. Instant extraction via URL parameter inspection fallback
    try {
        const urlObj = new URL(cleanUrl)
        const searchParams = urlObj.searchParams

        // Extract Price from params if available
        if (!extractedPrice && searchParams.has('price')) {
            const parsed = parseFloat(searchParams.get('price') || '')
            if (!isNaN(parsed) && parsed > 0) extractedPrice = parsed
        }
        // clickTrackInfo param (handles double encoding %253A or single %3A or :)
        if (!extractedPrice && searchParams.has('clickTrackInfo')) {
            const track1 = decodeURIComponent(searchParams.get('clickTrackInfo') || '')
            const track2 = decodeURIComponent(track1)
            const matchPrice = track2.match(/price[:%3A]+(\d+)/i) || track1.match(/price[:%3A]+(\d+)/i)
            if (matchPrice && matchPrice[1]) {
                const val = parseFloat(matchPrice[1])
                if (!isNaN(val) && val > 0) extractedPrice = val
            }
        }

        // priceCompare param
        if (!extractedPrice && searchParams.has('priceCompare')) {
            const track1 = decodeURIComponent(searchParams.get('priceCompare') || '')
            const track2 = decodeURIComponent(track1)
            const matchDisplay = track2.match(/displayPrice[:%3A]+(\d+)/i) || track1.match(/displayPrice[:%3A]+(\d+)/i)
            if (matchDisplay && matchDisplay[1]) {
                const val = parseFloat(matchDisplay[1]) / 100 // Convert paisa to NPR
                if (!isNaN(val) && val > 0) extractedPrice = val
            }
        }

        // Extract Sold count from params
        if (extractedSold === 0 && searchParams.has('sale')) {
            const parsed = parseInt(searchParams.get('sale') || '', 10)
            if (!isNaN(parsed) && parsed >= 0) extractedSold = parsed
        }

        // Extract Review count from params
        if (extractedReviews === 0 && searchParams.has('review')) {
            const parsed = parseInt(searchParams.get('review') || '', 10)
            if (!isNaN(parsed) && parsed >= 0) extractedReviews = parsed
        }

        // Extract title snippet from URL pathname
        if (!extractedTitle) {
            const pathSegments = urlObj.pathname.split('/').filter(Boolean)
            const prodSegment = pathSegments.find(s => s.includes('-i') || s.endsWith('.html'))
            if (prodSegment) {
                const cleanTitleSlug = prodSegment.replace(/-i\d+.*/, '').replace(/\.html$/, '').replace(/-/g, ' ')
                if (cleanTitleSlug.length > 2) {
                    extractedTitle = cleanTitleSlug.charAt(0).toUpperCase() + cleanTitleSlug.slice(1)
                }
            }
        }
    } catch (err) {
        // Fallthrough to scraper
    }

    // 2. Server HTML Scraper (Required if price or sales count missing from URL params)
    if (!extractedPrice || extractedSold === 0 || !extractedTitle) {
        try {
            const response = await axios.get(cleanUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 8000
            })

            const html = response.data

            // Price Extraction Hierarchy:
            if (!extractedPrice && typeof html === 'string') {
                // Priority A: pdpTrackingData pdt_price (Exact price for the specific SKU variation in URL)
                const trackingMatch = html.match(/pdpTrackingData\s*=\s*"([\s\S]*?)";\s*\n/i) || html.match(/var\s+pdpTrackingData\s*=\s*("[\s\S]*?");/i)
                if (trackingMatch) {
                    const rawTrack = trackingMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
                    try {
                        const trackObj = JSON.parse(rawTrack)
                        if (trackObj.pdt_price) {
                            const cleanPriceStr = String(trackObj.pdt_price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()
                            const p = parseFloat(cleanPriceStr)
                            if (!isNaN(p) && p > 0) extractedPrice = p
                        }
                        if (trackObj.pdt_name && !extractedTitle) {
                            extractedTitle = String(trackObj.pdt_name).trim()
                        }
                    } catch (e) {}
                }

                // Priority B: Check discount badge pattern (e.g. Rs. 499 -67%)
                if (!extractedPrice) {
                    const discountBadgeMatch = html.match(/Rs\.\s*([\d,]+)\s*-\d+%/i) || html.match(/Rs\.\s*([\d,]+)[^<]*-\d+%/i)
                    if (discountBadgeMatch && discountBadgeMatch[1]) {
                        const parsed = parseFloat(discountBadgeMatch[1].replace(/,/g, ''))
                        if (!isNaN(parsed) && parsed > 0) extractedPrice = parsed
                    }
                }

                // Priority C: Collect all Rs. prices and choose the minimum
                if (!extractedPrice) {
                    const allRsPrices: number[] = []
                    const rsRegex = /Rs\.\s*([\d,]+)/gi
                    let match: RegExpExecArray | null
                    while ((match = rsRegex.exec(html)) !== null) {
                        const val = parseFloat(match[1].replace(/,/g, ''))
                        if (!isNaN(val) && val > 10 && val < 500000) {
                            allRsPrices.push(val)
                        }
                    }

                    if (allRsPrices.length > 0) {
                        extractedPrice = Math.min(...allRsPrices)
                    }
                }
            }

            // Sales Count from HTML JSON
            if (extractedSold === 0) {
                const salesMatch = html.match(/"salesCount":\s*(\d+)/i) ||
                                   html.match(/"totalSold":\s*(\d+)/i) ||
                                   html.match(/(\d+)\s*sold/i)
                if (salesMatch && salesMatch[1]) {
                    const parsed = parseInt(salesMatch[1], 10)
                    if (!isNaN(parsed)) extractedSold = parsed
                }
            }

            // Title from HTML (pdt_name or document title)
            if (!extractedTitle) {
                const titleMatch = html.match(/"pdt_name"\s*:\s*"([^"]+)"/i) ||
                                   html.match(/<title>([^<]+)<\/title>/i)
                if (titleMatch && titleMatch[1]) {
                    extractedTitle = titleMatch[1].split('|')[0].split('-')[0].trim()
                }
            }
        } catch (scrapeErr) {
            console.error('[extractDarazCompetitorInfo] HTML fetch failed:', scrapeErr)
        }
    }

    // 3. Multi-variation price range calculation (e.g. "Rs 371 / Rs 449")
    let extractedPriceDisplay: string | null = null
    try {
        const resHtml = await axios.get(cleanUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 8000
        })
        const html = resHtml.data
        if (typeof html === 'string') {
            const moduleDataMatch = html.match(/var\s+__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                                    html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i)

            if (moduleDataMatch) {
                const mData = JSON.parse(moduleDataMatch[1])
                const skus = mData?.data?.root?.fields?.productOption?.skuBase?.skus || []

                if (skus.length > 1) {
                    const skuPromises = skus.map((s: any) =>
                        axios.get(`https://www.daraz.com.np/catalog/?q=${s.skuId}&ajax=true`, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'application/json, text/javascript, */*; q=0.01',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            timeout: 5000
                        }).then(r => {
                            const p = r.data?.mods?.listItems?.[0]?.price
                            if (p != null) {
                                const parsed = parseFloat(String(p).replace(/,/g, ''))
                                return !isNaN(parsed) && parsed > 0 ? parsed : null
                            }
                            return null
                        }).catch(() => null)
                    )

                    const skuResults = await Promise.all(skuPromises)
                    const validPrices = skuResults.filter((p): p is number => p !== null)
                    const uniquePrices = Array.from(new Set(validPrices)).sort((a, b) => a - b)

                    if (uniquePrices.length > 0) {
                        if (!extractedPrice) extractedPrice = uniquePrices[0]
                        extractedPriceDisplay = uniquePrices.map(p => `Rs ${p.toLocaleString()}`).join(' / ')
                    }
                }
            }
        }
    } catch (e) {}

    if (!extractedPriceDisplay && extractedPrice) {
        extractedPriceDisplay = `Rs ${extractedPrice.toLocaleString()}`
    }

    return {
        success: extractedPrice !== null || extractedSold > 0,
        price: extractedPrice,
        price_display: extractedPriceDisplay,
        total_sold: extractedSold,
        review_count: extractedReviews,
        title: extractedTitle || 'Daraz Competitor Product'
    }
}

/**
 * Saves or updates competitor links (1-4) for a product, automatically fetching live values
 * and writing price updates & snapshots into the database.
 */
export async function saveCompetitorLinks(
    productId: string,
    links: { competitor_index: number; competitor_url: string }[]
) {
    const supabase = await createClient()

    if (!productId) throw new Error('Product ID is required')

    const savePromises = links.map(async (item) => {
        const { competitor_index, competitor_url } = item
        if (competitor_index < 1 || competitor_index > 4) return null

        const cleanUrl = competitor_url?.trim() || ''

        if (!cleanUrl) {
            await supabase
                .from('daraz_competitor_products')
                .delete()
                .eq('product_id', productId)
                .eq('competitor_index', competitor_index)
            return null
        }

        const { data: existing } = await supabase
            .from('daraz_competitor_products')
            .select('*')
            .eq('product_id', productId)
            .eq('competitor_index', competitor_index)
            .maybeSingle()

        const extracted = await extractDarazCompetitorInfo(cleanUrl)

        const now = new Date().toISOString()
        const newPrice = extracted.price ?? existing?.current_price ?? 0
        const newSold = extracted.total_sold || existing?.total_sold || 0
        const newReviews = extracted.review_count || existing?.review_count || 0
        const title = extracted.title || existing?.title || `Competitor ${competitor_index}`

        let previousPrice = existing?.previous_price ?? null
        let priceChangedAt = existing?.price_changed_at ?? null

        if (existing?.current_price && newPrice > 0 && Math.abs(existing.current_price - newPrice) >= 1) {
            const pctDiff = Math.abs(existing.current_price - newPrice) / existing.current_price
            if (pctDiff < 0.20) {
                previousPrice = existing.current_price
                priceChangedAt = now
            } else {
                previousPrice = null
                priceChangedAt = null
            }
        }

        const upsertPayload: any = {
            product_id: productId,
            competitor_index,
            competitor_url: cleanUrl,
            title,
            current_price: newPrice,
            price_display: extracted.price_display || (newPrice > 0 ? `Rs ${newPrice.toLocaleString()}` : null),
            previous_price: previousPrice,
            price_changed_at: priceChangedAt,
            total_sold: newSold,
            review_count: newReviews,
            updated_at: now
        }

        const { data: savedComp, error: upsertErr } = await supabase
            .from('daraz_competitor_products')
            .upsert(upsertPayload, { onConflict: 'product_id,competitor_index' })
            .select()
            .single()

        if (upsertErr) {
            console.error('[saveCompetitorLinks] upsert error:', upsertErr)
            return null
        }

        if (savedComp && newPrice > 0) {
            await supabase
                .from('daraz_competitor_snapshots')
                .insert([{
                    competitor_id: savedComp.id,
                    product_id: productId,
                    competitor_index,
                    price: newPrice,
                    total_sold: newSold,
                    review_count: newReviews,
                    created_at: now
                }])
        }

        return savedComp
    })

    const results = (await Promise.all(savePromises)).filter(Boolean)

    revalidatePath('/dashboard/sales/daraz/average-sales-price')
    return { success: true, count: results.length }
}

/**
 * Fetches all competitors and calculates historical sales velocity (1d, 7d, 30d, 180d)
 * and 7-day price update alert status.
 */
export async function getCompetitorDataForProducts(productIds?: string[]): Promise<Record<string, CompetitorItem[]>> {
    const supabase = await createClient()

    let query = supabase
        .from('daraz_competitor_products')
        .select('*')
        .order('competitor_index', { ascending: true })

    if (productIds && productIds.length > 0 && productIds.length <= 100) {
        query = query.in('product_id', productIds)
    }

    const { data: compRows, error } = await query

    if (error || !compRows) {
        console.error('[getCompetitorDataForProducts] fetch error:', error)
        return {}
    }

    const competitorIds = compRows.map(c => c.id)

    const now = new Date()
    const t1d = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const t7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const t30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const t180d = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()

    let snapshots: any[] = []
    if (competitorIds.length > 0) {
        const BATCH_SIZE = 100
        const batchPromises = []
        for (let i = 0; i < competitorIds.length; i += BATCH_SIZE) {
            const batch = competitorIds.slice(i, i + BATCH_SIZE)
            batchPromises.push(
                supabase
                    .from('daraz_competitor_snapshots')
                    .select('*')
                    .in('competitor_id', batch)
                    .gte('created_at', t180d)
                    .order('created_at', { ascending: true })
            )
        }
        const batchResults = await Promise.all(batchPromises)
        for (const res of batchResults) {
            if (res.data) snapshots.push(...res.data)
        }
    }

    const resultMap: Record<string, CompetitorItem[]> = {}

    const snapMap = new Map<string, any[]>()
    snapshots.forEach(s => {
        if (!snapMap.has(s.competitor_id)) snapMap.set(s.competitor_id, [])
        snapMap.get(s.competitor_id)!.push(s)
    })

    compRows.forEach(comp => {
        const pId = comp.product_id
        if (!resultMap[pId]) resultMap[pId] = []

        let isPriceUpdated7d = false
        if (comp.price_changed_at) {
            const changedTime = new Date(comp.price_changed_at).getTime()
            if (changedTime >= new Date(t7d).getTime()) {
                isPriceUpdated7d = true
            }
        }

        const compSnaps = snapMap.get(comp.id) || []
        const currentSold = comp.total_sold || 0

        const getSoldAtCutoff = (cutoffIso: string): number | null => {
            if (compSnaps.length === 0) return null
            const cutoffTime = new Date(cutoffIso).getTime()
            const found = compSnaps.find(s => new Date(s.created_at).getTime() >= cutoffTime)
            return found ? found.total_sold : compSnaps[0].total_sold
        }

        const sold1dVal = getSoldAtCutoff(t1d)
        const sold7dVal = getSoldAtCutoff(t7d)
        const sold30dVal = getSoldAtCutoff(t30d)
        const sold180dVal = getSoldAtCutoff(t180d)

        const sold_1d = sold1dVal !== null ? Math.max(0, currentSold - sold1dVal) : 0
        const sold_7d = sold7dVal !== null ? Math.max(0, currentSold - sold7dVal) : 0
        const sold_30d = sold30dVal !== null ? Math.max(0, currentSold - sold30dVal) : 0
        const sold_180d = sold180dVal !== null ? Math.max(0, currentSold - sold180dVal) : 0

        const priceHistory = compSnaps
            .filter(s => s.price > 0)
            .map((s, idx, arr) => ({
                date: s.created_at,
                price: Number(s.price),
                old_price: idx > 0 ? Number(arr[idx - 1].price) : (comp.previous_price ? Number(comp.previous_price) : null)
            }))

        resultMap[pId].push({
            ...comp,
            is_price_updated_7d: isPriceUpdated7d,
            sold_1d,
            sold_7d,
            sold_30d,
            sold_180d,
            price_history: priceHistory
        })
    })

    return resultMap
}

/**
 * Background / Manual sync action to refresh all active competitor listings in fast parallel batches.
 */
export async function syncAllCompetitorsCron() {
    const supabase = await createClient()

    const { data: competitors, error } = await supabase
        .from('daraz_competitor_products')
        .select('*')

    if (error || !competitors || competitors.length === 0) {
        return { success: true, count: 0 }
    }

    let updatedCount = 0
    const now = new Date().toISOString()
    const BATCH_SIZE = 5

    for (let i = 0; i < competitors.length; i += BATCH_SIZE) {
        const batch = competitors.slice(i, i + BATCH_SIZE)

        await Promise.all(batch.map(async (comp) => {
            if (!comp.competitor_url) return

            const extracted = await extractDarazCompetitorInfo(comp.competitor_url)
            if (!extracted.success) return

            const newPrice = extracted.price ?? comp.current_price ?? 0
            const newSold = extracted.total_sold || comp.total_sold || 0
            const newReviews = extracted.review_count || comp.review_count || 0

            let previousPrice = comp.previous_price
            let priceChangedAt = comp.price_changed_at

            if (comp.current_price && newPrice > 0 && Math.abs(comp.current_price - newPrice) >= 1) {
                const pctDiff = Math.abs(comp.current_price - newPrice) / comp.current_price
                if (pctDiff < 0.20) {
                    previousPrice = comp.current_price
                    priceChangedAt = now
                } else {
                    previousPrice = null
                    priceChangedAt = null
                }
            }

            await supabase
                .from('daraz_competitor_products')
                .update({
                    current_price: newPrice,
                    price_display: extracted.price_display || (newPrice > 0 ? `Rs ${newPrice.toLocaleString()}` : null),
                    previous_price: previousPrice,
                    price_changed_at: priceChangedAt,
                    total_sold: newSold,
                    review_count: newReviews,
                    updated_at: now
                })
                .eq('id', comp.id)

            if (newPrice > 0) {
                await supabase
                    .from('daraz_competitor_snapshots')
                    .insert([{
                        competitor_id: comp.id,
                        product_id: comp.product_id,
                        competitor_index: comp.competitor_index,
                        price: newPrice,
                        total_sold: newSold,
                        review_count: newReviews,
                        created_at: now
                    }])
            }

            updatedCount++
        }))
    }

    revalidatePath('/dashboard/sales/daraz/average-sales-price')
    return { success: true, count: updatedCount }
}
