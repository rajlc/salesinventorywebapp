const axios = require('axios');

const urls = [
    "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html?spm=a2a0e.searchlist.list.4.320827e1MjVJja",
    "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html?spm=a2a0e.searchlist.list.8.320827e1MjVJja",
    "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345-s12358350775.html?"
];

async function extractDarazInfo(url) {
    if (!url || !url.trim().startsWith('http')) return { price: null, sold: 0, title: null };

    const cleanUrl = url.trim();
    let extractedPrice = null;
    let extractedSold = 0;
    let extractedReviews = 0;
    let extractedTitle = null;

    // 1. URL Query parameters (clickTrackInfo, price=, priceCompare)
    try {
        const u = new URL(cleanUrl);
        if (u.searchParams.has('price')) {
            const parsed = parseFloat(u.searchParams.get('price') || '');
            if (!isNaN(parsed) && parsed > 0) extractedPrice = parsed;
        }

        if (!extractedPrice && u.searchParams.has('clickTrackInfo')) {
            const track1 = decodeURIComponent(u.searchParams.get('clickTrackInfo') || '');
            const track2 = decodeURIComponent(track1);
            const m = track2.match(/price[:%3A]+(\d+)/i) || track1.match(/price[:%3A]+(\d+)/i);
            if (m && m[1]) {
                const val = parseFloat(m[1]);
                if (!isNaN(val) && val > 0) extractedPrice = val;
            }
        }

        if (!extractedPrice && u.searchParams.has('priceCompare')) {
            const track1 = decodeURIComponent(u.searchParams.get('priceCompare') || '');
            const track2 = decodeURIComponent(track1);
            const m = track2.match(/displayPrice[:%3A]+(\d+)/i) || track1.match(/displayPrice[:%3A]+(\d+)/i);
            if (m && m[1]) {
                const val = parseFloat(m[1]) / 100;
                if (!isNaN(val) && val > 0) extractedPrice = val;
            }
        }
    } catch (e) {}

    // 2. Fetch HTML if price or info missing
    if (!extractedPrice || extractedSold === 0 || !extractedTitle) {
        try {
            const res = await axios.get(cleanUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 10000
            });

            const html = res.data;

            if (typeof html === 'string') {
                // Priority A: pdpTrackingData pdt_price (Exact for selected SKU variation)
                const trackingMatch = html.match(/pdpTrackingData\s*=\s*"([\s\S]*?)";\s*\n/i) || html.match(/var\s+pdpTrackingData\s*=\s*("[\s\S]*?");/i);
                if (trackingMatch) {
                    const rawTrack = trackingMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    try {
                        const trackObj = JSON.parse(rawTrack);
                        if (trackObj.pdt_price) {
                            const cleanPriceStr = String(trackObj.pdt_price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim();
                            const p = parseFloat(cleanPriceStr);
                            if (!isNaN(p) && p > 0) extractedPrice = p;
                        }
                        if (trackObj.pdt_name && !extractedTitle) {
                            extractedTitle = String(trackObj.pdt_name).trim();
                        }
                    } catch (e) {}
                }

                // Priority B: Discount badge pattern or explicit pdt_price regex
                if (!extractedPrice) {
                    const discountBadgeMatch = html.match(/Rs\.\s*([\d,]+)\s*-\d+%/i) || html.match(/Rs\.\s*([\d,]+)[^<]*-\d+%/i);
                    if (discountBadgeMatch && discountBadgeMatch[1]) {
                        const p = parseFloat(discountBadgeMatch[1].replace(/,/g, ''));
                        if (!isNaN(p) && p > 0) extractedPrice = p;
                    }
                }

                // Priority C: Meta tags & OpenGraph
                if (!extractedPrice) {
                    const ogMatch = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([\d.]+)["']/i) ||
                                    html.match(/<meta\s+name=["']twitter:data1["']\s+content=["'](?:Rs\.\s*)?([\d.,]+)["']/i);
                    if (ogMatch && ogMatch[1]) {
                        const p = parseFloat(ogMatch[1].replace(/,/g, ''));
                        if (!isNaN(p) && p > 0) extractedPrice = p;
                    }
                }

                // Priority D: Fallback to Rs. XXX in HTML
                if (!extractedPrice) {
                    const allRsPrices = [];
                    const rsRegex = /Rs\.\s*([\d,]+)/gi;
                    let match;
                    while ((match = rsRegex.exec(html)) !== null) {
                        const val = parseFloat(match[1].replace(/,/g, ''));
                        if (!isNaN(val) && val > 10 && val < 500000) {
                            allRsPrices.push(val);
                        }
                    }
                    if (allRsPrices.length > 0) {
                        extractedPrice = Math.min(...allRsPrices);
                    }
                }

                // Title fallback
                if (!extractedTitle) {
                    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                    if (titleMatch && titleMatch[1]) {
                        extractedTitle = titleMatch[1].split('|')[0].split('-')[0].trim();
                    }
                }
            }
        } catch (scrapeErr) {
            console.error("Scrape error:", scrapeErr.message);
        }
    }

    return { price: extractedPrice, title: extractedTitle };
}

async function run() {
    for (let i = 0; i < urls.length; i++) {
        console.log(`\n--- URL ${i + 1} ---`);
        const res = await extractDarazInfo(urls[i]);
        console.log(`Result URL ${i + 1}: Price = Rs. ${res.price}, Title = ${res.title?.slice(0, 40)}`);
    }
}

run();
