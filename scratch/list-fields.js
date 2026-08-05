const fs = require('fs');

const jsonText = fs.readFileSync('scratch/moduleData.json', 'utf8');
const data = JSON.parse(jsonText);

console.log("Root fields keys:", Object.keys(data.data.root.fields || {}));

// Print all keys inside data
function listAllKeys(obj, prefix = '') {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(k => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (fullKey.length < 80) console.log(fullKey);
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k]) && Object.keys(obj[k]).length < 30) {
            listAllKeys(obj[k], fullKey);
        }
    });
}

listAllKeys(data.data, 'data');
