const axios = require('axios');

const urls = [
    "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html?spm=a2a0e.searchlist.list.4.320827e1MjVJja",
    "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html?spm=a2a0e.searchlist.list.8.320827e1MjVJja",
    "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345-s12358350775.html?"
];

async function checkPdtPrice(url) {
    console.log("\n==========================================");
    console.log("Testing URL:", url);

    // 1. Check URL parameters first
    let urlPrice = null;
    try {
        const u = new URL(url);
        if (u.searchParams.has('price')) {
            urlPrice = parseFloat(u.searchParams.get('price') || '');
        }
        if (!urlPrice && u.searchParams.has('clickTrackInfo')) {
            const t1 = decodeURIComponent(u.searchParams.get('clickTrackInfo') || '');
            const t2 = decodeURIComponent(t1);
            const m = t2.match(/price[:%3A]+(\d+)/i) || t1.match(/price[:%3A]+(\d+)/i);
            if (m && m[1]) urlPrice = parseFloat(m[1]);
        }
    } catch (e) {}

    if (urlPrice && urlPrice > 0) {
        console.log("-> Price from URL params:", urlPrice);
    }

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

        // Check pdpTrackingData
        const trackingMatch = html.match(/pdpTrackingData\s*=\s*"([\s\S]*?)";\s*\n/i) || html.match(/var\s+pdpTrackingData\s*=\s*("[\s\S]*?");/i);
        if (trackingMatch) {
            const raw = trackingMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            try {
                const trackObj = JSON.parse(raw);
                console.log("-> pdpTrackingData pdt_simplesku:", trackObj.pdt_simplesku);
                console.log("-> pdpTrackingData pdt_price:", trackObj.pdt_price);
            } catch (e) {}
        }
    } catch (err) {
        console.error("Fetch error:", err.message);
    }
}

async function run() {
    for (const u of urls) {
        await checkPdtPrice(u);
    }
}

run();
