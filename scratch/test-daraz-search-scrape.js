const axios = require('axios');

async function testCatalogSearch() {
    const searchUrl = "https://www.daraz.com.np/catalog/?q=509834175";
    console.log("Fetching search catalog URL:", searchUrl);

    try {
        const res = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = res.data;
        console.log("Search HTML length:", html.length);

        // Find listItems in window.pageData
        const pageDataMatch = html.match(/window\.pageData\s*=\s*(\{[\s\S]*?\});/i) || html.match(/var\s+pageData\s*=\s*(\{[\s\S]*?\});/i);
        if (pageDataMatch) {
            console.log("Found window.pageData!");
            const data = JSON.parse(pageDataMatch[1]);
            const listItems = data?.mods?.listItems || [];
            console.log(`Found ${listItems.length} listItems in search results!`);

            if (listItems.length > 0) {
                const item = listItems[0];
                console.log("Item 1 title:", item.name);
                console.log("Item 1 price:", item.price);
                console.log("Item 1 originalPrice:", item.originalPrice);
                console.log("Item 1 discount:", item.discount);
                console.log("Item 1 priceShow:", item.priceShow);
                console.log("Item 1 totalSold / sales:", item.totalSold || item.sales);
            }
        } else {
            console.log("pageData variable not found");
        }

        // Search for 499 in search HTML
        if (html.includes('499')) {
            console.log(">>> FOUND 499 IN CATALOG SEARCH HTML! <<<");
        }
    } catch (err) {
        console.error("Search error:", err.message);
    }
}

testCatalogSearch();
