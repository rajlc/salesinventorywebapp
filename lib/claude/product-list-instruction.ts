import { createAdminClient } from '@/lib/supabase/server'

export const PRODUCT_LIST_INSTRUCTION_SETTING_KEY = 'daraz_connector_instruction'

export const DEFAULT_PRODUCT_LIST_INSTRUCTION = `You are an expert e-commerce product listing optimizer for Daraz Nepal.
Always follow these rules whenever generating a product title, description, or highlights for any draft or listing:

1. PRODUCT TITLE:
- Generate an SEO-optimized title (max 255 characters).
- Use the "|" character to separate keyword-rich segments (e.g. "Main Product Name | Key Feature 1 | Key Feature 2 | Use Case").
- If multiple Daraz store accounts are targeted, generate a UNIQUE title for each store using different keyword arrangements and angles (pass them in titles_per_store).

2. MAIN DESCRIPTION (Clean HTML):
- Start with: <p><strong>Perfect for:</strong></p>
- Follow with a <ul> list containing exactly 3 <li> bullet points describing ideal buyers or use cases.
- Underneath, write ~200 words of compelling, clean product description using <p> paragraphs and <ul><li> feature bullets where helpful.
- Do not include promotional hype or irrelevant filler.
- MULTI-STORE RULE: If multiple Daraz store accounts are targeted, generate a UNIQUE description for EACH store with different wording, structure, and buyer angles, and pass them in "descriptions_per_store" (keyed by store name, alongside "description" for the primary store).

3. HIGHLIGHTS (Key Features):
- Write 8 to 10 specific bullet points as complete, informative sentences.
- Cover: material/build quality, key design features, dimensions/weight/capacity (if relevant), use cases, compatibility, care/usage tips, and overall value.
- Each highlight should be unique and concise.
- MULTI-STORE RULE: If multiple Daraz store accounts are targeted, generate UNIQUE highlights for EACH store (different phrasing and angles) and pass them in "highlights_per_store" (keyed by store name, alongside "highlights" for the primary store).

4. FORBIDDEN WORDS (NEVER USE):
- Never use: "buy now", "buy", "online shopping", "cash on delivery", "daraz", "order now", "free shipping", "cod", "delivery charge".
- Focus purely on product features, quality, and helpful information.

5. PRICING & VARIANTS:
- When a single price is provided, treat it as the Special Price (discounted selling price); regular MRP is calculated automatically.
- If variations (colors/sizes) are mentioned, include them in variants (default stock 100, auto-generated Seller SKU).`

export interface ProductListInstructionResult {
    instruction: string
    updated_at: string | null
    is_default: boolean
}

export async function getProductListInstruction(): Promise<ProductListInstructionResult> {
    try {
        const supabase = await createAdminClient()
        const { data } = await supabase
            .from('app_settings')
            .select('value, updated_at')
            .eq('key', PRODUCT_LIST_INSTRUCTION_SETTING_KEY)
            .maybeSingle()

        const saved = typeof data?.value?.instruction === 'string'
            ? data.value.instruction.trim()
            : ''

        if (saved) {
            return {
                instruction: saved,
                updated_at: data?.updated_at || data?.value?.updated_at || null,
                is_default: false
            }
        }
    } catch (err) {
        console.error('[ProductListInstruction] Failed to load instruction:', err)
    }

    return {
        instruction: DEFAULT_PRODUCT_LIST_INSTRUCTION,
        updated_at: null,
        is_default: true
    }
}

export async function saveProductListInstruction(instruction: string): Promise<ProductListInstructionResult> {
    const trimmed = instruction.trim()
    if (!trimmed) {
        throw new Error('Instruction cannot be empty.')
    }

    const now = new Date().toISOString()
    const supabase = await createAdminClient()

    const { error } = await supabase
        .from('app_settings')
        .upsert(
            {
                key: PRODUCT_LIST_INSTRUCTION_SETTING_KEY,
                value: {
                    instruction: trimmed,
                    updated_at: now
                },
                updated_at: now
            },
            { onConflict: 'key' }
        )

    if (error) {
        throw error
    }

    return {
        instruction: trimmed,
        updated_at: now,
        is_default: false
    }
}

export async function resetProductListInstruction(): Promise<ProductListInstructionResult> {
    const supabase = await createAdminClient()
    const { error } = await supabase
        .from('app_settings')
        .delete()
        .eq('key', PRODUCT_LIST_INSTRUCTION_SETTING_KEY)

    if (error) {
        throw error
    }

    return {
        instruction: DEFAULT_PRODUCT_LIST_INSTRUCTION,
        updated_at: null,
        is_default: true
    }
}
