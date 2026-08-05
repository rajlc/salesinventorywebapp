'use server'

import { createClient } from '@/lib/supabase/server'

export interface SupplierLedgerEntry {
    supplier_id: string
    supplier_name: string
    opening_balance: number
    debit: number
    credit: number
    running_balance: number
}

// Helper to check debit conditions (Logic defined in requirement)
const isDebitPurchase = (p: any) => {
    const isCashOrOnline = (p.payment_type || '').toLowerCase() !== 'due';
    const type = (p.purchase_type || 'Buy').toLowerCase();
    if (type === 'buy' && isCashOrOnline) return true;
    if (type === 'sell' && isCashOrOnline) return true;
    if (type === 'sell' && !isCashOrOnline) return true;
    return false;
}

const isCreditPurchase = (p: any) => {
    const isCashOrOnline = (p.payment_type || '').toLowerCase() !== 'due';
    const type = (p.purchase_type || 'Buy').toLowerCase();
    if (type === 'buy' && isCashOrOnline) return true;
    if (type === 'sell' && isCashOrOnline) return true;
    if (type === 'buy' && !isCashOrOnline) return true;
    return false;
}

export async function getSupplierLedger({
    fiscalYearId,
    search = ''
}: {
    fiscalYearId?: string
    search?: string
}): Promise<{ ledger: SupplierLedgerEntry[], error?: string }> {
    const supabase = await createClient()

    // 1. Get Fiscal Year Dates
    let startDate: string
    let endDate: string

    if (fiscalYearId) {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('id', fiscalYearId).single()
        if (!fy) return { ledger: [], error: 'Fiscal Year not found' }
        startDate = fy.start_date
        endDate = fy.end_date
    } else {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single()
        if (!fy) return { ledger: [], error: 'No active Fiscal Year found' }
        startDate = fy.start_date
        endDate = fy.end_date
    }

    // 2. Get Suppliers
    let supplierQuery = supabase.from('suppliers').select('id, supplier_name').eq('is_deleted', false)
    if (search) {
        supplierQuery = supplierQuery.ilike('supplier_name', `%${search}%`)
    }
    const { data: suppliers, error: supplierError } = await supplierQuery

    if (supplierError || !suppliers) {
        return { ledger: [], error: supplierError?.message || 'Failed to fetch suppliers' }
    }

    const supplierIds = suppliers.map(s => s.id)

    // 3. Fetch ALL relevant financial data (Purchases & Transactions) using pagination to bypass Supabase max_rows (1000) limit
    // Optimization: filtering by supplierIds to avoid full table scan if search is active
    // We need "Previous" data (before startDate) for Opening Balance
    // And "Current" data (startDate <= date <= endDate) for Debit/Credit

    // Fetch Purchases in pages of 1000
    let allPurchases: any[] = []
    let purchasesPage = 0
    const pageSize = 1000
    while (true) {
        const from = purchasesPage * pageSize
        const to = from + pageSize - 1
        const { data, error } = await supabase
            .from('purchases')
            .select('supplier_id, purchase_date, purchase_type, payment_type, total_amount')
            .in('supplier_id', supplierIds)
            .lte('purchase_date', endDate)
            .range(from, to)

        if (error) {
            console.error('Error fetching purchases data', error)
            return { ledger: [], error: 'Failed to fetch purchases data' }
        }
        if (!data || data.length === 0) break
        allPurchases = allPurchases.concat(data)
        if (data.length < pageSize) break
        purchasesPage++
    }

    // Fetch Transactions in pages of 1000
    let allTransactions: any[] = []
    let transactionsPage = 0
    while (true) {
        const from = transactionsPage * pageSize
        const to = from + pageSize - 1
        const { data, error } = await supabase
            .from('supplier_transactions')
            .select('supplier_id, transaction_date, transaction_type, amount')
            .in('supplier_id', supplierIds)
            .lte('transaction_date', endDate)
            .range(from, to)

        if (error) {
            console.error('Error fetching transactions data', error)
            return { ledger: [], error: 'Failed to fetch transactions data' }
        }
        if (!data || data.length === 0) break
        allTransactions = allTransactions.concat(data)
        if (data.length < pageSize) break
        transactionsPage++
    }

    // 4. Client-side Aggregation
    const ledgerMap = new Map<string, SupplierLedgerEntry>()

    // Initialize map
    suppliers.forEach(s => {
        ledgerMap.set(s.id, {
            supplier_id: s.id,
            supplier_name: s.supplier_name,
            opening_balance: 0,
            debit: 0,
            credit: 0,
            running_balance: 0
        })
    })

    // Process Purchases
    allPurchases?.forEach(p => {
        const entry = ledgerMap.get(p.supplier_id)
        if (!entry) return

        const amount = Number(p.total_amount) || 0
        const isBefore = p.purchase_date < startDate
        const isCurrent = p.purchase_date >= startDate && p.purchase_date <= endDate

        // Helper boolean values regarding Debit/Credit contribution
        const contributesDebit = isDebitPurchase(p)
        const contributesCredit = isCreditPurchase(p)

        if (isBefore) {
            // Logic for Opening Balance:
            // Opening Balance is essentially the "Running Balance" from the past.
            // Running Balance = Opening + Credit - Debit
            // So contribution to Opening Balance = Credit contribution - Debit contribution
            if (contributesCredit) entry.opening_balance += amount
            if (contributesDebit) entry.opening_balance -= amount
        } else if (isCurrent) {
            if (contributesDebit) entry.debit += amount
            if (contributesCredit) entry.credit += amount
        }
    })

    // Process Transactions
    allTransactions?.forEach(t => {
        const entry = ledgerMap.get(t.supplier_id)
        if (!entry) return

        const amount = Number(t.amount) || 0
        const isBefore = t.transaction_date < startDate
        const isCurrent = t.transaction_date >= startDate && t.transaction_date <= endDate

        const isPaid = t.transaction_type === 'Paid'
        const isReceived = t.transaction_type === 'Received'

        // Debit Logic: Transaction Type = Paid
        // Credit Logic: Transaction Type = Received

        if (isBefore) {
            // Paid -> contributes to Debit -> decreases balance
            if (isPaid) entry.opening_balance -= amount
            // Received -> contributes to Credit -> increases balance
            if (isReceived) entry.opening_balance += amount
        } else if (isCurrent) {
            if (isPaid) entry.debit += amount
            if (isReceived) entry.credit += amount
        }
    })

    // 5. Calculate Final Running Balance and Format
    const results = Array.from(ledgerMap.values()).map(entry => {
        entry.running_balance = entry.opening_balance + entry.credit - entry.debit
        return entry
    })

    return { ledger: results }
}

