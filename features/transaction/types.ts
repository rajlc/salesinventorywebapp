export type AccountType = 'bank' | 'cash' | 'wallet'
export type OwnerScope = 'business' | 'personal'
export type TransactionDirection = 'in' | 'out' | 'transfer'

export interface FinancialAccount {
    id: string
    name: string
    account_type: AccountType
    owner_scope: OwnerScope
    owner_user_id: string | null
    owner_name?: string | null
    account_last4: string | null
    opening_balance: number
    opening_balance_date: string
    is_active: boolean
    notes: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    // Computed live fields
    current_balance: number
    total_in: number
    total_out: number
    pending_cheques: number
    available_balance: number
}

export interface CashTransaction {
    id: string
    transaction_date: string
    account_id: string
    account_name?: string
    account_owner_scope?: OwnerScope
    transfer_to_account_id: string | null
    transfer_to_account_name?: string | null
    direction: TransactionDirection
    scope: OwnerScope
    category: string
    amount: number
    party_or_particular: string | null
    source_type: string
    source_id: string | null
    notes: string | null
    created_by: string | null
    creator_name?: string
    created_at: string
}

export interface PassbookEntry {
    id: string
    date: string
    particular: string
    category: string
    source_type: string
    creator_name: string
    debit: number
    credit: number
    running_balance: number
    notes: string | null
}

export interface SupplierChequeItem {
    id: string
    transaction_date: string
    cheque_date: string | null
    cheque_type: string | null
    cheque_name: string | null
    supplier_id: string
    supplier_name: string
    amount: number
    account_id: string | null
    account_name: string | null
    cheque_cleared: boolean
    cheque_cleared_at: string | null
    remarks: string | null
}

export interface PendingSmsAlert {
    id: string
    sender_id: string
    account_last4: string | null
    matched_account_id: string | null
    matched_account_name?: string | null
    direction: 'credit' | 'debit'
    amount: number
    raw_message: string
    received_at: string
    status: 'pending' | 'approved' | 'ignored'
    cash_transaction_id: string | null
    handled_by: string | null
    handled_at: string | null
}

export interface CashFlowSummary {
    startDate: string
    endDate: string
    openingBalance: number
    totalMoneyIn: number
    businessMoneyIn: number
    personalMoneyIn: number
    totalMoneyOut: number
    businessMoneyOut: number
    personalDrawings: number
    totalTransfers: number
    businessNetCashFlow: number
    netCashFlow: number
    closingBalance: number
    byCategory: Array<{
        category: string
        direction: 'in' | 'out'
        scope: OwnerScope
        total: number
        count: number
    }>
}

export interface DarazStoreSettlementCard {
    sellerAccount: string
    storeId: string | null
    shippedCount: number
    shippedCostValue: number
    deliveredUnsettledCount: number
    expectedDeliveredAmount: number
    carryForwardAmount: number
    lastVerifiedAt: string | null
}

export interface DarazWeeklySettlementRow {
    weekStart: string
    weekEnd: string
    sellerAccount: string
    storeId: string | null
    orderCount: number
    expectedAmount: number
    carryForwardIn: number
    totalExpected: number
    isWeekCompleted: boolean
    settlementId: string | null
    status: 'ready' | 'in_progress' | 'verified'
    receivedTotal: number
    unsettledAmount: number
    varianceType: 'exact' | 'penalty_fee' | 'carry_forward' | null
    verifiedAt: string | null
    verifiedByName: string | null
    allocations: Array<{
        account_id: string
        account_name: string
        amount: number
    }>
    notes: string | null
}

export interface CourierSettlementCard {
    courierName: string
    courierId: string | null
    shippedCount: number
    shippedCostValue: number
    deliveredUnsettledCount: number
    expectedCodAmount: number
    orders: Array<{
        id: string
        source: 'marketplace' | 'website'
        sales_id: string
        order_date: string
        delivered_at: string | null
        customer_name: string
        total_amount: number
        delivery_charge: number
        net_cod: number
    }>
}

