const fs = require('fs');

const jsonText = fs.readFileSync('scratch/moduleData.json', 'utf8');
const data = JSON.parse(jsonText);

const fields = data.data.root.fields;
console.log("Root fields keys:", Object.keys(fields));

if (fields.skuInfos) {
    console.log("skuInfos:", JSON.stringify(fields.skuInfos, null, 2));
}

if (fields.productOption) {
    console.log("productOption:", JSON.stringify(fields.productOption, null, 2));
}

if (fields.skuGalary) {
    console.log("skuGalary:", JSON.stringify(fields.skuGalary, null, 2));
}

// Print all values in fields that have numbers or price
Object.keys(fields).forEach(k => {
    const val = fields[k];
    const s = JSON.stringify(val);
    if (s.includes('price') || s.includes('Price') || s.includes('sale') || s.includes('sold') || s.includes('rating') || s.includes('review')) {
        console.log(`=== Field: ${k} ===`);
        console.log(s.length > 500 ? s.slice(0, 500) + '...' : s);
    }
});