// ============================================================================
// DETAIL PAGE ACTIONS
// ============================================================================

export type LedgerDetailType = 'CASH_BUY' | 'CASH_SELL' | 'DUE_SELL' | 'DUE_BUY' | 'PAID' | 'RECEIVED'

export async function getSupplierStats({
    supplierId,
    fiscalYearId
}: {
    supplierId: string
    fiscalYearId?: string
}) {
    const supabase = await createClient()

    // 1. Get Dates
    let startDate: string
    let endDate: string

    if (fiscalYearId) {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('id', fiscalYearId).single()
        if (!fy) return { error: 'Fiscal Year not found' }
        startDate = fy.start_date
        endDate = fy.end_date
    } else {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single()
        if (!fy) return { error: 'No active Fiscal Year found' }
        startDate = fy.start_date
        endDate = fy.end_date
    }

    // 2. Fetch Aggregates
    // We can't easy do complex conditional sums in one standard Supabase query without RPC or excessive data fetching.
    // For specific supplier, fetching all rows is reasonably efficient.

    // Purchases
    const { data: purchases, error: pError } = await supabase
        .from('purchases')
        .select('purchase_type, payment_type, total_amount')
        .eq('supplier_id', supplierId)
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate)

    // Transactions
    const { data: transactions, error: tError } = await supabase
        .from('supplier_transactions')
        .select('transaction_type, amount')
        .eq('supplier_id', supplierId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)

    if (pError || tError) return { error: 'Failed to fetch stats' }

    // 3. Fetch Opening Balance Data (Before Start Date)
    // We need to calculate opening balance for this specific supplier
    const { data: prevPurchases } = await supabase
        .from('purchases')
        .select('purchase_type, payment_type, total_amount')
        .eq('supplier_id', supplierId)
        .lt('purchase_date', startDate)

    const { data: prevTransactions } = await supabase
        .from('supplier_transactions')
        .select('transaction_type, amount')
        .eq('supplier_id', supplierId)
        .lt('transaction_date', startDate)

    // --- Calculations ---

    // A. Opening Balance
    let openingBalance = 0

    prevPurchases?.forEach(p => {
        const amount = Number(p.total_amount) || 0;
        const isCashOrOnline = (p.payment_type || '').toLowerCase() !== 'due';
        const type = (p.purchase_type || 'Buy').toLowerCase();

        // Credit Contributions
        if ((type === 'buy' && isCashOrOnline) ||
            (type === 'sell' && isCashOrOnline) ||
            (type === 'buy' && !isCashOrOnline)) {
            openingBalance += amount;
        }

        // Debit Contributions
        if ((type === 'buy' && isCashOrOnline) ||
            (type === 'sell' && isCashOrOnline) ||
            (type === 'sell' && !isCashOrOnline)) {
            openingBalance -= amount;
        }
    })

    prevTransactions?.forEach(t => {
        const amount = Number(t.amount) || 0
        if (t.transaction_type === 'Received') openingBalance += amount
        if (t.transaction_type === 'Paid') openingBalance -= amount
    })

    // B. Current Period Stats
    let cashBuy = 0
    let cashSell = 0
    let dueSell = 0
    let dueBuy = 0
    let paid = 0
    let received = 0

    purchases?.forEach(p => {
        const amount = Number(p.total_amount) || 0;
        const isCashOrOnline = (p.payment_type || '').toLowerCase() !== 'due';
        const type = (p.purchase_type || 'Buy').toLowerCase();

        if (type === 'buy' && isCashOrOnline) cashBuy += amount;
        if (type === 'sell' && isCashOrOnline) cashSell += amount;
        if (type === 'sell' && !isCashOrOnline) dueSell += amount;
        if (type === 'buy' && !isCashOrOnline) dueBuy += amount;
    })

    transactions?.forEach(t => {
        const amount = Number(t.amount) || 0
        if (t.transaction_type === 'Paid') paid += amount
        if (t.transaction_type === 'Received') received += amount
    })

    // Get Supplier Name
    const { data: supplier } = await supabase.from('suppliers').select('supplier_name').eq('id', supplierId).single()

    return {
        stats: { cashBuy, cashSell, dueSell, dueBuy, paid, received, openingBalance },
        supplierName: supplier?.supplier_name || 'Unknown Supplier',
        timeRange: { startDate, endDate }
    }
}

