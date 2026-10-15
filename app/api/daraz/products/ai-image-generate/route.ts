import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import sharp from 'sharp'
import axios from 'axios'
import { DEFAULT_IMAGE_PROMPTS } from '@/lib/daraz/image-studio-constants'

// Helper: Download image buffer from URL or base64
async function getImageBuffer(urlOrBase64: string): Promise<Buffer> {
    if (urlOrBase64.startsWith('data:')) {
        const base64Data = urlOrBase64.split(',')[1] || urlOrBase64
        return Buffer.from(base64Data, 'base64')
    }

    const response = await axios.get(urlOrBase64, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    })
    return Buffer.from(response.data)
}

// Helper: Upload buffer to Supabase storage 'mobile-captures'
async function uploadToStorage(supabase: any, buffer: Buffer, prefix: string): Promise<string> {
    const fileName = `studio_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`
    const { error } = await supabase.storage
        .from('mobile-captures')
        .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true
        })

    if (error) {
        console.warn(`[AIStudioStorage] Upload failed for ${fileName}:`, error.message)
        // Fallback to data URL if storage upload has issue
        return `data:image/jpeg;base64,${buffer.toString('base64')}`
    }

    const { data: { publicUrl } } = supabase.storage
        .from('mobile-captures')
        .getPublicUrl(fileName)

    return publicUrl
}

// ── Slot 1: Pure White Studio Cover Image (100% Free / Daraz SEO) ────────────
async function generateCoverImage(rawBuffer: Buffer): Promise<Buffer> {
    // 1. Resize & center subject onto 1000x1000 square with pure white #FFFFFF
    // Daraz requires 1:1 ratio, min 330x330, recommended 1000x1000
    const processed = await sharp(rawBuffer)
        .rotate() // auto-orient from EXIF
        .resize({
            width: 900,
            height: 900,
            fit: 'inside',
            withoutEnlargement: false,
        })
        .toBuffer()

    const { width = 900, height = 900 } = await sharp(processed).metadata()

    // Create a 1000x1000 pure white canvas and composite the product in the center
    const left = Math.round((1000 - width) / 2)
    const top = Math.round((1000 - height) / 2)

    return sharp({
        create: {
            width: 1000,
            height: 1000,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
        }
    })
    .composite([
        {
            input: processed,
            top: Math.max(0, top),
            left: Math.max(0, left)
        }
    ])
    .modulate({
        brightness: 1.03,
        saturation: 1.08
    })
    .jpeg({ quality: 92 })
    .toBuffer()
}

// ── Slot 3: Refined Texture & Detail Image (100% Free / Sharp Filter) ─────────
async function generateRefinedImage(rawBuffer: Buffer): Promise<Buffer> {
    // Applies unsharp mask, enhanced clarity, and contrast leveling
    const processed = await sharp(rawBuffer)
        .rotate()
        .resize({
            width: 920,
            height: 920,
            fit: 'inside'
        })
        .sharpen({
            sigma: 1.5,
            m1: 1.2,
            m2: 0.5
        })
        .modulate({
            brightness: 1.05,
            saturation: 1.15
        })
        .toBuffer()

    const { width = 920, height = 920 } = await sharp(processed).metadata()
    const left = Math.round((1000 - width) / 2)
    const top = Math.round((1000 - height) / 2)

    return sharp({
        create: {
            width: 1000,
            height: 1000,
            channels: 3,
            background: { r: 250, g: 250, b: 252 } // clean studio off-white
        }
    })
    .composite([
        {
            input: processed,
            top: Math.max(0, top),
            left: Math.max(0, left)
        }
    ])
    .jpeg({ quality: 94 })
    .toBuffer()
}

