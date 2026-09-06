import { NextRequest, NextResponse } from 'next/server'
import {
    listDarazStores,
    saveProductDraft,
    bulkAddProducts,
    getDraftListings,
    pushProductToDaraz
} from '@/lib/claude/connector-service'

// ── CORS Helper ─────────────────────────────────────────────────────────────

function withCors(response: NextResponse | Response): Response {
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, mcp-session-id')
    return response
}

export async function OPTIONS() {
    return withCors(new NextResponse(null, { status: 204 }))
}

// ── Authentication Helper ───────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
    const requiredKey = process.env.CLAUDE_CONNECTOR_API_KEY
    if (!requiredKey || requiredKey.trim() === '') {
        return true // Open if no secret key configured
    }

    const authHeader = req.headers.get('authorization')
    const customHeader = req.headers.get('x-api-key')
    const queryKey = req.nextUrl.searchParams.get('key')

    if (authHeader && authHeader.replace(/^Bearer\s+/i, '').trim() === requiredKey) {
        return true
    }
    if (customHeader && customHeader.trim() === requiredKey) {
        return true
    }
    if (queryKey && queryKey.trim() === requiredKey) {
        return true
    }

    return false
}

// ── MCP Tool Definitions ────────────────────────────────────────────────────

const CLAUDE_TOOLS = [
    {
        name: 'list_daraz_stores',
        description: 'List all connected Daraz seller store accounts (e.g., Bagmati Traders) with their account IDs and status.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'save_product_draft',
        description: 'Save a single product draft into the webapp database. CRITICAL RULES FOR CLAUDE: 1) ALWAYS make ONLY ONE tool call per product. Even if user mentions multiple stores (e.g. "Balaju shop and Bagmati"), DO NOT call this tool multiple times! Make ONE single call and pass store_accounts: ["Balaju Shop", "Bagmati Traders"] and unique titles in titles_per_store. 2) You MUST generate the full SEO title, rich HTML description, and bullet-point highlights and pass them DIRECTLY in the tool arguments ("title", "description", "highlights"). DO NOT omit them from the tool arguments or only write them in chat! 3) The status is saved as "draft".',
        inputSchema: {
            type: 'object',
            properties: {
                raw_name: {
                    type: 'string',
                    description: 'The raw/short product name entered by the user (e.g. "Rechargeable Milk Frother")'
                },
                title: {
                    type: 'string',
                    description: 'MANDATORY: The SEO-optimized Daraz product title you generated (e.g. "Rechargeable Milk Frother - Electric Handheld Coffee & Milk Foam Maker"). Saved in Product Title (Name on Daraz).'
                },
                description: {
                    type: 'string',
                    description: 'MANDATORY: Full rich HTML product description with <p>, <ul>, <li> tags to be saved in Main Description. Put your exact generated description here.'
                },
                highlights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'MANDATORY: Array of key highlight bullet points (e.g. ["Rechargeable via USB", "Whips smooth, creamy foam in under 30 seconds"]). Put your exact generated highlights here.'
                },
                price: {
                    type: 'number',
                    description: 'Selling price in NPR (Rs.)'
                },
                titles_per_store: {
                    type: 'object',
                    description: 'Optional: If multiple seller accounts are requested (e.g. "Balaju shop and Bagmati"), provide unique SEO titles for each store: {"Balaju Shop": "Title 1...", "Bagmati Traders": "Title 2..."}'
                },
                special_price: {
                    type: 'number',
                    description: 'Optional promotional or discounted price in NPR'
                },
                store_accounts: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of target Daraz seller accounts (e.g. ["Balaju Shop", "Bagmati Traders"]). If user targets multiple stores, list ALL of them in this single array. DO NOT call this tool multiple times!'
                },
                store_account_name: {
                    type: 'string',
                    description: 'Single seller account name (e.g. "Bagmati" or "Balaju Shop")'
                },
                category_path: {
                    type: 'string',
                    description: 'Optional suggested category path (e.g. "Home Appliances > Small Kitchen Appliances > Coffee Machines & Accessories > Milk Frothers")'
                },
                images: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional list of image URLs for the product'
                },
                wholesale_price: {
                    type: 'number',
                    description: 'Cost or wholesale purchase price in NPR'
                }
            },
            required: ['raw_name', 'title', 'description', 'highlights', 'price']
        }
    },
    {
        name: 'bulk_add_products',
        description: 'Add multiple products at once to the webapp as drafts. Perfect for when a new shipment or bulk inventory arrives.',
        inputSchema: {
            type: 'object',
            properties: {
                products: {
                    type: 'array',
                    description: 'List of arrived products to add',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Product name/item description' },
                            price: { type: 'number', description: 'Selling price in NPR' },
                            special_price: { type: 'number', description: 'Optional special price' },
                            wholesale_price: { type: 'number', description: 'Cost price' },
                            images: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['name']
                    }
                },
                store_account_name: {
                    type: 'string',
                    description: 'Optional Daraz seller account name for all products (e.g. "Bagmati")'
                }
            },
            required: ['products']
        }
    },
    {
        name: 'push_product_to_daraz',
        description: 'Push a product directly to the Daraz seller account (e.g. Bagmati). Auto-generates AI title, description, highlights, and category if omitted. Note: Daraz marketplace requires at least 1 image URL to publish.',
        inputSchema: {
            type: 'object',
            properties: {
                product_name: {
                    type: 'string',
                    description: 'Product name to push to Daraz'
                },
                price: {
                    type: 'number',
                    description: 'Selling price in NPR (Rs.)'
                },
                special_price: {
                    type: 'number',
                    description: 'Optional discounted/special promotional price in NPR'
                },
                store_account_name: {
                    type: 'string',
                    description: 'Daraz seller store account name (e.g. "Bagmati" or "Bagmati Traders")'
                },
                images: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Image URLs (at least 1 image is required by Daraz to publish)'
                },
                description: {
                    type: 'string',
                    description: 'Optional custom product description'
                },
                highlights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional list of bullet points'
                }
            },
            required: ['product_name', 'price']
        }
    },
    {
        name: 'get_draft_listings',
        description: 'Check existing product drafts in the database and their status (draft, generated, pushed, failed).',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['draft', 'generating', 'generated', 'pushing', 'pushed', 'failed', 'all'],
                    description: 'Filter by listing status'
                },
                limit: {
                    type: 'number',
                    description: 'Max number of drafts to return (default: 15)'
                }
            }
        }
    }
]