export async function getSupplierDetailedTransactions({
    supplierId,
    type,
    page = 1,
    limit = 10,
    fiscalYearId
}: {
    supplierId: string
    type: LedgerDetailType
    page?: number
    limit?: number
    fiscalYearId?: string
}) {
    const supabase = await createClient()

    // Get Dates
    let startDate: string
    let endDate: string

    if (fiscalYearId) {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('id', fiscalYearId).single()
        if (!fy) return { error: 'Fiscal Year not found' }
        startDate = fy.start_date
        endDate = fy.end_date
    } else {
        const { data: fy } = await supabase.from('fiscal_years').select('start_date, end_date').eq('is_active', true).single()
        if (!fy) return { error: 'No active Fiscal Year found' }
        startDate = fy.start_date
        endDate = fy.end_date
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    let data = [], count = 0

    if (['PAID', 'RECEIVED'].includes(type)) {
        // Query Supplier Transactions
        let query = supabase
            .from('supplier_transactions')
            .select('*', { count: 'exact' })
            .eq('supplier_id', supplierId)
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate)
            .order('transaction_date', { ascending: false })
            .range(from, to)

        if (type === 'PAID') query = query.eq('transaction_type', 'Paid')
        if (type === 'RECEIVED') query = query.eq('transaction_type', 'Received')

        const { data: resData, count: resCount, error } = await query
        if (error) return { error: error.message }

        // Normalize to common structure
        data = (resData || []).map((t: any) => ({
            id: t.id,
            date: t.transaction_date,
            description: `Transaction (${t.transaction_mode})`,
            reference: t.payment_method, // or Mode
            amount: t.amount,
            type: t.transaction_type, // 'Paid' | 'Received'
            meta: t // Store full object if needed
        }))
        count = resCount || 0

    } else {
        // Query Purchases
        const isBuy = type.includes('BUY')
        const isCash = type.includes('CASH')

        let query = supabase
            .from('purchases')
            .select('*, product:products(product_name)', { count: 'exact' })
            .eq('supplier_id', supplierId)
            .gte('purchase_date', startDate)
            .lte('purchase_date', endDate)
            .order('purchase_date', { ascending: false })
            .range(from, to)

        // Filter Type (Buy/Sell)
        if (isBuy) {
            query = query.or('purchase_type.eq.Buy,purchase_type.eq.buy,purchase_type.is.null')
        } else {
            query = query.or('purchase_type.eq.Sell,purchase_type.eq.sell')
        }

        // Filter Payment
        if (isCash) {
            query = query.not('payment_type', 'ilike', 'due')
        } else {
            query = query.ilike('payment_type', 'due')
        }

        const { data: resData, count: resCount, error } = await query
        if (error) return { error: error.message }

        // Normalize
        const resTransactions = (resData || []).map((p: any) => {
            const isCashOrOnline = (p.payment_type || '').toLowerCase() !== 'due'
            const paymentLabel = isCashOrOnline ? 'Cash' : 'Due'
            const typeLabel = p.purchase_type || 'Buy'

            return {
                id: p.id,
                date: p.purchase_date,
                description: p.product?.product_name || 'Unknown Product',
                particular_detail: `${paymentLabel} ${typeLabel}`,
                reference: p.payment_type,
                amount: p.total_amount,
                type: p.purchase_type, // 'Buy' | 'Sell'
                quantity: p.quantity,
                unit_amount: p.unit_amount,
                meta: p
            }
        })

        // Fetch comments for these purchases
        const purchaseIds = resTransactions.map(t => t.id)
        const { data: comments } = await supabase
            .from('ledger_comments')
            .select('*')
            .in('purchase_id', purchaseIds)

        data = resTransactions.map(t => ({
            ...t,
            comments: (comments || []).filter((c: any) => c.purchase_id === t.id)
        }))

        count = resCount || 0
    }


    return {
        transactions: data,
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page
    }
}

