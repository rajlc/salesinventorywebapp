const axios = require('axios');

const urls = [
    "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html?spm=a2a0e.searchlist.list.4.320827e1MjVJja",
    "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html?spm=a2a0e.searchlist.list.8.320827e1MjVJja",
    "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345.html?spm=a2a0e.searchlist.list.10.320827e1MjVJja"
];

async function getSpecialPrice(url) {
    console.log("\n-------------------------------------------");
    console.log("Testing URL:", url.slice(0, 80) + '...');

    // 1. Check URL parameters
    let urlPrice = null;
    try {
        const u = new URL(url);
        if (u.searchParams.has('price')) {
            urlPrice = parseFloat(u.searchParams.get('price') || '');
        }
        if (!urlPrice && u.searchParams.has('clickTrackInfo')) {
            const track = decodeURIComponent(u.searchParams.get('clickTrackInfo') || '');
            const m = track.match(/price%3A(\d+)/i) || track.match(/price:(\d+)/i);
            if (m && m[1]) urlPrice = parseFloat(m[1]);
        }
    } catch (e) {}

    if (urlPrice && urlPrice > 0) {
        console.log("-> URL Special Price:", urlPrice);
        return urlPrice;
    }

    // 2. HTML Scraper with Special Price Detection
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 10000
        });

        const html = res.data;

        // Check for discount pattern: Rs. 499 -67%
        const discountBadgeMatch = html.match(/Rs\.\s*([\d,]+)\s*-\d+%/i) || html.match(/Rs\.\s*([\d,]+)[^<]*-\d+%/i);
        if (discountBadgeMatch && discountBadgeMatch[1]) {
            const p = parseFloat(discountBadgeMatch[1].replace(/,/g, ''));
            if (!isNaN(p) && p > 0) {
                console.log("-> Found Discount Badge Price (Rs. XXX -YY%):", p);
                return p;
            }
        }

        // Collect all Rs. prices from HTML
        const allPrices = [];
        const rsRegex = /Rs\.\s*([\d,]+)/gi;
        let match;
        while ((match = rsRegex.exec(html)) !== null) {
            const val = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(val) && val > 10 && val < 500000) {
                allPrices.push(val);
            }
        }

        console.log("-> All Rs. prices found in HTML:", allPrices);

        if (allPrices.length > 0) {
            // Special price is the minimum selling price on the page!
            const specialPrice = Math.min(...allPrices);
            console.log("-> Selected Special Price (Math.min):", specialPrice);
            return specialPrice;
        }
    } catch (err) {
        console.error("HTML fetch error:", err.message);
    }

    return null;
}

async function run() {
    for (const u of urls) {
        await getSpecialPrice(u);
    }
}

run();
