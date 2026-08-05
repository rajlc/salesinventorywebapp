const axios = require('axios');

async function inspectAllSkus() {
    const url = "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;

    const moduleDataMatch = html.match(/var\s+__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                            html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i);

    if (moduleDataMatch) {
        const data = JSON.parse(moduleDataMatch[1]);
        const fields = data?.data?.root?.fields;

        console.log("Product Title:", fields?.product?.title);
        console.log("SKU Base Skus:", fields?.productOption?.skuBase?.skus);

        // Fetch each SKU variation page
        const skus = fields?.productOption?.skuBase?.skus || [];
        for (const s of skus) {
            const skuPageUrl = `https://www.daraz.com.np/products/${s.pagePath}`;
            console.log(`\nFetching SKU Page: ${s.skuId} -> ${skuPageUrl}`);
            try {
                const sRes = await axios.get(skuPageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                });
                const sHtml = sRes.data;
                const m = sHtml.match(/pdpTrackingData\s*=\s*"([\s\S]*?)";\s*\n/i);
                if (m) {
                    const cleanTrack = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    const trackObj = JSON.parse(cleanTrack);
                    console.log(`-> SKU ${s.skuId} pdt_price:`, trackObj.pdt_price);
                }
            } catch (e) {
                console.error("SKU fetch error:", e.message);
            }
        }
    }
}

inspectAllSkus();
