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
    viewDraftImages,
    calculateDarazProfitAction,
    generateStudioImagesAction,
    searchSuppliersAction
} from '@/lib/claude/connector-service'
import { authenticateConnectorRequest } from '@/lib/claude/connector-auth'
import { runWithConnectorScope } from '@/lib/claude/connector-scope'
import { getProductListInstruction } from '@/lib/claude/product-list-instruction'

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

// ── MCP Tool Definitions ────────────────────────────────────────────────────

const CLAUDE_TOOLS = [
    {
        name: 'get_product_list_instruction',
        description: 'Fetch the user\'s saved "Product List Instruction" (custom rules for product title, description, highlights, formatting, and forbidden words). MANDATORY: Always call this tool at the start of a new chat or before generating any product title, description, or highlights — even if the user did not explicitly mention "Product List Instruction".',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
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
        description: 'Save a single product draft into the webapp database. CRITICAL RULES: 0) ALWAYS follow the user\'s "Product List Instruction" (call get_product_list_instruction first if you have not read it in this chat) when writing title, description, and highlights. 1) PRICING RULE: When the user specifies a price (e.g. "Rs 450"), that price is the Special Price (discounted selling price). Regular MRP is automatically marked up with a discount. 2) VARIANTS: If user specifies variations (e.g. "Black" and "Red"), pass them in "variants". Stock will automatically be 100 for each variation and Seller SKU is automatically generated. 3) STORE TARGETING: Make ONLY ONE tool call even if multiple stores are requested (pass store_accounts: ["Balaju Shop", "Bagmati Traders"]). 4) Always generate the full SEO title, formatted description, and bullet-point highlights (each starting with "• "). 5) The status is saved as "draft".',
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
                    description: 'Optional category name or full path (e.g. "Water Bottle" or "Home Appliances > Small Kitchen Appliances > Milk Frothers"). If multiple Daraz categories match, the tool returns suggested_categories options to confirm with the user.'
                },
                category_name: {
                    type: 'string',
                    description: 'Optional short category name/keyword (e.g. "Water Bottle"). Checked against official Daraz categories; returns options if multiple match.'
                },
                category_id: {
                    type: 'number',
                    description: 'Optional Daraz category ID if known'
                },
                confirm_category: {
                    type: 'boolean',
                    description: 'Set to true after the user confirms the top suggested category when multiple matches were returned'
                },
                attributes: {
                    type: 'object',
                    description: 'Optional category product specifications (e.g. {"brand": "No Brand", "material": "Stainless Steel", "warranty_type": "No Warranty"})'
                },
                titles_per_store: {
                    type: 'object',
                    description: 'Optional: If multiple seller accounts are requested, provide unique SEO titles for each store: {"Balaju Shop": "Title 1...", "Bagmati Traders": "Title 2..."}'
                },
                descriptions_per_store: {
                    type: 'object',
                    description: 'Optional: If multiple seller accounts are requested, provide unique HTML descriptions for each store: {"Balaju Shop": "<p>...</p>", "Bagmati Traders": "<p>...</p>"}'
                },
                highlights_per_store: {
                    type: 'object',
                    description: 'Optional: If multiple seller accounts are requested, provide unique highlight bullet arrays for each store: {"Balaju Shop": ["Point 1", ...], "Bagmati Traders": ["Point 1", ...]}'
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
                    description: 'Cost or wholesale purchase price in NPR (synced to product_wholesale_prices)'
                },
                campaign_price: {
                    type: 'number',
                    description: 'Optional Daraz campaign price in NPR (synced to daraz_avg_prices)'
                },
                mrp_price: {
                    type: 'number',
                    description: 'Optional explicit regular MRP price in NPR (synced to mrp_prices)'
                },
                supplier_name: {
                    type: 'string',
                    description: 'Optional supplier name (e.g. "Ram"). The system checks the suppliers database: if an exact match exists, it links automatically; if only a close/fuzzy match exists (e.g. "Ramu"), it returns suggested_suppliers and asks you to confirm with the user before saving.'
                },
                supplier_id: {
                    type: 'string',
                    description: 'Optional exact supplier UUID from our database'
                },
                confirm_supplier: {
                    type: 'boolean',
                    description: 'Set to true after the user confirms a fuzzy-matched supplier name (e.g. confirming "Ramu" when they said "Ram")'
                },
                include_image_in_description: {
                    type: 'boolean',
                    description: 'Set to true to embed a product image (<img> tag) inside the HTML main description'
                },
                description_image_url: {
                    type: 'string',
                    description: 'Optional specific image URL to embed inside the HTML product description'
                },
                generate_studio_images: {
                    type: 'boolean',
                    description: 'Set to true to generate AI studio product image(s) and attach them to this draft'
                },
                image_prompt: {
                    type: 'string',
                    description: 'Visual prompt describing the product (used when the user uploads a raw mobile photo in ChatGPT/Claude and asks to generate a studio product image and save to database)'
                },
                replace_existing_images: {
                    type: 'boolean',
                    description: 'Set to true to replace/delete old draft images with the newly generated studio images'
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
        description: 'Update or edit an existing product draft in the database. Can find the draft by "id" ("draft_id") or by "raw_name". Supports adding/changing category (category_id, category_path, or category_name — automatically checks Daraz categories and returns suggested_categories options if multiple match), updating price, special_price, wholesale_price, campaign_price, supplier_name (with fuzzy match confirmation), variants, specifications, title, description (including embedding an image), highlights, stores, generating new studio images, or deleting old images.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Draft UUID (if known)'
                },
                draft_id: {
                    type: 'string',
                    description: 'Alias for id (Draft UUID)'
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
                wholesale_price: {
                    type: 'number',
                    description: 'Updated purchase/wholesale cost price in NPR (saved to draft and synced to inventory database)'
                },
                campaign_price: {
                    type: 'number',
                    description: 'Updated campaign price in NPR (synced to database)'
                },
                mrp_price: {
                    type: 'number',
                    description: 'Updated MRP price in NPR (synced to database)'
                },
                supplier_name: {
                    type: 'string',
                    description: 'Supplier name (e.g. "Ram"). Checks database and asks confirmation if only a fuzzy match like "Ramu" is found.'
                },
                supplier_id: {
                    type: 'string',
                    description: 'Exact supplier UUID'
                },
                confirm_supplier: {
                    type: 'boolean',
                    description: 'Set to true once the user confirms a suggested fuzzy-matched supplier'
                },
                variants: {
                    type: 'array',
                    description: 'Updated list of variations/colors/sizes (e.g. ["Black", "Red"] or with individual prices). Stock defaults to 100.',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            values: { type: 'array', items: { type: 'string' } },
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
                titles_per_store: {
                    type: 'object',
                    description: 'Updated unique SEO titles per store account'
                },
                descriptions_per_store: {
                    type: 'object',
                    description: 'Updated unique HTML descriptions per store account: {"StoreName": "<p>...</p>"}'
                },
                highlights_per_store: {
                    type: 'object',
                    description: 'Updated unique highlight bullet arrays per store account: {"StoreName": ["Point 1", ...]}'
                },
                description: {
                    type: 'string',
                    description: 'Updated product description'
                },
                include_image_in_description: {
                    type: 'boolean',
                    description: 'Set to true to embed a product image inside the HTML product description'
                },
                description_image_url: {
                    type: 'string',
                    description: 'Specific image URL to embed inside the HTML product description'
                },
                highlights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Updated bullet point highlights'
                },
                category_id: {
                    type: 'number',
                    description: 'Updated Daraz category ID'
                },
                category_path: {
                    type: 'string',
                    description: 'Updated category path or category name (checks Daraz categories; returns options if multiple match)'
                },
                category_name: {
                    type: 'string',
                    description: 'Updated short category name/keyword (e.g. "Water Bottle")'
                },
                confirm_category: {
                    type: 'boolean',
                    description: 'Set to true to confirm the top suggested category when multiple matches were returned'
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
                store_account_name: {
                    type: 'string',
                    description: 'Single target store account name'
                },
                images: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Updated product image URLs'
                },
                generate_studio_images: {
                    type: 'boolean',
                    description: 'Set to true to generate AI studio product image(s) for this draft'
                },
                image_prompt: {
                    type: 'string',
                    description: 'Detailed visual prompt to generate a new studio product image and attach it to this draft'
                },
                replace_existing_images: {
                    type: 'boolean',
                    description: 'Set to true to delete old images from the draft and replace them with newly provided or generated images'
                },
                delete_old_images: {
                    type: 'boolean',
                    description: 'Set to true to delete existing images from the draft'
                },
                delete_image_indices: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'Optional 0-based indices of images to delete from the draft (e.g. [0] deletes the first old image)'
                },
                delete_image_urls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional specific image URLs to delete from the draft'
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
        description: 'Push a product or existing draft directly to one or multiple Daraz seller accounts (e.g. ["Bagmati Traders", "Balaju Shop"]). Automatically generates a UNIQUE Seller SKU per store (e.g. BT-... for Bagmati Traders and BS-... for Balaju Shop) so SKUs never collide across accounts, and syncs pricing/supplier/SKUs to the inventory database. Can push an existing draft by passing "id" ("draft_id") or "product_name".',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Optional existing Draft UUID to push to Daraz'
                },
                draft_id: {
                    type: 'string',
                    description: 'Alias for id (existing Draft UUID to push)'
                },
                product_name: {
                    type: 'string',
                    description: 'Product name to push to Daraz'
                },
                title: {
                    type: 'string',
                    description: 'Optional Daraz SEO title'
                },
                titles_per_store: {
                    type: 'object',
                    description: 'Optional unique SEO titles per store account'
                },
                price: {
                    type: 'number',
                    description: 'Selling price in NPR (treated as special price)'
                },
                special_price: {
                    type: 'number',
                    description: 'Optional discounted/special promotional price in NPR'
                },
                wholesale_price: {
                    type: 'number',
                    description: 'Optional purchase/wholesale cost price in NPR'
                },
                campaign_price: {
                    type: 'number',
                    description: 'Optional campaign price in NPR'
                },
                mrp_price: {
                    type: 'number',
                    description: 'Optional regular MRP price in NPR'
                },
                supplier_name: {
                    type: 'string',
                    description: 'Optional supplier name (checks database and asks confirmation if only a fuzzy match is found)'
                },
                supplier_id: {
                    type: 'string',
                    description: 'Optional supplier UUID'
                },
                confirm_supplier: {
                    type: 'boolean',
                    description: 'Set to true after user confirms a fuzzy-matched supplier'
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
                    description: 'Single Daraz seller store account name (e.g. "Bagmati Traders")'
                },
                store_accounts: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Multiple Daraz seller store accounts (e.g. ["Bagmati Traders", "Balaju Shop"]). Each store gets its own unique Seller SKU!'
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
                include_image_in_description: {
                    type: 'boolean',
                    description: 'Set to true to embed a product image inside the HTML description'
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
            }
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
    },
    {
        name: 'calculate_daraz_profit',
        description: 'Calculate exact Daraz Nepal commission (+13% VAT), payment handling fee (+13% VAT), order processing/handling fee bracket (+13% VAT), total deductions, net payout, net profit, breakeven minimum safe price, and recommended selling price for a product or draft.',
        inputSchema: {
            type: 'object',
            properties: {
                draft_id: {
                    type: 'string',
                    description: 'Optional Draft UUID to calculate fees/profit for'
                },
                raw_name: {
                    type: 'string',
                    description: 'Optional product name'
                },
                category_id: {
                    type: 'number',
                    description: 'Optional Daraz category ID'
                },
                category_path: {
                    type: 'string',
                    description: 'Optional Daraz category path'
                },
                selling_price: {
                    type: 'number',
                    description: 'Selling / Special Price on Daraz in NPR'
                },
                wholesale_price: {
                    type: 'number',
                    description: 'Purchase / Wholesale cost price in NPR'
                },
                packaging_cost: {
                    type: 'number',
                    description: 'Optional packaging cost per order in NPR (default: 0)'
                },
                target_profit: {
                    type: 'number',
                    description: 'Optional desired net profit in NPR to reverse-calculate recommended selling price'
                },
                target_margin_percent: {
                    type: 'number',
                    description: 'Optional desired net profit margin percentage (e.g. 20 for 20%) to reverse-calculate recommended selling price'
                }
            }
        }
    },
    {
        name: 'generate_studio_images',
        description: 'Upload or generate professional e-commerce studio product image(s), save them permanently to the webapp database (Supabase storage), attach them to a draft, optionally embed an image in the HTML description, and delete old/raw images from the draft. If you have image URLs or base64 images created/found in chat, pass them in "images" or "images_base64" and they will be downloaded, converted to clean studio JPEGs, and uploaded to the draft!',
        inputSchema: {
            type: 'object',
            properties: {
                draft_id: {
                    type: 'string',
                    description: 'Draft UUID to attach uploaded/generated images to'
                },
                raw_name: {
                    type: 'string',
                    description: 'Product name to find the draft or describe the product'
                },
                images: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional array of image URLs (or data:image/...;base64 strings) to download and upload directly into the webapp draft'
                },
                image_urls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Alias for images: array of image URLs to upload into the draft'
                },
                images_base64: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional array of base64-encoded image strings (or data URLs) to upload directly into the webapp draft'
                },
                source_image_url: {
                    type: 'string',
                    description: 'Optional single image URL to upload or transform into studio product photos'
                },
                image_prompt: {
                    type: 'string',
                    description: 'Visual prompt describing the product to generate a clean studio photo'
                },
                replace_existing_images: {
                    type: 'boolean',
                    description: 'Set to true to delete all old images on the draft and replace with the newly uploaded/generated studio image(s)'
                },
                delete_old_images: {
                    type: 'boolean',
                    description: 'Set to true to delete old images from the draft'
                },
                delete_image_indices: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'Optional 0-based indices of old images to delete from the draft'
                },
                delete_image_urls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional specific image URLs to delete from the draft'
                },
                include_image_in_description: {
                    type: 'boolean',
                    description: 'Set to true to also embed the studio image inside the draft HTML description'
                }
            }
        }
    },
    {
        name: 'search_suppliers',
        description: 'Search suppliers in the inventory database by name (e.g. "Ram") to check exact or fuzzy matches (e.g. "Ramu").',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Supplier name to search for'
                }
            }
        }
    }
]

