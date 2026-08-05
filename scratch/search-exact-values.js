const fs = require('fs');

const html = fs.readFileSync('scratch/daraz-page.html', 'utf8');

// Find all occurrences of "Rs." or numeric prices
const rsMatches = [...html.matchAll(/Rs\.\s*([\d.,]+)/gi)];
console.log("All Rs. matches:", rsMatches.map(m => m[0]));

// Search for any JSON fields containing "price", "sale", "sold", "rating", "review", "discount"
const jsonKeyVal = [...html.matchAll(/"([^"]*?(?:price|sale|sold|rating|review|discount)[^"]*?)":\s*("([^"]*)"|([\d.]+)|(\{[\s\S]*?\}))/gi)];

console.log(`Found ${jsonKeyVal.length} json key-value pairs:`);
jsonKeyVal.forEach(m => {
    const k = m[1];
    const v = m[2];
    if (v.length < 150) {
        console.log(`Key: "${k}" => ${v}`);
    }
});
