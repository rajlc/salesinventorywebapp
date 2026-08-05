import axios from 'axios'
import FormData from 'form-data'
import { buildSignedParams, signRequest, API_URL, APP_KEY, APP_SECRET } from './client'

// Migrate a single image from an external URL (e.g. Supabase CDN)
// to Daraz's own CDN using their /image/migrate API.
// Returns the Daraz-hosted image URL (slatic.net).
export async function migrateImageToDaraz(
    imageUrl: string,
    accessToken: string
): Promise<string> {
    const apiPath = '/image/migrate'
    // Daraz /image/migrate uses an XML payload
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8" ?>
<Request>
    <Image>
        <Url>${imageUrl}</Url>
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
// Returns a batch_id; use /image/response/get to retrieve URLs.
// For simplicity, we use the single migrate in a loop for up to 8 images.
export async function migrateImagesToDaraz(
    imageUrls: string[],
    accessToken: string
): Promise<string[]> {
    // Daraz limit: max 8 images per product
    const limited = imageUrls.slice(0, 8)
    const results: string[] = []

    for (const url of limited) {
        try {
            const darazUrl = await migrateImageToDaraz(url, accessToken)
            results.push(darazUrl)
        } catch (err: any) {
            console.warn(`[ImageMigrate] Failed to migrate ${url}:`, err.message)
            // Skip failed images, continue with others
        }
    }

    if (results.length === 0) {
        throw new Error('All images failed to migrate to Daraz CDN')
    }

    return results
}

// Upload raw image binary directly to Daraz (alternative to migrate)
// Used when image URL is not publicly accessible
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
        contentType: 'image/jpeg',
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
