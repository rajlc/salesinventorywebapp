import { NextRequest, NextResponse } from 'next/server'
import { getRequestListingScope } from '@/lib/daraz/listing-access'
import {
    DEFAULT_PRODUCT_LIST_INSTRUCTION,
    getProductListInstruction,
    resetProductListInstruction,
    saveProductListInstruction
} from '@/lib/claude/product-list-instruction'

export async function GET() {
    try {
        const scope = await getRequestListingScope()
        if (!scope.userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const result = await getProductListInstruction()
        return NextResponse.json({
            ...result,
            default_instruction: DEFAULT_PRODUCT_LIST_INSTRUCTION,
            can_edit: !scope.restricted || scope.canEdit
        })
    } catch (error: any) {
        console.error('[DarazAiInstruction][GET] Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to load instruction' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const scope = await getRequestListingScope()
        if (!scope.userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }
        if (scope.restricted && !scope.canEdit) {
            return NextResponse.json({ error: 'You have view-only access to Daraz Listing' }, { status: 403 })
        }

        const body = await req.json().catch(() => ({}))

        if (body.reset === true) {
            const result = await resetProductListInstruction()
            return NextResponse.json({
                success: true,
                ...result,
                default_instruction: DEFAULT_PRODUCT_LIST_INSTRUCTION
            })
        }

        if (typeof body.instruction !== 'string' || !body.instruction.trim()) {
            return NextResponse.json({ error: 'Instruction text is required' }, { status: 400 })
        }

        const result = await saveProductListInstruction(body.instruction)
        return NextResponse.json({
            success: true,
            ...result,
            default_instruction: DEFAULT_PRODUCT_LIST_INSTRUCTION
        })
    } catch (error: any) {
        console.error('[DarazAiInstruction][POST] Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to save instruction' }, { status: 500 })
    }
}
