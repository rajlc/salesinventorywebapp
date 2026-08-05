const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const newPrompt = `You are an expert e-commerce product listing optimizer for Daraz Nepal.

Given the following product details, generate a complete product listing in a SINGLE JSON response:

PRODUCT: {productName}
PRICE: NPR {price}
STORE ACCOUNTS: {storeNames}
CATEGORY PATH: {categoryPath}
CATEGORY ATTRIBUTES SCHEMA: {attributesSchema}
IMAGE AVAILABLE: {hasImage}
IMAGE URL: {imageUrl}

INSTRUCTIONS:
1. TITLES: Generate one unique SEO-optimized title for EACH store account name listed in "STORE ACCOUNTS". Each title must be different — use different keyword arrangements, keyword-rich descriptors, and angles. Max 255 characters each. Use the "|" character to separate title segments/keywords. Key format: exact store account name as the JSON key.
2. CATEGORY: Suggest the best matching Daraz category path from common Daraz Nepal categories.
3. DESCRIPTION: Generate a beautiful, rich product description using clean HTML tags.
   Structure:
   - Start with "<p><strong>Perfect for:</strong></p>"
   - Follow with an HTML unordered list "<ul>" containing exactly 3 bullet points "<li>" describing the ideal buyer or use case.
   - Below the list, if a product image is available, add the image using: "<p><img src=\"{imageUrl}\" alt=\"{productName}\" /></p>". (Use the primary image from the added images represented by {imageUrl}).
   - Underneath the image, write approximately 200 words of a compelling, beautifully-written product description using paragraphs "<p>" and lists "<ul><li>" where appropriate to highlight details.
4. HIGHLIGHTS: Write exactly 8 to 10 specific bullet points as complete sentences. Cover: product material/quality, key design features, dimensions/weight if relevant, use cases, compatibility, care instructions, and value proposition. Make each point unique and informative.
5. ATTRIBUTES: Fill values for ALL provided category attributes. Rules: (a) "brand" attribute MUST always be "No Brand", (b) for singleSelect attributes, choose the most appropriate option from the provided options array, (c) for text attributes, infer a concise appropriate value from the product context.

CRITICAL RULES:
- Absolutely DO NOT use direct promotional phrases or sales pitches in the titles, description, or highlights.
- Forbidden words/phrases to NEVER use: "buy now", "buy", "online shopping", "cash on delivery", "daraz", "order now", "free shipping", "cod", "delivery charge".
- Do not pressure or force the buyer to purchase; focus purely on the product features, quality, and organic content.

Return ONLY a valid JSON object — no markdown, no extra text, no code fences:
{
  "titles": { "StoreName1": "Unique SEO title | Key Features | Store 1", "StoreName2": "Different SEO title | Key Features | Store 2" },
  "category_suggestion": "Parent Category > Sub Category > Leaf Category",
  "description": "<p><strong>Perfect for:</strong></p><ul><li>Use Case 1</li><li>Use Case 2</li><li>Use Case 3</li></ul><p><img src=\"{imageUrl}\" alt=\"Product\" /></p><p>Beautifully written description here...</p>",
  "highlights": ["Highlight sentence 1.", "Highlight sentence 2.", "..."],
  "attributes": { "brand": "No Brand", "other_attr": "value" }
}`;

async function run() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'daraz_listing_prompt',
                value: { prompt: newPrompt },
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })
            .select();

        if (error) throw error;
        console.log("Database prompt updated successfully via Supabase JS client!", data);
    } catch (err) {
        console.error("Update failed:", err.message);
    }
}

run();