// ── GET: Supports MCP SSE Streaming and JSON Tool Discovery ─────────────────

export async function GET(req: NextRequest) {
    const auth = await authenticateConnectorRequest(req)
    if (!auth.ok || !auth.scope) {
        return withCors(NextResponse.json({ error: auth.error || 'Unauthorized. Invalid or missing API key.' }, { status: auth.status || 401 }))
    }

    // 1. MCP SSE Stream (Server-Sent Events)
    const acceptHeader = req.headers.get('accept') || ''
    if (acceptHeader.includes('text/event-stream')) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const keyParam = req.nextUrl.searchParams.get('key') || req.nextUrl.searchParams.get('token')
        const endpointUrl = keyParam
            ? `${baseUrl}/api/claude-connector?key=${encodeURIComponent(keyParam)}`
            : `${baseUrl}/api/claude-connector`

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
    const auth = await authenticateConnectorRequest(req)
    if (!auth.ok || !auth.scope) {
        return withCors(NextResponse.json({ error: auth.error || 'Unauthorized. Invalid or missing API key.' }, { status: auth.status || 401 }))
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
                const { instruction } = await getProductListInstruction()
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
                        },
                        instructions: `PRODUCT LIST INSTRUCTION (MANDATORY — ALWAYS FOLLOW WHEN GENERATING ANY PRODUCT TITLE, DESCRIPTION, OR HIGHLIGHTS, EVEN IF THE USER DOES NOT EXPLICITLY MENTION IT):\n\n${instruction}`
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
                    result: {
                        prompts: [
                            {
                                name: 'product_list_instruction',
                                description: 'Load the user\'s saved Product List Instruction for generating Daraz product titles, descriptions, and highlights.'
                            }
                        ]
                    }
                }))
            }
            if (method === 'prompts/get') {
                const { instruction } = await getProductListInstruction()
                return withCors(NextResponse.json({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        description: 'User-configured Product List Instruction for Daraz listings',
                        messages: [
                            {
                                role: 'user',
                                content: {
                                    type: 'text',
                                    text: `Follow this Product List Instruction for all product titles, descriptions, and highlights:\n\n${instruction}`
                                }
                            }
                        ]
                    }
                }))
            }

            // MCP tools/call
            if (method === 'tools/call') {
                const toolName = paramsName(body)
                const args = body.params?.arguments || body.params || {}

                try {
                    const result = await runWithConnectorScope(auth.scope, () => executeTool(toolName, args))
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

        // 2. Handle REST / Custom Action requests (ChatGPT Actions, Gemini, REST clients)
        const action = body.action || body.tool || body.name
        const args = body.arguments || body.params || body.parameters || body

        if (!action) {
            return withCors(NextResponse.json({
                error: 'Action or tool name is required. Use GET to inspect available tools.'
            }, { status: 400 }))
        }

        const result = await runWithConnectorScope(auth.scope, () => executeTool(action, args))

        // Strip raw base64 _images and data_url bloat for REST/OpenAPI clients (ChatGPT Actions limit responses to ~100KB)
        const sanitizedData = typeof result === 'object' && result !== null ? { ...(result as any) } : result
        if (typeof sanitizedData === 'object' && sanitizedData !== null) {
            delete sanitizedData._images
            if (Array.isArray(sanitizedData.images)) {
                sanitizedData.images = sanitizedData.images.map((img: any) => {
                    if (typeof img === 'object' && img !== null && 'data_url' in img) {
                        const { data_url, ...rest } = img
                        return rest
                    }
                    return img
                })
            }
        }

        return withCors(NextResponse.json({
            success: sanitizedData?.success !== undefined ? sanitizedData.success : true,
            action,
            data: sanitizedData
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

async function withAutoInstruction<T>(payload: T): Promise<T> {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const { instruction } = await getProductListInstruction()
        return {
            ...payload,
            product_list_instruction: instruction
        }
    }
    return payload
}

async function executeTool(name: string, args: any) {
    const resolvedId = args.id || args.draft_id || args.draftId
    switch (name) {
        case 'get_product_list_instruction': {
            const data = await getProductListInstruction()
            return {
                ...data,
                usage_note: 'Follow every rule in "instruction" when generating product title, description, highlights, and pricing/variants.'
            }
        }

        case 'list_daraz_stores':
            return await withAutoInstruction(await listDarazStores())

        case 'save_product_draft':
            return await saveProductDraft({
                raw_name: args.raw_name || args.product_name || args.name,
                title: args.title || args.daraz_title || args.product_title,
                titles_per_store: args.titles_per_store,
                description: args.description || args.product_description || args.desc || args.body || args.content || args.details || args.main_description,
                descriptions_per_store: args.descriptions_per_store,
                highlights: args.highlights || args.bullet_points || args.bullets || args.key_features || args.features || args.highlight_points || args.specs || args.specifications,
                highlights_per_store: args.highlights_per_store,
                price: args.price,
                special_price: args.special_price,
                wholesale_price: args.wholesale_price ?? args.purchase_cost ?? args.cost_price,
                campaign_price: args.campaign_price,
                mrp_price: args.mrp_price,
                supplier_id: args.supplier_id,
                supplier_name: args.supplier_name || args.supplier,
                confirm_supplier: args.confirm_supplier,
                variants: args.variants || args.variations || args.colors || args.skus,
                attributes: args.attributes || args.specs || args.specifications,
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores,
                images: args.images,
                include_image_in_description: args.include_image_in_description,
                description_image_url: args.description_image_url,
                generate_studio_images: args.generate_studio_images,
                image_prompt: args.image_prompt,
                replace_existing_images: args.replace_existing_images,
                category_id: args.category_id,
                category_path: args.category_path,
                category_name: args.category_name || args.category,
                confirm_category: args.confirm_category,
                product_link: args.product_link || args.link || args.url
            })

        case 'update_product_draft':
            return await updateProductDraft({
                id: resolvedId,
                draft_id: resolvedId,
                raw_name: args.raw_name || args.product_name || args.name,
                title: args.title || args.daraz_title || args.product_title,
                titles_per_store: args.titles_per_store,
                description: args.description || args.product_description || args.desc,
                descriptions_per_store: args.descriptions_per_store,
                include_image_in_description: args.include_image_in_description,
                description_image_url: args.description_image_url,
                highlights: args.highlights || args.bullet_points || args.bullets,
                highlights_per_store: args.highlights_per_store,
                price: args.price,
                special_price: args.special_price,
                wholesale_price: args.wholesale_price ?? args.purchase_cost ?? args.cost_price,
                campaign_price: args.campaign_price,
                mrp_price: args.mrp_price,
                supplier_id: args.supplier_id,
                supplier_name: args.supplier_name || args.supplier,
                confirm_supplier: args.confirm_supplier,
                variants: args.variants || args.variations || args.colors || args.skus,
                attributes: args.attributes || args.specs || args.specifications,
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores,
                category_id: args.category_id,
                category_path: args.category_path,
                category_name: args.category_name || args.category,
                confirm_category: args.confirm_category,
                images: args.images,
                generate_studio_images: args.generate_studio_images,
                image_prompt: args.image_prompt,
                replace_existing_images: args.replace_existing_images,
                delete_old_images: args.delete_old_images,
                delete_image_indices: args.delete_image_indices,
                delete_image_urls: args.delete_image_urls,
                product_link: args.product_link || args.link || args.url,
                status: args.status
            })

        case 'delete_product_draft':
            return await deleteProductDraft({
                id: resolvedId,
                draft_id: resolvedId,
                raw_name: args.raw_name || args.product_name || args.name
            })

        case 'get_draft_details':
            return await withAutoInstruction(await getDraftDetails({
                id: resolvedId,
                draft_id: resolvedId,
                raw_name: args.raw_name || args.product_name || args.name
            }))

        case 'bulk_add_products':
            return await bulkAddProducts({
                products: args.products || [],
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores
            })

        case 'push_product_to_daraz':
            return await pushProductToDaraz({
                id: resolvedId,
                draft_id: resolvedId,
                product_name: args.product_name || args.raw_name || args.name,
                title: args.title || args.daraz_title || args.product_title,
                titles_per_store: args.titles_per_store,
                descriptions_per_store: args.descriptions_per_store,
                highlights_per_store: args.highlights_per_store,
                price: args.price,
                special_price: args.special_price,
                wholesale_price: args.wholesale_price ?? args.purchase_cost ?? args.cost_price,
                campaign_price: args.campaign_price,
                mrp_price: args.mrp_price,
                supplier_id: args.supplier_id,
                supplier_name: args.supplier_name || args.supplier,
                confirm_supplier: args.confirm_supplier,
                variants: args.variants || args.variations || args.colors || args.skus,
                attributes: args.attributes || args.specs || args.specifications,
                store_account_name: args.store_account_name || args.store,
                store_accounts: args.store_accounts || args.stores || args.target_stores,
                images: args.images || [],
                description: args.description,
                include_image_in_description: args.include_image_in_description,
                description_image_url: args.description_image_url,
                highlights: args.highlights,
                category_id: args.category_id,
                category_path: args.category_path,
                category_name: args.category_name,
                category: args.category
            })

        case 'get_draft_listings':
            return await getDraftListings({
                status: args.status,
                type: args.type,
                search: args.search || args.query,
                limit: args.limit
            })

        case 'view_draft_images':
            return await withAutoInstruction(await viewDraftImages({
                id: resolvedId,
                draft_id: resolvedId,
                raw_name: args.raw_name || args.product_name || args.name,
                image_url: args.image_url || args.url,
                max_images: args.max_images
            }))

        case 'extract_product_link':
            return await withAutoInstruction(await extractProductLinkAction(args.url || args.link || args.product_link))

        case 'search_daraz_categories':
            return await searchDarazCategoriesAction(
                args.query || args.search || args.product_name || args.keyword || '',
                args.limit ? Number(args.limit) : 5
            )

        case 'calculate_daraz_profit':
            return await calculateDarazProfitAction({
                draft_id: resolvedId,
                raw_name: args.raw_name || args.product_name || args.name,
                category_id: args.category_id,
                category_path: args.category_path,
                selling_price: args.selling_price ?? args.special_price ?? args.price,
                wholesale_price: args.wholesale_price ?? args.purchase_cost ?? args.cost_price,
                packaging_cost: args.packaging_cost,
                target_profit: args.target_profit,
                target_margin_percent: args.target_margin_percent
            })

        case 'generate_studio_images':
        case 'upload_product_images':
            return await generateStudioImagesAction({
                draft_id: resolvedId,
                raw_name: args.raw_name || args.product_name || args.name,
                images: args.images,
                image_urls: args.image_urls,
                images_base64: args.images_base64,
                base64_image: args.base64_image,
                source_image_url: args.source_image_url || args.image_url || args.url,
                image_prompt: args.image_prompt || args.prompt,
                replace_existing_images: args.replace_existing_images,
                delete_old_images: args.delete_old_images,
                delete_image_indices: args.delete_image_indices,
                delete_image_urls: args.delete_image_urls,
                include_image_in_description: args.include_image_in_description
            })

        case 'search_suppliers':
            return await searchSuppliersAction(args.query || args.supplier_name || args.supplier || args.search || '')

        default:
            throw new Error(`Unknown tool "${name}". Call list_daraz_stores, search_daraz_categories, calculate_daraz_profit, generate_studio_images, search_suppliers, view_draft_images, extract_product_link, save_product_draft, update_product_draft, delete_product_draft, get_draft_details, bulk_add_products, push_product_to_daraz, or get_draft_listings.`)
    }
}
