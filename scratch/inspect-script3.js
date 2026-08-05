const axios = require('axios');

async function inspectScript3() {
    const url = "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        }
    });

    const html = res.data;

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
        console.log("JSON-LD found:");
        console.log(jsonLdMatch[1]);
    } else {
        console.log("No JSON-LD found");
    }

    // Also inspect appParams or appConfig in the script tags
    const appParamsMatch = html.match(/appParams\s*:\s*(\{[\s\S]*?\})\s*,\s*pdp/i) ||
                           html.match(/pdpData\s*=\s*(\{[\s\S]*?\});/i) ||
                           html.match(/window\.__appData__\s*=\s*(\{[\s\S]*?\});/i);
    if (appParamsMatch) {
        console.log("App params snippet:", appParamsMatch[1].slice(0, 500));
    }

    // Check for price / sales in all scripts
    const skuMatches = html.match(/"salePrice":\s*\{[^}]+\}/g);
    console.log("salePrice matches:", skuMatches);

    const priceMatches = html.match(/"price":\s*"[\d.]+"/g) || html.match(/"price":\s*[\d.]+/g);
    console.log("price matches:", priceMatches);

    const ratingMatches = html.match(/"ratingCount":\s*"?\d+"?/g) || html.match(/"reviewCount":\s*"?\d+"?/g);
    console.log("rating matches:", ratingMatches);

    const soldMatches = html.match(/"sold":\s*"?\d+"?/g) || html.match(/"totalSold":\s*"?\d+"?/g) || html.match(/\d+\s*sold/gi);
    console.log("sold matches:", soldMatches);
}

inspectScript3();
