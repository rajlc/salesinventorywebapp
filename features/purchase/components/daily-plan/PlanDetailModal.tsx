'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Edit, Loader2, Save, Plus } from 'lucide-react'
import { getProductPurchaseStats, ProductPurchaseStats, PurchasePlan, updatePurchasePlan } from '@/features/purchase/actions/plan-actions'
import { getLatestMrpByProductName, addMrpPrice, MrpPriceItem } from '@/features/purchase/actions/mrp-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function PlanDetailModal({ plan, open, onClose, onUpdate }: { plan: PurchasePlan, open: boolean, onClose: () => void, onUpdate?: () => void }) {
    const router = useRouter()
    const [stats, setStats] = useState<ProductPurchaseStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [latestMrp, setLatestMrp] = useState<MrpPriceItem | null>(null)
    const [isAddMrpModalOpen, setIsAddMrpModalOpen] = useState(false)
    const [newMrpPrice, setNewMrpPrice] = useState('')
    const [newMrpDate, setNewMrpDate] = useState(new Date().toISOString().split('T')[0])
    const [savingMrp, setSavingMrp] = useState(false)

    // Edit State
    const [editValues, setEditValues] = useState({
        quantity: plan.quantity,
        remarks: plan.remarks || '',
        status: plan.status
    })

    // Reset editing when plan changes or modal opens
    useEffect(() => {
        if (open) {
            setIsEditing(false)
            setEditValues({
                quantity: plan.quantity,
                remarks: plan.remarks || '',
                status: plan.status
            })
            // Fetch stats and MRP
            if (plan?.product_id) {
                setLoading(true)
                getProductPurchaseStats(plan.product_id)
                    .then(setStats)
                    .finally(() => setLoading(false))
            }
            if (plan?.product?.product_name) {
                getLatestMrpByProductName(plan.product.product_name)
                    .then(res => setLatestMrp(res.data))
            }
        }
    }, [open, plan])

    const handleSaveMrp = async () => {
        if (!newMrpPrice || !newMrpDate || !plan?.product?.product_name) return
        setSavingMrp(true)
        const res = await addMrpPrice({
            product_name: plan.product.product_name,
            inventory_id: plan.product_id,
            mrp_price: parseFloat(newMrpPrice),
            applied_date: newMrpDate
        })
        setSavingMrp(false)
        if (res.success) {
            toast.success("MRP added successfully")
            setIsAddMrpModalOpen(false)
            setNewMrpPrice('')
            // Refetch MRP
            getLatestMrpByProductName(plan.product.product_name).then(r => setLatestMrp(r.data))
        } else {
            toast.error("Failed to add MRP: " + res.message)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await updatePurchasePlan(plan.id, {
                quantity: editValues.quantity,
                remarks: editValues.remarks,
                status: editValues.status
            })
            toast.success("Plan updated successfully")
            setIsEditing(false)
            if (onUpdate) onUpdate()
            else router.refresh()
        } catch (error: any) {
            toast.error("Failed to update plan")
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    const canEdit = plan.status === 'Pending'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-zinc-700">
                    <h2 className="text-lg font-bold">Details: {plan.product?.product_name}</h2>
                    <button onClick={onClose} className="hidden md:block"><X size={20} className="text-gray-500" /></button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-500">Planned Date</label>
                            <div className="font-medium text-lg flex items-center gap-2">
                                <Calendar size={16} />
                                {new Date(plan.plan_date).toLocaleDateString()}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-500">Status</label>
                            {isEditing ? (
                                <select
                                    value={editValues.status}
                                    onChange={e => setEditValues({ ...editValues, status: e.target.value as any })}
                                    className="w-full p-1 border rounded dark:bg-zinc-800"
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Complete">Complete (Locks Plan)</option>
                                    <option value="Cancel">Cancel</option>
                                </select>
                            ) : (
                                <div className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${plan.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                    plan.status === 'Complete' ? 'bg-green-100 text-green-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {plan.status}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-500">Target Qty</label>
                            {isEditing ? (
                                <input
                                    type="number"
                                    min="1"
                                    value={editValues.quantity}
                                    onChange={e => setEditValues({ ...editValues, quantity: Number(e.target.value) })}
                                    className="w-full p-1 border rounded dark:bg-zinc-800"
                                />
                            ) : (
                                <div className="font-medium">{plan.quantity}</div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-500">Seller SKUs</label>
                            <div className="text-sm">
                                {[plan.product?.seller_sku1, plan.product?.seller_sku2, plan.product?.seller_sku3, plan.product?.seller_sku4].filter(Boolean).join(', ') || 'N/A'}
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-500">Remarks</label>
                            {isEditing ? (
                                <input
                                    value={editValues.remarks}
                                    onChange={e => setEditValues({ ...editValues, remarks: e.target.value })}
                                    className="w-full p-1 border rounded dark:bg-zinc-800"
                                />
                            ) : (
                                <div className="flex gap-4">
                                    <div className="bg-gray-50 dark:bg-zinc-800 p-2 rounded flex-1">{plan.remarks || 'No remarks'}</div>
                                    {latestMrp && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2 rounded shrink-0">
                                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block uppercase">Latest MRP Price</span>
                                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-500">Rs. {latestMrp.mrp_price.toLocaleString()}</span>
                                            <span className="text-[10px] text-emerald-600/70 block mt-0.5">Applied: {latestMrp.applied_date}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="border-t pt-4 dark:border-zinc-700">
                        <h3 className="font-bold mb-3">Analysis Data</h3>
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border dark:border-blue-800">
                                    <h4 className="text-xs font-bold text-blue-700 uppercase mb-1">Latest Purchase</h4>
                                    <div className="text-xl font-bold">Rs. {stats?.latestPrice}</div>
                                    <div className="text-xs text-gray-600">{stats?.latestSupplier}</div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border dark:border-green-800">
                                    <h4 className="text-xs font-bold text-green-700 uppercase mb-1">All-Time Low</h4>
                                    <div className="text-xl font-bold">Rs. {stats?.lowPrice}</div>
                                    <div className="text-xs text-gray-600">{stats?.lowSupplier}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* History Table */}
                    <div className="border-t pt-4 dark:border-zinc-700">
                        <h3 className="font-bold mb-3">Last 3 Purchases</h3>
                        <div className="overflow-x-auto border rounded dark:border-zinc-700">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2">Qty</th>
                                        <th className="px-3 py-2">Price</th>
                                        <th className="px-3 py-2">Supplier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats?.last3Orders.map((order: any, i: number) => (
                                        <tr key={i} className="border-t dark:border-zinc-700">
                                            <td className="px-3 py-2">{new Date(order.purchase_date).toLocaleDateString()}</td>
                                            <td className="px-3 py-2">{order.quantity}</td>
                                            <td className="px-3 py-2">Rs. {order.unit_amount}</td>
                                            <td className="px-3 py-2">{order.supplier?.supplier_name}</td>
                                        </tr>
                                    ))}
                                    {(!stats?.last3Orders || stats.last3Orders.length === 0) && (
                                        <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">No history found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-1 pb-11 md:pb-4 border-t dark:border-zinc-700 flex justify-between items-center gap-2">
                    <div>
                        {!isEditing && (
                            <button onClick={() => setIsAddMrpModalOpen(true)} className="px-4 py-2 text-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded flex items-center gap-2 font-medium">
                                <Plus size={16} /> Add MRP
                            </button>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                                    {saving ? <Loader2 className="animate-spin h-3 w-3" /> : <Save size={16} />} Save Changes
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50 dark:hover:bg-zinc-800">Close</button>
                                {canEdit && (
                                    <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded flex items-center gap-2">
                                        <Edit size={16} /> Edit
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Add MRP Modal Overlay */}
            {isAddMrpModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm p-4">
                        <h3 className="font-bold text-lg mb-4">Add MRP for {plan.product?.product_name}</h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Date</label>
                                <input 
                                    type="date" 
                                    value={newMrpDate}
                                    onChange={e => setNewMrpDate(e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">MRP Price (Rs)</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    value={newMrpPrice}
                                    onChange={e => setNewMrpPrice(e.target.value)}
                                    placeholder="Enter MRP Price..."
                                    className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700" 
                                />
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button onClick={() => setIsAddMrpModalOpen(false)} className="px-4 py-2 text-sm border rounded">Cancel</button>
                            <button 
                                onClick={handleSaveMrp} 
                                disabled={savingMrp || !newMrpPrice} 
                                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {savingMrp ? <Loader2 className="animate-spin h-3 w-3" /> : null} Save MRP
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
