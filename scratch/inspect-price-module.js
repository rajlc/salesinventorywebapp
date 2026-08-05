const fs = require('fs');

const jsonText = fs.readFileSync('scratch/moduleData.json', 'utf8');
const data = JSON.parse(jsonText);

const modules = data.data;

console.log("=== module_product_price_1 ===");
console.log(JSON.stringify(modules.module_product_price_1, null, 2));

console.log("=== module_product_review ===");
console.log(JSON.stringify(modules.module_product_review, null, 2));