// ── GET: Supports MCP SSE Streaming and JSON Tool Discovery ─────────────────

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return withCors(NextResponse.json({ error: 'Unauthorized. Invalid or missing API key.' }, { status: 401 }))
    }

    // 1. MCP SSE Stream (Server-Sent Events)
    const acceptHeader = req.headers.get('accept') || ''
    if (acceptHeader.includes('text/event-stream')) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const endpointUrl = `${baseUrl}/api/claude-connector`

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            start(controller) {
                // Official Model Context Protocol SSE handshake
                controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`))
            }
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            }
        })
    }

    // 2. Standard JSON Tool Discovery
    return withCors(NextResponse.json({
        name: 'Inventory Webapp - Claude Connector',
        version: '1.0.0',
        description: 'Claude AI Connector for Daraz Product Management & Inventory',
        protocolVersion: '2024-11-05',
        capabilities: {
            tools: {}
        },
        tools: CLAUDE_TOOLS,
        endpoints: {
            mcp_endpoint: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/claude-connector`,
            openapi_spec: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/claude-connector/openapi`
        },
        status: 'online'
    }))
}

// ── POST: Universal MCP & REST Tool Execution ───────────────────────────────

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
        return withCors(NextResponse.json({ error: 'Unauthorized. Invalid or missing API key.' }, { status: 401 }))
    }

    try {
        const body = await req.json().catch(() => ({}))

        // 1. Handle Model Context Protocol (MCP) JSON-RPC requests
        if (body.jsonrpc === '2.0' || body.method) {
            const id = body.id !== undefined ? body.id : null
            const method = body.method

            // MCP Notifications (e.g. notifications/initialized)
            if (method?.startsWith('notifications/') || id === null) {
                return withCors(new NextResponse(null, { status: 204 }))
            }

            // MCP initialize
            if (method === 'initialize') {
                return withCors(NextResponse.json({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: '2024-11-05',
                        serverInfo: {
                            name: 'inventory-webapp-daraz-connector',
                            version: '1.0.0'
                        },
                        capabilities: {
                            tools: {},
                            resources: {},
                            prompts: {}
                        }
                    }
                }))
            }

            // MCP ping
            if (method === 'ping') {
                return withCors(NextResponse.json({
                    jsonrpc: '2.0',
                    id,
                    result: {}
                }))
            }

            // MCP tools/list
            if (method === 'tools/list') {
                return withCors(NextResponse.json({
                    jsonrpc: '2.0',
                    id,
                    result: { tools: CLAUDE_TOOLS }
                }))
            }

            // MCP resources/list & prompts/list (return empty list gracefully)
            if (method === 'resources/list') {
                return withCors(NextResponse.json({
                    jsonrpc: '2.0',
                    id,
                    result: { resources: [] }
                }))
            }
            if (method === 'prompts/list') {
                return withCors(NextResponse.json({
                    jsonrpc: '2.0',
                    id,
                    result: { prompts: [] }
                }))
            }

            // MCP tools/call
            if (method === 'tools/call') {
                const toolName = paramsName(body)
                const args = body.params?.arguments || body.params || {}

                try {
                    const result = await executeTool(toolName, args)
                    return withCors(NextResponse.json({
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                                }
                            ]
                        }
                    }))
                } catch (toolErr: any) {
                    return withCors(NextResponse.json({
                        jsonrpc: '2.0',
                        id,
                        result: {
                            isError: true,
                            content: [{ type: 'text', text: `Tool error: ${toolErr.message}` }]
                        }
                    }))
                }
            }

            return withCors(NextResponse.json({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Method '${method}' not recognized` }
            }, { status: 404 }))
        }

        // 2. Handle REST / Custom Action requests
        const action = body.action || body.tool || body.name
        const args = body.arguments || body.params || body

        if (!action) {
            return withCors(NextResponse.json({
                error: 'Action or tool name is required. Use GET to inspect available tools.'
            }, { status: 400 }))
        }

        const result = await executeTool(action, args)
        return withCors(NextResponse.json({
            success: true,
            action,
            data: result
        }))

    } catch (err: any) {
        console.error('[ClaudeConnectorAPI] Error:', err.message)
        return withCors(NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 }))
    }
}

