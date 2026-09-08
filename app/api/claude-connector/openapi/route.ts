import { NextRequest, NextResponse } from 'next/server'
import { POST as connectorPost, OPTIONS as connectorOptions } from '../route'

export async function OPTIONS() {
    return connectorOptions()
}

export async function POST(req: NextRequest) {
    // If Claude sent MCP request to the openapi URL by mistake, handle it gracefully!
    return connectorPost(req)
}

export async function GET(req: NextRequest) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const openApiSchema = {
        openapi: '3.0.0',
        info: {
            title: 'Inventory Webapp Daraz Connector',
            version: '1.0.0',
            description: 'Claude AI Custom Connector for Daraz Product Management and Inventory'
        },
        servers: [
            {
                url: baseUrl,
                description: 'Inventory Webapp API Server'
            }
        ],
        paths: {
            '/api/claude-connector': {
                post: {
                    summary: 'Execute Daraz Inventory Action',
                    description: 'Universal runner for creating drafts, bulk adding arrived products, checking stores, or pushing products to Daraz.',
                    operationId: 'executeDarazAction',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        action: {
                                            type: 'string',
                                            enum: [
                                                'list_daraz_stores',
                                                'search_daraz_categories',
                                                'extract_product_link',
                                                'view_draft_images',
                                                'save_product_draft',
                                                'update_product_draft',
                                                'delete_product_draft',
                                                'get_draft_details',
                                                'get_draft_listings',
                                                'bulk_add_products',
                                                'push_product_to_daraz'
                                            ],
                                            description: 'The tool or action to execute. Use view_draft_images to inspect actual product images for image_only drafts.'
                                        },
                                        url: {
                                            type: 'string',
                                            description: 'Competitor product URL or direct image URL'
                                        },
                                        image_url: {
                                            type: 'string',
                                            description: 'Direct image URL to inspect with view_draft_images'
                                        },
                                        type: {
                                            type: 'string',
                                            enum: ['image_only', 'link_only', 'name_only', 'pending', 'ready', 'pushed', 'all'],
                                            description: 'Draft classification filter: image_only, link_only, pending, ready, etc.'
                                        },
                                        query: {
                                            type: 'string',
                                            description: 'Search keywords when calling search_daraz_categories'
                                        },
                                        draft_id: {
                                            type: 'string',
                                            description: 'Draft UUID (required for get_draft_details, update_product_draft, or delete_product_draft if raw_name is not given)'
                                        },
                                        raw_name: {
                                            type: 'string',
                                            description: 'Product name for single draft saving, updating, or deleting'
                                        },
                                        title: {
                                            type: 'string',
                                            description: 'SEO-optimized product title generated for Daraz'
                                        },
                                        category_id: {
                                            type: 'number',
                                            description: 'Daraz Category ID (e.g. 10002341)'
                                        },
                                        category_path: {
                                            type: 'string',
                                            description: 'Human readable category path (e.g. "Kitchen & Dining > Cookware > Pots & Pans")'
                                        },
                                        description: {
                                            type: 'string',
                                            description: 'Product description. Can be provided in clean Markdown or HTML. System formats it with paragraphs and bolding.'
                                        },
                                        highlights: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: 'Key bullet points for Highlights. System automatically ensures bullet point "• " at the start.'
                                        },
                                        attributes: {
                                            type: 'object',
                                            description: 'Product specifications and dynamic attributes (e.g. {"brand": "No Brand", "material": "Stainless Steel", "color": "Silver"})'
                                        },
                                        variants: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string', description: 'Variation name (e.g. "Color", "Size")' },
                                                    values: {
                                                        type: 'array',
                                                        items: { type: 'string' },
                                                        description: 'Variation option values (e.g. ["Black", "Red"])'
                                                    },
                                                    price: { type: 'number', description: 'Regular price / MRP (if omitted, auto-calculated with markup from special_price)' },
                                                    special_price: { type: 'number', description: 'User-stated selling/special price' },
                                                    quantity: { type: 'number', description: 'Stock quantity, defaults to 100' }
                                                },
                                                required: ['name', 'values']
                                            },
                                            description: 'Product variations (colors, sizes) with prices and stock'
                                        },
                                        titles_per_store: {
                                            type: 'object',
                                            description: 'Unique SEO titles for each store: {"Balaju Shop": "...", "Bagmati Traders": "..."}'
                                        },
                                        store_accounts: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: 'List of target stores (e.g. ["Balaju Shop", "Bagmati Traders"]). Pass all stores in this single array.'
                                        },
                                        product_name: {
                                            type: 'string',
                                            description: 'Product name when pushing to Daraz'
                                        },
                                        price: {
                                            type: 'number',
                                            description: 'Regular MRP price in NPR. If omitted, calculated with a ~25% markup above special_price.'
                                        },
                                        special_price: {
                                            type: 'number',
                                            description: 'User-specified selling price in NPR (Special Price). Always prioritized as the effective customer price.'
                                        },
                                        store_account_name: {
                                            type: 'string',
                                            description: 'Daraz seller account name (e.g. Bagmati)'
                                        },
                                        images: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: 'List of image URLs'
                                        },
                                        products: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    price: { type: 'number' },
                                                    special_price: { type: 'number' },
                                                    variants: { type: 'array' }
                                                }
                                            },
                                            description: 'Array of products for bulk addition'
                                        },
                                        status: {
                                            type: 'string',
                                            description: 'Filter status for drafts'
                                        }
                                    },
                                    required: ['action']
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Action executed successfully',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            success: { type: 'boolean' },
                                            data: { type: 'object' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const res = NextResponse.json(openApiSchema)
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key')
    return res
}
