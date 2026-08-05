
import { getProductStockDetails } from '@/features/inventory/services/stock-ledger-service'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props {
    params: Promise<{
        productId: string
    }>
}

export default async function StockLedgerDetailPage({ params }: Props) {
    const { productId } = await params
    console.log('[StockLedgerDetail] Requested ID:', productId)

    const details = await getProductStockDetails(productId)
    console.log('[StockLedgerDetail] Result:', details ? 'Found' : 'Not Found')

    if (!details) {
        notFound()
    }

    const DetailRow = ({ label, value, isBold = false, colorClass = 'text-gray-900 dark:text-gray-100' }: { label: string, value: number, isBold?: boolean, colorClass?: string }) => (
        <div className={`flex justify-between items-center py-3 border-b dark:border-zinc-800 ${isBold ? 'font-bold' : ''}`}>
            <span className="text-gray-600 dark:text-gray-400">{label}</span>
            <span className={`font-mono ${colorClass} ${isBold ? 'text-lg' : ''}`}>{value}</span>
        </div>
    )

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{details.product_name}</h1>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {details.product_id && <span>ID: <span className="font-mono text-gray-700 dark:text-gray-300">{details.product_id}</span></span>}
                    </div>
                    {(details.seller_sku1 || details.seller_sku2 || details.seller_sku3 || details.seller_sku4) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {[details.seller_sku1, details.seller_sku2, details.seller_sku3, details.seller_sku4]
                                .filter(Boolean)
                                .map((sku, i) => (
                                    <span key={i} className="px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 rounded border dark:border-zinc-700">
                                        {sku}
                                    </span>
                                ))
                            }
                        </div>
                    )}
                </div>

                <Link
                    href="/dashboard/inventory/stock-ledger"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-200 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span>Back to Ledger</span>
                </Link>
            </div>

            {/* Metrics List */}
            <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-sm p-6 space-y-1">
                <DetailRow label="Opening Stock" value={details.opening_stock} />
                <DetailRow label="Manual Adjustment" value={details.manual_adjustment} />
                <DetailRow label="Auto Adjust" value={details.auto_adjust} colorClass="text-purple-600 dark:text-purple-400" />
                <DetailRow label="Damage Stock" value={details.damage_stock} colorClass="text-orange-600 dark:text-orange-400" />
                <DetailRow label="Purchase" value={details.purchase} />

                <div className="my-4 border-t dark:border-zinc-800 border-dashed"></div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sales & Returns</h3>

                <DetailRow label="Daraz Shipped Order" value={details.daraz_shipped} colorClass="text-green-600 dark:text-green-400" />
                <DetailRow label="Daraz Delivered Order" value={details.daraz_delivered} colorClass="text-green-600 dark:text-green-400" />
                <DetailRow label="Daraz Returning to Seller Order" value={details.daraz_returning} colorClass="text-green-600 dark:text-green-400" />
                <DetailRow label="Daraz Customer Return Order" value={details.daraz_customer_return} colorClass="text-green-600 dark:text-green-400" />


                <DetailRow label="Store Sales Qty" value={details.store_sales} colorClass="text-green-600 dark:text-green-400" />

                <div className="my-2 border-t dark:border-zinc-800 border-dashed"></div>
                
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ecommerce Order (website)</h3>
                <DetailRow label="Ecommerce Shipped Order Qty" value={details.website_shipped} colorClass="text-green-600 dark:text-green-400" />
                <DetailRow label="Ecommerce Delivered Order Qty" value={details.website_delivered} colorClass="text-green-600 dark:text-green-400" />
                <DetailRow label="Ecommerce Returned Delivered Qty" value={details.website_returned_delivered} colorClass="text-red-600 dark:text-red-400" />
                <DetailRow label="Total Sales By Ecommerce" value={details.website_shipped + details.website_delivered} isBold={true} colorClass="text-blue-600 dark:text-blue-400" />

                <div className="my-4 border-t dark:border-zinc-800 border-dashed"></div>

                <DetailRow label="Daraz Returned Delivered Qty" value={details.daraz_returned_delivered} colorClass="text-red-600 dark:text-red-400" />
                <DetailRow label="Daraz Customer Return Qty" value={details.daraz_customer_return} colorClass="text-red-600 dark:text-red-400" /> {/* Listed twice as per prompt implies separate focus, or technically it contributes to both sales and returns logic differently in ledger? In ledger, Customer Return is sales (sold) AND return? No, Customer Return in sales column? Wait. 
                In ledger service:
                Sales Column (Green) includes: Customer Return.
                Sales Return Column (Red) includes: Customer Return.
                So it appears in both. I will list it here as requested.
                */}


                <div className="my-4 border-t-2 border-gray-100 dark:border-zinc-700"></div>

                <div className="flex justify-between items-center pt-2">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">Total Stock</span>
                    <span className={`text-2xl font-bold font-mono ${details.total_stock < 0 ? 'text-red-600' : 'text-blue-700 dark:text-blue-400'}`}>
                        {details.total_stock}
                    </span>
                </div>
            </div>
        </div>
    )
}
