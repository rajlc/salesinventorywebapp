const fs = require('fs');
const path = require('path');

const dir = 'supabase/migrations';
const files = fs.readdirSync(dir);

files.forEach(file => {
    if (!file.endsWith('.sql')) return;
    const filePath = path.join(dir, file);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.toLowerCase().includes('exec') || content.toLowerCase().includes('sql') || content.toLowerCase().includes('query')) {
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes('create function') || line.toLowerCase().includes('create or replace function')) {
                    console.log(`In ${file} Line ${idx+1}: ${line.trim()}`);
                }
            });
        }
    } catch (err) {
        // ignore
    }
});
