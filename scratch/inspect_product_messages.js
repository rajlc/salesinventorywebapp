const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: messages, error } = await supabase
        .from('daraz_chat_messages')
        .select('*')
        .eq('template_id', '10006')
        .limit(5)

    if (error) {
        console.error('Error fetching product card messages:', error)
        return
    }

    console.log('\n--- Product Card Messages (template_id = 10006) ---')
    messages.forEach(m => {
        console.log(`Message ID: ${m.message_id}`)
        console.log(`Raw Content:`, m.content)
        try {
            console.log(`Parsed Content:`, JSON.parse(m.content))
        } catch (e) {
            console.log(`Parsing error:`, e.message)
        }
        console.log('---------------------------------')
    })
}

run()
