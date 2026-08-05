const axios = require('axios');

async function inspectSkuVariation() {
    const url = "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345-s12358350775.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;
    console.log("HTML length:", html.length);

    // Extract target skuId from URL: s12358350775 -> 12358350775
    const skuIdMatch = url.match(/-s(\d+)\.html/i) || url.match(/[?&]sku_?id=(\d+)/i);
    const targetSkuId = skuIdMatch ? skuIdMatch[1] : null;
    console.log("Target SKU ID from URL:", targetSkuId);

    // Find __moduleData__ or appParams
    const moduleDataMatch = html.match(/var\s+__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                            html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i);

    if (moduleDataMatch) {
        const data = JSON.parse(moduleDataMatch[1]);
        const fields = data?.data?.root?.fields;

        console.log("\n=== pdpTrackingData ===");
        const trackingMatch = html.match(/pdpTrackingData\s*=\s*"([\s\S]*?)";\s*\n/i);
        if (trackingMatch) {
            const cleanTrack = trackingMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            try {
                const trackObj = JSON.parse(cleanTrack);
                console.log("pdt_price in tracking:", trackObj.pdt_price);
                console.log("pdt_simplesku in tracking:", trackObj.pdt_simplesku);
                console.log("pdt_sku in tracking:", trackObj.pdt_sku);
            } catch (e) {}
        }

        console.log("\n=== skuInfos ===");
        if (fields?.skuInfos) {
            console.log("skuInfos keys:", Object.keys(fields.skuInfos));
            for (const [sId, sObj] of Object.entries(fields.skuInfos)) {
                console.log(`SKU ${sId}:`, JSON.stringify(sObj, null, 2));
            }
        }

        console.log("\n=== skuBase.skus ===");
        const skus = fields?.productOption?.skuBase?.skus || [];
        skus.forEach(s => {
            console.log("SKU:", s.skuId, "propPath:", s.propPath, "pagePath:", s.pagePath);
        });

        // Search for targetSkuId in html text
        if (targetSkuId) {
            const skuIdx = html.indexOf(targetSkuId);
            console.log(`\nTarget SKU ID ${targetSkuId} found in HTML at index: ${skuIdx}`);
            if (skuIdx !== -1) {
                console.log(html.slice(Math.max(0, skuIdx - 150), Math.min(html.length, skuIdx + 300)));
            }
        }
    }
}

inspectSkuVariation();