function paramsName(body: any): string {
    return body.params?.name || body.name || ''
}

// ── Tool Dispatcher ─────────────────────────────────────────────────────────

async function executeTool(name: string, args: any) {
    switch (name) {
        case 'list_daraz_stores':
            return await listDarazStores()

        case 'save_product_draft':
            return await saveProductDraft({
                raw_name: args.raw_name || args.product_name || args.name,
                title: args.title || args.daraz_title || args.product_title,
                titles_per_store: args.titles_per_store,
                description: args.description || args.product_description || args.desc || args.body || args.content || args.details || args.main_description,
                highlights: args.highlights || args.bullet_points || args.bullets || args.key_features || args.features || args.highlight_points || args.specs || args.specifications,
                price: args.price,
                special_price: args.special_price,
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores,
                images: args.images,
                wholesale_price: args.wholesale_price,
                supplier_id: args.supplier_id,
                category_id: args.category_id,
                category_path: args.category_path
            })

        case 'bulk_add_products':
            return await bulkAddProducts({
                products: args.products || [],
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores
            })

        case 'push_product_to_daraz':
            return await pushProductToDaraz({
                product_name: args.product_name || args.raw_name || args.name,
                title: args.title || args.daraz_title || args.product_title,
                price: args.price,
                special_price: args.special_price,
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores,
                images: args.images || [],
                description: args.description,
                highlights: args.highlights,
                category_id: args.category_id,
                category_path: args.category_path
            })

        case 'get_draft_listings':
            return await getDraftListings({
                status: args.status,
                limit: args.limit
            })

        default:
            throw new Error(`Unknown tool "${name}". Call list_daraz_stores, save_product_draft, bulk_add_products, push_product_to_daraz, or get_draft_listings.`)
    }
}
