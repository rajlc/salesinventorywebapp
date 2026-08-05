require('dotenv').config({ path: '.env.local' });

if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    console.log('DATABASE_URL is available!');
} else {
    console.log('DATABASE_URL is MISSING.');
}