// Get full chronological ledger for a single supplier
export async function getSupplierFullLedger({
    supplierId,
    fiscalYearId
}: {
    supplierId: string
    fiscalYearId?: string
}): Promise<{ ledger: any[], supplierName: string }> {
    const supabase = await createClient()

    // 1. Get supplier name
    const { data: supplier } = await supabase
        .from('suppliers')
        .select('supplier_name')
        .eq('id', supplierId)
        .single()

    const supplierName = supplier?.supplier_name || 'Unknown'

    // 2. Get Fiscal Year Dates (if provided)
    let endDate: string | null = null

    if (fiscalYearId) {
        const { data: fy } = await supabase
            .from('fiscal_years')
            .select('start_date, end_date')
            .eq('id', fiscalYearId)
            .single()

        if (fy) {
            endDate = fy.end_date
        }
    }

    // 3. Fetch all purchases for this supplier
    let purchaseQuery = supabase
        .from('purchases')
        .select('id, purchase_date, purchase_type, payment_type, total_amount, product_id, quantity, unit_amount, products(product_name)')
        .eq('supplier_id', supplierId)
        .order('purchase_date', { ascending: false })
        .limit(100000)

    if (endDate) {
        purchaseQuery = purchaseQuery.lte('purchase_date', endDate)
    }

    const { data: purchases } = await purchaseQuery

    // 4. Fetch all transactions for this supplier
    let transQuery = supabase
        .from('supplier_transactions')
        .select('id, transaction_date, transaction_type, transaction_mode, payment_method, amount, remarks')
        .eq('supplier_id', supplierId)
        .order('transaction_date', { ascending: false })
        .limit(100000)

    if (endDate) {
        transQuery = transQuery.lte('transaction_date', endDate)
    }

    const { data: transactions } = await transQuery

    // 5. Combine and format ledger entries
    const ledgerEntries: any[] = []

    // Process purchases
    purchases?.forEach(p => {
        const pType = (p.purchase_type || 'Buy').toLowerCase()
        const isCashOrOnline = (p.payment_type || '').toLowerCase() !== 'due'
        let debit = 0
        let credit = 0

        // Calculate debit and credit
        if (pType === 'buy' && isCashOrOnline) {
            debit = p.total_amount
            credit = p.total_amount
        } else if (pType === 'sell' && isCashOrOnline) {
            debit = p.total_amount
            credit = p.total_amount
        } else if (pType === 'sell' && !isCashOrOnline) {
            debit = p.total_amount
        } else if (pType === 'buy' && !isCashOrOnline) {
            credit = p.total_amount
        }

        const paymentLabel = isCashOrOnline ? 'Cash' : 'Due'
        const typeLabel = p.purchase_type || 'Buy'

        ledgerEntries.push({
            id: p.id,
            date: p.purchase_date,
            particular: (p.products as any)?.product_name || 'Unknown Product',
            particular_detail: `${paymentLabel} ${typeLabel}`,
            quantity: p.quantity,
            unit_amount: p.unit_amount,
            debit,
            credit,
            running_amount: 0,
            type: 'purchase',
            purchase_type: typeLabel
        })
    })

    // Process transactions
    transactions?.forEach(t => {
        const isPaid = t.transaction_type === 'Paid'
        const isReceived = t.transaction_type === 'Received'

        let particular = `${t.transaction_type} (${t.payment_method || t.transaction_mode})`
        if (t.remarks) {
            particular += ` - ${t.remarks}`
        }

        ledgerEntries.push({
            id: t.id,
            date: t.transaction_date,
            particular,
            particular_detail: null,
            debit: isPaid ? t.amount : 0,
            credit: isReceived ? t.amount : 0,
            running_amount: 0,
            type: 'transaction'
        })
    })

    // 6. Sort by date descending (latest first)
    // Within the same date: Transactions first, Sells second, Buys third
    ledgerEntries.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        
        if (dateB !== dateA) {
            return dateB - dateA
        }

        // Helper to assign sorting priority weight
        const getWeight = (item: any) => {
            if (item.type === 'transaction') return 1 // Transaction is topmost
            const type = (item.purchase_type || '').toLowerCase()
            if (type === 'sell') return 2 // Sell is middle
            return 3 // Buy is bottom
        }

        return getWeight(a) - getWeight(b)
    })

    // 7. Calculate running balance
    let runningBalance = 0
    for (let i = ledgerEntries.length - 1; i >= 0; i--) {
        runningBalance = runningBalance + ledgerEntries[i].credit - ledgerEntries[i].debit
        ledgerEntries[i].running_amount = runningBalance
    }

    // 8. Fetch comments for all items
    const purchaseIds = ledgerEntries.filter(e => e.type === 'purchase').map(e => e.id)
    const transactionIds = ledgerEntries.filter(e => e.type === 'transaction').map(e => e.id)

    const { data: comments } = await supabase
        .from('ledger_comments')
        .select('*')
        .or(`purchase_id.in.(${purchaseIds.join(',')}),transaction_id.in.(${transactionIds.join(',')})`)

    ledgerEntries.forEach(entry => {
        entry.comments = (comments || []).filter((c: any) =>
            (entry.type === 'purchase' && c.purchase_id === entry.id) ||
            (entry.type === 'transaction' && c.transaction_id === entry.id)
        )
    })

    return { ledger: ledgerEntries, supplierName }
}

