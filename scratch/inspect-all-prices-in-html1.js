const axios = require('axios');

async function inspectAllPrices() {
    const url = "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;

    // Search for all Rs. occurrences
    const rsMatches = [...html.matchAll(/Rs\.\s*([\d.,]+)/gi)];
    console.log("All Rs. matches:", rsMatches.map(m => m[0]));

    // Find pdpTrackingData
    const trackingMatch = html.match(/pdpTrackingData\s*=\s*"([\s\S]*?)";\s*\n/i) || html.match(/var\s+pdpTrackingData\s*=\s*("[\s\S]*?");/i);
    if (trackingMatch) {
        console.log("Tracking match raw:", trackingMatch[1].slice(0, 300));
    }

    // Search for "price" or "sale" in json
    const jsonMatches = [...html.matchAll(/"([^"]*?(?:price|sale|discount|special|original)[^"]*?)":\s*("([^"]*)"|([\d.]+)|(\{[\s\S]*?\}))/gi)];
    console.log(`Found ${jsonMatches.length} json matches:`);
    jsonMatches.forEach(m => {
        if (m[2].length < 100) {
            console.log(`${m[1]} => ${m[2]}`);
        }
    });
}

inspectAllPrices();
