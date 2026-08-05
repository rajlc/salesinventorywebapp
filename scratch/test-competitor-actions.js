const axios = require('axios');

async function extractDarazCompetitorInfo(url) {
    if (!url || !url.trim().startsWith('http')) {
        return { success: false, price: null, total_sold: 0, review_count: 0, title: null, error: 'Invalid URL' }
    }

    const cleanUrl = url.trim()

    let extractedPrice = null
    let extractedSold = 0
    let extractedReviews = 0
    let extractedTitle = null

    try {
        const urlObj = new URL(cleanUrl)
        const searchParams = urlObj.searchParams

        if (searchParams.has('price')) {
            const parsed = parseFloat(searchParams.get('price') || '')
            if (!isNaN(parsed) && parsed > 0) extractedPrice = parsed
        }
        if (!extractedPrice && searchParams.has('clickTrackInfo')) {
            const decodedTrack = decodeURIComponent(searchParams.get('clickTrackInfo') || '')
            const matchPrice = decodedTrack.match(/price%3A(\d+)/i) || decodedTrack.match(/price:(\d+)/i)
            if (matchPrice && matchPrice[1]) {
                const val = parseFloat(matchPrice[1])
                if (!isNaN(val) && val > 0) extractedPrice = val
            }
        }
        if (!extractedPrice && searchParams.has('priceCompare')) {
            const decodedCompare = decodeURIComponent(searchParams.get('priceCompare') || '')
            const matchDisplay = decodedCompare.match(/displayPrice%3A(\d+)/i) || decodedCompare.match(/displayPrice:(\d+)/i)
            if (matchDisplay && matchDisplay[1]) {
                const val = parseFloat(matchDisplay[1]) / 100
                if (!isNaN(val) && val > 0) extractedPrice = val
            }
        }

        if (searchParams.has('sale')) {
            const parsed = parseInt(searchParams.get('sale') || '', 10)
            if (!isNaN(parsed) && parsed >= 0) extractedSold = parsed
        }

        if (searchParams.has('review')) {
            const parsed = parseInt(searchParams.get('review') || '', 10)
            if (!isNaN(parsed) && parsed >= 0) extractedReviews = parsed
        }

        const pathSegments = urlObj.pathname.split('/').filter(Boolean)
        const prodSegment = pathSegments.find(s => s.includes('-i') || s.endsWith('.html'))
        if (prodSegment) {
            const cleanTitleSlug = prodSegment.replace(/-i\d+.*/, '').replace(/\.html$/, '').replace(/-/g, ' ')
            if (cleanTitleSlug.length > 2) {
                extractedTitle = cleanTitleSlug.charAt(0).toUpperCase() + cleanTitleSlug.slice(1)
            }
        }
    } catch (err) {
        console.error("URL parse error:", err.message);
    }

    if (!extractedPrice || extractedSold === 0 || !extractedTitle) {
        try {
            console.log("Fetching HTML for:", cleanUrl);
            const response = await axios.get(cleanUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache'
                },
                timeout: 10000
            })

            const html = response.data
            console.log("Response status:", response.status, "HTML length:", html?.length);

            if (typeof html === 'string') {
                if (!extractedPrice) {
                    const priceMatch = html.match(/"pdt_price"\s*:\s*"Rs\.\s*([\d.,]+)"/i) ||
                                       html.match(/"pdt_price"\s*:\s*"([^"]+)"/i) ||
                                       html.match(/"salePrice":\s*\{[^}]*"value":\s*([\d.]+)/i) ||
                                       html.match(/"price":\s*\{[^}]*"value":\s*([\d.]+)/i) ||
                                       html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([\d.]+)["']/i) ||
                                       html.match(/<meta\s+name=["']twitter:data1["']\s+content=["'](?:Rs\.\s*)?([\d.,]+)["']/i) ||
                                       html.match(/Rs\.\s*([\d,]+)/i)
                    if (priceMatch && priceMatch[1]) {
                        const parsed = parseFloat(priceMatch[1].replace(/,/g, '').replace(/[^\d.]/g, ''))
                        if (!isNaN(parsed) && parsed > 0) extractedPrice = parsed
                    }
                }

                if (extractedSold === 0) {
                    const salesMatch = html.match(/"salesCount":\s*(\d+)/i) ||
                                       html.match(/"totalSold":\s*(\d+)/i) ||
                                       html.match(/(\d+)\s*sold/i)
                    if (salesMatch && salesMatch[1]) {
                        const parsed = parseInt(salesMatch[1], 10)
                        if (!isNaN(parsed)) extractedSold = parsed
                    }
                }

                if (extractedReviews === 0) {
                    const reviewMatch = html.match(/"ratingCount":\s*(\d+)/i) ||
                                        html.match(/"reviewCount":\s*(\d+)/i) ||
                                        html.match(/"review":\s*(\d+)/i)
                    if (reviewMatch && reviewMatch[1]) {
                        const parsed = parseInt(reviewMatch[1], 10)
                        if (!isNaN(parsed)) extractedReviews = parsed
                    }
                }

                if (!extractedTitle) {
                    const titleMatch = html.match(/"pdt_name"\s*:\s*"([^"]+)"/i) ||
                                       html.match(/<title>([^<]+)<\/title>/i)
                    if (titleMatch && titleMatch[1]) {
                        extractedTitle = titleMatch[1].split('|')[0].split('-')[0].trim()
                    }
                }
            } else {
                console.log("HTML response is not string! Type:", typeof html);
            }
        } catch (scrapeErr) {
            console.error('[extractDarazCompetitorInfo] HTML fetch failed:', scrapeErr.message)
        }
    }

    return {
        success: extractedPrice !== null || extractedSold > 0,
        price: extractedPrice,
        total_sold: extractedSold,
        review_count: extractedReviews,
        title: extractedTitle || 'Daraz Competitor Product'
    }
}

async function test() {
    const urls = [
        "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html?spm=a2a0e.searchlist.list.4.320827e1MjVJja",
        "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html?spm=a2a0e.searchlist.list.8.320827e1MjVJja",
        "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345.html?spm=a2a0e.searchlist.list.10.320827e1MjVJja"
    ];

    for (const u of urls) {
        const res = await extractDarazCompetitorInfo(u);
        console.log("Result:", res);
    }
}

test();
