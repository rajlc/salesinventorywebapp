const axios = require('axios');

async function testFetch() {
    const url = "https://www.daraz.com.np/products/milk-frother-handheld-for-coffee-electric-hand-foamer-blender-for-drink-mixer-i512414330.html";
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 10000
        });

        const html = response.data;
        console.log("HTML length:", html.length);

        // Find all script tags or price matches
        const priceMatches = [
            ...html.matchAll(/"salePrice":\s*\{[^}]*"value":\s*([\d.]+)/gi),
            ...html.matchAll(/"price":\s*\{[^}]*"value":\s*([\d.]+)/gi),
            ...html.matchAll(/"originalPrice":\s*\{[^}]*"value":\s*([\d.]+)/gi),
            ...html.matchAll(/"price":\s*"?([\d.]+)"?/gi),
            ...html.matchAll(/"pdp-price"[^>]*>([^<]+)</gi),
            ...html.matchAll(/Rs\.\s*([\d,]+)/gi)
        ];

        console.log("Price matches count:", priceMatches.length);
        priceMatches.slice(0, 10).forEach(m => console.log("Match:", m[0], "Group 1:", m[1]));

        // Check for pdpPlatformAppConfig or __moduleData__
        const scriptMatch = html.match(/pdpPlatformAppConfig\s*=\s*(\{[\s\S]*?\});/i) ||
                            html.match(/runParams\s*=\s*(\{[\s\S]*?\});/i) ||
                            html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i);

        if (scriptMatch) {
            console.log("Found JSON config script!");
            const jsonText = scriptMatch[1];
            console.log("Snippet:", jsonText.slice(0, 500));
        } else {
            console.log("No explicit pdpPlatformAppConfig variable found.");
        }

        // Search for 'sold' or 'rating'
        const soldMatches = [...html.matchAll(/(\d+)\s*sold/gi), ...html.matchAll(/"sale":\s*"?(\d+)"?/gi)];
        console.log("Sold matches:", soldMatches.map(m => m[0]));

    } catch (err) {
        console.error("Fetch error:", err.message);
    }
}

testFetch();
