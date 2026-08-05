const axios = require('axios');

async function inspectSkus() {
    const url = "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;

    // Search for any numbers like 499, 450, 490, 500, etc inside script tags
    const priceRegex = /"salePrice"\s*:\s*\{[^}]*\}|"specialPrice"\s*:\s*\{[^}]*\}|"price"\s*:\s*\{[^}]*\}/gi;
    let m;
    while ((m = priceRegex.exec(html)) !== null) {
        console.log("Price obj match:", m[0]);
    }

    // Search for all numbers in JSON objects
    const numMatches = [...html.matchAll(/"([^"]*?price[^"]*?)"\s*:\s*([\d.]+)/gi)];
    console.log(`Found ${numMatches.length} numeric price matches:`);
    numMatches.forEach(nm => console.log(`${nm[1]} => ${nm[2]}`));
}

inspectSkus();
