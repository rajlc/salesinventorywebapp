import sharp from 'sharp'

export interface OptimizedImage {
    url: string
    base64: string
    mimeType: string
    dataUrl: string
    width: number
    height: number
    sizeBytes: number
}

// In-memory cache for fast repeat requests
const imageCache = new Map<string, { data: OptimizedImage; expires: number }>()

/**
 * Downloads an image from an external URL (Supabase, Daraz CDN, etc.)
 * and resizes/compresses it using sharp into an optimized JPEG.
 * Returns clean base64 data for Claude's vision model.
 */
export async function fetchAndOptimizeImage(url: string, maxDim = 1024): Promise<OptimizedImage | null> {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return null

    const cached = imageCache.get(url)
    if (cached && cached.expires > Date.now()) {
        return cached.data
    }

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            },
            signal: controller.signal
        })
        clearTimeout(timeout)

        if (!res.ok) {
            console.warn(`[ImageHelper] HTTP ${res.status} fetching image: ${url}`)
            return null
        }

        const arrayBuf = await res.arrayBuffer()
        const buf = Buffer.from(arrayBuf)

        const meta = await sharp(buf).metadata()
        const optBuf = await sharp(buf)
            .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toBuffer()

        const base64 = optBuf.toString('base64')
        const result: OptimizedImage = {
            url,
            base64,
            mimeType: 'image/jpeg',
            dataUrl: `data:image/jpeg;base64,${base64}`,
            width: meta.width || maxDim,
            height: meta.height || maxDim,
            sizeBytes: optBuf.length
        }

        // Cache for 30 minutes
        imageCache.set(url, { data: result, expires: Date.now() + 30 * 60 * 1000 })
        return result
    } catch (err: any) {
        console.warn(`[ImageHelper] Failed to fetch/optimize image ${url}:`, err.message)
        return null
    }
}
