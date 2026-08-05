const fs = require('fs');

const jsonText = fs.readFileSync('scratch/moduleData.json', 'utf8');

try {
    const data = JSON.parse(jsonText);
    console.log("JSON parsed successfully! Top keys:", Object.keys(data));

    // Recursively search for keys containing price, sold, review, rating, stock
    function searchObj(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        for (const [key, val] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            const kLower = key.toLowerCase();

            if (kLower.includes('price') || kLower.includes('sold') || kLower.includes('rating') || kLower.includes('review') || kLower.includes('stock')) {
                if (typeof val !== 'object' || val === null) {
                    console.log(`[Key Match] ${currentPath} =`, val);
                } else if (val.text || val.value) {
                    console.log(`[Object Match] ${currentPath} =`, JSON.stringify(val));
                }
            }
            if (typeof val === 'object' && val !== null) {
                searchObj(val, currentPath);
            }
        }
    }

    searchObj(data);
} catch (err) {
    console.error("JSON parse error:", err.message);
    // Regex search inside text
    const prices = jsonText.match(/"text"\s*:\s*"Rs\.\s*[\d,]+"/gi) || jsonText.match(/"value"\s*:\s*[\d.]+/gi);
    console.log("Regex price matches inside moduleData:", prices?.slice(0, 10));
}
