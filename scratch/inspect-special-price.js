const axios = require('axios');

async function checkSpecialPrice() {
    const url = "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;
    console.log("HTML length:", html.length);

    // Search for 499 in HTML
    const matches499 = [...html.matchAll(/499/g)];
    console.log("Found 499 occurrences count:", matches499.length);

    // Search for JSON patterns containing 499
    const regex499 = /"([^"]+)"\s*:\s*"?499"?/gi;
    let m;
    while ((m = regex499.exec(html)) !== null) {
        console.log(`Match 499: key="${m[1]}", full="${m[0]}"`);
    }

    // Search for "special_price", "salePrice", "discountPrice", "price", "originalPrice"
    const priceKeys = [...html.matchAll(/"([^"]*?(?:price|discount|sale|special)[^"]*?)":\s*("[^"]*"|\{[\s\S]*?\}|[\d.]+)/gi)];
    console.log(`\nFound ${priceKeys.length} price keys:`);
    priceKeys.forEach(pk => {
        const k = pk[1];
        const v = pk[2];
        if (v.includes('499') || v.includes('1500') || k.includes('sale') || k.includes('special')) {
            console.log(`Key: "${k}" => ${v.slice(0, 150)}`);
        }
    });
}

checkSpecialPrice();
