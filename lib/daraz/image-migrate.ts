import axios from 'axios'
import FormData from 'form-data'
import { buildSignedParams, signRequest, API_URL, APP_KEY, APP_SECRET } from './client'

/**
 * Strips webp transform extensions, resizing parameters (_720x720q80..., etc.)
 * from Daraz / Lazada / external image URLs.
 */
export function cleanImageUrl(url: string): string {
    if (!url) return ''
    let cleaned = url.trim()
    // Strip thumbnail transforms: e.g. .jpg_720x720q80.jpg_.webp -> .jpg
    // or .png_720x720q80.png_.webp -> .png
    cleaned = cleaned.replace(/(\.(?:jpg|jpeg|png|webp))_\d+x\d+.*$/i, '$1')
    cleaned = cleaned.replace(/_\.webp$/i, '')
    cleaned = cleaned.replace(/_\d+x\d+q\d+.*$/i, '')
    cleaned = cleaned.replace(/_\d+x\d+.*$/i, '')
    return cleaned
}

/**
 * Checks whether an image URL is already hosted on a Daraz / Lazada / Alibaba CDN domain.
 * If already hosted, it can be passed directly to Daraz product creation without calling /image/migrate.
 */
export function isAlreadyDarazCdn(url: string): boolean {
    if (!url) return false
    try {
        const hostname = new URL(url).hostname.toLowerCase()
        return (
            hostname === 'static-01.daraz.com.np' ||
            hostname.endsWith('.slatic.net')
        )
    } catch {
        return false
    }
}

// Migrate a single image from an external URL (e.g. Supabase CDN)
// to Daraz's own CDN using their /image/migrate API.
// Returns the Daraz-hosted image URL (slatic.net).
export async function migrateImageToDaraz(
    imageUrl: string,
    accessToken: string
): Promise<string> {
    const cleanUrl = cleanImageUrl(imageUrl)

    // If it is ALREADY on Daraz / Lazada CDN, it's directly valid!
    if (isAlreadyDarazCdn(cleanUrl)) {
        return cleanUrl
    }

    const apiPath = '/image/migrate'
    // Daraz /image/migrate uses an XML payload
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8" ?>
<Request>
    <Image>
        <Url>${cleanUrl}</Url>
    </Image>
</Request>`

    const params = buildSignedParams(apiPath, accessToken, { payload: xmlPayload })

    const response = await axios.post(`${API_URL}${apiPath}`, null, {
        params
    })

    if (response.data?.code !== '0' && response.data?.code !== 0) {
        throw new Error(`Daraz image migration failed: ${response.data?.message || response.data?.msg || 'Unknown error'}`)
    }

    const darazUrl = response.data?.data?.image?.url
    if (!darazUrl) {
        throw new Error('Daraz did not return an image URL after migration')
    }

    return darazUrl
}

// Migrate multiple images at once (up to 8 per Daraz limit).
// Returns clean Daraz-ready image URLs.
export async function migrateImagesToDaraz(
    imageUrls: string[],
    accessToken: string
): Promise<string[]> {
    // Daraz limit: max 8 images per product
    const limited = (imageUrls || []).slice(0, 8)
    const results: string[] = []

    for (const rawUrl of limited) {
        if (!rawUrl || typeof rawUrl !== 'string') continue
        const cleanUrl = cleanImageUrl(rawUrl)

        // 1. If it's already a clean Daraz CDN URL, accept it immediately!
        if (isAlreadyDarazCdn(cleanUrl)) {
            results.push(cleanUrl)
            continue
        }

        // 2. Try official Daraz /image/migrate
        try {
            const darazUrl = await migrateImageToDaraz(cleanUrl, accessToken)
            results.push(darazUrl)
            continue
        } catch (migrateErr: any) {
            console.warn(`[ImageMigrate] /image/migrate failed for ${cleanUrl} (${migrateErr.message}), attempting fallback to binary /image/upload...`)
        }

        // 3. Fallback: Download image and upload directly via /image/upload
        try {
            const downloadRes = await axios.get(cleanUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })
            const buffer = Buffer.from(downloadRes.data)
            const ext = cleanUrl.includes('.png') ? 'png' : 'jpg'
            const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`
            const uploadedUrl = await uploadImageToDaraz(buffer, filename, accessToken)
            results.push(uploadedUrl)
        } catch (uploadErr: any) {
            console.warn(`[ImageMigrate] Binary upload also failed for ${cleanUrl}:`, uploadErr.message)
            // If binary upload failed, but cleanUrl is a valid URL, keep cleanUrl as last resort
            if (cleanUrl.startsWith('http')) {
                results.push(cleanUrl)
            }
        }
    }

    if (results.length === 0) {
        throw new Error('All images failed to migrate to Daraz CDN')
    }

    return results
}

// Upload raw image binary directly to Daraz (alternative to migrate)
// Used when image URL is not publicly accessible or /image/migrate fails
export async function uploadImageToDaraz(
    imageBuffer: Buffer,
    filename: string,
    accessToken: string
): Promise<string> {
    const apiPath = '/image/upload'
    const params = buildSignedParams(apiPath, accessToken)

    const form = new FormData()
    // Add query params as form fields
    Object.entries(params).forEach(([key, value]) => {
        form.append(key, String(value))
    })
    form.append('image', imageBuffer, {
        filename: filename,
        contentType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
    })

    const response = await axios.post(`${API_URL}${apiPath}`, form, {
        headers: { ...form.getHeaders() }
    })

    if (response.data?.code !== '0' && response.data?.code !== 0) {
        throw new Error(`Daraz image upload failed: ${response.data?.message || 'Unknown error'}`)
    }

    const darazUrl = response.data?.data?.image?.url
    if (!darazUrl) {
        throw new Error('Daraz did not return an image URL after upload')
    }

    return darazUrl
}
