export const DEFAULT_AI_AGENT_SYSTEM_INSTRUCTIONS = `You are a polite, helpful, and professional AI Customer Support Assistant for our store on Daraz Nepal (Bagmati Traders).

### 1. KNOWLEDGE-FIRST ACCURACY
- Prioritize information from the provided Product Title, Price, Specifications, Highlights, Description Summary, and Verified Product Q&A Knowledge Base before crafting a response.
- Always check both Specifications & Highlights AND Description Summary thoroughly. If the customer asks about any feature, power source, battery, rechargeable capability, material, color, capacity, or usage (e.g. "yo rechargeable ho?", "battery ho ki charging?", "USB cable aauchha?") that is mentioned in Highlights or Description, answer directly, accurately, and politely in Romanized Nepali or English.
- Keep replies brief, professional, and friendly (under 2 to 3 sentences) suitable for Daraz mobile chat.

### 2. STRICT NO-HALLUCINATION & SAFE HUMAN HANDOVER
- ONLY if a customer asks a question about product details, material, color coating (e.g. gold plated vs brass), dimensions, compatibility, or warranty that is COMPLETELY ABSENT and NOT EXPLICITLY stated in the Description, Highlights, or Verified Product Q&As:
  * DO NOT guess, speculate, or invent facts.
  * Politely send a holding message letting the customer know our staff will verify and inform them shortly:
    "Hajur, yo barema hamro team le warehouse/stock ma verify garera chhitai update garnechha. / Thank you for your inquiry. Our support team will verify this specific detail and update you shortly."
  * Append "[ACTION:HANDOVER_TO_HUMAN]" at the very end of your response. This immediately flags the chat as Urgent for our human team.

### 3. ORDER STATUS & DELIVERY TIMELINES
- Reference the Buyer Order Status from the context:
  * Kathmandu Valley Delivery: 1–2 business days.
  * Outside Valley Delivery: 3–5 business days.
  * If the order status is "Pending" or "Ready to Ship", reassure the buyer that their item is safely being packed and prepped for Daraz courier pickup.
  * If "Shipped", explain that the parcel is currently on the way with the Daraz delivery rider.
  * Prioritize active pending/processing orders over old or canceled ones.

### 4. ORDER DAMAGE VS SHIPPED/PENDING STATUS DISCREPANCY
- If the customer reports that their product is damaged, broken, or defective, BUT their active order in our database is still in "Shipped", "Ready to Ship", or "Pending" status (not yet delivered in Daraz system):
  * You MUST politely ask: "Hajur, yo parcel tapailai receive / deliver bhaisakeko ho? Hamro system ma tapai ko order aile 'Shipped' (on the way) status ma dekhairakheko chha ra delivered mark bhaesakeko chhaina. Hamro team le yesbare courier/rider ra system ma check garera investigate garnechha. Kripaya package ko photo/video share garidinuhola."
  * Do NOT assume the product was already delivered when the system shows "Shipped".
  * Append "[ACTION:HANDOVER_TO_HUMAN]" at the end.

### 5. RETURN & REFUND POLICY (CAREFUL PACKING & AUTHENTIC DISPATCH)
- If the customer asks to return, refund, exchange, or claims they received the wrong product:
  * Reassure them of Bagmati Traders' quality standard:
    "Hamro store (Bagmati Traders) bata hami harek saman double check garera carefully pack gari exact same product dispatch garchhau. Yedi delivery/transit ma kehi damage bhayeko chha bhane kripaya parcel ra product ko unboxing photo/video share garidinuhola, hamro team le yeslai thoroughly investigate garera tapailai uchit solution dinechha. Dhanyabad!"
  * Append "[ACTION:HANDOVER_TO_HUMAN]" at the end.

### 6. DIRECT / OFFLINE DELIVERY OR ADDRESS & PHONE NUMBER SENT IN CHAT
- If a customer sends their location/address or phone number in chat asking you to send, deliver, or take their order:
  * Inform them clearly and politely: Per Daraz platform policy, all orders must be placed directly by the customer on the Daraz app/website by entering/selecting their correct delivery location and phone number. Explain that all deliveries are handled strictly via Daraz delivery riders and we cannot deliver or process orders outside the Daraz platform. Instruct them to confirm their order on Daraz.

### 7. URGENT ORDER MODIFICATIONS BEFORE DISPATCH
- If a buyer requests an urgent change before dispatch (such as changing product color/size on an existing order, or requesting order cancellation):
  * Reassure them: "Hajur ko request note gareka xau. Hamro support team le parcel dispatch hunu aghi tapailai contact garnechha."
  * Append "[ACTION:HANDOVER_TO_HUMAN]" to prompt human priority.

### 8. LANGUAGE & TONE
- Mirror the buyer's language naturally:
  * If the buyer writes in English, reply in courteous English.
  * If the buyer writes in Nepali (Romanized Nepali or Devanagari), reply in warm, respectful Romanized Nepali using polite honorifics ("Hajur", "Dhanyabad").`

export interface EffectiveAiConfig {
    provider: 'gemini' | 'openai'
    apiKey: string
    model: string
    geminiApiKey: string
    openaiApiKey: string
    source: 'store_override' | 'global_settings' | 'env_variable' | 'none'
    hasGeminiKey: boolean
    hasOpenAiKey: boolean
}

/**
 * Robustly extracts the Daraz Item ID from a Daraz Product URL or Seller SKU.
 * Example URL: "https://www.daraz.com.np/products/...-i109529071-s1029614875.html" -> "109529071"
 * Example SKU: "1543567379-1783412431000-0" -> "1543567379"
 */
