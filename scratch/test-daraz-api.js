const axios = require('axios');

async function testDarazEndpoints() {
    const itemId = "509834175";
    const urlsToTest = [
        `https://www.daraz.com.np/api/v1/item/detail?itemId=${itemId}`,
        `https://www.daraz.com.np/pdp/item/detail?itemId=${itemId}`,
        `https://www.daraz.com.np/products/i${itemId}.html`,
        `https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html`
    ];

    for (const u of urlsToTest) {
        console.log("\n=========================");
        console.log("Testing URL:", u);
        try {
            const res = await axios.get(u, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 5000
            });
            console.log("Status:", res.status);
            console.log("Content type:", res.headers['content-type']);
            const dataStr = typeof res.data === 'object' ? JSON.stringify(res.data) : res.data;
            console.log("Length:", dataStr.length);
            if (dataStr.includes('499')) console.log(">>> FOUND 499 IN RESPONSE! <<<");
            if (dataStr.includes('1500')) console.log(">>> FOUND 1500 IN RESPONSE! <<<");
        } catch (e) {
            console.log("Error:", e.message);
        }
    }
}

testDarazEndpoints();
