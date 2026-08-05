const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const reviewId = '8878998320612';
    const replyContent = "Thank you so much for your review! We are thrilled to serve you.";

    const { data, error } = await supabase
        .from('daraz_reviews')
        .update({
            reply_content: replyContent,
            reply_status: 'replied',
            replied_at: new Date().toISOString()
        })
        .eq('review_id', reviewId)
        .select();

    if (error) {
        console.error('Error updating review:', error);
    } else {
        console.log('Successfully updated review status:', data);
    }
}

run();
