const axios = require('axios');

async function testMobile() {
    const desktopUrl = "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html";
    const mobileUrl = desktopUrl.replace('www.daraz.com.np', 'm.daraz.com.np');

    console.log("Fetching Mobile URL:", mobileUrl);

    try {
        const res = await axios.get(mobileUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = res.data;
        console.log("Mobile HTML length:", html.length);

        // Find 499 or special price in Mobile HTML
        const rsMatches = [...html.matchAll(/Rs\.\s*([\d.,]+)/gi)];
        console.log("Mobile Rs. matches:", rsMatches.map(m => m[0]));

        const priceMatches = [...html.matchAll(/"salePrice"\s*:\s*"([^"]+)"/gi), ...html.matchAll(/"special_price"\s*:\s*"([^"]+)"/gi), ...html.matchAll(/"price"\s*:\s*"([^"]+)"/gi)];
        console.log("Mobile Price matches:", priceMatches.map(m => m[0]));

        // Search for 499 in mobile HTML
        if (html.includes('499')) {
            console.log("FOUND 499 IN MOBILE HTML!");
            const idx = html.indexOf('499');
            console.log(html.slice(Math.max(0, idx - 100), Math.min(html.length, idx + 100)));
        } else {
            console.log("499 not found directly in mobile HTML");
        }
    } catch (err) {
        console.error("Mobile fetch error:", err.message);
    }
}

testMobile();
