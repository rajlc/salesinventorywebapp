'use client'

import React, { useState } from 'react'
import { PurchasePlan, updatePurchasePlanStatus } from '@/features/purchase/actions/plan-actions'
import { CountdownTimer } from './CountdownTimer'
import { PlanDetailModal } from './PlanDetailModal'
import { Check, Eye, Archive, Share2, X, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-shim'
import PurchaseForm from '@/features/purchase/components/PurchaseForm'
import { ComboComponentSelectModal } from '@/features/inventory/components/ComboComponentSelectModal'

interface PlanListProps {
    plans: PurchasePlan[]
    completedProductIds: string[]
    onPlanUpdated?: () => void
}

export function PlanList({ plans, completedProductIds, onPlanUpdated }: PlanListProps) {
    const router = useRouter()

    // View Modal State
    const [selectedPlan, setSelectedPlan] = useState<PurchasePlan | null>(null)
    const [viewOpen, setViewOpen] = useState(false)

    // Purchase Modal State
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
    const [purchasePlanData, setPurchasePlanData] = useState<{ productId: string, productName: string, quantity: number, remarks: string } | undefined>(undefined)

    // Combo Resolving State
    const [comboResolving, setComboResolving] = useState<{ id: string, name: string, planQuantity: number, remarks: string, components?: any[] } | null>(null)

    // Full Image State
    const [fullImage, setFullImage] = useState<string | null>(null)

    // Action Menu State - tracks which plan is showing the complete action menu
    const [actionMenuPlanId, setActionMenuPlanId] = useState<string | null>(null)

    // Bulk Share State
    const [selectedPlans, setSelectedPlans] = useState<string[]>([])
    const [isBulkSharing, setIsBulkSharing] = useState(false)

    // Dynamic Grouping
    const isPurchased = (plan: PurchasePlan) => {
        if (plan.status === 'Pending' || plan.status === 'Pending Confirmation') return false;
        return completedProductIds.includes(plan.product_id)
    }

    const rawPurchasedPlans = plans.filter(isPurchased)

    // Aggregate purchased plans by product_id
    const purchasedPlans = Object.values(rawPurchasedPlans.reduce((acc, plan) => {
        const key = plan.product_id
        if (!acc[key]) {
            acc[key] = { ...plan }
        } else {
            acc[key].quantity += plan.quantity
        }
        return acc
    }, {} as Record<string, PurchasePlan>))

    const pendingPlans = plans.filter(p => p.status === 'Pending' && !isPurchased(p))
    const pendingConfirmationPlans = plans.filter(p => p.status === 'Pending Confirmation' && !isPurchased(p))
    const manualCompletePlans = plans.filter(p => p.status === 'Complete' && !isPurchased(p))
    const cancelPlans = plans.filter(p => p.status === 'Cancel')

    const handleView = (plan: PurchasePlan) => {
        setSelectedPlan(plan)
        setViewOpen(true)
    }

    const handleOpenPurchaseModal = (plan: PurchasePlan) => {
        // Check if combo
        if (plan.product && plan.product.product_type === 'combo') {
            setComboResolving({
                id: plan.product_id,
                name: plan.product.product_name,
                planQuantity: plan.quantity,
                remarks: plan.remarks || '',
                components: plan.product.product_combos || [] // Pass eager components
            })
            return
        }

        setPurchasePlanData({
            productId: plan.product_id,
            productName: plan.product?.product_name || '',
            quantity: plan.quantity,
            remarks: plan.remarks || ''
        })
        setPurchaseModalOpen(true)
    }

    // Sound Effect (Short Clap/Pop)
    const playClapSound = () => {
        const audio = new Audio("data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==") // Placeholder for actual clap sound, I will use a real one in next step if this is too short. Actually let's use a real base64.
        // Replacing with a real short 'pop/clap' base64 to ensure it works.
        const realClap = "data:audio/wav;base64,UklGRqQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYAGAACAgICAgICAgICAgICAgICAgICAgICAgICAf3hxeHCAgIB/cnV5gICAf3J1eYCAgH9zdXqAgIB/c3V6gICAf3N1eoCAgH9zdXqAgIB/c3V6gICAf3N1eoCAgH9zdXqAgIB/c3V6gICAf3N1eoCAgH90dn2AgIB/dHZ9gICAf3R2fYCAgH90dn2AgIB/dHZ9gICAf3R2fYCAgH90dn2AgIB/dHZ9gICAf3R2fYCAgH90dn2AgIB/dHZ9gICAf3R2fYCAgH5yc3uAgIB+cnN7gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+bnJ2gICAfm5ydoCAgH5ucnaAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH5vc3eAgIB+b3N3gICAfm9zd4CAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gICAfXF0eoCAgH1xdHqAgIB9cXR6gIB=" // This is truncated dummy. I will use a proper generic function with a reliable URL or just standard "sound" logic.
        // Actually, best approach: Use a standard small distinct beep/pop encoded or simply confirm Vibration first.
        // User asked for "Clap". 
        // I will use a short base64 string for a "tick" or "pop" which is safer.

        try {
            // Using a simple short beep/pop base64
            const snd = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU" + "A".repeat(100)); // Dummy
            const clapAudio = new Audio("https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3"); // Reliable public CDN for 'Pop' sound
            clapAudio.volume = 0.5;
            clapAudio.play().catch(e => console.error("Audio play failed", e));
        } catch (e) {
            console.error("Sound error", e)
        }
    }

    const triggerMobileFeedback = (withSound: boolean) => {
        // Mobile check
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            // Vibrate
            if (navigator.vibrate) {
                navigator.vibrate(200)
            }

            // Sound
            if (withSound) {
                playClapSound()
            }
        }
    }

    const handleMarkComplete = async (plan: PurchasePlan) => {
        try {
            triggerMobileFeedback(true) // Vibrate + Sound
            await updatePurchasePlanStatus(plan.id, 'Complete')
            toast.success("Marked as Complete")
            onPlanUpdated?.()
        } catch (err) {
            toast.error("Failed to update status")
        }
    }

    const handleMarkCancel = async (plan: PurchasePlan) => {
        if (!confirm("Are you sure you want to cancel this plan?")) return
        try {
            triggerMobileFeedback(false) // Vibrate Only
            await updatePurchasePlanStatus(plan.id, 'Cancel')
            toast.success("Plan Cancelled")
            onPlanUpdated?.()
        } catch (err) {
            toast.error("Failed to update status")
        }
    }

    const handleApprovePendingConfirmation = async (plan: PurchasePlan) => {
        if (!confirm(`Approve auto-planned purchase for "${plan.product?.product_name}"? This will move it to Pending.`)) return
        try {
            triggerMobileFeedback(true)
            await updatePurchasePlanStatus(plan.id, 'Pending')
            toast.success('Plan approved — moved to Pending')
            onPlanUpdated?.()
        } catch (err) {
            toast.error('Failed to approve plan')
        }
    }

    const handleShareToWhatsApp = (plan: PurchasePlan) => {
        // Open share modal with just this plan selected
        setSelectedPlans([plan.id])
        setIsBulkSharing(true)
    }

    const handleBulkShare = async () => {
        if (selectedPlans.length === 0) {
            toast.error('No plans selected')
            return
        }

        // Open modal to share each plan individually
        setIsBulkSharing(true)
    }

    const togglePlanSelection = (planId: string) => {
        setSelectedPlans(prev =>
            prev.includes(planId)
                ? prev.filter(id => id !== planId)
                : [...prev, planId]
        )
    }

    const toggleSelectAll = () => {
        if (selectedPlans.length === pendingPlans.length) {
            setSelectedPlans([])
        } else {
            setSelectedPlans(pendingPlans.map(p => p.id))
        }
    }

    const onPurchaseSuccess = async () => {
        triggerMobileFeedback(true)
        setPurchaseModalOpen(false)
        toast.success("Purchase Entry Created. Plan Updated.")
        onPlanUpdated?.()
    }

    const ActionButtons = ({ plan, type }: { plan: PurchasePlan, type: 'pending' | 'pending-confirmation' | 'purchased' | 'complete' | 'cancel' }) => (
        <div className="flex items-center justify-end gap-2">
            {type === 'pending' && (
                <>
                    {/* Complete Button */}
                    <button
                        onClick={() => setActionMenuPlanId(plan.id)}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded flex items-center gap-1 border border-gray-300"
                        title="Choose action"
                    >
                        <Check size={14} /> Complete
                    </button>

                    {/* Cancel Button */}
                    <button
                        onClick={() => handleMarkCancel(plan)}
                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs rounded flex items-center gap-1 border border-red-200"
                        title="Cancel Plan"
                    >
                        Cancel
                    </button>

                    {/* Share Button */}
                    <button
                        onClick={() => handleShareToWhatsApp(plan)}
                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs rounded flex items-center gap-1 border border-blue-200"
                        title="Share Plan"
                    >
                        <Share2 size={14} /> Share
                    </button>
                </>
            )}

            {type === 'pending-confirmation' && (
                <>
                    {/* Approve Button */}
                    <button
                        onClick={() => handleApprovePendingConfirmation(plan)}
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded flex items-center gap-1 border border-amber-600"
                        title="Approve auto-planned item"
                    >
                        <Check size={14} /> Approve
                    </button>

                    {/* Cancel Button */}
                    <button
                        onClick={() => handleMarkCancel(plan)}
                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs rounded flex items-center gap-1 border border-red-200"
                        title="Dismiss auto-planned item"
                    >
                        Dismiss
                    </button>
                </>
            )}

            {type === 'purchased' && (
                <button disabled className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-bold flex items-center gap-1 border border-gray-200 cursor-not-allowed">
                    <Check size={14} /> Done
                </button>
            )}

            {type === 'complete' && (
                <button
                    onClick={() => {
                        handleOpenPurchaseModal(plan)
                    }}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded flex items-center gap-1"
                    title="Open Purchase Entry Form"
                >
                    Add Purchase
                </button>
            )}

            {type === 'cancel' && (
                <span className="text-red-500 text-xs font-bold">Cancelled</span>
            )}
        </div>
    )

    const RenderTable = ({ data, title, colorClass, type, headerBadge }: { data: PurchasePlan[], title: string, colorClass: string, type: 'pending' | 'pending-confirmation' | 'purchased' | 'complete' | 'cancel', headerBadge?: React.ReactNode }) => {
        if (data.length === 0) return null

        return (
            <Card className="mb-6 border-none shadow-none md:border md:shadow-sm bg-transparent md:bg-white md:dark:bg-zinc-900">
                <CardHeader className="sticky top-0 z-10 py-3 px-4 md:px-6 bg-gray-100/95 dark:bg-zinc-800/95 backdrop-blur supports-[backdrop-filter]:bg-gray-100/60 border-b dark:border-zinc-700 md:static md:bg-gray-50 md:dark:bg-zinc-800 rounded-t-lg">
                    <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                            <CardTitle className={`text-base font-bold ${colorClass.replace(
                                /text-[a-z]+-[0-9]+/,
                                (match) => `${match} dark:text-white`
                            )}`}>
                                {title} ({data.length})
                            </CardTitle>
                            {headerBadge}
                        </div>

                        {/* Bulk Share Button for Pending Plans */}
                        {type === 'pending' && selectedPlans.length > 0 && (
                            <button
                                onClick={handleBulkShare}
                                disabled={isBulkSharing}
                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white text-xs rounded-lg flex items-center gap-2 transition-all shadow-sm"
                            >
                                <Share2 size={14} />
                                {isBulkSharing ? 'Sharing...' : `Share ${selectedPlans.length}`}
                            </button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto bg-white dark:bg-zinc-900 rounded-b-lg border-t md:border-none">
                        <table className="w-full text-sm text-left table-fixed">
                            <thead className="bg-gray-100 dark:bg-zinc-700 text-gray-600">
                                <tr>
                                    {type === 'pending' && (
                                        <th className="px-4 py-2 w-[3%]">
                                            <input
                                                type="checkbox"
                                                checked={selectedPlans.length === data.length && data.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 cursor-pointer"
                                            />
                                        </th>
                                    )}
                                    <th className="px-4 py-2 w-[5%]">S.N</th>
                                    <th className="px-4 py-2 w-[8%]">Date</th>
                                    <th className="px-4 py-2 w-[25%]">Product Name</th>
                                    <th className="px-4 py-2 w-[5%]">Qty</th>
                                    <th className="px-4 py-2 w-[10%]">L. Price</th>
                                    <th className="px-4 py-2 w-[15%]">L. Supplier</th>
                                    <th className="px-4 py-2 w-[10%]">Remarks</th>
                                    {type !== 'pending-confirmation' && (
                                        <th className="px-4 py-2 w-[10%]">Expires In</th>
                                    )}
                                    <th className="px-4 py-2 w-[15%] text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-zinc-700">
                                {data.map((plan, index) => (
                                    <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        {type === 'pending' && (
                                            <td className="px-4 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPlans.includes(plan.id)}
                                                    onChange={() => togglePlanSelection(plan.id)}
                                                    className="w-4 h-4 cursor-pointer"
                                                />
                                            </td>
                                        )}
                                        <td className="px-4 py-2">{index + 1}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{new Date(plan.plan_date).toLocaleDateString()}</td>
                                        <td
                                            className="px-4 py-2 font-medium text-blue-600 hover:underline cursor-pointer whitespace-normal break-words"
                                            onClick={() => handleView(plan)}
                                            title="Click to view details"
                                        >
                                            {plan.product?.product_name}
                                        </td>
                                        <td className="px-4 py-2">{plan.quantity}</td>
                                        <td className="px-4 py-2">Rs. {plan.snapshot_latest_price}</td>
                                        <td className="px-4 py-2 truncate" title={plan.snapshot_latest_supplier}>{plan.snapshot_latest_supplier}</td>
                                        <td className="px-4 py-2 truncate">{plan.remarks}</td>
                                        {type !== 'pending-confirmation' && (
                                            <td className="px-4 py-2">
                                                <CountdownTimer targetDate={plan.expires_at} />
                                            </td>
                                        )}
                                        <td className="px-4 py-2 text-right whitespace-nowrap">
                                            <ActionButtons plan={plan} type={type} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-2">
                        {data.map((plan) => (
                            <div key={plan.id} className="bg-white dark:bg-zinc-900 p-2 rounded-lg border shadow-sm flex flex-col gap-1.5">
                                {/* Row 1: Countdown (Left) | Low Price (Right) */}
                                <div className="flex justify-between items-center text-[10px] pb-1.5 border-b border-dashed">
                                    <div className="font-mono text-gray-500 dark:text-white">
                                        {type !== 'pending-confirmation' && (
                                            <CountdownTimer targetDate={plan.expires_at} />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium text-gray-700 dark:text-gray-300">
                                            Rs. {plan.snapshot_low_price}
                                        </div>
                                        {/* Checkbox removed for mobile view as per user request */}
                                    </div>
                                </div>

                                {/* Row 2: Image 30% | Name 70% */}
                                <div className="flex gap-2 items-center py-0.5" onClick={() => handleView(plan)}>
                                    <div className="w-[30%] flex justify-start" onClick={(e) => {
                                        if (plan.product?.image_url) {
                                            e.stopPropagation()
                                            setFullImage(plan.product.image_url)
                                        }
                                    }}>
                                        {plan.product?.image_url ? (
                                            <img
                                                src={plan.product.image_url}
                                                alt="Product"
                                                className="w-full h-16 rounded-md object-cover border bg-gray-50"
                                            />
                                        ) : (
                                            <div className="w-full h-16 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 border">
                                                <Archive size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full font-medium text-blue-600 dark:text-white text-xs leading-tight line-clamp-3">
                                        {plan.product?.product_name}
                                    </div>
                                </div>

                                {/* Row 3: Qty (Left - Middle) | L Price (Right - Middle) */}
                                <div className="flex justify-between items-center py-1.5 border-t border-dashed text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-500 text-[10px]">Qty:</span>
                                        <span className="font-bold">{plan.quantity}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-500 text-[10px]">L. Price:</span>
                                        <span className="font-bold">Rs. {plan.snapshot_latest_price}</span>
                                    </div>
                                </div>

                                {/* Row 4: Buttons */}
                                <div className="pt-1.5 border-t dark:border-zinc-800">
                                    {type === 'pending' && (
                                        <div className="space-y-2">
                                            {/* Action Buttons - Grid */}
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* Complete Button */}
                                                <button
                                                    onClick={() => setActionMenuPlanId(plan.id)}
                                                    className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-[10px] rounded flex items-center justify-center gap-1 transition-all border border-gray-300"
                                                >
                                                    <Check size={12} /> Complete
                                                </button>

                                                {/* Cancel Button */}
                                                <button
                                                    onClick={() => handleMarkCancel(plan)}
                                                    className="w-full py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-[10px] rounded flex items-center justify-center gap-1 transition-all border border-red-200"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {type === 'pending-confirmation' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Approve Button */}
                                            <button
                                                onClick={() => handleApprovePendingConfirmation(plan)}
                                                className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium text-[10px] rounded flex items-center justify-center gap-1 transition-all"
                                            >
                                                <Check size={12} /> Approve
                                            </button>

                                            {/* Dismiss Button */}
                                            <button
                                                onClick={() => handleMarkCancel(plan)}
                                                className="w-full py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-[10px] rounded flex items-center justify-center gap-1 transition-all border border-red-200"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    )}

                                    {type === 'complete' && (
                                        <button
                                            onClick={() => handleOpenPurchaseModal(plan)}
                                            className="w-full py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] rounded-full flex items-center justify-center gap-1 transition-all shadow-sm"
                                        >
                                            Add Purchase
                                        </button>
                                    )}

                                    {type === 'purchased' && (
                                        <div className="w-full py-1.5 bg-gray-50 text-gray-400 text-[10px] rounded flex items-center justify-center gap-1 border border-gray-100 cursor-not-allowed font-medium">
                                            <Check size={12} /> Entry Done
                                        </div>
                                    )}

                                    {type === 'cancel' && (
                                        <div className="w-full py-1.5 text-center text-red-500 text-[10px] font-bold bg-red-50 rounded border border-red-100">
                                            Cancelled
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                </CardContent>
            </Card >
        )
    }

    return (
        <div className="space-y-6">
            {/* Styles for custom animations */}
            <style jsx global>{`
                @keyframes shimmer-x {
                    from { transform: translateX(-150%); }
                    to { transform: translateX(150%); }
                }
                .animate-shimmer-x {
                    animation: shimmer-x 2s infinite linear;
                }
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>

            <RenderTable
                data={pendingConfirmationPlans}
                title="Needs Confirmation"
                colorClass="text-amber-600"
                type="pending-confirmation"
                headerBadge={
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold border border-amber-300">
                        🤖 Auto-planned
                    </span>
                }
            />
            <RenderTable data={pendingPlans} title="Pending Plans" colorClass="text-yellow-600" type="pending" />
            <RenderTable data={manualCompletePlans} title="Manually Completed" colorClass="text-green-600" type="complete" />
            <RenderTable data={purchasedPlans} title="Purchased Today" colorClass="text-blue-600" type="purchased" />
            <RenderTable data={cancelPlans} title="Cancelled Plans" colorClass="text-red-600" type="cancel" />

            {plans.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    No purchase plans found
                </div>
            )}

            {/* Detail View Modal */}
            {selectedPlan && (
                <PlanDetailModal
                    plan={selectedPlan}
                    open={viewOpen}
                    onClose={() => setViewOpen(false)}
                    onUpdate={() => router.refresh()}
                />
            )}

            {/* Add Purchase Modal */}
            {purchaseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 md:p-4">
                    <div className="w-full max-w-3xl h-full md:h-[80vh] bg-white dark:bg-zinc-900 md:rounded-lg shadow-xl overflow-hidden">
                        <PurchaseForm
                            onClose={() => setPurchaseModalOpen(false)}
                            onSuccess={onPurchaseSuccess}
                            initialData={purchasePlanData}
                        />
                    </div>
                </div>
            )}

            {/* Complete Action Popup */}
            {actionMenuPlanId && (
                <div
                    className="fixed inset-0 z-[60] flex items-center md:items-center items-end justify-center bg-black/40"
                    onClick={() => setActionMenuPlanId(null)}
                >
                    <div
                        className="w-full md:w-auto md:min-w-[400px] bg-white dark:bg-zinc-900 rounded-t-2xl md:rounded-2xl p-4 pb-6 mb-16 md:mb-0 shadow-xl animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1 bg-gray-300 dark:bg-zinc-600 rounded-full mx-auto mb-4 md:hidden"></div>
                        <h3 className="text-center font-semibold text-sm md:text-base mb-4 text-gray-700 dark:text-gray-300">
                            Choose Action
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    const plan = plans.find(p => p.id === actionMenuPlanId)
                                    if (plan && window.confirm("Mark as Complete? (No purchase entry)")) {
                                        handleMarkComplete(plan)
                                        setActionMenuPlanId(null)
                                    }
                                }}
                                className="py-3 md:py-4 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm md:text-base rounded-lg flex items-center justify-center gap-2 transition-all"
                            >
                                <Check size={18} /> Done
                            </button>
                            <button
                                onClick={() => {
                                    const plan = plans.find(p => p.id === actionMenuPlanId)
                                    if (plan) {
                                        setActionMenuPlanId(null)
                                        handleOpenPurchaseModal(plan)
                                    }
                                }}
                                className="py-3 md:py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm md:text-base rounded-lg flex items-center justify-center gap-2 transition-all"
                            >
                                + Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Combo Component Select Modal */}
            {comboResolving && (
                <ComboComponentSelectModal
                    comboProductId={comboResolving.id}
                    comboProductName={comboResolving.name}
                    initialComponents={comboResolving.components}
                    onClose={() => setComboResolving(null)}
                    onSelectComponent={(component) => {
                        setComboResolving(null)
                        // Open purchase form with component
                        setPurchasePlanData({
                            productId: component.id,
                            productName: component.product_name,
                            quantity: comboResolving.planQuantity, // Or calculate based on ratio? User said "when user click Product A then open add purchase form with Product name is Product A" implies simple mapping. Quantity likely needs user input or just prefill with plan quantity. I'll prefill with plan quantity for now as a default.
                            remarks: `Component of bundle: ${comboResolving.name}. ${comboResolving.remarks}`
                        })
                        setPurchaseModalOpen(true)
                    }}
                />
            )}

            {/* Full Image Modal */}
            {fullImage && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setFullImage(null)}>
                    <div className="relative max-w-full max-h-full">
                        <button className="absolute -top-10 right-0 text-white p-2">Close</button>
                        <img src={fullImage} alt="Full View" className="max-w-full max-h-[80vh] object-contain rounded-md" />
                    </div>
                </div>
            )}

            {/* Bulk Share Modal */}
            {isBulkSharing && (
                <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => {
                    setIsBulkSharing(false)
                    setSelectedPlans([])
                }}>
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b dark:border-zinc-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Share {selectedPlans.length} Plans to WhatsApp
                            </h3>
                            <button
                                onClick={() => {
                                    setIsBulkSharing(false)
                                    setSelectedPlans([])
                                }}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Plans List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {plans.filter(p => selectedPlans.includes(p.id)).map((plan, index) => {
                                const message =
                                    `📦 *Product:* ${plan.product?.product_name || 'N/A'}\n` +
                                    `💰 *LP:* Rs. ${plan.snapshot_latest_price || 0} | 🏪 *LS:* ${plan.snapshot_latest_supplier || 'N/A'}\n` +
                                    `📊 *Quantity:* ${plan.quantity}\n` +
                                    `📝 *Remarks:* ${plan.remarks || 'None'}`

                                const handleCopyAndShare = () => {
                                    // Copy to clipboard
                                    navigator.clipboard.writeText(message)

                                    // Open WhatsApp
                                    const encodedMessage = encodeURIComponent(message)
                                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                                    const whatsappUrl = isMobile
                                        ? `whatsapp://send?text=${encodedMessage}`
                                        : `https://wa.me/?text=${encodedMessage}`

                                    window.open(whatsappUrl, '_blank')
                                    toast.success(`Plan ${index + 1} opened in WhatsApp!`)
                                }

                                const handleCopy = () => {
                                    navigator.clipboard.writeText(message)
                                    toast.success(`Plan ${index + 1} copied!`)
                                }

                                return (
                                    <div key={plan.id} className="border dark:border-zinc-700 rounded-lg p-3 bg-gray-50 dark:bg-zinc-800">
                                        <div className="flex justify-between items-start mb-2 gap-3">
                                            <div className="flex-1">
                                                <div className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                                                    {index + 1}. {plan.product?.product_name}
                                                </div>
                                                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                                                    <div>LP: Rs. {plan.snapshot_latest_price} | LS: {plan.snapshot_latest_supplier || 'N/A'}</div>
                                                    <div>Qty: {plan.quantity}</div>
                                                    <div>Remarks: {plan.remarks || 'None'}</div>
                                                </div>
                                            </div>

                                            {/* Product Image Thumbnail */}
                                            {plan.product?.image_url && (
                                                <div
                                                    className="flex-shrink-0 cursor-zoom-in group relative"
                                                    onClick={() => setFullImage(plan.product?.image_url || null)}
                                                >
                                                    <img
                                                        src={plan.product.image_url}
                                                        alt="Product"
                                                        className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-zinc-700 group-hover:ring-2 group-hover:ring-blue-500 transition-all"
                                                    />
                                                    <div className="absolute grid place-items-center inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-md transition-opacity">
                                                        <span className="text-white text-[10px] font-bold">Zoom</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={handleCopy}
                                                className="py-2 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-all"
                                            >
                                                📋 Copy
                                            </button>
                                            <button
                                                onClick={handleCopyAndShare}
                                                className="py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 transition-all"
                                            >
                                                <Share2 size={14} />
                                                Share
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        const plansToShare = plans.filter(p => selectedPlans.includes(p.id))

                                        // Combine all plans into one message
                                        let combinedMessage = `📦 *${plansToShare.length} Purchase Plans*\n\n`

                                        plansToShare.forEach((plan, index) => {
                                            combinedMessage += `*${index + 1}.* ${plan.product?.product_name || 'N/A'}\n`
                                            combinedMessage += `💰 *LP:* Rs. ${plan.snapshot_latest_price || 0} | 🏪 *LS:* ${plan.snapshot_latest_supplier || 'N/A'}\n`
                                            combinedMessage += `📊 *Qty:* ${plan.quantity}\n`
                                            combinedMessage += `📝 *Remarks:* ${plan.remarks || 'None'}\n`

                                            if (index < plansToShare.length - 1) {
                                                combinedMessage += `\n${'─'.repeat(30)}\n\n`
                                            }
                                        })

                                        navigator.clipboard.writeText(combinedMessage)
                                        toast.success('All plans copied to clipboard!')
                                        setIsBulkSharing(false)
                                        setSelectedPlans([])
                                    }}
                                    className="w-full py-3 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all"
                                >
                                    <Copy size={18} />
                                    Copy All Plans
                                </button>
                                <button
                                    onClick={() => {
                                        const plansToShare = plans.filter(p => selectedPlans.includes(p.id))

                                        // Combine all plans into one message
                                        let combinedMessage = `📦 *${plansToShare.length} Purchase Plans*\n\n`

                                        plansToShare.forEach((plan, index) => {
                                            combinedMessage += `*${index + 1}.* ${plan.product?.product_name || 'N/A'}\n`
                                            combinedMessage += `💰 *LP:* Rs. ${plan.snapshot_latest_price || 0} | 🏪 *LS:* ${plan.snapshot_latest_supplier || 'N/A'}\n`
                                            combinedMessage += `📊 *Qty:* ${plan.quantity}\n`
                                            combinedMessage += `📝 *Remarks:* ${plan.remarks || 'None'}\n`

                                            if (index < plansToShare.length - 1) {
                                                combinedMessage += `\n${'─'.repeat(30)}\n\n`
                                            }
                                        })

                                        const encodedMessage = encodeURIComponent(combinedMessage)
                                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                                        const whatsappUrl = isMobile
                                            ? `whatsapp://send?text=${encodedMessage}`
                                            : `https://wa.me/?text=${encodedMessage}`

                                        window.open(whatsappUrl, '_blank')
                                        toast.success('All plans opened in WhatsApp!')
                                        setIsBulkSharing(false)
                                        setSelectedPlans([])
                                    }}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all"
                                >
                                    <Share2 size={18} />
                                    Share All Plans in One Message
                                </button>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                                Click "Copy" to copy individual plans or "Share All" to send everything together
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* Full Image Modal */}
            {fullImage && (
                <div
                    className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setFullImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
                        <img
                            src={fullImage}
                            alt="Full Size"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in duration-200"
                        />
                        <button
                            onClick={() => setFullImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
                        >
                            <X size={24} />
                            <span className="sr-only">Close</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
