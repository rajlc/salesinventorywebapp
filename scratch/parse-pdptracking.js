const fs = require('fs');

const html = fs.readFileSync('scratch/daraz-page.html', 'utf8');

const match = html.match(/pdpTrackingData\s*=\s*"([\s\S]*?)";\s*\n/i);

if (match) {
    const raw = match[1];
    const clean = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    try {
        const parsed = JSON.parse(clean);
        console.log("pdpTrackingData Parsed:");
        console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
        console.log("Raw clean string:", clean);
    }
}
