const axios = require('axios');

async function inspectCatalog() {
    const url = "https://www.daraz.com.np/catalog/?q=509834175";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;

    // Search for any script tag containing price or item
    const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    console.log(`Found ${scripts.length} script tags`);

    scripts.forEach((s, idx) => {
        if (s.includes('price') || s.includes('499') || s.includes('listItems') || s.includes('items')) {
            console.log(`\n--- Script #${idx} ---`);
            console.log(s.slice(0, 400));
        }
    });
}

inspectCatalog();