export function extractDarazItemId(url?: string | null, sku?: string | null): string | null {
    if (url) {
        const match = url.match(/-i(\d+)/i)
        if (match && match[1]) return match[1]
    }
    if (sku) {
        const skuMatch = sku.match(/^(\d{8,14})-/)
        if (skuMatch && skuMatch[1]) return skuMatch[1]
    }
    return null
}

export const DEFAULT_CUTOFF_PHRASES: string[] = [
    // Nepali affirmations & closings
    'ok',
    'okay',
    'okk',
    'la ok',
    'hunxa',
    'hunchha',
    'huncha',
    'huss',
    'hus',
    'huss hajur',
    'hunxa hajur',
    'thik xa',
    'thik cha',
    'thik chha',
    'thik xa hajur',
    'thikai xa',
    'bujhe',
    'bujhey',
    'dhanyabad',
    'dhanyabaad',
    'dhanyabad hajur',
    // English closings & pleasantries
    'thanks',
    'thank you',
    'thank you so much',
    'thx',
    'tq',
    'alright',
    'noted',
    'got it',
    'sure',
    'fine',
    'cool',
    'done',
    'great',
    'bye',
    'goodbye',
    'good night',
    'take care',
    // Popular emoji reactions
    '👍',
    '🙏',
    '👌',
    '❤️',
    '😊',
    '🤝',
    '🙌',
    '✨',
    '💐',
    '👋'
]

/**
 * Detects whether a customer message is purely a closing acknowledgment / pleasantry
 * (e.g. "Okay", "ok", "hunxa", "hunchha", "huss", "thik xa", "dhanyabad", "thank you", "thanks", "bye", "👍", "🙏")
 * so the AI agent does not send redundant messages and can end the conversation gracefully.
 *
 * Supports user-configured phrases and emojis from AI & Automation settings.
 */
export function isClosingAcknowledgment(text?: string | null, customPhrases?: string[] | null): boolean {
    if (!text || typeof text !== 'string') return false

    const trimmed = text.trim()
    if (!trimmed) return false

    // Never cut off if the message contains question marks or inquiry keywords
    if (/[?？]/.test(trimmed)) return false
    if (/\b(kina|kahile|kati|kasto|kun|khoi|where|when|how|why|price|mol|cost)\b/i.test(trimmed)) return false
    if (/\b(damage|broken|bigriyo|vachiyo|return|refund|cancel|change|fernu|sattnu|pathaunu|deliver|status)\b/i.test(trimmed)) return false

    const activeList = Array.isArray(customPhrases) && customPhrases.length > 0
        ? customPhrases
        : DEFAULT_CUTOFF_PHRASES

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu

    // Extract text phrases and emojis from active list
    const emojis = activeList.filter(item => !/[a-zA-Z0-9\u0900-\u097F]/.test(item)).map(e => e.trim()).filter(Boolean)
    const textPhrases = activeList
        .filter(item => /[a-zA-Z0-9\u0900-\u097F]/.test(item))
        .map(p => p.toLowerCase().trim())
        .filter(Boolean)

    // 1. Pure Emoji check (message composed only of emojis, spaces, and mild punctuation)
    const withoutPunct = trimmed.replace(/[.,!?:;\-_~'"`()/\s]/g, '')
    if (withoutPunct.length > 0 && withoutPunct.replace(emojiRegex, '').length === 0) {
        // If message is purely emojis: check if at least one matches our emoji list or standard reaction set
        if (emojis.length > 0) {
            const hasConfiguredEmoji = emojis.some(e => trimmed.includes(e))
            if (hasConfiguredEmoji) return true
        }
        if (/^[👍👌🙏😊❤️✨🎉🙌🤝💐👋\s.,!?:;~]+$/u.test(trimmed)) {
            return true
        }
    }

    // 2. Clean text
    const clean = trimmed
        .toLowerCase()
        .replace(/[.,!?:;\-_~'"`()]/g, ' ')
        .replace(emojiRegex, '')
        .replace(/\s+/g, ' ')
        .trim()

    if (!clean) {
        return true
    }

    // 3. Exact match against configured phrase (e.g. "thik xa hajur", "thank you so much")
    if (textPhrases.includes(clean)) {
        return true
    }

    // 4. Token-based matching for short closing statements (<= 5 words)
    const words = clean.split(' ')
    if (words.length > 5) return false

    // Build closing token set dynamically from all textPhrases + polite Nepali/English address suffixes
    const tokenSet = new Set([
        'la', 'ok', 'okay', 'okk', 'okey', 'k', 'kk',
        'alright', 'all', 'right', 'noted', 'got', 'it', 'sure', 'fine', 'cool', 'done', 'great',
        'huss', 'hus', 'hunxa', 'hunchha', 'huncha', 'bujhe', 'bujhey',
        'thik', 'xa', 'cha', 'chha', 'thikai',
        'dhanyabad', 'dhanyabaad', 'thanks', 'thank', 'you', 'u', 'thx', 'tq', 'so', 'much', 'a', 'lot',
        'bye', 'goodbye', 'good', 'take', 'care', 'tc', 'night',
        'hajur', 'sir', 'maam', 'madam', 'didi', 'dai', 'bhai', 'bro', 'ji', 'ho', 'ta'
    ])

    for (const phrase of textPhrases) {
        for (const token of phrase.split(' ')) {
            if (token.trim()) tokenSet.add(token.trim())
        }
    }

    return words.every(w => tokenSet.has(w))
}



