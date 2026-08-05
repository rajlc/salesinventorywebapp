const fs = require('fs');

const html = fs.readFileSync('scratch/daraz-page.html', 'utf8');

// Find __moduleData__ or appParams
const moduleDataMatch = html.match(/var\s+__moduleData__\s*=\s*(\{[\s\S]*?\});/i) ||
                        html.match(/window\.__moduleData__\s*=\s*(\{[\s\S]*?\});/i);

if (moduleDataMatch) {
    const data = JSON.parse(moduleDataMatch[1]);
    console.log("Root fields keys:", Object.keys(data.data.root.fields));

    const fields = data.data.root.fields;

    // Check skuInfos
    if (fields.skuInfos) {
        console.log("skuInfos keys:", Object.keys(fields.skuInfos));
        console.log("skuInfos content:", JSON.stringify(fields.skuInfos, null, 2));
    }

    // Check skuGalleries or productOption
    if (fields.productOption) {
        console.log("productOption:", JSON.stringify(fields.productOption, null, 2));
    }

    // Check flashSale or atmosphereInfo
    if (fields.globalConfig) {
        console.log("globalConfig:", JSON.stringify(fields.globalConfig, null, 2));
    }
}
