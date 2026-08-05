const axios = require('axios');

async function testSkuCatalog() {
    const skuId = "12358350775";
    const searchUrl = `https://www.daraz.com.np/catalog/?q=${skuId}&ajax=true`;

    try {
        const res = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 8000
        });

        const listItems = res.data?.mods?.listItems || [];
        console.log(`Searching catalog for SKU ID ${skuId}: found ${listItems.length} items`);
        if (listItems.length > 0) {
            const item = listItems[0];
            console.log("  Price (Special):", item.price);
            console.log("  Original Price:", item.originalPrice);
            console.log("  Discount:", item.discount);
            console.log("  Price Show:", item.priceShow);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testSkuCatalog();
