export interface OtherFeeItem {
    id: string
    name: string
    type: 'percentage' | 'fixed' | 'bracket'
    rate: number
    apply_vat: boolean // true = adds 13% VAT (e.g. rate * 1.13); false = fixed % / amount without VAT
    applies_to?: 'sales_price' | 'commission'
    is_active: boolean
    description?: string
}

export interface HandlingFeeBracket {
    minPrice: number
    maxPrice: number | null
    baseFee: number
    vatPercent: number
    label: string
}

export const DARAZ_HANDLING_FEE_BRACKETS: HandlingFeeBracket[] = [
    { minPrice: 0, maxPrice: 400, baseFee: 5, vatPercent: 13, label: '0–400 NPR: Rs. 5 (+13% VAT = Rs. 5.65)' },
    { minPrice: 401, maxPrice: 1000, baseFee: 10, vatPercent: 13, label: '401–1000 NPR: Rs. 10 (+13% VAT = Rs. 11.30)' },
    { minPrice: 1001, maxPrice: 1500, baseFee: 15, vatPercent: 13, label: '1001–1500 NPR: Rs. 15 (+13% VAT = Rs. 16.95)' },
    { minPrice: 1501, maxPrice: null, baseFee: 30, vatPercent: 13, label: '1500+ NPR: Rs. 30 (+13% VAT = Rs. 33.90)' }
]

/**
 * Daraz official handling fee per item based on price bracket + 13% VAT:
 * - 0–400 NPR: 5 NPR + 13% VAT (Rs. 5.65)
 * - 401–1000 NPR: 10 NPR + 13% VAT (Rs. 11.30)
 * - 1001–1500 NPR: 15 NPR + 13% VAT (Rs. 16.95)
 * - 1500+ NPR: 30 NPR + 13% VAT (Rs. 33.90)
 */
export function getDarazHandlingFee(itemPrice: number): {
    baseFee: number
    vat: number
    totalFee: number
    bracketLabel: string
} {
    if (!itemPrice || itemPrice <= 0) {
        return { baseFee: 0, vat: 0, totalFee: 0, bracketLabel: '0 NPR' }
    }
    let baseFee = 30
    let bracketLabel = '1500+ NPR (Rs. 30 + 13% VAT = Rs. 33.90)'

    if (itemPrice <= 400) {
        baseFee = 5
        bracketLabel = '0–400 NPR (Rs. 5 + 13% VAT = Rs. 5.65)'
    } else if (itemPrice <= 1000) {
        baseFee = 10
        bracketLabel = '401–1000 NPR (Rs. 10 + 13% VAT = Rs. 11.30)'
    } else if (itemPrice <= 1500) {
        baseFee = 15
        bracketLabel = '1001–1500 NPR (Rs. 15 + 13% VAT = Rs. 16.95)'
    }

    const vat = parseFloat((baseFee * 0.13).toFixed(4))
    const totalFee = parseFloat((baseFee + vat).toFixed(2))

    return {
        baseFee,
        vat,
        totalFee,
        bracketLabel
    }
}

export const DEFAULT_OTHER_FEES: OtherFeeItem[] = [
    {
        id: 'payment_fee',
        name: 'Payment Processing Fee',
        type: 'percentage',
        rate: 2.5,
        apply_vat: true,
        applies_to: 'sales_price',
        is_active: true,
        description: 'Payment processing fee with 13% VAT (2.50% + 13% VAT = 2.825% effective)'
    },
    {
        id: 'free_shipping_max',
        name: 'Free Shipping Max Fee',
        type: 'percentage',
        rate: 4.0,
        apply_vat: true,
        applies_to: 'sales_price',
        is_active: false,
        description: 'Free Shipping Max program fee with 13% VAT (4.00% + 13% VAT = 4.52% effective)'
    },
    {
        id: 'co_funded_voucher',
        name: 'Co-funded Voucher Max',
        type: 'percentage',
        rate: 3.0,
        apply_vat: false,
        applies_to: 'sales_price',
        is_active: false,
        description: 'Seller share of co-funded campaign vouchers (Fixed % without VAT)'
    },
    {
        id: 'handling_fee',
        name: 'Handling Fee (Tiered Bracket)',
        type: 'bracket',
        rate: 0,
        apply_vat: true,
        applies_to: 'sales_price',
        is_active: true,
        description: 'Daraz tiered item handling fee + 13% VAT (0-400: Rs.5.65, 401-1000: Rs.11.30, 1001-1500: Rs.16.95, 1500+: Rs.33.90)'
    },
    {
        id: 'gst_withholding',
        name: 'General Sales Tax Withholding (WHT)',
        type: 'percentage',
        rate: 1.0,
        apply_vat: false,
        applies_to: 'sales_price',
        is_active: false,
        description: 'Advance tax / GST withholding (Fixed % without VAT)'
    }
]

