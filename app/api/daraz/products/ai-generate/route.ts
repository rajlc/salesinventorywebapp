import { NextRequest, NextResponse } from 'next/server'
import { generateDarazListingContent, AiGenerationError } from '@/lib/daraz/ai-generate-service'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const result = await generateDarazListingContent({
            productName: body.productName,
            price: body.price,
            imageUrl: body.imageUrl,
            storeNames: body.storeNames,
            categoryPath: body.categoryPath,
            attributesSchema: body.attributesSchema,
            model: body.model,
        })

        return NextResponse.json(result)
    } catch (err: unknown) {
        if (err instanceof AiGenerationError) {
            return NextResponse.json({ error: err.message }, { status: err.statusCode })
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[DarazAIGenerate] Error:', err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
