const axios = require('axios');

const testUrls = [
    { name: "Comp 1 (No SKU)", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html?spm=a2a0e.searchlist.list.8.320827e1MjVJja" },
    { name: "Comp 2 (Variation 1)", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345.html?spm=a2a0e.searchlist.list.10.320827e1MjVJja" },
    { name: "Comp 2 (Variation 2: -s12358350775)", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345-s12358350775.html?" },
    { name: "Comp 3", url: "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html?spm=a2a0e.searchlist.list.4.320827e1MjVJja" }
];

async function extractDarazCompetitorInfo(url) {
    if (!url || !url.trim().startsWith('http')) {
        return { success: false, price: null, total_sold: 0, review_count: 0, title: null, error: 'Invalid URL' };
    }

    const cleanUrl = url.trim();
    let extractedPrice = null;
    let extractedSold = 0;
    let extractedReviews = 0;
    let extractedTitle = null;

    // Extract itemId and skuId from URL
    const itemIdMatch = cleanUrl.match(/-i(\d+)/i) || cleanUrl.match(/[?&]item_?id=(\d+)/i);
    const skuIdMatch = cleanUrl.match(/-s(\d+)\.html/i) || cleanUrl.match(/[?&]sku_?id=(\d+)/i);

    const itemId = itemIdMatch ? itemIdMatch[1] : null;
    const skuId = skuIdMatch ? skuIdMatch[1] : null;

    const targetId = skuId || itemId;

    if (targetId) {
        try {
            const catalogUrl = `https://www.daraz.com.np/catalog/?q=${targetId}&ajax=true`;
            const res = await axios.get(catalogUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 6000
            });

            const listItems = res.data?.mods?.listItems || [];
            if (listItems.length > 0) {
                const item = listItems[0];
                if (item.price != null) {
                    const parsed = parseFloat(String(item.price).replace(/,/g, ''));
                    if (!isNaN(parsed) && parsed > 0) extractedPrice = parsed;
                }
                if (item.review != null) {
                    const parsed = parseInt(String(item.review), 10);
                    if (!isNaN(parsed) && parsed >= 0) extractedReviews = parsed;
                }
                if (item.totalSold != null || item.sales != null) {
                    const parsed = parseInt(String(item.totalSold || item.sales), 10);
                    if (!isNaN(parsed) && parsed >= 0) extractedSold = parsed;
                }
                if (item.name) {
                    extractedTitle = item.name.trim();
                }
            }
        } catch (catErr) {
            console.error('[Catalog API error]:', catErr.message);
        }
    }

    return {
        success: extractedPrice !== null,
        price: extractedPrice,
        total_sold: extractedSold,
        review_count: extractedReviews,
        title: extractedTitle || 'Daraz Competitor Product'
    };
}

async function run() {
    for (const test of testUrls) {
        console.log(`\n=================== ${test.name} ===================`);
        const res = await extractDarazCompetitorInfo(test.url);
        console.log("Result:", JSON.stringify(res, null, 2));
    }
}

run();
