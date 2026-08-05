import Link from "next/link"
import { Metadata } from "next"
import { getDashboardMetrics } from "@/features/dashboard/actions/dashboard-actions"
import {
    ShoppingBag,
    Globe,
    Store,
    ShoppingCart,
    Package,
    TrendingUp,
    AlertTriangle,
    Users,
    Receipt,
    FileText,
    BarChart3,
    MessageSquare,
    MessageCircle,
    Bell,
    Calendar,
    ArrowRight,
    CheckCircle2
} from "lucide-react"

export const metadata: Metadata = {
    title: "Dashboard Overview | Bagmati Traders",
}

export const revalidate = 0

export default async function DashboardPage() {
    const metrics = await getDashboardMetrics()

    const {
        headerTitle,
        headerSubtitle,
        activeFiscalYear,
        darazToday,
        websiteSalesToday,
        storeSalesToday,
        purchaseToday,
        inventory,
        financials,
        notifications
    } = metrics

    const totalOrdersCount = darazToday.pending + darazToday.packed + darazToday.readyToShip + darazToday.shipped
    const totalReturnsCount = darazToday.returnedDelivered + darazToday.customerReturnDelivered

    return (
        <div className="space-y-5 font-sans max-w-7xl mx-auto pb-6 text-slate-800 dark:text-zinc-200">
            {/* DYNAMIC TIME-BASED HEADER & LIGHT BLACK FISCAL YEAR PILL */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                        {headerTitle}
                    </h1>
                    <p className="text-xs md:text-sm font-normal text-slate-500 dark:text-zinc-400 mt-0.5">
                        {headerSubtitle}
                    </p>
                </div>

                {/* Light Black Fiscal Year Pill */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 text-slate-100 border border-slate-700/60 shadow-xs w-fit shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-slate-300">Fiscal Year:</span>
                    <span className="text-xs font-bold text-white">
                        {activeFiscalYear ? activeFiscalYear.name : 'No Active FY'}
                    </span>
                </div>
            </div>

            {/* PRIORITY 1: TODAY'S SALES & PURCHASING */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Today's Activity Overview
                    </h2>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        Today ({new Date().toLocaleDateString('en-NP', { month: 'short', day: 'numeric' })})
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* 1. Daraz Orders Today */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            {/* Card Header: Icon + "Daraz Orders Today" (Bold) */}
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                                <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                                    <ShoppingBag className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Daraz Orders Today
                                </h3>
                            </div>

                            {/* Card Body */}
                            <div className="grid grid-cols-2 gap-3 pt-3">
                                {/* Left Column: Totals */}
                                <div className="space-y-3 flex flex-col justify-center">
                                    <div>
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Total Orders</span>
                                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                                            {totalOrdersCount}
                                            <span className="text-[10px] font-normal text-slate-500 ml-1">orders</span>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Total Returns</span>
                                        <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
                                            {totalReturnsCount}
                                            <span className="text-[10px] font-normal text-slate-500 ml-1">returns</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Unified Green & Red Containers */}
                                <div className="space-y-2 text-[11px]">
                                    <div className="rounded-md border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 divide-y divide-emerald-200/70 dark:divide-emerald-800/40 text-emerald-900 dark:text-emerald-300 overflow-hidden shadow-xs">
                                        <div className="flex items-center justify-between px-2.5 py-1">
                                            <span>Pending</span>
                                            <span className="font-bold">{darazToday.pending}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-2.5 py-1">
                                            <span>Packed</span>
                                            <span className="font-bold">{darazToday.packed}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-2.5 py-1">
                                            <span>RTS</span>
                                            <span className="font-bold">{darazToday.readyToShip}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-2.5 py-1">
                                            <span>Shipped</span>
                                            <span className="font-bold">{darazToday.shipped}</span>
                                        </div>
                                    </div>

                                    <div className="rounded-md border border-rose-300 dark:border-rose-800/60 bg-rose-50/80 dark:bg-rose-950/40 divide-y divide-rose-200/70 dark:divide-rose-800/40 text-rose-900 dark:text-rose-300 overflow-hidden shadow-xs">
                                        <div className="flex items-center justify-between px-2.5 py-1">
                                            <span>Returned Del</span>
                                            <span className="font-bold">{darazToday.returnedDelivered}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-2.5 py-1">
                                            <span>Cust ret. Del</span>
                                            <span className="font-bold">{darazToday.customerReturnDelivered}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* View More at bottom */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/sales/daraz/sales-entry"
                                className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* 2. Website Orders Today */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            {/* Card Header: Icon + "Website Orders Today" (Bold) */}
                            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                                <div className="p-1.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                    <Globe className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Website Orders Today
                                </h3>
                            </div>

                            <div className="space-y-0.5 mt-3">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Website Orders Today</span>
                                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                                    {websiteSalesToday.count} <span className="text-xs font-normal text-slate-500">orders</span>
                                </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                                <span className="text-slate-500 dark:text-zinc-400">Today's Revenue</span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                    Rs {websiteSalesToday.totalAmount.toLocaleString('en-NP')}
                                </span>
                            </div>
                        </div>

                        {/* View More at bottom */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/sales/website-orders/orders"
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* 3. Store Sales Today */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            {/* Card Header: Icon + "Store Sales Today" (Bold) */}
                            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                                <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                                    <Store className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Store Sales Today
                                </h3>
                            </div>

                            <div className="space-y-0.5 mt-3">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Store Sales Today</span>
                                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                                    {storeSalesToday.count} <span className="text-xs font-normal text-slate-500">sales</span>
                                </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                                <span className="text-slate-500 dark:text-zinc-400">Today's Revenue</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    Rs {storeSalesToday.totalAmount.toLocaleString('en-NP')}
                                </span>
                            </div>
                        </div>

                        {/* View More at bottom */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/sales/store-sales"
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* 4. Purchases Today (Updated Wireframe Layout) */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            {/* Card Header: Icon + "Purchases Today" (Bold) */}
                            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                                <div className="p-1.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
                                    <ShoppingCart className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Purchases Today
                                </h3>
                            </div>

                            {/* Card Body: Left Column (Purchases Today & Purchase Amount) + Right Column (Sales Amount & Transactions) */}
                            <div className="grid grid-cols-2 gap-3 pt-3">
                                {/* Left Column */}
                                <div className="space-y-3 flex flex-col justify-center">
                                    <div>
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Purchases today</span>
                                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                                            {purchaseToday.itemCount}
                                            <span className="text-[10px] font-normal text-slate-500 ml-1">items</span>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Purchase Amount</span>
                                        <div className="text-lg font-bold text-sky-600 dark:text-sky-400">
                                            Rs {purchaseToday.purchaseAmount.toLocaleString('en-NP')}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-2 text-[11px]">
                                    {/* Sales Amount */}
                                    <div className="pb-1 border-b border-slate-100 dark:border-zinc-800">
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 block truncate">Sales Amount</span>
                                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                            Rs {purchaseToday.salesAmount.toLocaleString('en-NP')}
                                        </div>
                                    </div>

                                    {/* Transaction Breakdown Block */}
                                    <div>
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Transaction</span>
                                        <div className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/50 divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300 overflow-hidden text-[10.5px]">
                                            <div className="flex items-center justify-between px-2 py-0.5">
                                                <span>Online</span>
                                                <span className="font-semibold text-slate-900 dark:text-white">Rs {purchaseToday.transactions.online.toLocaleString('en-NP')}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-2 py-0.5">
                                                <span>Cash</span>
                                                <span className="font-semibold text-slate-900 dark:text-white">Rs {purchaseToday.transactions.cash.toLocaleString('en-NP')}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-2 py-0.5">
                                                <span>Due</span>
                                                <span className="font-semibold text-slate-900 dark:text-white">Rs {purchaseToday.transactions.due.toLocaleString('en-NP')}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-2 py-0.5">
                                                <span>Others</span>
                                                <span className="font-semibold text-slate-900 dark:text-white">Rs {purchaseToday.transactions.others.toLocaleString('en-NP')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* View More at bottom */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/purchase/dashboard"
                                className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRIORITY 2: INVENTORY OVERVIEW */}
            <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Inventory & Valuation
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Inventory List */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">Total Inventory Items</span>
                                <div className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">
                                    {inventory.totalProducts.toLocaleString('en-NP')} <span className="text-xs font-normal text-slate-500">SKUs</span>
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                                <Package className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/inventory/product-list"
                                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* Stock Valuation */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">Total Stock Valuation</span>
                                <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                                    Rs {inventory.totalValuation.toLocaleString('en-NP', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/inventory/stock-ledger"
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* Damaged Goods */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">Damaged Goods Count</span>
                                <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400 mt-1">
                                    {inventory.damagedCount} <span className="text-xs font-normal text-slate-500">items</span>
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/inventory/damaged-stocks"
                                className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRIORITY 3: FINANCIAL & FISCAL YEAR ACCOUNTING */}
            <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    Financial & Fiscal Year Accounting
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Supplier Ledger */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="p-2 rounded bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 w-fit mb-2">
                                <Users className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Pending Due Balance</span>
                                <div className="text-lg font-semibold text-violet-600 dark:text-violet-400">
                                    Rs {financials.pendingSupplierDue.toLocaleString('en-NP', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/suppliers"
                                className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* Purchase Billing */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="p-2 rounded bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 w-fit mb-2">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Purchase Book (FY {activeFiscalYear?.name})</span>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Rs {financials.purchaseBillingTotal.toLocaleString('en-NP', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/account/pan-vat-billing/purchase-billing"
                                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* Sales Billing */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="p-2 rounded bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 w-fit mb-2">
                                <Receipt className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Sales Book (FY {activeFiscalYear?.name})</span>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Rs {financials.salesBillingTotal.toLocaleString('en-NP', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/account/pan-vat-billing/sales-billing"
                                className="text-xs font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* Sales Report Est Shipped */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 w-fit mb-2">
                                <BarChart3 className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Est. Shipped (FY {activeFiscalYear?.name})</span>
                                <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                                    Rs {financials.estShippedTotal.toLocaleString('en-NP', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                            <Link
                                href="/dashboard/account/pan-vat-billing/report"
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"
                            >
                                View More <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRIORITY 4: ACTION ITEMS & REMINDERS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 pt-1">
                {/* 1. Daraz Chat Unread */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 pb-2">
                            <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                                <MessageSquare className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                                Daraz Chat Unread
                            </h3>
                        </div>
                        <div className="py-2 text-center">
                            <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                                {notifications.unreadDarazChats5Days}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                Unread chats in last 5 days
                            </p>
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                        <Link
                            href="/dashboard/chat-ai?tab=chat"
                            className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 hover:underline"
                        >
                            View More <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                {/* 2. Unreplied Product Reviews */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 pb-2">
                            <div className="p-2 rounded bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400">
                                <MessageCircle className="w-4 h-4" />
                            </div>
                            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                                Product Reviews
                            </h3>
                        </div>
                        <div className="py-2 text-center">
                            <div className="text-2xl font-semibold text-pink-600 dark:text-pink-400">
                                {notifications.unrepliedTextReviews}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                Text reviews awaiting reply
                            </p>
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                        <Link
                            href="/dashboard/chat-ai/reviews"
                            className="text-xs font-medium text-pink-600 hover:text-pink-700 dark:text-pink-400 flex items-center gap-1 hover:underline"
                        >
                            View More <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                {/* 3. Open Reminders (Scrollable compartment showing 5 at a time) */}
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                                        Open Reminders
                                    </h3>
                                    <span className="text-[10px] text-slate-400">
                                        {notifications.openReminders.length} active
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Compartment (Fixed max height ~ 180px for 5 items) */}
                        <div className="my-2 max-h-[180px] overflow-y-auto pr-1 space-y-1.5 divide-y divide-slate-100 dark:divide-zinc-800">
                            {notifications.openReminders.length === 0 ? (
                                <div className="text-center py-6 text-xs text-slate-400 flex flex-col items-center gap-1">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    No pending open reminders.
                                </div>
                            ) : (
                                notifications.openReminders.map((reminder) => (
                                    <div key={reminder.id} className="pt-1.5 first:pt-0 flex items-start gap-2 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 dark:text-zinc-200 truncate text-[11px]">
                                                {reminder.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                <span>{reminder.date}</span>
                                                {reminder.time && <span>• {reminder.time}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                        <Link
                            href="/dashboard/profile"
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                        >
                            View More <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
