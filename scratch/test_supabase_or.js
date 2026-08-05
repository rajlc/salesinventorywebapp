const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jrcluodakvudjkwlrrxi.supabase.co';
const supabaseAnonKey = 'sb_publishable_QxC3QgjfijudxCB-1GgMlg__SZLiZGU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  console.log('Today start:', todayStart);

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_status, created_at, updated_at')
      .or(`order_status.in.("New Order","Follow up again","Confirmed Order","Ready to Ship","Packed"),created_at.gte.${todayStart},updated_at.gte.${todayStart}`);

    if (error) {
      console.error('Supabase error:', error);
    } else {
      console.log('Successfully fetched orders:', data.length);
      console.log('First 5 orders sample:', data.slice(0, 5));
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

test();
