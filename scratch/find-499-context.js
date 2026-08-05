const axios = require('axios');

async function find499() {
    const url = "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;
    let idx = html.indexOf('499');
    let count = 0;
    while (idx !== -1) {
        count++;
        console.log(`\n=================== Occurrence #${count} at index ${idx} ===================`);
        const start = Math.max(0, idx - 150);
        const end = Math.min(html.length, idx + 150);
        console.log(html.slice(start, end));
        idx = html.indexOf('499', idx + 1);
    }
}

find499();