export interface CourierSettlementHistoryRow {
    id: string
    courier_name: string
    settlement_date: string
    expected_amount: number
    received_total: number
    unsettled_amount: number
    variance_type: string
    order_count: number
    verified_at: string
    verified_by_name: string
    notes: string | null
    allocations: Array<{
        account_id: string
        account_name: string
        amount: number
    }>
}

export interface OtherLiability {
    id: string
    title: string
    category: 'loan' | 'unpaid_bill' | 'other'
    amount: number
    due_date: string | null
    is_paid: boolean
    notes: string | null
    created_at: string
}

export interface LiveNetWorthData {
    asOf: string
    // Assets
    companyBanksTotal: number
    personalTotal: number
    cashInHandTotal: number
    totalLiquidCash: number
    warehouseStockValue: number
    darazInTransitValue: number
    darazPendingPayout: number
    courierInTransitValue: number
    courierPendingCod: number
    partyReceivables: number
    totalAssets: number
    businessTotalAssets: number
    // Liabilities
    partyPayables: number
    pendingChequesTotal: number
    otherLiabilitiesTotal: number
    totalLiabilities: number
    // Real Net Worth
    netWorth: number
    businessNetWorth: number
    // Non-cash loss visibility
    damagedGoodsLoss: number
    // Detail breakdowns
    accounts: FinancialAccount[]
    otherLiabilities: OtherLiability[]
}

export interface NetWorthSnapshot {
    id: string
    snapshot_date: string
    period_label: string | null
    company_banks_total: number
    personal_total: number
    cash_in_hand_total: number
    warehouse_stock_value: number
    daraz_in_transit_value: number
    daraz_pending_payout: number
    courier_in_transit_value: number
    courier_pending_cod: number
    party_receivables: number
    party_payables: number
    pending_cheques_total: number
    other_liabilities_total: number
    damaged_goods_loss: number
    total_assets: number
    total_liabilities: number
    net_worth: number
    created_at: string
}

export const CASHFLOW_CATEGORIES = {
    in: [
        { value: 'Daraz Payout', scope: 'business' as OwnerScope },
        { value: 'Courier COD Payout', scope: 'business' as OwnerScope },
        { value: 'Store / Direct Sale', scope: 'business' as OwnerScope },
        { value: 'Supplier Refund', scope: 'business' as OwnerScope },
        { value: 'Owner Capital Added', scope: 'personal' as OwnerScope },
        { value: 'Loan Received', scope: 'business' as OwnerScope },
        { value: 'Other Income', scope: 'business' as OwnerScope },
    ],
    out: [
        { value: 'Cash / Online Purchase', scope: 'business' as OwnerScope },
        { value: 'Party Due Payment', scope: 'business' as OwnerScope },
        { value: 'Supplier Cheque Cleared', scope: 'business' as OwnerScope },
        { value: 'Rent', scope: 'business' as OwnerScope },
        { value: 'Staff Salary', scope: 'business' as OwnerScope },
        { value: 'Transport / Delivery', scope: 'business' as OwnerScope },
        { value: 'Facebook Ads / Marketing', scope: 'business' as OwnerScope },
        { value: 'Packaging & Office', scope: 'business' as OwnerScope },
        { value: 'Vehicle Expenses', scope: 'business' as OwnerScope },
        { value: 'Tax / VAT', scope: 'business' as OwnerScope },
        { value: 'Loan Repayment', scope: 'business' as OwnerScope },
        { value: 'Personal Expense', scope: 'personal' as OwnerScope },
        { value: 'Other Business Expense', scope: 'business' as OwnerScope },
    ],
    transfer: [
        { value: 'Self Transfer', scope: 'business' as OwnerScope },
        { value: 'Bank to Cash in Hand', scope: 'business' as OwnerScope },
        { value: 'Cash Handover (Admin)', scope: 'business' as OwnerScope },
    ],
} as const
