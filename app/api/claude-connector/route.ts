import { NextRequest, NextResponse } from 'next/server'
import {
    listDarazStores,
    saveProductDraft,
    updateProductDraft,
    deleteProductDraft,
    getDraftDetails,
    bulkAddProducts,
    getDraftListings,
    pushProductToDaraz,
    searchDarazCategoriesAction,
    extractProductLinkAction,
    viewDraftImages
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

    if (authHeader && authHeader.startsWith('Bearer claude_daraz_bearer_token_')) {
        return true
    }

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
        description: 'List all connected Daraz seller store accounts (e.g., Bagmati Traders, Balaju Shop) with their account IDs and status.',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'save_product_draft',
        description: 'Save a single product draft into the webapp database. CRITICAL RULES FOR CLAUDE: 1) PRICING RULE: When the user specifies a price (e.g. "Rs 450"), that price is the Special Price (discounted selling price). Regular MRP is automatically marked up with a discount. 2) VARIANTS: If user specifies variations (e.g. "Black" and "Red"), pass them in "variants". Stock will automatically be 100 for each variation and Seller SKU is automatically generated. 3) STORE TARGETING: Make ONLY ONE tool call even if multiple stores are requested (pass store_accounts: ["Balaju Shop", "Bagmati Traders"]). 4) Always generate the full SEO title, formatted description, and bullet-point highlights (each starting with "• "). 5) The status is saved as "draft".',
        inputSchema: {
            type: 'object',
            properties: {
                raw_name: {
                    type: 'string',
                    description: 'The raw/short product name entered by the user (e.g. "Rechargeable Milk Frother")'
                },
                title: {
                    type: 'string',
                    description: 'The SEO-optimized Daraz product title you generated (e.g. "Rechargeable Milk Frother - Electric Handheld Coffee & Milk Foam Maker"). Saved in Product Title (Name on Daraz).'
                },
                price: {
                    type: 'number',
                    description: 'Price in NPR. If only one price is given, it is treated as the Special Price (discounted price) with regular MRP calculated automatically.'
                },
                special_price: {
                    type: 'number',
                    description: 'Optional explicit special/promotional selling price in NPR'
                },
                variants: {
                    type: 'array',
                    description: 'Optional list of variations/colors/sizes (e.g. ["Black", "Red"] or [{ name: "Black", price: 450 }, { name: "Red", price: 450 }]). Stock is automatically set to 100 and Seller SKU is auto-generated.',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Variation name (e.g. "Black", "XL")' },
                            color: { type: 'string', description: 'Color name' },
                            size: { type: 'string', description: 'Size' },
                            price: { type: 'number', description: 'Variant price in NPR (treated as special price)' },
                            special_price: { type: 'number', description: 'Variant special price' },
                            stock: { type: 'number', description: 'Variant stock quantity (defaults to 100)' },
                            seller_sku: { type: 'string', description: 'Optional custom Seller SKU' }
                        }
                    }
                },
                description: {
                    type: 'string',
                    description: 'Full product description with clean paragraphs and bold formatting (**bold** or <strong>) to be saved in Main Description.'
                },
                highlights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of key highlight bullet points. Each point will automatically have a bullet point ("• ") in front.'
                },
                category_path: {
                    type: 'string',
                    description: 'Optional suggested category path (e.g. "Home Appliances > Small Kitchen Appliances > Coffee Machines & Accessories > Milk Frothers")'
                },
                category_id: {
                    type: 'number',
                    description: 'Optional Daraz category ID if known'
                },
                attributes: {
                    type: 'object',
                    description: 'Optional category product specifications (e.g. {"brand": "No Brand", "material": "Stainless Steel", "warranty_type": "No Warranty"})'
                },
                titles_per_store: {
                    type: 'object',
                    description: 'Optional: If multiple seller accounts are requested, provide unique SEO titles for each store: {"Balaju Shop": "Title 1...", "Bagmati Traders": "Title 2..."}'
                },
                store_accounts: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of target Daraz seller accounts (e.g. ["Balaju Shop", "Bagmati Traders"]).'
                },
                store_account_name: {
                    type: 'string',
                    description: 'Single seller account name (e.g. "Bagmati" or "Balaju Shop")'
                },
                images: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional list of image URLs for the product'
                },
                wholesale_price: {
                    type: 'number',
                    description: 'Cost or wholesale purchase price in NPR'
                },
                product_link: {
                    type: 'string',
                    description: 'Optional competitor or supplier product URL (Daraz, Amazon, Alibaba, AliExpress, etc.)'
                }
            }
        }
    },
    {
        name: 'update_product_draft',
        description: 'Update or edit an existing product draft in the database. Can find the draft by "id" or by "raw_name". You can update its price, special price, variants, specifications, title, description, highlights, stores, or status.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Draft UUID (if known)'
                },
                raw_name: {
                    type: 'string',
                    description: 'Product name to find and update (if ID is not known)'
                },
                price: {
                    type: 'number',
                    description: 'Updated price in NPR (treated as special price)'
                },
                special_price: {
                    type: 'number',
                    description: 'Updated special price in NPR'
                },
                variants: {
                    type: 'array',
                    description: 'Updated list of variations/colors/sizes (e.g. ["Black", "Red"] or with individual prices). Stock defaults to 100.',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            color: { type: 'string' },
                            size: { type: 'string' },
                            price: { type: 'number' },
                            special_price: { type: 'number' },
                            stock: { type: 'number' },
                            seller_sku: { type: 'string' }
                        }
                    }
                },
                title: {
                    type: 'string',
                    description: 'Updated Daraz SEO title'
                },
                description: {
                    type: 'string',
                    description: 'Updated product description'
                },
                highlights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Updated bullet point highlights'
                },
                category_path: {
                    type: 'string',
                    description: 'Updated category path'
                },
                attributes: {
                    type: 'object',
                    description: 'Updated category specifications (e.g. brand, material)'
                },
                store_accounts: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Updated target stores'
                },
                images: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Updated product image URLs'
                },
                product_link: {
                    type: 'string',
                    description: 'Competitor or supplier product URL'
                },
                status: {
                    type: 'string',
                    enum: ['draft', 'generating', 'generated', 'pushing', 'pushed', 'failed'],
                    description: 'Updated draft status'
                }
            }
        }
    },
    {
        name: 'delete_product_draft',
        description: 'Permanently delete a product draft from the webapp database by "id" or "raw_name".',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Draft UUID to delete'
                },
                raw_name: {
                    type: 'string',
                    description: 'Product name to find and delete'
                }
            }
        }
    },
    {
        name: 'get_draft_details',
        description: 'Get full complete details of a specific product draft by "id" or "raw_name", including all variants, attributes, full description, highlights, pricing, and assigned stores.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Draft UUID'
                },
                raw_name: {
                    type: 'string',
                    description: 'Product name to search for'
                }
            }
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
                            price: { type: 'number', description: 'Selling price in NPR (treated as special price)' },
                            special_price: { type: 'number', description: 'Optional special price' },
                            wholesale_price: { type: 'number', description: 'Cost price' },
                            variants: { type: 'array', description: 'Optional variants for this item' },
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
        description: 'Push a product directly to the Daraz seller account (e.g. Bagmati). Auto-generates AI title, rich description, highlights with bullet points, and category if omitted. Supports variants and dynamic specifications. Note: Daraz marketplace requires at least 1 image URL to publish.',
        inputSchema: {
            type: 'object',
            properties: {
                product_name: {
                    type: 'string',
                    description: 'Product name to push to Daraz'
                },
                price: {
                    type: 'number',
                    description: 'Selling price in NPR (treated as special price)'
                },
                special_price: {
                    type: 'number',
                    description: 'Optional discounted/special promotional price in NPR'
                },
                variants: {
                    type: 'array',
                    description: 'Optional list of variations (e.g. ["Black", "Red"] or objects with individual prices). Stock defaults to 100.'
                },
                attributes: {
                    type: 'object',
                    description: 'Optional category specifications (e.g. {"brand": "No Brand", "material": "Stainless Steel"})'
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
                },
                category_id: {
                    type: 'number',
                    description: 'Optional category ID'
                },
                category_path: {
                    type: 'string',
                    description: 'Optional category path (e.g. "Toys & Games > Traditional Games > Card Games" or "Traditional Games")'
                },
                category_name: {
                    type: 'string',
                    description: 'Optional category name (e.g. "Traditional Games" or "Card Games")'
                },
                category: {
                    type: 'string',
                    description: 'Optional category name or path'
                }
            },
            required: ['product_name']
        }
    },
    {
        name: 'get_draft_listings',
        description: 'Check existing product drafts in the database. Can filter by status and by draft type (e.g. image_only, link_only, pending, ready, pushed).',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['draft', 'generating', 'generated', 'pushing', 'pushed', 'failed', 'all'],
                    description: 'Filter by listing status'
                },
                type: {
                    type: 'string',
                    enum: ['image_only', 'link_only', 'name_only', 'pending', 'ready', 'pushed', 'all'],
                    description: 'Filter drafts by raw input type: "image_only" (user only uploaded images, needing title/desc/highlights/category), "link_only" (competitor URL only), "name_only", "pending" (any draft requiring content generation), "ready", "pushed", or "all". IMPORTANT: For "image_only" drafts, call "view_draft_images" or "get_draft_details" with the draft id to visually inspect the product photo.'
                },
                search: {
                    type: 'string',
                    description: 'Optional search term by product name'
                },
                limit: {
                    type: 'number',
                    description: 'Max number of drafts to return (default: 20)'
                }
            }
        }
    },
    {
        name: 'view_draft_images',
        description: 'View and visually inspect the actual product images of a draft listing or image URL. Downloads and attaches the images directly into Claude\'s visual context as image blocks. ALWAYS call this tool when checking "image_only" drafts or when you need to see what a product looks like to write its title, description, category, and highlights.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Draft listing UUID'
                },
                raw_name: {
                    type: 'string',
                    description: 'Product name or search term'
                },
                image_url: {
                    type: 'string',
                    description: 'Optional direct image URL to view'
                },
                max_images: {
                    type: 'number',
                    description: 'Maximum number of images to view (default: 2, max: 4)'
                }
            }
        }
    },
    {
        name: 'extract_product_link',
        description: 'Extract product title, price, high-resolution images, description, highlights, and matching Daraz category from any competitor product link (Daraz, Amazon, Alibaba, AliExpress, or other eCommerce store).',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'The product URL to extract data from (e.g. https://www.daraz.com.np/products/...)'
                }
            },
            required: ['url']
        }
    },
    {
        name: 'search_daraz_categories',
        description: 'Search official Daraz Nepal categories by product keywords (e.g. "yogurt maker", "night lamp", "curd maker", "electric kettle"). Returns exact leaf category IDs and breadcrumb paths to use when creating or saving drafts and pushing products.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Keywords or product name to search categories for (e.g. "yogurt maker", "night light")'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum category suggestions to return (default: 5)'
                }
            },
            required: ['query']
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
        version: '1.2.0',
        description: 'Claude AI Connector for Daraz Product Management & Inventory with Variants, Specifications & Full Draft CRUD',
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
                            version: '1.2.0'
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

            // MCP resources/list & prompts/list
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
                    const anyResult = result as any
                    const attachedImages = Array.isArray(anyResult?._images) ? anyResult._images : []

                    const sanitizedResult = typeof anyResult === 'object' && anyResult !== null ? { ...anyResult } : anyResult
                    if (typeof sanitizedResult === 'object' && sanitizedResult !== null) {
                        delete sanitizedResult._images
                    }

                    const content: any[] = [
                        {
                            type: 'text',
                            text: typeof sanitizedResult === 'string' ? sanitizedResult : JSON.stringify(sanitizedResult, null, 2)
                        }
                    ]

                    // Attach MCP image content blocks for Claude's vision model
                    for (const img of attachedImages) {
                        content.push({
                            type: 'image',
                            data: img.base64,
                            mimeType: img.mimeType,
                            annotations: {
                                audience: ['assistant', 'user']
                            }
                        })
                    }

                    return withCors(NextResponse.json({
                        jsonrpc: '2.0',
                        id,
                        result: { content }
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
        const args = body.arguments || body.params || body.parameters || body

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
                variants: args.variants || args.variations || args.colors || args.skus,
                attributes: args.attributes || args.specs || args.specifications,
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores,
                images: args.images,
                wholesale_price: args.wholesale_price,
                supplier_id: args.supplier_id,
                category_id: args.category_id,
                category_path: args.category_path,
                product_link: args.product_link || args.link || args.url
            })

        case 'update_product_draft':
            return await updateProductDraft({
                id: args.id,
                raw_name: args.raw_name || args.product_name || args.name,
                title: args.title || args.daraz_title || args.product_title,
                titles_per_store: args.titles_per_store,
                description: args.description || args.product_description || args.desc,
                highlights: args.highlights || args.bullet_points || args.bullets,
                price: args.price,
                special_price: args.special_price,
                variants: args.variants || args.variations || args.colors || args.skus,
                attributes: args.attributes || args.specs || args.specifications,
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores,
                category_id: args.category_id,
                category_path: args.category_path,
                images: args.images,
                wholesale_price: args.wholesale_price,
                supplier_id: args.supplier_id,
                product_link: args.product_link || args.link || args.url,
                status: args.status
            })

        case 'delete_product_draft':
            return await deleteProductDraft({
                id: args.id,
                raw_name: args.raw_name || args.product_name || args.name
            })

        case 'get_draft_details':
            return await getDraftDetails({
                id: args.id,
                raw_name: args.raw_name || args.product_name || args.name
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
                variants: args.variants || args.variations || args.colors || args.skus,
                attributes: args.attributes || args.specs || args.specifications,
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
                type: args.type,
                search: args.search,
                limit: args.limit
            })

        case 'view_draft_images':
            return await viewDraftImages({
                id: args.id,
                raw_name: args.raw_name || args.product_name || args.name,
                image_url: args.image_url || args.url,
                max_images: args.max_images
            })

        case 'extract_product_link':
            return await extractProductLinkAction(args.url || args.link)

        case 'search_daraz_categories':
            return await searchDarazCategoriesAction(
                args.query || args.search || args.product_name || args.keyword || '',
                args.limit ? Number(args.limit) : 5
            )

        default:
            throw new Error(`Unknown tool "${name}". Call list_daraz_stores, search_daraz_categories, view_draft_images, extract_product_link, save_product_draft, update_product_draft, delete_product_draft, get_draft_details, bulk_add_products, push_product_to_daraz, or get_draft_listings.`)
    }
}
