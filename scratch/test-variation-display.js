const axios = require('axios');

const testUrls = [
    { name: "Comp 1", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html?spm=a2a0e.searchlist.list.8.320827e1MjVJja" },
    { name: "Comp 2", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345.html?spm=a2a0e.searchlist.list.10.320827e1MjVJja" },
    { name: "Comp 3", url: "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html?spm=a2a0e.searchlist.list.4.320827e1MjVJja" }
];

async function extractDarazCompetitorInfo(url) {
    if (!url || !url.trim().startsWith('http')) {
        return { success: false, price: null, price_display: null, total_sold: 0, review_count: 0, title: null };
    }

    const cleanUrl = url.trim();
    let extractedPrice = null;
    let extractedPriceDisplay = null;
    let extractedSold = 0;
    let extractedReviews = 0;
    let extractedTitle = null;

    const itemIdMatch = cleanUrl.match(/-i(\d+)/i) || cleanUrl.match(/[?&]item_?id=(\d+)/i);
    const skuIdMatch = cleanUrl.match(/-s(\d+)\.html/i) || cleanUrl.match(/[?&]sku_?id=(\d+)/i);

    const itemId = itemIdMatch ? itemIdMatch[1] : null;
    const skuId = skuIdMatch ? skuIdMatch[1] : null;
    const targetId = skuId || itemId;

    // Fetch primary info via Catalog API
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
        } catch (catErr) {}
    }

    // Check for all SKU variations on the page to build the variation price display (e.g. "Rs 371 / Rs 449")
    if (cleanUrl) {
        try {
            const resHtml = await axios.get(cleanUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 8000
            });
            const html = resHtml.data;
            const moduleDataMatch = html.match(/var\s+__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                                    html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i);

            if (moduleDataMatch) {
                const mData = JSON.parse(moduleDataMatch[1]);
                const skus = mData?.data?.root?.fields?.productOption?.skuBase?.skus || [];

                if (skus.length > 1) {
                    const skuPromises = skus.map(s =>
                        axios.get(`https://www.daraz.com.np/catalog/?q=${s.skuId}&ajax=true`, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'application/json, text/javascript, */*; q=0.01',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            timeout: 5000
                        }).then(r => {
                            const p = r.data?.mods?.listItems?.[0]?.price;
                            if (p != null) {
                                const parsed = parseFloat(String(p).replace(/,/g, ''));
                                return !isNaN(parsed) && parsed > 0 ? parsed : null;
                            }
                            return null;
                        }).catch(() => null)
                    );

                    const skuResults = await Promise.all(skuPromises);
                    const validPrices = skuResults.filter(p => p !== null);
                    const uniquePrices = Array.from(new Set(validPrices)).sort((a, b) => a - b);

                    if (uniquePrices.length > 0) {
                        extractedPrice = uniquePrices[0]; // Set minimum price as primary numeric price
                        extractedPriceDisplay = uniquePrices.map(p => `Rs ${p}`).join(' / ');
                    }
                }
            }
        } catch (e) {}
    }

    if (!extractedPriceDisplay && extractedPrice) {
        extractedPriceDisplay = `Rs ${extractedPrice}`;
    }

    return {
        success: extractedPrice !== null,
        price: extractedPrice,
        price_display: extractedPriceDisplay,
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
