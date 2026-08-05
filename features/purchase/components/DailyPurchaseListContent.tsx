'use client'

import { useState, useEffect } from 'react'
import { useDashboard } from '@/app/dashboard/context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { getPurchasePlans } from '@/features/purchase/actions/plan-actions'
import { getTodayPurchases, getPurchases } from '@/features/purchase/actions/purchase-actions'
import { getDailyPurchaseReport } from '@/features/purchase/actions/purchase-analytics-actions'
import { PlanList } from '@/features/purchase/components/daily-plan/PlanList'
import { SearchInput } from '@/features/purchase/components/daily-plan/SearchInput'
import { AddPlanModal } from '@/features/purchase/components/daily-plan/AddPlanModal'
import { ArrowLeft, Plus, FileText, List as ListIcon, Eye, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import DailyPurchaseDetailView from './DailyPurchaseDetailView'
import PurchaseListContent from '@/features/purchase/components/PurchaseListContent'
import PurchaseForm from '@/features/purchase/components/PurchaseForm'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { cachePurchasePlans, getCachedPurchasePlans } from '@/features/purchase/actions/offline-purchase-actions'

interface DailyPurchaseListContentProps {
    isEmbedded?: boolean
}

export default function DailyPurchaseListContent({ isEmbedded = false }: DailyPurchaseListContentProps) {
    const [viewMode, setViewMode] = useState<'plan' | 'transactions' | 'all-purchases'>('plan')
    const [isAddPurchaseModalOpen, setIsAddPurchaseModalOpen] = useState(false)
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const searchQuery = searchParams.get('q')?.toLowerCase() || ''
    const { setHeaderTitle, setHeaderAction } = useDashboard()
    const { isOnline, pendingCount } = useOfflineSync()

    // Update global header title and action based on view mode
    useEffect(() => {
        if (!setHeaderTitle || !setHeaderAction || isEmbedded) return

        if (viewMode === 'plan') {
            setHeaderTitle('Daily Purchases')
            setHeaderAction(
                <button
                    onClick={() => setIsAddPurchaseModalOpen(true)}
                    className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                >
                    <Plus size={22} />
                </button>
            )
        } else if (viewMode === 'transactions') {
            const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            setHeaderTitle(
                <div className="flex flex-col items-center justify-center -space-y-0.5">
                    <span className="text-sm font-bold">Transaction Details</span>
                    <span className="text-[11px] font-medium text-gray-500">{todayStr}</span>
                </div>
            )
            setHeaderAction(null)
        } else {
            setHeaderTitle('All Purchase List')
            setHeaderAction(null)
        }

        return () => {
            if (setHeaderTitle) setHeaderTitle(null)
            if (setHeaderAction) setHeaderAction(null)
        }
    }, [viewMode, setHeaderTitle, setHeaderAction, isEmbedded])

    // Fetch Plans (with offline support)
    const { data: allPlans, isLoading: isPlansLoading } = useQuery({
        queryKey: ['purchase-plans'],
        queryFn: async () => {
            if (isOnline) {
                // Online: fetch from server and cache
                const plans = await getPurchasePlans()
                if (plans && plans.length > 0) {
                    await cachePurchasePlans(plans)
                }
                return plans
            } else {
                // Offline: load from cache
                return await getCachedPurchasePlans()
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - plans don't change often
        gcTime: 10 * 60 * 1000 // 10 minutes (formerly cacheTime)
    })

    // Fetch Today's Purchases (for completion status)
    const { data: todayPurchasesData, isLoading: isPurchasesLoading } = useQuery({
        queryKey: ['today-purchases-for-plan'],
        queryFn: () => getTodayPurchases(),
        staleTime: 30 * 1000, // 30 seconds - purchases update frequently
        gcTime: 5 * 60 * 1000 // 5 minutes
    })

    // Fetch Details for Today (for Transaction Details View)
    const today = new Date().toISOString().split('T')[0]
    const { data: detailData, isLoading: isDetailLoading } = useQuery({
        queryKey: ['purchase-details-today', today],
        queryFn: () => getPurchases({ startDate: today, endDate: today, limit: 1000 }),
        enabled: viewMode === 'transactions',
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000 // 5 minutes
    })

    const completedProductIds = Array.from(new Set(todayPurchasesData?.purchases?.map((p: any) => p.product_id) || [])) as string[]

    // Filter Plans
    const filteredPlans = searchQuery
        ? allPlans?.filter(p => p.product?.product_name.toLowerCase().includes(searchQuery)) || []
        : allPlans || []

    const isLoading = isPlansLoading || isPurchasesLoading

    const handlePlanAdded = async () => {
        // Invalidate queries to refresh list
        queryClient.invalidateQueries({ queryKey: ['purchase-plans'] })
    }

    const handlePlanUpdated = async () => {
        // Invalidate both plans and today's purchases (for purchased status check)
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['purchase-plans'] }),
            queryClient.invalidateQueries({ queryKey: ['today-purchases-for-plan'] }),
            queryClient.invalidateQueries({ queryKey: ['today-purchases'] }) // Also refresh main purchase list if needed
        ])
    }

    const handlePurchaseAdded = async () => {
        // Optimistic update: immediately update cache instead of refetching
        // This provides instant feedback to the user

        // Invalidate with refetchType background to revalidate without blocking UI
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ['today-purchases-for-plan'],
                refetchType: 'active' // Only refetch if query is currently being used
            }),
            queryClient.invalidateQueries({
                queryKey: ['purchase-details-today'],
                refetchType: 'active'
            }),
            queryClient.invalidateQueries({
                queryKey: ['today-purchases'],
                refetchType: 'active'
            })
        ])
    }

    return (
        <div className={`flex flex-col h-full bg-gray-50 dark:bg-zinc-900 ${isEmbedded ? '' : 'md:mt-0 mt-16'}`}>
            {/* Header - Only shown if NOT embedded */}
            {!isEmbedded && (
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold text-blue-600">Daily Purchases</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">Plan and track daily procurement</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/purchase"
                            className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Back to Purchase
                        </Link>
                    </div>
                </div>
            )}

            {/* Toggle Buttons & Controls */}
            <div className={`hidden md:block sticky z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm ${isEmbedded ? 'top-0' : 'top-0'}`}>
                <div className="flex items-center justify-between gap-3">
                    {/* Left: View Toggles (Desktop) */}
                    <div className="flex items-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                        <button
                            onClick={() => setViewMode('plan')}
                            className={`flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'plan'
                                ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            <FileText size={14} />
                            Purchase Plan
                        </button>
                        <button
                            onClick={() => setViewMode('transactions')}
                            className={`flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'transactions'
                                ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            <ListIcon size={14} />
                            Transaction Details
                        </button>
                    </div>

                    {/* Right: Actions (Only for Plan View currently) - Desktop */}
                    {viewMode === 'plan' && (
                        <div className="flex items-center gap-2">
                            <div className="w-64">
                                <SearchInput />
                            </div>
                            <AddPlanModal onPlanAdded={handlePlanAdded} onOpenChange={setIsPlanModalOpen} />
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Header Controls */}
            <div className={`md:hidden sticky top-16 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 ${viewMode === 'plan' ? 'block' : 'hidden'}`}>
                <div className="px-4 py-3">
                    <SearchInput />
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex-1 ${viewMode === 'plan' ? 'overflow-auto p-3 pb-24' : 'overflow-hidden'}`}>
                {viewMode === 'plan' ? (
                    isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="text-gray-500">Loading plans...</div>
                        </div>
                    ) : (
                        <PlanList
                            plans={filteredPlans}
                            completedProductIds={completedProductIds}
                            onPlanUpdated={handlePlanUpdated}
                        />
                    )
                ) : viewMode === 'transactions' ? (
                    /* Transaction Details View - Direct Detail View */
                    <DailyPurchaseDetailView
                        date={today}
                        purchases={detailData?.purchases || []}
                        isLoading={isDetailLoading}
                    // No onBack provided, so back button will be hidden
                    />
                ) : (
                    /* All Purchases View - Display Purchase List */
                    <PurchaseListContent isEmbedded={true} />
                )}
            </div>

            {/* Mobile Floating Action Button (Plan View Only) */}
            {viewMode === 'plan' && (
                <div className="md:hidden fixed bottom-20 right-4 z-40">
                    <AddPlanModal
                        onPlanAdded={handlePlanAdded}
                        onOpenChange={setIsPlanModalOpen}
                        trigger={
                            <button className="h-12 w-12 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all">
                                <Plus size={24} />
                            </button>
                        }
                    />
                </div>
            )}

            {/* Mobile Bottom Navigation */}
            {!isAddPurchaseModalOpen && !isPlanModalOpen && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 z-50 px-2 py-2 pb-safe">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setViewMode('plan')}
                            className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${viewMode === 'plan'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            <FileText size={20} />
                            <span className="text-xs font-medium">Purchase Plan</span>
                        </button>
                        <button
                            onClick={() => setViewMode('transactions')}
                            className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${viewMode === 'transactions'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            <ListIcon size={20} />
                            <span className="text-xs font-medium">Transaction Details</span>
                        </button>
                        <button
                            onClick={() => setViewMode('all-purchases')}
                            className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${viewMode === 'all-purchases'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            <Eye size={20} />
                            <span className="text-xs font-medium">Order List</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Add Purchase Modal */}
            {isAddPurchaseModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 md:p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-3xl h-full md:h-[80vh] bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <PurchaseForm
                            onClose={() => setIsAddPurchaseModalOpen(false)}
                            onSuccess={handlePurchaseAdded}
                            showExtraFields={true} // Assuming full entry form is desired as per "Purchase Entry" page
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
