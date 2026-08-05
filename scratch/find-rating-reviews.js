const fs = require('fs');

const html = fs.readFileSync('scratch/daraz-page.html', 'utf8');

// Search for any rating or review or reviewCount or sold numbers
const matches = [
    ...html.matchAll(/"ratingCount"\s*:\s*"?(\d+)"?/gi),
    ...html.matchAll(/"reviewCount"\s*:\s*"?(\d+)"?/gi),
    ...html.matchAll(/"total"\s*:\s*"?(\d+)"?/gi),
    ...html.matchAll(/"itemRating"\s*:\s*(\{[\s\S]*?\})/gi),
    ...html.matchAll(/(\d+)\s*Ratings/gi),
    ...html.matchAll(/(\d+)\s*Reviews/gi),
    ...html.matchAll(/(\d+)\s*sold/gi)
];

console.log("Found matches:");
matches.forEach(m => console.log(m[0]));
