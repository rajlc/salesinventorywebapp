const fs = require('fs');

const html = fs.readFileSync('scratch/daraz-page.html', 'utf8');

const match = html.match(/var\s+pdpTrackingData\s*=\s*"([^"]+)"/i) || html.match(/pdpTrackingData\s*=\s*(\{[\s\S]*?\});/i);

if (match) {
    let trackingText = match[1];
    if (trackingText.startsWith('{')) {
        console.log("Tracking Object:", trackingText);
    } else {
        // Unescape escaped JSON string
        const unescaped = trackingText.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log("Unescaped pdpTrackingData:");
        console.log(unescaped);
    }
} else {
    console.log("No pdpTrackingData match");
}
