const axios = require('axios');
const fs = require('fs');

const urls = [
    { name: "Comp 1", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html?spm=a2a0e.searchlist.list.8.320827e1MjVJja" },
    { name: "Comp 2", url: "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-electric-milk-frother-with-double-whisks-usb-rechargeable-electric-foam-maker-for-coffee-latte-cappuccino-egg-whipping-i512036345.html?spm=a2a0e.searchlist.list.10.320827e1MjVJja" },
    { name: "Comp 3", url: "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-3-speed-usb-rechargeable-milk-frother-electric-milk-shaker-foam-maker-portable-coffee-machine-handheld-coffee-maker-mixer-for-latte-cappuccino-mac-coffee-protein-shake-mini-coffee-maker-egg-beater-i509834175.html?spm=a2a0e.searchlist.list.4.320827e1MjVJja" }
];

async function debugUrl(item) {
    console.log(`\n=================== DEBUGGING ${item.name} ===================`);
    console.log("URL:", item.url);

    try {
        const res = await axios.get(item.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': 'lzd_cid=0; lzd_sid=0'
            },
            timeout: 10000
        });

        const html = res.data;
        console.log("HTML length:", html.length);

        // Find all JSON script blocks
        const moduleDataMatch = html.match(/var\s+__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                                html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i);

        if (moduleDataMatch) {
            fs.writeFileSync(`scratch/${item.name.replace(/\s+/g, '_')}_data.json`, moduleDataMatch[1]);
            console.log(`Saved moduleData for ${item.name}`);

            const jsonStr = moduleDataMatch[1];
            // Find all numbers formatted like prices (e.g. 300 to 2000)
            const numbers = [...jsonStr.matchAll(/:\s*"?(\d{3,4}(?:\.\d+)?)"?/g)].map(m => parseFloat(m[1]));
            const uniqueNums = Array.from(new Set(numbers.filter(n => n >= 200 && n <= 3000)));
            console.log(`Unique price-like numbers in moduleData:`, uniqueNums.sort((a,b) => a - b));
        }

        // Search for all Rs. in raw HTML
        const allRs = [...html.matchAll(/Rs\.\s*([\d,]+)/gi)].map(m => parseFloat(m[1].replace(/,/g, '')));
        console.log(`All Rs. in raw HTML:`, Array.from(new Set(allRs)).sort((a,b) => a - b));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

async function run() {
    for (const item of urls) {
        await debugUrl(item);
    }
}

run();
