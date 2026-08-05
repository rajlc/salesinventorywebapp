const axios = require('axios');

const urls = [
    "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html?spm=a2a0e.searchlist.list.4.320827e1MjVJja",
    "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html?spm=a2a0e.searchlist.list.8.320827e1MjVJja",
    "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345.html?spm=a2a0e.searchlist.list.10.320827e1MjVJja"
];

async function extractInfo(url) {
    console.log("\nTesting URL:", url.slice(0, 80) + '...');
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 10000
        });

        const html = response.data;
        let price = null;
        let sold = 0;
        let reviews = 0;
        let title = null;

        // 1. Check pdt_price in pdpTrackingData
        const pdtMatch = html.match(/"pdt_price"\s*:\s*"Rs\.\s*([\d.,]+)"/i) || html.match(/"pdt_price"\s*:\s*"([^"]+)"/i);
        if (pdtMatch && pdtMatch[1]) {
            const p = parseFloat(pdtMatch[1].replace(/,/g, '').replace(/[^\d.]/g, ''));
            if (!isNaN(p) && p > 0) price = p;
        }

        // 2. Check salePrice value
        if (!price) {
            const saleMatch = html.match(/"salePrice":\s*\{[^}]*"value":\s*([\d.]+)/i) || html.match(/"price":\s*\{[^}]*"value":\s*([\d.]+)/i);
            if (saleMatch && saleMatch[1]) {
                const p = parseFloat(saleMatch[1]);
                if (!isNaN(p) && p > 0) price = p;
            }
        }

        // 3. Check general Rs. pattern
        if (!price) {
            const rsMatch = html.match(/Rs\.\s*([\d,]+)/i);
            if (rsMatch && rsMatch[1]) {
                const p = parseFloat(rsMatch[1].replace(/,/g, ''));
                if (!isNaN(p) && p > 0) price = p;
            }
        }

        // Check sold
        const soldMatch = html.match(/(\d+)\s*sold/i) || html.match(/"sold":\s*"?(\d+)"?/i) || html.match(/"sale":\s*"?(\d+)"?/i);
        if (soldMatch && soldMatch[1]) {
            sold = parseInt(soldMatch[1], 10);
        }

        // Check title
        const titleMatch = html.match(/"pdt_name"\s*:\s*"([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1];
        }

        console.log("-> Extracted Price:", price);
        console.log("-> Extracted Sold:", sold);
        console.log("-> Extracted Title:", title?.slice(0, 40));
    } catch (e) {
        console.error("-> Error:", e.message);
    }
}

async function runAll() {
    for (const u of urls) {
        await extractInfo(u);
    }
}

runAll();
