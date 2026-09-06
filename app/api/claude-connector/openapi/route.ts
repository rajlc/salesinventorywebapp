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
                                                'save_product_draft',
                                                'bulk_add_products',
                                                'push_product_to_daraz',
                                                'get_draft_listings'
                                            ],
                                            description: 'The tool or action to execute'
                                        },
                                        raw_name: {
                                            type: 'string',
                                            description: 'Product name for single draft saving'
                                        },
                                        title: {
                                            type: 'string',
                                            description: 'SEO-optimized product title generated for Daraz'
                                        },
                                        description: {
                                            type: 'string',
                                            description: 'Full HTML description with <p>, <ul>, <li> tags to be saved in Main Description'
                                        },
                                        highlights: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: 'Key bullet points for Highlights'
                                        },
                                        titles_per_store: {
                                            type: 'object',
                                            description: 'Unique SEO titles for each store: {"Balaju Shop": "...", "Bagmati Traders": "..."}'
                                        },
                                        store_accounts: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: 'List of target stores (e.g. ["Balaju Shop", "Bagmati Traders"]). Make only 1 call and pass all stores in this array!'
                                        },
                                        product_name: {
                                            type: 'string',
                                            description: 'Product name when pushing to Daraz'
                                        },
                                        price: {
                                            type: 'number',
                                            description: 'Price in NPR'
                                        },
                                        special_price: {
                                            type: 'number',
                                            description: 'Optional promotional price in NPR'
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
                                                    special_price: { type: 'number' }
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