// ── Call Google Imagen 3 API ─────────────────────────────────────────────────
async function callGoogleImagen(promptText: string, apiKey: string): Promise<Buffer | null> {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`
        const res = await axios.post(
            url,
            {
                instances: [{ prompt: promptText }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: '1:1',
                    outputOptions: { mimeType: 'image/jpeg' }
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                timeout: 30000
            }
        )

        const base64Bytes = res.data?.predictions?.[0]?.bytesBase64Encoded
        if (base64Bytes) {
            return Buffer.from(base64Bytes, 'base64')
        }
    } catch (err: any) {
        console.warn('[AIStudio-Imagen] Google Imagen 3 generation notice:', err.response?.data?.error?.message || err.message)
    }
    return null
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            rawImageUrl,
            productName = 'Product',
            categoryPath = 'E-commerce Item',
            price = '',
            selectedSlots = [1, 2, 3, 4]
        } = body

        if (!rawImageUrl) {
            return NextResponse.json({ error: 'rawImageUrl is required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        // 1. Load image studio settings
        const { data: imgRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_image_ai_settings')
            .maybeSingle()

        // Load primary AI settings for fallback Gemini key
        const { data: aiRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daraz_ai_settings')
            .maybeSingle()

        const imgSettings = imgRow?.value || {}
        const provider = imgSettings.provider || 'gemini-imagen'
        const inheritKey = imgSettings.inheritGeminiKey !== false
        const geminiApiKey = inheritKey 
            ? (aiRow?.value?.geminiApiKey || aiRow?.value?.apiKey || process.env.GEMINI_API_KEY || '')
            : (imgSettings.apiKey || process.env.GEMINI_API_KEY || '')

        const prompts = {
            slot1: imgSettings.prompts?.slot1 || DEFAULT_IMAGE_PROMPTS.slot1,
            slot2: imgSettings.prompts?.slot2 || DEFAULT_IMAGE_PROMPTS.slot2,
            slot3: imgSettings.prompts?.slot3 || DEFAULT_IMAGE_PROMPTS.slot3,
            slot4: imgSettings.prompts?.slot4 || DEFAULT_IMAGE_PROMPTS.slot4,
        }

        // Interpolate variables
        const interpolate = (template: string) => {
            return template
                .replace(/\{productName\}/g, productName)
                .replace(/\{categoryPath\}/g, categoryPath)
                .replace(/\{price\}/g, String(price || ''))
        }

        // Download raw mobile image
        const rawBuffer = await getImageBuffer(rawImageUrl)

        const results: Record<number, string> = {}

        // Process requested slots in parallel
        await Promise.all(
            selectedSlots.map(async (slot: number) => {
                try {
                    if (slot === 1) {
                        // Slot 1: Pure White Studio Cover Image (100% Free)
                        const coverBuf = await generateCoverImage(rawBuffer)
                        results[1] = await uploadToStorage(supabase, coverBuf, 'cover_slot1')
                    } else if (slot === 3) {
                        // Slot 3: Refined Texture & Detail Image (100% Free)
                        const detailBuf = await generateRefinedImage(rawBuffer)
                        results[3] = await uploadToStorage(supabase, detailBuf, 'detail_slot3')
                    } else if (slot === 2) {
                        // Slot 2: Side-by-Side / Multi-Angle View
                        const prompt2 = interpolate(prompts.slot2)
                        let slot2Buf: Buffer | null = null

                        if (provider === 'gemini-imagen' && geminiApiKey) {
                            slot2Buf = await callGoogleImagen(prompt2, geminiApiKey)
                        }

                        // Fallback: If AI generation not enabled or failed, create studio side presentation
                        if (!slot2Buf) {
                            slot2Buf = await generateCoverImage(rawBuffer)
                        }

                        results[2] = await uploadToStorage(supabase, slot2Buf, 'angle_slot2')
                    } else if (slot === 4) {
                        // Slot 4: Lifestyle & Use-Case Scene
                        const prompt4 = interpolate(prompts.slot4)
                        let slot4Buf: Buffer | null = null

                        if (provider === 'gemini-imagen' && geminiApiKey) {
                            slot4Buf = await callGoogleImagen(prompt4, geminiApiKey)
                        }

                        // Fallback: If AI generation not enabled or failed, create studio refine presentation
                        if (!slot4Buf) {
                            slot4Buf = await generateRefinedImage(rawBuffer)
                        }

                        results[4] = await uploadToStorage(supabase, slot4Buf, 'lifestyle_slot4')
                    }
                } catch (err: any) {
                    console.error(`[AIStudio] Error processing slot ${slot}:`, err.message)
                }
            })
        )

        return NextResponse.json({
            success: true,
            results,
            count: Object.keys(results).length
        })
    } catch (error: any) {
        console.error('[AIStudio] Generation endpoint failed:', error.message)
        return NextResponse.json({ error: error.message || 'Image generation failed' }, { status: 500 })
    }
}
