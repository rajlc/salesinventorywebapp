const axios = require('axios');

async function locate499() {
    const url = "https://www.daraz.com.np/products/i509834175.html";
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const html = res.data;
    console.log("HTML length:", html.length);

    let idx = html.indexOf('499');
    let count = 0;
    while (idx !== -1) {
        count++;
        console.log(`\n=================== Occurrence #${count} at index ${idx} ===================`);
        const start = Math.max(0, idx - 200);
        const end = Math.min(html.length, idx + 200);
        console.log(html.slice(start, end));
        idx = html.indexOf('499', idx + 1);
    }
}

locate499();
