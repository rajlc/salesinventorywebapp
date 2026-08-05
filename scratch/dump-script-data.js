const axios = require('axios');
const fs = require('fs');

async function dumpData() {
    const url = "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;
    fs.writeFileSync('scratch/daraz-page.html', html);
    console.log("Saved html, searching for keywords...");

    // Find all occurrences of "price" or "sale" (case insensitive)
    const matches = [];
    const re = /"([^"]*price[^"]*)":\s*("[^"]*"|\{[\s\S]*?\}|[\d.]+)/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        matches.push(m[0]);
    }
    console.log(`Found ${matches.length} price-like keys:`);
    matches.slice(0, 20).forEach(x => console.log(x.slice(0, 150)));
}

dumpData();