// ============================================================================
// SHARING & COMMENTS
// ============================================================================

export async function createLedgerShare({
    supplierId,
    fiscalYearId
}: {
    supplierId: string
    fiscalYearId?: string
}) {
    const supabase = await createClient()
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    const { data, error } = await supabase
        .from('supplier_ledger_shares')
        .insert({
            supplier_id: supplierId,
            token,
            fiscal_year_id: fiscalYearId,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        })
        .select()
        .single()

    if (error) return { error: error.message }
    return { share: data }
}

export async function getLedgerByToken(token: string) {
    const supabase = await createClient()

    // 1. Get Share Info
    const { data: share, error: shareError } = await supabase
        .from('supplier_ledger_shares')
        .select('*, supplier:suppliers(supplier_name)')
        .eq('token', token)
        .single()

    if (shareError || !share) return { error: 'Invalid or expired share link' }

    // 2. Fetch Ledger
    const ledgerData = await getSupplierFullLedger({
        supplierId: share.supplier_id,
        fiscalYearId: share.fiscal_year_id
    })

    return {
        ...ledgerData,
        shareInfo: share
    }
}

export async function addLedgerComment({
    supplierId,
    purchaseId,
    transactionId,
    content,
    author
}: {
    supplierId: string
    purchaseId?: string
    transactionId?: string
    content: string
    author: 'Supplier' | 'Admin'
}) {
    const supabase = await createClient()

    // Verify 15-day rule (if supplier)
    if (author === 'Supplier') {
        let targetDate: string | null = null
        if (purchaseId) {
            const { data: p } = await supabase.from('purchases').select('purchase_date').eq('id', purchaseId).single()
            targetDate = p?.purchase_date || null
        } else if (transactionId) {
            const { data: t } = await supabase.from('supplier_transactions').select('transaction_date').eq('id', transactionId).single()
            targetDate = t?.transaction_date || null
        }

        if (targetDate) {
            const diff = Math.abs(new Date().getTime() - new Date(targetDate).getTime())
            const days = diff / (1000 * 60 * 60 * 24)
            if (days > 15) return { error: 'Comments are only allowed on transactions within the last 15 days.' }
        }
    }

    const { data, error } = await supabase
        .from('ledger_comments')
        .insert({
            supplier_id: supplierId,
            purchase_id: purchaseId,
            transaction_id: transactionId,
            content,
            author
        })
        .select()
        .single()

    if (error) return { error: error.message }
    return { comment: data }
}

export async function deleteLedgerComment(commentId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('ledger_comments').delete().eq('id', commentId)
    if (error) return { error: error.message }
    return { success: true }
}
