const axios = require('axios');
const fs = require('fs');

async function inspectHtml() {
    const url = "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    const html = res.data;

    // Find all <script> blocks
    const scripts = [];
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        if (match[1].length > 100) {
            scripts.push(match[1]);
        }
    }

    console.log(`Found ${scripts.length} script blocks`);

    scripts.forEach((s, idx) => {
        if (s.includes('price') || s.includes('pdp') || s.includes('sale') || s.includes('sku') || s.includes('rating')) {
            console.log(`--- Script #${idx} (length ${s.length}) ---`);
            const snippet = s.length > 300 ? s.slice(0, 300) + '...' : s;
            console.log(snippet);

            // Search for price keys inside JSON objects
            const priceKeys = s.match(/"salePrice":\s*\{[^}]+\}/g) || s.match(/"price":\s*\{[^}]+\}/g) || s.match(/"value":\s*"?([\d.]+)"?/g) || s.match(/"sale":\s*"?(\d+)"?/g);
            if (priceKeys) {
                console.log("Found price/sales keys:", priceKeys.slice(0, 5));
            }
        }
    });
}

inspectHtml();