/**
 * Calculate effective percentage rate for an other fee item
 * If apply_vat is true, rate is multiplied by 1.13 (+13% VAT)
 */
export function getEffectiveFeeRate(fee: OtherFeeItem): number {
    if (fee.type === 'percentage') {
        return fee.apply_vat ? fee.rate * 1.13 : fee.rate
    }
    return fee.rate
}

export interface FeeCalculationDetail {
    id: string
    name: string
    type: 'percentage' | 'fixed' | 'bracket'
    baseRate: number
    applyVat: boolean
    effectiveRate: number
    deductionAmount: number
    bracketNote?: string
}

export interface DarazFeeBreakdown {
    salesPrice: number
    // Raw Category Commission from sheet (e.g. 15.76%)
    rawCommissionRate: number
    // Commission Fee (+13% VAT = 15.76 * 1.13 = 17.8088%)
    effectiveCommissionRate: number
    baseCommissionAmount: number
    commissionVatAmount: number
    totalCommissionFee: number
    // Handling fee detail
    handlingFeeDetail?: {
        baseFee: number
        vat: number
        totalFee: number
        bracketLabel: string
    }
    // Other fees list
    otherFeeDetails: FeeCalculationDetail[]
    otherFeesTotal: number
    // Grand totals
    totalDeduction: number
    totalEffectiveFeePercent: number
    netPayout: number
}

/**
 * Accurately calculate all Daraz fee deductions with 13% VAT rules
 *
 * Rules:
 * 1. Commission Fee = Category Commission Rate % + 13% VAT (effective = rate * 1.13)
 * 2. Payment Fee = Fixed % + 13% VAT (effective = rate * 1.13)
 * 3. Free Shipping Max = Fixed % + 13% VAT (effective = rate * 1.13)
 * 4. Handling Fee = Official Daraz tiered bracket (0-400: Rs.5, 401-1000: Rs.10, 1001-1500: Rs.15, 1500+: Rs.30) + 13% VAT
 * 5. Co-funded Voucher Max = Fixed % (NO VAT)
 * 6. GST Withholding (WHT) = Fixed % (NO VAT)
 */
export function calculateDarazFeeBreakdown(params: {
    salesPrice: number
    categoryCommissionRate: number
    otherFees: OtherFeeItem[]
}): DarazFeeBreakdown {
    const { salesPrice, categoryCommissionRate = 0, otherFees = [] } = params

    // Commission Fee always includes 13% VAT
    const baseCommissionAmount = (salesPrice * categoryCommissionRate) / 100
    const commissionVatAmount = baseCommissionAmount * 0.13
    const totalCommissionFee = baseCommissionAmount + commissionVatAmount
    const effectiveCommissionRate = categoryCommissionRate * 1.13

    let otherFeesTotal = 0
    const otherFeeDetails: FeeCalculationDetail[] = []
    let handlingFeeDetail: DarazFeeBreakdown['handlingFeeDetail'] = undefined

    for (const fee of otherFees) {
        if (!fee.is_active) continue

        let deductionAmount = 0
        let effectiveRate = fee.rate
        let bracketNote: string | undefined = undefined

        // Check if this fee is the tiered Handling Fee (either by type 'bracket' or id 'handling_fee')
        if (fee.type === 'bracket' || fee.id === 'handling_fee') {
            const hFee = getDarazHandlingFee(salesPrice)
            deductionAmount = fee.apply_vat ? hFee.totalFee : hFee.baseFee
            effectiveRate = deductionAmount
            bracketNote = hFee.bracketLabel
            handlingFeeDetail = hFee
        } else if (fee.type === 'percentage') {
            effectiveRate = fee.apply_vat ? fee.rate * 1.13 : fee.rate
            deductionAmount = (salesPrice * effectiveRate) / 100
        } else {
            // Fixed amount in Rs.
            effectiveRate = fee.apply_vat ? fee.rate * 1.13 : fee.rate
            deductionAmount = effectiveRate
        }

        otherFeesTotal += deductionAmount
        otherFeeDetails.push({
            id: fee.id,
            name: fee.name,
            type: fee.type,
            baseRate: fee.rate,
            applyVat: Boolean(fee.apply_vat),
            effectiveRate,
            deductionAmount,
            bracketNote
        })
    }

    const totalDeduction = totalCommissionFee + otherFeesTotal
    const netPayout = salesPrice - totalDeduction
    const totalEffectiveFeePercent = salesPrice > 0 ? (totalDeduction / salesPrice) * 100 : 0

    return {
        salesPrice,
        rawCommissionRate: categoryCommissionRate,
        effectiveCommissionRate,
        baseCommissionAmount,
        commissionVatAmount,
        totalCommissionFee,
        handlingFeeDetail,
        otherFeeDetails,
        otherFeesTotal,
        totalDeduction,
        totalEffectiveFeePercent,
        netPayout
    }
}

