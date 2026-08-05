const fs = require('fs');

const jsonText = fs.readFileSync('scratch/moduleData.json', 'utf8');
const data = JSON.parse(jsonText);

const fields = data.data.root.fields;

console.log("=== Product field ===");
console.log(JSON.stringify(fields.product, null, 2));
