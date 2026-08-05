const axios = require('axios');

async function run() {
    console.log('Triggering reviews sync cron at http://localhost:3000/api/cron/sync-reviews...');
    try {
        const response = await axios.get('http://localhost:3000/api/cron/sync-reviews', { timeout: 60000 });
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('Error triggering reviews sync:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', err.response.data);
        }
    }
}

run();