/**
 * Calculate exact net profit for a product price
 */
export function calculateExactProductProfit(params: {
    sellingPrice: number | null | undefined
    purchasingPrice: number
    categoryCommissionRate: number
    otherFees: OtherFeeItem[]
}): {
    profit: number | null
    breakdown: DarazFeeBreakdown | null
} {
    const { sellingPrice, purchasingPrice, categoryCommissionRate = 0, otherFees = [] } = params
    if (sellingPrice == null || sellingPrice <= 0 || purchasingPrice <= 0) {
        return { profit: null, breakdown: null }
    }

    const breakdown = calculateDarazFeeBreakdown({
        salesPrice: sellingPrice,
        categoryCommissionRate,
        otherFees
    })

    const profit = breakdown.netPayout - purchasingPrice
    return {
        profit: parseFloat(profit.toFixed(2)),
        breakdown
    }
}

/**
 * Calculate mathematically exact breakeven selling price
 * accounting for both variable percentage fees (incl. VAT) and tiered handling fees (incl. VAT)
 */
export function calculateExactBreakevenPrice(params: {
    purchasingPrice: number
    categoryCommissionRate: number
    otherFees: OtherFeeItem[]
}): number {
    const { purchasingPrice, categoryCommissionRate = 0, otherFees = [] } = params
    if (purchasingPrice <= 0) return 0

    // Sum all variable percentage fees
    let totalVariablePct = categoryCommissionRate * 1.13 // Commission with 13% VAT
    let otherFixedFees = 0
    let hasTieredHandling = false
    let handlingFeeVat = true

    for (const fee of otherFees) {
        if (!fee.is_active) continue
        if (fee.type === 'percentage') {
            totalVariablePct += fee.apply_vat ? fee.rate * 1.13 : fee.rate
        } else if (fee.type === 'bracket' || fee.id === 'handling_fee') {
            hasTieredHandling = true
            handlingFeeVat = Boolean(fee.apply_vat)
        } else {
            // Fixed amount fee
            otherFixedFees += fee.apply_vat ? fee.rate * 1.13 : fee.rate
        }
    }

    const variableRateFactor = totalVariablePct / 100
    if (variableRateFactor >= 1) return purchasingPrice

    if (!hasTieredHandling) {
        // Simple case: no tiered handling fee
        return parseFloat(((purchasingPrice + otherFixedFees) / (1 - variableRateFactor)).toFixed(2))
    }

    // Solve for each price tier:
    const vatMultiplier = handlingFeeVat ? 1.13 : 1.0
    const tiers = [
        { max: 400, fee: 5 * vatMultiplier },
        { max: 1000, fee: 10 * vatMultiplier },
        { max: 1500, fee: 15 * vatMultiplier },
        { max: Infinity, fee: 30 * vatMultiplier }
    ]

    for (let i = 0; i < tiers.length; i++) {
        const candidate = (purchasingPrice + tiers[i].fee + otherFixedFees) / (1 - variableRateFactor)
        const minVal = i === 0 ? 0 : tiers[i - 1].max
        if (candidate > minVal && candidate <= tiers[i].max) {
            return parseFloat(candidate.toFixed(2))
        }
    }

    // Fallback to highest tier (1500+)
    const finalCandidate = (purchasingPrice + 30 * vatMultiplier + otherFixedFees) / (1 - variableRateFactor)
    return parseFloat(finalCandidate.toFixed(2))
}
