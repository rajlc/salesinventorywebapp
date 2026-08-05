const fs = require('fs');
const path = require('path');

const query = process.argv[2];
const filePath = process.argv[3];

if (!query || !filePath) {
    console.error('Usage: node search_helper.js <query> <filePath>');
    process.exit(1);
}

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let matchesCount = 0;
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
            console.log(`${index + 1}: ${line.trim()}`);
            matchesCount++;
        }
    });
    console.log(`Total matches found: ${matchesCount}`);
} catch (err) {
    console.error('Error reading file:', err.message);
}
