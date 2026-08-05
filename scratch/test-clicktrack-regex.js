function parsePriceFromUrl(url) {
    let extractedPrice = null;
    try {
        const urlObj = new URL(url);
        const searchParams = urlObj.searchParams;

        // 1. Direct price param
        if (searchParams.has('price')) {
            const parsed = parseFloat(searchParams.get('price') || '');
            if (!isNaN(parsed) && parsed > 0) extractedPrice = parsed;
        }

        // 2. clickTrackInfo param (handles double encoding %253A or single %3A or :)
        if (!extractedPrice && searchParams.has('clickTrackInfo')) {
            const track1 = decodeURIComponent(searchParams.get('clickTrackInfo') || '');
            const track2 = decodeURIComponent(track1); // double decode

            const matchPrice = track2.match(/price[:%3A]+(\d+)/i) || track1.match(/price[:%3A]+(\d+)/i);
            if (matchPrice && matchPrice[1]) {
                const val = parseFloat(matchPrice[1]);
                if (!isNaN(val) && val > 0) extractedPrice = val;
            }
        }

        // 3. priceCompare param
        if (!extractedPrice && searchParams.has('priceCompare')) {
            const track1 = decodeURIComponent(searchParams.get('priceCompare') || '');
            const track2 = decodeURIComponent(track1);
            const matchDisplay = track2.match(/displayPrice[:%3A]+(\d+)/i) || track1.match(/displayPrice[:%3A]+(\d+)/i);
            if (matchDisplay && matchDisplay[1]) {
                const val = parseFloat(matchDisplay[1]) / 100;
                if (!isNaN(val) && val > 0) extractedPrice = val;
            }
        }
    } catch (e) {
        console.error("Parse error:", e);
    }
    return extractedPrice;
}

const testUrl1 = "https://www.daraz.com.np/products/prime-picks-premium-coffee-blender-i509834175.html?clickTrackInfo=query%253Acoffee%252Bblender%253Bprice%253A499%253Bitem_id%253A509834175";
const testUrl2 = "https://www.daraz.com.np/products/test-i123.html?price=499";
const testUrl3 = "https://www.daraz.com.np/products/test-i123.html?clickTrackInfo=price:499";

console.log("Url 1 price:", parsePriceFromUrl(testUrl1));
console.log("Url 2 price:", parsePriceFromUrl(testUrl2));
console.log("Url 3 price:", parsePriceFromUrl(testUrl3));
