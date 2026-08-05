const axios = require('axios');

async function testVariations() {
    const items = [
        { name: "Comp 1", itemId: "512414330", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html" },
        { name: "Comp 2", itemId: "512036345", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345.html" },
        { name: "Comp 3", itemId: "509834175", url: "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html" }
    ];

    for (const item of items) {
        console.log(`\n=================== ${item.name} (Item ID: ${item.itemId}) ===================`);

        // 1. Fetch Catalog API
        const catalogUrl = `https://www.daraz.com.np/catalog/?q=${item.itemId}&ajax=true`;
        const resCat = await axios.get(catalogUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const catItem = resCat.data?.mods?.listItems?.[0];
        if (catItem) {
            console.log("Catalog Item fields:", Object.keys(catItem));
            console.log("Catalog price:", catItem.price, "originalPrice:", catItem.originalPrice);
            if (catItem.skuId) console.log("Catalog skuId:", catItem.skuId);
            if (catItem.skus) console.log("Catalog skus:", catItem.skus);
        }

        // 2. Fetch HTML to inspect all SKU variation pagePaths or prices
        const resHtml = await axios.get(item.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        const html = resHtml.data;
        const moduleDataMatch = html.match(/var\s+__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                                html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i);

        if (moduleDataMatch) {
            const mData = JSON.parse(moduleDataMatch[1]);
            const skus = mData?.data?.root?.fields?.productOption?.skuBase?.skus || [];
            console.log(`Found ${skus.length} SKU variations in HTML skuBase:`);

            const skuPrices = [];
            for (const s of skus) {
                const sCatUrl = `https://www.daraz.com.np/catalog/?q=${s.skuId}&ajax=true`;
                try {
                    const sRes = await axios.get(sCatUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    });
                    const sItem = sRes.data?.mods?.listItems?.[0];
                    if (sItem && sItem.price) {
                        const p = parseFloat(String(sItem.price).replace(/,/g, ''));
                        if (!isNaN(p) && p > 0) {
                            skuPrices.push({ skuId: s.skuId, price: p, propPath: s.propPath });
                        }
                    }
                } catch (e) {}
            }

            console.log("All SKU prices fetched via Catalog API:", skuPrices);

            // Deduplicate prices
            const uniquePrices = Array.from(new Set(skuPrices.map(x => x.price))).sort((a,b) => a - b);
            console.log("Unique Variation Prices:", uniquePrices);
            const formatted = uniquePrices.map(p => `Rs. ${p}`).join(' / ');
            console.log("Formatted Price Display String:", formatted);
        }
    }
}

testVariations();
