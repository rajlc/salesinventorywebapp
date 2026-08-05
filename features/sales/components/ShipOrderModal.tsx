'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui-shim'
import { getPathaoCities, getPathaoZones, getPathaoAreas, getPathaoStoreId, calculatePathaoPrice, createPathaoOrder } from '@/features/sales/actions/courier-actions'
import { Loader2, Truck, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ShipOrderModalProps {
    order: any
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function ShipOrderModal({ order, isOpen, onClose, onSuccess }: ShipOrderModalProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [priceData, setPriceData] = useState<any>(null)

    // Form Data
    const [cities, setCities] = useState<any[]>([])
    const [zones, setZones] = useState<any[]>([])
    const [areas, setAreas] = useState<any[]>([])

    const [storeId, setStoreId] = useState<number | null>(null)
    const [selectedCity, setSelectedCity] = useState<string>('')
    const [selectedZone, setSelectedZone] = useState<string>('')
    const [selectedArea, setSelectedArea] = useState<string>('')

    const [itemWeight, setItemWeight] = useState('0.5')
    const [itemQuantity, setItemQuantity] = useState('1')
    const [itemDescription, setItemDescription] = useState('Parcel')
    const [amountToCollect, setAmountToCollect] = useState('0')

    // Initialize
    useEffect(() => {
        if (isOpen) {
            setStep(1)
            loadCities()
            loadStore()
            // Reset fields
            setSelectedCity('')
            setSelectedZone('')
            setSelectedArea('')
            setPriceData(null)

            // Pre-fill
            if (order) {
                setAmountToCollect(order.total_amount?.toString() || '0')
                setItemQuantity('1') // Default to 1 box
                // Could infer description from items
                const desc = order.items?.map((i: any) => i.product_name).join(', ') || 'Order Items'
                setItemDescription(desc.substring(0, 100)) // Limit length
            }
        }
    }, [isOpen, order])

    // Loaders
    const loadCities = async () => {
        const data = await getPathaoCities()
        setCities(data)
    }

    const loadStore = async () => {
        const id = await getPathaoStoreId()
        setStoreId(id)
    }

    const handleCityChange = async (cityId: string) => {
        setSelectedCity(cityId)
        setSelectedZone('')
        setSelectedArea('')
        setZones([])
        setAreas([])
        setPriceData(null)

        const data = await getPathaoZones(parseInt(cityId))
        setZones(data)
    }

    const handleZoneChange = async (zoneId: string) => {
        setSelectedZone(zoneId)
        setSelectedArea('')
        setAreas([])
        setPriceData(null)

        const data = await getPathaoAreas(parseInt(zoneId))
        setAreas(data)
    }

    const calculate = async () => {
        if (!storeId || !selectedCity || !selectedZone || !itemWeight) {
            toast.error('Please fill all required fields')
            return
        }

        setLoading(true)
        const payload = {
            store_id: storeId,
            item_type: 2, // Parcel
            delivery_type: 48, // Normal
            item_weight: parseFloat(itemWeight),
            recipient_city: parseInt(selectedCity),
            recipient_zone: parseInt(selectedZone)
        }

        const result = await calculatePathaoPrice(payload)
        setLoading(false)

        if (result.error) {
            toast.error('Price calculation failed: ' + result.error)
        } else {
            setPriceData(result.data)
            setStep(2)
        }
    }

    const handleSubmit = async () => {
        if (!priceData) return

        setLoading(true)
        const payload = {
            store_id: storeId!,
            merchant_order_id: order.sales_id || `ORD-${order.id.substring(0, 6)}`,
            recipient_name: order.customer_name,
            recipient_phone: order.phone_number,
            recipient_address: order.shipping_address || 'No Address Provided', // Fallback
            recipient_city: parseInt(selectedCity),
            recipient_zone: parseInt(selectedZone),
            recipient_area: parseInt(selectedArea),
            delivery_type: 48,
            item_type: 2,
            item_quantity: parseInt(itemQuantity),
            item_weight: parseFloat(itemWeight),
            amount_to_collect: parseInt(amountToCollect),
            item_description: itemDescription
        }

        const result = await createPathaoOrder(payload, order.id)
        setLoading(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Order shipped successfully!')
            onSuccess()
            onClose()
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Ship Order #{order?.sales_id}
                    </DialogTitle>
                </DialogHeader>

                {!storeId ? (
                    <div className="py-6 text-center text-red-500 flex flex-col items-center">
                        <AlertCircle className="h-8 w-8 mb-2" />
                        <p>Store ID not found. Please check API Settings.</p>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        {step === 1 && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>City</Label>
                                        <select
                                            className="w-full h-10 px-3 py-2 rounded-md border text-sm"
                                            value={selectedCity}
                                            onChange={(e) => handleCityChange(e.target.value)}
                                        >
                                            <option value="">Select City</option>
                                            {cities.map((city: any) => (
                                                <option key={city.city_id} value={city.city_id}>{city.city_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Zone</Label>
                                        <select
                                            className="w-full h-10 px-3 py-2 rounded-md border text-sm"
                                            value={selectedZone}
                                            onChange={(e) => handleZoneChange(e.target.value)}
                                            disabled={!selectedCity}
                                        >
                                            <option value="">Select Zone</option>
                                            {zones.map((zone: any) => (
                                                <option key={zone.zone_id} value={zone.zone_id}>{zone.zone_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Area</Label>
                                    <select
                                        className="w-full h-10 px-3 py-2 rounded-md border text-sm"
                                        value={selectedArea}
                                        onChange={(e) => setSelectedArea(e.target.value)}
                                        disabled={!selectedZone}
                                    >
                                        <option value="">Select Area</option>
                                        {areas.map((area: any) => (
                                            <option key={area.area_id} value={area.area_id}>{area.area_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Weight (kg)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={itemWeight}
                                            onChange={(e) => setItemWeight(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>COD Amount</Label>
                                        <Input
                                            type="number"
                                            value={amountToCollect}
                                            onChange={(e) => setAmountToCollect(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {step === 2 && priceData && (
                            <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Delivery Fee:</span>
                                    <span className="font-bold">Rs {priceData.price}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">COD Charge:</span>
                                    <span className="font-bold">{(priceData.cod_percentage * 100).toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between text-base border-t pt-2 mt-2">
                                    <span className="font-bold">Total Delivery Cost:</span>
                                    <span className="font-bold text-blue-600">Rs {priceData.final_price}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-2 italic text-center">
                                    *Will be collected from Customer
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {step === 2 && (
                        <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>Back</Button>
                    )}
                    {step === 1 ? (
                        <Button onClick={calculate} disabled={loading || !storeId || !selectedCity || !selectedZone}>
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Calculate Price'}
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirm Shipment'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
