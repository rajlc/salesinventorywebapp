import axios from 'axios'
import { resolveBestCategory } from '@/lib/daraz/category-service'

export interface ExtractedProductInfo {
    platform: string
    raw_name: string
    title: string
    price: number | null
    special_price: number | null
    category_id: number | null
    category_path: string
    images: string[]
    description: string
    highlights: string[]
    product_link: string
}

// Supported competitor platforms detector
export function detectPlatform(url: string): string {
    const lower = url.toLowerCase()
    if (lower.includes('daraz.')) return 'Daraz'
    if (lower.includes('amazon.')) return 'Amazon'
    if (lower.includes('alibaba.')) return 'Alibaba'
    if (lower.includes('aliexpress.')) return 'AliExpress'
    if (lower.includes('flipkart.')) return 'Flipkart'
    if (lower.includes('ebay.')) return 'eBay'
    return 'Web Store'
}

// Clean HTML tags and decode basic entities
export function cleanText(text?: string | null): string {
    if (!text) return ''
    return text
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Extracts product details (title, price, images, description, highlights, matching Daraz category)
 * from a competitor product link (Daraz, Amazon, Alibaba, AliExpress, etc.)
 */
export async function extractCompetitorProduct(rawUrl: string): Promise<ExtractedProductInfo> {
    const cleanUrl = rawUrl.trim()
    if (!cleanUrl) {
        throw new Error('Product URL is required')
    }

    let parsedUrl: URL
    try {
        parsedUrl = new URL(cleanUrl)
    } catch {
        throw new Error('Invalid product URL format')
    }

    const platform = detectPlatform(cleanUrl)

    // Fetch HTML with realistic browser headers
    const res = await axios.get(cleanUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
        },
        timeout: 15000,
        maxRedirects: 5
    })

    const html = typeof res.data === 'string' ? res.data : ''
    if (!html) {
        throw new Error('Empty response received from product URL')
    }

    let rawName = ''
    let title = ''
    let price: number | null = null
    let specialPrice: number | null = null
    let images: string[] = []
    let categoryPath = ''
    let description = ''
    let highlights: string[] = []

    // ── 1. OpenGraph & Meta Extraction ────────────────────────────────────
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]
    const titleTag = html.match(/<title>([^<]+)<\/title>/i)?.[1]

    if (ogTitle) {
        title = cleanText(ogTitle.replace(/\s*\|\s*(Daraz|Amazon|AliExpress|Alibaba)[^|]*$/i, ''))
    } else if (titleTag) {
        title = cleanText(titleTag.replace(/\s*\|\s*(Daraz|Amazon|AliExpress|Alibaba)[^|]*$/i, ''))
    }

    if (ogDesc) {
        description = cleanText(ogDesc)
    }

    if (ogImage && ogImage.startsWith('http')) {
        images.push(ogImage)
    }

    // ── 2. JSON-LD Structured Data Extraction ─────────────────────────────
    const ldMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const m of ldMatches) {
        try {
            const jsonStr = m.replace(/<\/?script[^>]*>/gi, '').trim()
            const json = JSON.parse(jsonStr)
            const items = Array.isArray(json) ? json : [json]

            for (const item of items) {
                if (item['@type'] === 'Product' || item.name) {
                    if (!title && item.name) title = cleanText(item.name)
                    if (item.category && !categoryPath) {
                        categoryPath = cleanText(item.category)
                    }
                    if (item.description && !description) {
                        description = cleanText(item.description)
                    }

                    // Images
                    if (item.image) {
                        const imgList = Array.isArray(item.image) ? item.image : [item.image]
                        for (const img of imgList) {
                            if (typeof img === 'string' && img.startsWith('http') && !images.includes(img)) {
                                images.push(img)
                            } else if (img && typeof img.url === 'string' && !images.includes(img.url)) {
                                images.push(img.url)
                            }
                        }
                    }

                    // Price
                    const offers = item.offers ? (Array.isArray(item.offers) ? item.offers[0] : item.offers) : null
                    if (offers && offers.price) {
                        const parsedPrice = parseFloat(String(offers.price).replace(/[^0-9.]/g, ''))
                        if (!isNaN(parsedPrice) && parsedPrice > 0) {
                            price = parsedPrice
                        }
                    }
                }
            }
        } catch {
            // Ignore malformed JSON-LD scripts
        }
    }

    // ── 3. Daraz-Specific Parsing ─────────────────────────────────────────
    if (platform === 'Daraz') {
        const pdtPriceMatch = html.match(/"pdt_price":\s*"([^"]+)"/i)
        const rsMatch = html.match(/(?:Rs\.?|NPR)\s*([0-9,]+(?:\.[0-9]+)?)/i)
        const rawPriceStr = pdtPriceMatch ? pdtPriceMatch[1] : (rsMatch ? rsMatch[1] : null)
        if (rawPriceStr) {
            const numMatch = rawPriceStr.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
            if (numMatch) {
                const numeric = parseFloat(numMatch[0])
                if (!isNaN(numeric) && numeric > 0) {
                    specialPrice = numeric
                    price = Math.round(numeric * 1.3)
                }
            }
        }

        const darazImgMatches = html.match(/https:\/\/(?:img\.drz\.lazcdn\.com|static-01\.daraz\.com\.np)\/p\/[a-f0-9]+(?:\.jpg|\.png)/gi) || []
        for (const imgUrl of darazImgMatches) {
            const cleanImg = imgUrl.split('_')[0]
            if (!images.includes(cleanImg)) {
                images.push(cleanImg)
            }
        }

        const pdpMatch = html.match(/pdpTrackingData\s*=\s*({[\s\S]+?});/i)
        if (pdpMatch) {
            try {
                const pdp = JSON.parse(pdpMatch[1])
                if (pdp.core?.category_name && !categoryPath) {
                    categoryPath = cleanText(pdp.core.category_name)
                }
            } catch {}
        }
    }

    // Fallback title from URL slug if still empty
    if (!title) {
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean)
        const slug = pathParts[pathParts.length - 1] || ''
        title = slug
            .replace(/-i\d+.*$/, '')
            .replace(/[-_]/g, ' ')
            .replace(/\.html?$/i, '')
            .trim()
    }

    rawName = title

    // ── 4. Resolve Local Daraz Category ──────────────────────────────────
    let matchedCategoryId: number | null = null
    let matchedCategoryPath = categoryPath

    const categorySearchTerm = categoryPath ? categoryPath.split('>').pop()?.trim() || categoryPath : title
    if (categorySearchTerm) {
        try {
            const resolved = await resolveBestCategory(categorySearchTerm, categoryPath)
            if (resolved && resolved.id) {
                matchedCategoryId = resolved.id
                matchedCategoryPath = resolved.path
            }
        } catch (err) {
            console.warn('[ExtractLink] Category resolution error:', err)
        }
    }

    // Generate preliminary highlights from description
    if (description) {
        const sentences = description
            .split(/[.;•\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 10 && s.length < 150)
            .slice(0, 5)
        highlights = sentences.map(s => s.replace(/^[•\-\*\s]+/, '').trim())
    }

    return {
        platform,
        raw_name: rawName,
        title,
        price,
        special_price: specialPrice,
        category_id: matchedCategoryId,
        category_path: matchedCategoryPath || categoryPath,
        images: images.slice(0, 8),
        description,
        highlights,
        product_link: cleanUrl
    }
}
