const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'daraz_ai_settings')
        .single();
    
    const apiKey = settings?.value?.apiKey;
    if (!apiKey) {
        console.error('No API key found in app_settings table');
        return;
    }

    const productName = 'Shoe Deodorizer and Foot Spray';
    console.log('Asking OpenAI for category suggestion for:', productName);

    const prompt = `You are a product categorization expert.
Identify the e-commerce category paths for the following product on Daraz Nepal (Lazada).
PRODUCT: "${productName}"

Suggest up to 3 most relevant leaf category paths. Output ONLY a valid JSON array of strings (the category paths, using ' > ' as separator). Do not include markdown code fences or extra text.

Example response:
["Fashion > Men > Shoes > Shoes Accessories", "Health & Beauty > Bath & Body > Foot Care > Foot Deodorant"]`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You always respond with valid JSON arrays of strings.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                response_format: { type: 'json_object' }
            })
        });

        const result = await response.json();
        console.log('OpenAI raw response:', result.choices?.[0]?.message?.content);
    } catch (err) {
        console.error('Failed:', err.message);
    }
}

run();
