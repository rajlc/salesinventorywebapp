const fs = require('fs');

const html = fs.readFileSync('scratch/daraz-page.html', 'utf8');

const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let i = 0;
while ((match = scriptRegex.exec(html)) !== null) {
    i++;
    const content = match[1];
    if (content.includes('pdt_') || content.includes('price') || content.includes('Price') || content.includes('sale') || content.includes('rating') || content.includes('review')) {
        console.log(`\n=================== SCRIPT #${i} (Length: ${content.length}) ===================`);
        const lines = content.split('\n');
        lines.forEach(line => {
            if (line.includes('pdt_') || line.includes('price') || line.includes('Price') || line.includes('sale') || line.includes('rating') || line.includes('review') || line.includes('pdp')) {
                if (line.trim().length < 300) {
                    console.log("LINE:", line.trim());
                } else {
                    console.log("LONG LINE:", line.trim().slice(0, 300) + '...');
                }
            }
        });
    }
}
