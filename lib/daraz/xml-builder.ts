// Builds the XML payload for Daraz /product/create API
// Based on Daraz Open Platform documentation

export interface DarazSkuVariant {
    sellerSku?: string
    price: number
    specialPrice?: number
    specialPriceFrom?: string
    specialPriceTo?: string
    quantity: number
    packageWeight?: number
    packageLength?: number
    packageWidth?: number
    packageHeight?: number
    packageContent?: string
    images?: string[] // Daraz CDN URLs
    // Variant attributes (e.g., color_family: 'Multicolor', size: '16 CM')
    variantAttributes?: Record<string, string>
}

export interface DarazProductPayload {
    primaryCategory: number | string
    images: string[]            // Daraz CDN URLs (slatic.net), min 1, max 8
    name: string                // Product title
    shortDescription?: string   // Highlights bullet points (HTML)
    description?: string        // Full description (HTML)
    brand?: string
    // All dynamic category attributes
    attributes?: Record<string, string>
    // SKU variants
    skus: DarazSkuVariant[]
}

// Escape XML special characters
function escapeXml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

// Auto-generate a seller SKU if not provided
function generateSellerSku(name: string, index: number): string {
    const clean = name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20).toUpperCase()
    const timestamp = Date.now().toString().slice(-6)
    return `${clean}-${timestamp}-${index}`
}

export function buildProductCreateXml(payload: DarazProductPayload): string {
    const {
        primaryCategory,
        images,
        name,
        shortDescription,
        description,
        brand,
        attributes = {},
        skus,
    } = payload

    // Build images XML
    const imagesXml = images
        .slice(0, 8)
        .map(url => `            <Image>${escapeXml(url)}</Image>`)
        .join('\n')

    // Build attributes XML (name + all dynamic attributes)
    const attrLines: string[] = []
    attrLines.push(`                <name>${escapeXml(name)}</name>`)
    if (shortDescription) {
        attrLines.push(`                <short_description>${escapeXml(shortDescription)}</short_description>`)
    }
    if (description) {
        attrLines.push(`                <description>${escapeXml(description)}</description>`)
    }
    if (brand) {
        attrLines.push(`                <brand>${escapeXml(brand)}</brand>`)
    }
    // Add all dynamic attributes from the category form
    Object.entries(attributes).forEach(([key, value]) => {
        if (key !== 'name' && key !== 'short_description' && key !== 'description' && key !== 'brand' && value) {
            attrLines.push(`                <${key}>${escapeXml(value)}</${key}>`)
        }
    })

    // Build SKUs XML
    const skusXml = skus.map((sku, i) => {
        const sellerSku = sku.sellerSku || generateSellerSku(name, i + 1)
        
        // Variant-specific images
        const skuImagesXml = sku.images && sku.images.length > 0
            ? `                     <Images>\n${sku.images.slice(0, 8).map(u => `                          <Image>${escapeXml(u)}</Image>`).join('\n')}\n                     </Images>`
            : ''

        // Variant attributes (color, size, etc.)
        const variantAttrLines = Object.entries(sku.variantAttributes || {})
            .map(([k, v]) => `                      <${k}>${escapeXml(v)}</${k}>`)
            .join('\n')

        return `                <Sku>
                     <SellerSku>${escapeXml(sellerSku)}</SellerSku>
${variantAttrLines}
                     <quantity>${sku.quantity}</quantity>
                     <price>${sku.price.toFixed(2)}</price>
${sku.specialPrice ? `                     <special_price>${sku.specialPrice.toFixed(2)}</special_price>` : ''}
${sku.specialPrice && sku.specialPriceFrom ? `                     <special_from_date>${sku.specialPriceFrom}</special_from_date>` : ''}
${sku.specialPrice && sku.specialPriceTo ? `                     <special_to_date>${sku.specialPriceTo}</special_to_date>` : ''}
${sku.packageLength ? `                     <package_length>${sku.packageLength}</package_length>` : ''}
${sku.packageHeight ? `                     <package_height>${sku.packageHeight}</package_height>` : ''}
${sku.packageWeight ? `                     <package_weight>${sku.packageWeight}</package_weight>` : ''}
${sku.packageWidth ? `                     <package_width>${sku.packageWidth}</package_width>` : ''}
${sku.packageContent ? `                     <package_content>${escapeXml(sku.packageContent)}</package_content>` : ''}
${skuImagesXml}
                </Sku>`
    }).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
    <Product>
        <PrimaryCategory>${primaryCategory}</PrimaryCategory>
        <SPUId/>
        <AssociatedSku/>
        <Images>
${imagesXml}
        </Images>
        <Attributes>
${attrLines.join('\n')}
        </Attributes>
        <Skus>
${skusXml}
        </Skus>
    </Product>
</Request>`
}
