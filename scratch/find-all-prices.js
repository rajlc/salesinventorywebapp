const fs = require('fs');

const jsonText = fs.readFileSync('scratch/moduleData.json', 'utf8');

// Find all matches of "salePrice", "originalPrice", "price", "sale", "review", "rating"
const matches = [...jsonText.matchAll(/"([^"]*(?:price|sale|sold|rating|review)[^"]*)":\s*("[^"]*"|\{[\s\S]*?\}|[\d.]+)/gi)];

console.log(`Found ${matches.length} matches:`);
matches.forEach(m => {
    console.log(`Key: ${m[1]} -> Val: ${m[2].slice(0, 100)}`);
});
