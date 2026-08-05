const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

console.log("Current Env Keys:");
Object.keys(process.env).forEach(k => {
    if (k.includes('DB') || k.includes('URL') || k.includes('POSTGRES') || k.includes('SUPABASE')) {
        console.log(k);
    }
});
