const axios = require('axios');

async function testDarazCatalog() {
    const itemIds = ["512414330", "512036345", "509834175"];

    for (const id of itemIds) {
        console.log(`\n=================== CATALOG SEARCH FOR ITEM ID ${id} ===================`);
        const searchUrl = `https://www.daraz.com.np/catalog/?q=${id}&ajax=true`;

        try {
            const res = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 8000
            });

            console.log("Status:", res.status);
            console.log("Data keys:", Object.keys(res.data || {}));
            const listItems = res.data?.mods?.listItems || [];
            console.log(`Found ${listItems.length} items in catalog response!`);

            if (listItems.length > 0) {
                listItems.forEach((item, idx) => {
                    console.log(`Item #${idx + 1}:`);
                    console.log("  Name:", item.name);
                    console.log("  Price (Special):", item.price);
                    console.log("  Original Price:", item.originalPrice);
                    console.log("  Discount:", item.discount);
                    console.log("  Price Show:", item.priceShow);
                    console.log("  Rating / Reviews:", item.ratingScore, "/", item.review);
                    console.log("  Total Sold:", item.totalSold || item.sales);
                    console.log("  SKUs count:", item.skuId);
                });
            }
        } catch (e) {
            console.error("Catalog error:", e.message);
        }
    }
}

testDarazCatalog();
