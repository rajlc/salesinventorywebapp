const fs = require('fs');

const html = fs.readFileSync('scratch/daraz-page.html', 'utf8');

// Search for pdt_ price, sold, tracking, appParams
const pdtMatches = html.match(/"pdt_[^"]+":\s*"[^"]*"/g);
console.log("PDT tracking matches:", pdtMatches);

// Search for price patterns like Rs. XXX or value
const pricePattern = html.match(/Rs\.\s*[\d,]+/gi);
console.log("Rs. matches:", pricePattern);

// Search for appParams or module data
const moduleDataMatch = html.match(/var\s+__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                        html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                        html.match(/var\s+appParams\s*=\s*(\{[\s\S]*?\});/i) ||
                        html.match(/appParams\s*:\s*(\{[\s\S]*?\})\s*,\s*pdp/i);

if (moduleDataMatch) {
    console.log("Found appParams / moduleData length:", moduleDataMatch[1].length);
    fs.writeFileSync('scratch/moduleData.json', moduleDataMatch[1]);
} else {
    console.log("No appParams / moduleData variable matched directly.");
}

// Search for sold, ratings, reviews
const soldMatch = html.match(/(\d+)\s*Sold/gi) || html.match(/"sold":\s*"?\d+"?/gi) || html.match(/"sale":\s*"?\d+"?/gi);
console.log("Sold matches:", soldMatch);

const reviewMatch = html.match(/(\d+)\s*Ratings/gi) || html.match(/(\d+)\s*Reviews/gi) || html.match(/"review":\s*"?\d+"?/gi);
console.log("Review matches:", reviewMatch);
