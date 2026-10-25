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
        timeout: 25000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    })
    return Buffer.from(response.data)
}

// Helper: Upload buffer to Supabase storage 'mobile-captures'
async function uploadToStorage(supabase: any, buffer: Buffer, prefix: string): Promise<string> {
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`
    const { error } = await supabase.storage
        .from('mobile-captures')
        .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true
        })

    if (error) {
        console.warn(`[AIStudioStorage] Upload failed for ${fileName}:`, error.message)
        return `data:image/jpeg;base64,${buffer.toString('base64')}`
    }

    const { data: { publicUrl } } = supabase.storage
        .from('mobile-captures')
        .getPublicUrl(fileName)

    return publicUrl
}

// ── Slot 1: Pure White Studio Cover Image (100% Daraz SEO Compliant) ─────────
async function generateCoverImage(subjectBuffer: Buffer, isCutout: boolean): Promise<Buffer> {
    let input = subjectBuffer
    if (isCutout) {
        try {
            input = await sharp(subjectBuffer).trim().toBuffer()
        } catch {
            input = subjectBuffer
        }
    }

    const resized = await sharp(input)
        .rotate()
        .resize({ width: 800, height: 800, fit: 'inside' })
        .toBuffer()

    const { width = 800, height = 800 } = await sharp(resized).metadata()
    const top = Math.round((1000 - height) / 2) - 15
    const left = Math.round((1000 - width) / 2)

    // Soft realistic ground contact shadow beneath product
    const shadowSvg = Buffer.from(
        `<svg width="${width + 60}" height="40" xmlns="http://www.w3.org/2000/svg">` +
        `<ellipse cx="${(width + 60) / 2}" cy="20" rx="${width * 0.38}" ry="12" fill="rgba(0,0,0,0.18)" filter="blur(6px)" />` +
        `</svg>`
    )

    return sharp({
        create: {
            width: 1000,
            height: 1000,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
        }
    })
    .composite([
        { input: shadowSvg, top: Math.min(960, top + height - 18), left: Math.max(0, left - 30) },
        { input: resized, top: Math.max(0, top), left: Math.max(0, left) }
    ])
    .modulate({ brightness: 1.03, saturation: 1.08 })
    .jpeg({ quality: 95 })
    .toBuffer()
}

// ── Slot 2: Side-by-Side / Multi-Angle Showcase ──────────────────────────────
async function generateSideBySideImage(subjectBuffer: Buffer, isCutout: boolean): Promise<Buffer> {
    let input = subjectBuffer
    if (isCutout) {
        try {
            input = await sharp(subjectBuffer).trim().toBuffer()
        } catch {
            input = subjectBuffer
        }
    }

    const mainView = await sharp(input)
        .rotate()
        .resize({ width: 560, height: 680, fit: 'inside' })
        .toBuffer()
    const mainMeta = await sharp(mainView).metadata()

    // Secondary perspective: focused zoom callout
    const detailCrop = await sharp(input)
        .rotate()
        .resize({ width: 380, height: 420, fit: 'cover', position: 'top' })
        .modulate({ brightness: 1.05, saturation: 1.1 })
        .sharpen({ sigma: 1.5 })
        .toBuffer()

    const detailFramed = await sharp(detailCrop)
        .extend({ top: 6, bottom: 6, left: 6, right: 6, background: '#FFFFFF' })
        .toBuffer()
    const framedMeta = await sharp(detailFramed).metadata()

    const topMain = Math.round((1000 - (mainMeta.height || 600)) / 2)
    const topDetail = Math.round((1000 - (framedMeta.height || 420)) / 2) - 25

    return sharp({
        create: {
            width: 1000,
            height: 1000,
            channels: 3,
            background: { r: 248, g: 249, b: 251 }
        }
    })
    .composite([
        { input: mainView, top: Math.max(0, topMain), left: 50 },
        { input: detailFramed, top: Math.max(0, topDetail), left: 550 }
    ])
    .jpeg({ quality: 95 })
    .toBuffer()
}

// ── Slot 3: Refined Texture & Macro Detail ───────────────────────────────────
async function generateRefinedImage(subjectBuffer: Buffer, isCutout: boolean): Promise<Buffer> {
    let input = subjectBuffer
    if (isCutout) {
        try {
            input = await sharp(subjectBuffer).trim().toBuffer()
        } catch {
            input = subjectBuffer
        }
    }

    const processed = await sharp(input)
        .rotate()
        .resize({ width: 900, height: 900, fit: 'inside' })
        .modulate({ brightness: 1.06, saturation: 1.15 })
        .sharpen({ sigma: 2.0, m1: 1.5, m2: 0.8 })
        .toBuffer()

    const { width = 900, height = 900 } = await sharp(processed).metadata()
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
        { input: processed, top: Math.max(0, top), left: Math.max(0, left) }
    ])
    .jpeg({ quality: 96 })
    .toBuffer()
}

// ── Slot 4: Modern Studio Pedestal / Lifestyle Showcase ──────────────────────
async function generateLifestyleImage(subjectBuffer: Buffer, isCutout: boolean): Promise<Buffer> {
    let input = subjectBuffer
    if (isCutout) {
        try {
            input = await sharp(subjectBuffer).trim().toBuffer()
        } catch {
            input = subjectBuffer
        }
    }

    // Modern studio cylinder podium with soft ambient lighting
    const podiumSvg = Buffer.from(
        '<svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
        '  <radialGradient id="bg" cx="50%" cy="30%" r="70%">' +
        '    <stop offset="0%" stop-color="#F3F4F6"/>' +
        '    <stop offset="100%" stop-color="#E5E7EB"/>' +
        '  </radialGradient>' +
        '  <linearGradient id="podiumTop" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '    <stop offset="0%" stop-color="#FFFFFF"/>' +
        '    <stop offset="100%" stop-color="#F3F4F6"/>' +
        '  </linearGradient>' +
        '  <linearGradient id="podiumBase" x1="0%" y1="0%" x2="0%" y2="100%">' +
        '    <stop offset="0%" stop-color="#E5E7EB"/>' +
        '    <stop offset="100%" stop-color="#D1D5DB"/>' +
        '  </linearGradient>' +
        '</defs>' +
        '<rect width="1000" height="1000" fill="url(#bg)"/>' +
        '<ellipse cx="500" cy="850" rx="360" ry="60" fill="rgba(0,0,0,0.06)" filter="blur(15px)"/>' +
        '<rect x="220" y="780" width="560" height="80" rx="20" fill="url(#podiumBase)"/>' +
        '<ellipse cx="500" cy="780" rx="280" ry="45" fill="url(#podiumTop)"/>' +
        '</svg>'
    )

    const podiumBase = await sharp(podiumSvg).png().toBuffer()
    const product = await sharp(input)
        .rotate()
        .resize({ width: 720, height: 600, fit: 'inside' })
        .toBuffer()
    const { width = 720, height = 600 } = await sharp(product).metadata()

    const shadowSvg = Buffer.from(
        `<svg width="${width + 40}" height="35" xmlns="http://www.w3.org/2000/svg">` +
        `<ellipse cx="${(width + 40) / 2}" cy="17" rx="${width * 0.42}" ry="10" fill="rgba(0,0,0,0.22)" filter="blur(7px)"/>` +
        `</svg>`
    )

    const productBottomY = 780
    const productTopY = Math.max(20, productBottomY - height + 15)
    const productLeftX = Math.round((1000 - width) / 2)

    return sharp(podiumBase)
        .composite([
            { input: shadowSvg, top: productBottomY - 15, left: Math.max(0, productLeftX - 20) },
            { input: product, top: productTopY, left: Math.max(0, productLeftX) }
        ])
        .jpeg({ quality: 95 })
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
        console.warn('[AIStudio-Imagen] Google Imagen 3 notice:', err.response?.data?.error?.message || err.message)
    }
    return null
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            rawImageUrl,
            cutoutBase64,
            productName = 'Product',
            categoryPath = 'E-commerce Item',
            price = '',
            selectedSlots = [1, 2, 3, 4]
        } = body

        if (!rawImageUrl && !cutoutBase64) {
            return NextResponse.json({ error: 'rawImageUrl or cutoutBase64 is required' }, { status: 400 })
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

        const interpolate = (template: string) => {
            return template
                .replace(/\{productName\}/g, productName)
                .replace(/\{categoryPath\}/g, categoryPath)
                .replace(/\{price\}/g, String(price || ''))
        }

        // Determine subject buffer: prefer transparent cutout if available
        let subjectBuffer: Buffer
        let isCutout = false

        if (cutoutBase64) {
            subjectBuffer = await getImageBuffer(cutoutBase64)
            isCutout = true
        } else {
            subjectBuffer = await getImageBuffer(rawImageUrl)
        }

        const results: Record<number, string> = {}

        // Process requested slots in parallel
        await Promise.all(
            selectedSlots.map(async (slot: number) => {
                try {
                    if (slot === 1) {
                        // Slot 1: Pure White Studio Cover Image
                        const coverBuf = await generateCoverImage(subjectBuffer, isCutout)
                        results[1] = await uploadToStorage(supabase, coverBuf, 'daraz_prod_white_cover')
                    } else if (slot === 2) {
                        // Slot 2: Side-by-Side / Multi-Angle View
                        let slot2Buf: Buffer | null = null
                        if (provider === 'gemini-imagen' && geminiApiKey) {
                            const prompt2 = interpolate(prompts.slot2)
                            slot2Buf = await callGoogleImagen(prompt2, geminiApiKey)
                        }

                        if (!slot2Buf) {
                            slot2Buf = await generateSideBySideImage(subjectBuffer, isCutout)
                        }

                        results[2] = await uploadToStorage(supabase, slot2Buf, 'daraz_prod_perspective_view')
                    } else if (slot === 3) {
                        // Slot 3: Refined Texture & Macro Detail
                        const detailBuf = await generateRefinedImage(subjectBuffer, isCutout)
                        results[3] = await uploadToStorage(supabase, detailBuf, 'daraz_prod_texture_detail')
                    } else if (slot === 4) {
                        // Slot 4: Modern Studio Pedestal / Lifestyle Scene
                        let slot4Buf: Buffer | null = null
                        if (provider === 'gemini-imagen' && geminiApiKey) {
                            const prompt4 = interpolate(prompts.slot4)
                            slot4Buf = await callGoogleImagen(prompt4, geminiApiKey)
                        }

                        if (!slot4Buf) {
                            slot4Buf = await generateLifestyleImage(subjectBuffer, isCutout)
                        }

                        results[4] = await uploadToStorage(supabase, slot4Buf, 'daraz_prod_studio_showcase')
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
