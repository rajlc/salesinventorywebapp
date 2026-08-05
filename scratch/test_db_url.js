require('dotenv').config({ path: '.env.local' });
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'FOUND' : 'MISSING');
console.log('POSTGRES_URL:', process.env.POSTGRES_URL ? 'FOUND' : 'MISSING');
console.log('SUPABASE_DB_URL:', process.env.SUPABASE_DB_URL ? 'FOUND' : 'MISSING');
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'FOUND' : 'MISSING');
