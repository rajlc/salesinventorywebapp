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
            version: '1.1.0',
            description: 'AI Custom Connector for Daraz Product Management and Inventory. MANDATORY: At the start of any new chat or before generating any product title, description, or highlights (even if the user does not mention it), ALWAYS call action "get_product_list_instruction" first and follow every rule returned. MULTI-STORE SUPPORT: For save_product_draft, update_product_draft, and push_product_to_daraz, you CAN pass unique store-wise titles, descriptions, AND highlights using titles_per_store, descriptions_per_store, and highlights_per_store keyed by each store name.'
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
                                                'get_product_list_instruction',
                                                'list_daraz_stores',
                                                'search_daraz_categories',
                                                'calculate_daraz_profit',
                                                'generate_studio_images',
                                                'search_suppliers',
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
                                            description: 'The tool or action to execute. MANDATORY FIRST STEP: Always call get_product_list_instruction first before generating any product title, description, or highlights. Use view_draft_images to inspect actual product images for image_only drafts (returns AI visual_analysis + image URLs). Use calculate_daraz_profit for fee/profit/minimum safe price calculations. Use generate_studio_images to generate studio product photos and delete old draft images.'
                                        },
                                        id: {
                                            type: 'string',
                                            description: 'Draft UUID (alias for draft_id)'
                                        },
                                        url: {
                                            type: 'string',
                                            description: 'Competitor product URL or direct image URL'
                                        },
                                        image_url: {
                                            type: 'string',
                                            description: 'Direct image URL to inspect with view_draft_images or transform with generate_studio_images'
                                        },
                                        type: {
                                            type: 'string',
                                            enum: ['image_only', 'link_only', 'name_only', 'pending', 'ready', 'pushed', 'all'],
                                            description: 'Draft classification filter: image_only, link_only, pending, ready, etc.'
                                        },
                                        query: {
                                            type: 'string',
                                            description: 'Search keywords when calling search_daraz_categories or search_suppliers'
                                        },
                                        draft_id: {
                                            type: 'string',
                                            description: 'Draft UUID (for get_draft_details, update_product_draft, delete_product_draft, view_draft_images, generate_studio_images, calculate_daraz_profit, or push_product_to_daraz)'
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
                                            description: 'Daraz Category ID (e.g. 10002341). Can be used in both save_product_draft and update_product_draft to add or change category.'
                                        },
                                        category_path: {
                                            type: 'string',
                                            description: 'Category name or full path (e.g. "Water Bottle" or "Kitchen & Dining > Cookware > Pots & Pans"). Works in both save_product_draft and update_product_draft; if multiple categories match, returns suggested_categories options to confirm with the user.'
                                        },
                                        category_name: {
                                            type: 'string',
                                            description: 'Short category name/keyword (e.g. "Water Bottle") to check and assign or update category on a draft.'
                                        },
                                        confirm_category: {
                                            type: 'boolean',
                                            description: 'Set to true to confirm the top suggested category when multiple matches are returned.'
                                        },
                                        description: {
                                            type: 'string',
                                            description: 'Product description. Can be provided in clean Markdown or HTML. System formats it with paragraphs and bolding.'
                                        },
                                        descriptions_per_store: {
                                            type: 'object',
                                            additionalProperties: { type: 'string' },
                                            description: 'Optional unique HTML descriptions per Daraz store when multiple stores are targeted: {"Balaju Shop": "<p>...</p>", "Bagmati Traders": "<p>...</p>"}'
                                        },
                                        highlights_per_store: {
                                            type: 'object',
                                            additionalProperties: { type: 'array', items: { type: 'string' } },
                                            description: 'Optional unique highlight bullet arrays per Daraz store when multiple stores are targeted: {"Balaju Shop": ["Point 1", ...], "Bagmati Traders": ["Point 1", ...]}'
                                        },
                                        include_image_in_description: {
                                            type: 'boolean',
                                            description: 'Set to true to embed a product image (<img> tag) inside the HTML main description'
                                        },
                                        description_image_url: {
                                            type: 'string',
                                            description: 'Optional specific image URL to embed inside the HTML product description'
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
                                                    name: { type: 'string', description: 'Variation name (e.g. "Black", "Red", or group name "Color")' },
                                                    values: {
                                                        type: 'array',
                                                        items: { type: 'string' },
                                                        description: 'Optional variation option values (e.g. ["Black", "Red"])'
                                                    },
                                                    color: { type: 'string' },
                                                    size: { type: 'string' },
                                                    price: { type: 'number', description: 'Regular price / MRP (if omitted, auto-calculated with markup from special_price)' },
                                                    special_price: { type: 'number', description: 'User-stated selling/special price' },
                                                    quantity: { type: 'number', description: 'Stock quantity, defaults to 100' },
                                                    stock: { type: 'number', description: 'Stock quantity, defaults to 100' }
                                                }
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
                                            description: 'List of target stores (e.g. ["Balaju Shop", "Bagmati Traders"]). Pass all stores in this single array. When pushing to Daraz, each store automatically receives a unique Seller SKU!'
                                        },
                                        product_name: {
                                            type: 'string',
                                            description: 'Product name when pushing to Daraz'
                                        },
                                        price: {
                                            type: 'number',
                                            description: 'Regular MRP price in NPR (or selling price if special_price is omitted).'
                                        },
                                        special_price: {
                                            type: 'number',
                                            description: 'User-specified selling price in NPR (Special Price). Always prioritized as the effective customer price.'
                                        },
                                        wholesale_price: {
                                            type: 'number',
                                            description: 'Purchase/wholesale cost price in NPR (saved to draft and synced to product_wholesale_prices)'
                                        },
                                        campaign_price: {
                                            type: 'number',
                                            description: 'Daraz campaign price in NPR (saved to draft and synced to daraz_avg_prices)'
                                        },
                                        mrp_price: {
                                            type: 'number',
                                            description: 'Explicit regular MRP price in NPR (synced to mrp_prices)'
                                        },
                                        supplier_name: {
                                            type: 'string',
                                            description: 'Supplier name (e.g. "Ram"). Checks our suppliers database: if exact match exists, links automatically; if only close match exists (e.g. "Ramu"), returns status="supplier_confirmation_required" with suggested_suppliers so you can ask the user to confirm.'
                                        },
                                        supplier_id: {
                                            type: 'string',
                                            description: 'Exact supplier UUID from database'
                                        },
                                        confirm_supplier: {
                                            type: 'boolean',
                                            description: 'Set to true after the user confirms a suggested fuzzy-matched supplier (e.g. confirming "Ramu")'
                                        },
                                        selling_price: {
                                            type: 'number',
                                            description: 'Selling price in NPR for calculate_daraz_profit'
                                        },
                                        packaging_cost: {
                                            type: 'number',
                                            description: 'Optional packaging cost in NPR for calculate_daraz_profit'
                                        },
                                        target_profit: {
                                            type: 'number',
                                            description: 'Desired net profit in NPR for calculate_daraz_profit'
                                        },
                                        target_margin_percent: {
                                            type: 'number',
                                            description: 'Desired net margin percentage for calculate_daraz_profit'
                                        },
                                        generate_studio_images: {
                                            type: 'boolean',
                                            description: 'Set to true to generate AI studio product image(s) and save to webapp database'
                                        },
                                        image_prompt: {
                                            type: 'string',
                                            description: 'Visual description of the product to generate a studio product image (when user uploads a raw mobile image in ChatGPT/Claude)'
                                        },
                                        replace_existing_images: {
                                            type: 'boolean',
                                            description: 'Set to true to replace and delete old images from the draft'
                                        },
                                        delete_old_images: {
                                            type: 'boolean',
                                            description: 'Set to true to delete existing images from the draft'
                                        },
                                        delete_image_indices: {
                                            type: 'array',
                                            items: { type: 'number' },
                                            description: '0-based indices of old images to delete from the draft'
                                        },
                                        delete_image_urls: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: 'Specific image URLs to delete from the draft'
                                        },
                                        store_account_name: {
                                            type: 'string',
                                            description: 'Daraz seller account name (e.g. Bagmati Traders)'
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
