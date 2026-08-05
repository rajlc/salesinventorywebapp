const fs = require('fs');

const html = fs.readFileSync('scratch/daraz-page.html', 'utf8');

// Find all URLs matching api, pdp, detail, mtop, lazada
const apiMatches = [...html.matchAll(/(https?:)?\/\/[^"'\s]+\b(?:api|pdp|mtop|detail|getVouchers|price)[^"'\s]*/gi)];

console.log(`Found ${apiMatches.length} API-like URLs in HTML:`);
apiMatches.forEach(m => console.log(m[0]));
