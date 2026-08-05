'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, Button } from '@/components/ui-shim'
import * as XLSX from 'xlsx'
import { Search, ChevronLeft, ChevronRight, Edit2, Check, X, Loader2, RefreshCw, AlertTriangle, ArrowLeft, UploadCloud, ArrowDown, Lock, Unlock, FileSpreadsheet, Eye, ExternalLink, Plus, TrendingUp } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getDarazAvgPrices, updateDarazAvgPrice, bulkUpdateDarazAvgPrice, syncDarazAvgPricesGoogleSheets, pullDarazAvgPricesFromGoogleSheets, syncLiveSellerPrices, pushPriceToDaraz, DarazAvgPriceItem, updateWebsitePricesBulk, syncLiveSellerPricesForProduct, toggleProductPriceLock, autoUpdateWebsitePrices } from '@/features/sales/actions/avg-price-actions'
import { saveCompetitorLinks, syncAllCompetitorsCron, CompetitorItem } from '@/features/sales/actions/competitor-actions'

const DEFAULT_STORE_THEME: { bg: string; text: string; border: string } = { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]', border: 'border-[#E5E7EB]' }

const storeColorMap: Record<string, { bg: string; text: string; border: string }> = {
    'BAGMATI': { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]', border: 'border-[#86EFAC]' }, // Emerald Green
    'BALAJU': { bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]', border: 'border-[#93C5FD]' }, // Royal Blue
    'COSMETICS': { bg: 'bg-[#F3E8FF]', text: 'text-[#7E22CE]', border: 'border-[#D8B4FE]' }, // Lavender Purple
    'BTAS': { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FDE68A]' }, // Golden Amber
}

export default function DarazAverageSalesPricePage() {
    const [data, setData] = useState<DarazAvgPriceItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [salesDays, setSalesDays] = useState<number | string>(60)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isPulling, setIsPulling] = useState(false)
    const [isSyncingLive, setIsSyncingLive] = useState(false)
    const [pushingId, setPushingId] = useState<string | null>(null)
    const [togglingLockId, setTogglingLockId] = useState<string | null>(null)
    const [isApplyingAutoPrices, setIsApplyingAutoPrices] = useState(false)
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
    const [compareRows, setCompareRows] = useState<any[]>([])
    const [markupPercent, setMarkupPercent] = useState<string>('20')
    const [compareSortOrder, setCompareSortOrder] = useState<'asc' | 'desc' | null>(null)
    const [markupBaseCol, setMarkupBaseCol] = useState<'breakeven' | 'campaign' | 'required'>('breakeven')
    const [diffCol1, setDiffCol1] = useState<string>('required')
    const [diffCol2, setDiffCol2] = useState<string>('campaign')

    // Competitor State & Modals
    const [competitorFilter, setCompetitorFilter] = useState<'all' | 'most_sold' | 'price_alert' | 'has_competitors'>('all')
    const [editCompetitorProduct, setEditCompetitorProduct] = useState<DarazAvgPriceItem | null>(null)
    const [editCompetitorUrls, setEditCompetitorUrls] = useState<string[]>(['', '', '', ''])
    const [isSavingCompetitors, setIsSavingCompetitors] = useState(false)
    const [viewCompetitorProduct, setViewCompetitorProduct] = useState<DarazAvgPriceItem | null>(null)
    const [isSyncingCompetitors, setIsSyncingCompetitors] = useState(false)

    useEffect(() => {
        const markup = parseFloat(markupPercent) || 0
        setCompareRows(prev => prev.map(row => {
            if (row.is_manually_edited) return row

            let basePrice = 0
            if (markupBaseCol === 'breakeven') {
                basePrice = row.breakeven_price || 0
            } else if (markupBaseCol === 'campaign') {
                basePrice = row.campaign_price || 0
            } else if (markupBaseCol === 'required') {
                basePrice = row.required_price || 0
            }

            const calculated = basePrice * (1 + markup / 100)
            const rounded = Math.ceil(calculated / 5) * 5
            return { ...row, custom_price: rounded }
        }))
    }, [markupPercent, markupBaseCol])
    const [activeSyncMenuProductId, setActiveSyncMenuProductId] = useState<string | null>(null)
    const [syncingLiveProductId, setSyncingLiveProductId] = useState<string | null>(null)

    const [isUpdatingStock, setIsUpdatingStock] = useState(false)
    const [stockFilter, setStockFilter] = useState<'all' | 'stock_out' | 'low_stock'>('all')
    const [showPriorityOnly, setShowPriorityOnly] = useState<boolean>(false)
    const [filterAccount, setFilterAccount] = useState<string>('')
    const [livePriceFilter, setLivePriceFilter] = useState<'' | 'daraz' | 'website' | 'mrp'>('')
    const [stockModalProduct, setStockModalProduct] = useState<DarazAvgPriceItem | null>(null)
    const [stockEdits, setStockEdits] = useState<Record<string, number>>({}) // key: store_id:sku
    const [showLivePriceColumns, setShowLivePriceColumns] = useState(true)

    // Bulk Actions
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
    const [isBulkPushing, setIsBulkPushing] = useState(false)
    const [bulkPushProgress, setBulkPushProgress] = useState({ current: 0, total: 0 })
    const [isBulkSaving, setIsBulkSaving] = useState(false)
    const [applyBulkOnlyIfEmpty, setApplyBulkOnlyIfEmpty] = useState(false)
    const [applyBulkOnlyIfPurchase, setApplyBulkOnlyIfPurchase] = useState(false)
    const [applyBulkOnlyIfMrp, setApplyBulkOnlyIfMrp] = useState(false)
    const [bulkMathAction, setBulkMathAction] = useState<string>('')
    const [campaignMathAction, setCampaignMathAction] = useState<string>('')
    const [targetPlatform, setTargetPlatform] = useState<'daraz' | 'website' | 'campaign'>('daraz')
    const [websiteDiscountType, setWebsiteDiscountType] = useState<'amount' | 'percent' | 'daraz_price' | 'daraz_campaign'>('daraz_price')
    const [websiteDiscountValue, setWebsiteDiscountValue] = useState<string>('')
    const [isWebsitePushing, setIsWebsitePushing] = useState(false)
    const [pushSelectProduct, setPushSelectProduct] = useState<DarazAvgPriceItem | null>(null)
    const [bulkPushModalOpen, setBulkPushModalOpen] = useState(false)
    const [filterHasPurchasing, setFilterHasPurchasing] = useState(false)

    // Drag to scroll
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [startX, setStartX] = useState(0)
    const [scrollLeft, setScrollLeft] = useState(0)

    const startDrag = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return
        setIsDragging(true)
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
        setScrollLeft(scrollContainerRef.current.scrollLeft)
    }
    const stopDrag = () => setIsDragging(false)
    const onDrag = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return
        e.preventDefault()
        const x = e.pageX - scrollContainerRef.current.offsetLeft
        const walk = (x - startX)
        scrollContainerRef.current.scrollLeft = scrollLeft - walk
    }

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(50)

    // Search
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    const hasFilters = search || filterAccount || stockFilter !== 'all' || livePriceFilter || filterHasPurchasing || showPriorityOnly;
    const clearFilters = () => {
        setSearch('')
        setFilterAccount('')
        setStockFilter('all')
        setLivePriceFilter('')
        setFilterHasPurchasing(false)
        setShowPriorityOnly(false)
        setCurrentPage(1)
    }

    // Regular price profit-percent dropdown (15 / 20 / 25)
    const [regularPct, setRegularPct] = useState<15 | 20 | 25>(15)

    // Editing State (we can edit market_price and campaign_price)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editMarketPrice, setEditMarketPrice] = useState<string>('')
    const [editCampaignPrice, setEditCampaignPrice] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)

    // Helper to get stores with live price for a single product
    const getStoresWithLivePrice = (item: DarazAvgPriceItem) => {
        const storesMap = new Map<string, { store_id: string; store_name: string; price: number; special_price: number | null; sku: string }>()
        Object.entries(item.live_prices || {})
            .filter(([skuKey]) => !skuKey.includes('_slot_'))
            .forEach(([sku, lp]) => {
                if (lp.store_id) {
                    if (!storesMap.has(lp.store_id)) {
                        storesMap.set(lp.store_id, {
                            store_id: lp.store_id,
                            store_name: lp.store_name,
                            price: lp.price,
                            special_price: lp.special_price,
                            sku
                        })
                    }
                }
            })
        return Array.from(storesMap.values())
    }

    // Helper to get stores with live price for bulk selection
    const getBulkStoresWithLivePrice = (selectedItems: DarazAvgPriceItem[]) => {
        const storesMap = new Map<string, { store_id: string; store_name: string; count: number }>()
        selectedItems.forEach(item => {
            const itemStores = new Set<string>()
            Object.values(item.live_prices || {}).forEach(lp => {
                if (lp.store_id) {
                    itemStores.add(lp.store_id)
                }
            })
            itemStores.forEach(storeId => {
                const lpVal = Object.values(item.live_prices || {}).find(lp => lp.store_id === storeId)
                const storeName = lpVal ? lpVal.store_name : 'Unknown'
                const existing = storesMap.get(storeId)
                if (existing) {
                    existing.count += 1
                } else {
                    storesMap.set(storeId, {
                        store_id: storeId,
                        store_name: storeName,
                        count: 1
                    })
                }
            })
        })
        return Array.from(storesMap.values())
    }

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500)
        return () => clearTimeout(timer)
    }, [search])

    useEffect(() => {
        loadData(salesDays)
    }, [salesDays])

    async function loadData(days: number | string = salesDays) {
        setIsLoading(true)
        try {
            const result = await getDarazAvgPrices(days)
            setData(result)
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const res = await syncDarazAvgPricesGoogleSheets()
            if (res.success) {
                alert('Successfully synced with Google Sheets!')
                loadData()
            } else {
                alert(`Sync failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Sync error: ${err.message}`)
        } finally {
            setIsSyncing(false)
        }
    }

    const handlePull = async () => {
        setIsPulling(true)
        try {
            const res = await pullDarazAvgPricesFromGoogleSheets()
            if (res.success) {
                alert('Successfully updated data from Google Sheets!')
                loadData()
            } else {
                alert(`Pull failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Pull error: ${err.message}`)
        } finally {
            setIsPulling(false)
        }
    }

    const handleSyncLive = async () => {
        setIsSyncingLive(true)
        try {
            const res = await syncLiveSellerPrices()
            if (res.success) {
                alert(`✓ Successfully synced Live Prices & Live Stock for ${res.count} products from Daraz!`)
                loadData()
            } else {
                alert(`Sync failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Sync error: ${err.message}`)
        } finally {
            setIsSyncingLive(false)
        }
    }

    const handlePushPrice = async (productId: string, productName: string, targetStoreIds?: string[]) => {
        const storeLabel = targetStoreIds && targetStoreIds.length > 0 ? "selected store account(s)" : "all connected accounts"
        if (!confirm(`Push Daraz Price to Daraz for "${productName}"?\nThis will set the Special Price on ${storeLabel}.`)) return
        setPushingId(productId)
        try {
            const res = await pushPriceToDaraz(productId, targetStoreIds)
            if (res.success) {
                alert(`✓ Price pushed!\n${res.message}`)
            } else {
                alert(`✗ Push failed:\n${res.message}`)
            }
        } catch (err: any) {
            alert(`Push error: ${err.message}`)
        } finally {
            setPushingId(null)
        }
    }

    const handleSyncLiveForProduct = async (productId: string, productName: string) => {
        setSyncingLiveProductId(productId)
        try {
            const res = await syncLiveSellerPricesForProduct(productId)
            if (res.success) {
                alert(`✓ Live prices synced!\n${res.message}`)
                loadData()
            } else {
                alert(`✗ Sync failed:\n${res.message}`)
            }
        } catch (err: any) {
            alert(`Sync error: ${err.message}`)
        } finally {
            setSyncingLiveProductId(null)
        }
    }

    const openCompetitorEditModal = (item: DarazAvgPriceItem) => {
        setEditCompetitorProduct(item)
        const urls = ['', '', '', '']
        if (item.competitors) {
            item.competitors.forEach(c => {
                if (c.competitor_index >= 1 && c.competitor_index <= 4) {
                    urls[c.competitor_index - 1] = c.competitor_url || ''
                }
            })
        }
        setEditCompetitorUrls(urls)
    }

    const handleSaveCompetitors = async () => {
        if (!editCompetitorProduct) return
        setIsSavingCompetitors(true)
        try {
            const payload = editCompetitorUrls.map((url, idx) => ({
                competitor_index: idx + 1,
                competitor_url: url.trim()
            }))
            const res = await saveCompetitorLinks(editCompetitorProduct.product_id, payload)
            if (res.success) {
                alert(`✓ Saved competitor links for "${editCompetitorProduct.product_name}"`)
                setEditCompetitorProduct(null)
                loadData()
            }
        } catch (err: any) {
            alert(`Error saving competitors: ${err.message}`)
        } finally {
            setIsSavingCompetitors(false)
        }
    }

    const handleSyncCompetitorsAll = async () => {
        setIsSyncingCompetitors(true)
        try {
            const res = await syncAllCompetitorsCron()
            if (res.success) {
                alert(`✓ Updated live details for ${res.count} competitor products!`)
                loadData()
            }
        } catch (err: any) {
            alert(`Competitor sync error: ${err.message}`)
        } finally {
            setIsSyncingCompetitors(false)
        }
    }




    const toggleSelection = (productId: string) => {
        setSelectedProductIds(prev => {
            const next = new Set(prev)
            if (next.has(productId)) next.delete(productId)
            else next.add(productId)
            return next
        })
    }

    const handleBulkMath = (type: 'increase' | 'decrease' | 'regular' | 'mrp' | 'lowest_live' | 'live_1' | 'live_2' | 'live_3' | 'live_4' | 'breakeven') => {
        let amount = 0
        if (type === 'increase' || type === 'decrease') {
            const val = prompt(`Enter amount to ${type}:`)
            if (!val || isNaN(parseFloat(val))) return
            amount = parseFloat(val)
        }

        setData(prev => prev.map(item => {
            if (!selectedProductIds.has(item.product_id)) return item

            if (applyBulkOnlyIfEmpty && item.market_price && item.market_price > 0) {
                return item // Skip because it is not empty
            }

            if (applyBulkOnlyIfPurchase && (!item.purchasing_price || item.purchasing_price < 1)) {
                return item // Skip because it has no valid purchasing price
            }

            if (applyBulkOnlyIfMrp && (!item.mrp_price || item.mrp_price <= 0)) {
                return item // Skip because it has no MRP price
            }

            let newPrice = item.market_price || 0
            if (type === 'increase') newPrice += amount
            if (type === 'decrease') newPrice -= amount
            if (type === 'mrp') {
                if (item.mrp_price && item.mrp_price > 0) {
                    newPrice = item.mrp_price
                }
            }
            if (type === 'regular') {
                const commPct = item.commission_percent !== null ? item.commission_percent : 25
                const breakeven = item.purchasing_price / (1 - commPct / 100)
                const rawReg = breakeven * (1 + regularPct / 100)
                newPrice = Math.ceil(rawReg / 5) * 5
            }
            if (type === 'breakeven') {
                const commPct = item.commission_percent !== null ? item.commission_percent : 25
                const breakeven = item.purchasing_price / (1 - commPct / 100)
                newPrice = Math.round(breakeven / 5) * 5
            }
            if (type === 'lowest_live') {
                let lowest = Infinity
                Object.values(item.live_prices || {}).forEach(lp => {
                    const price = lp.special_price || lp.price
                    if (price > 0 && price < lowest) lowest = price
                })
                if (lowest !== Infinity) newPrice = lowest
            }
            if (type === 'live_1' && item.seller_sku1 && item.live_prices?.[item.seller_sku1]) {
                newPrice = item.live_prices[item.seller_sku1].special_price || item.live_prices[item.seller_sku1].price
            }
            if (type === 'live_2' && item.seller_sku2 && item.live_prices?.[item.seller_sku2]) {
                newPrice = item.live_prices[item.seller_sku2].special_price || item.live_prices[item.seller_sku2].price
            }
            if (type === 'live_3' && item.seller_sku3 && item.live_prices?.[item.seller_sku3]) {
                newPrice = item.live_prices[item.seller_sku3].special_price || item.live_prices[item.seller_sku3].price
            }
            if (type === 'live_4' && item.seller_sku4 && item.live_prices?.[item.seller_sku4]) {
                newPrice = item.live_prices[item.seller_sku4].special_price || item.live_prices[item.seller_sku4].price
            }

            return { ...item, market_price: newPrice }
        }))
    }

    const handleBulkSave = async () => {
        if (!confirm(`Save Daraz Price changes for ${selectedProductIds.size} products?`)) return
        setIsBulkSaving(true)
        try {
            const updates = data.filter(d => selectedProductIds.has(d.product_id)).map(d => ({
                product_id: d.product_id,
                market_price: d.market_price
            }))
            const res = await bulkUpdateDarazAvgPrice(updates)
            if (res.success) {
                alert('✓ Bulk update successful!')
                loadData()
            }
        } catch (err: any) {
            alert(`Bulk save error: ${err.message}`)
        } finally {
            setIsBulkSaving(false)
        }
    }

    const handleCampaignBulkMath = (type: 'discount_pct' | 'discount_amt' | 'breakeven_pct' | 'breakeven_amt' | 'regular') => {
        let amount = 0
        if (type !== 'regular') {
            const val = prompt(`Enter value for ${type.replace('_', ' ')}:`)
            if (!val || isNaN(parseFloat(val))) return
            amount = parseFloat(val)
        }

        setData(prev => prev.map(item => {
            if (!selectedProductIds.has(item.product_id)) return item

            if (applyBulkOnlyIfEmpty && item.campaign_price && item.campaign_price > 0) {
                return item // Skip because campaign price is not empty
            }

            if (applyBulkOnlyIfPurchase && (!item.purchasing_price || item.purchasing_price < 1)) {
                return item // Skip because it has no valid purchasing price
            }

            let newCampaignPrice = item.campaign_price || 0

            if (type === 'regular') {
                newCampaignPrice = item.regular_sales_price || 0
            } else if (type === 'discount_pct') {
                const darazPrice = item.market_price || 0
                newCampaignPrice = Math.round(darazPrice - (darazPrice * (amount / 100)))
            } else if (type === 'discount_amt') {
                const darazPrice = item.market_price || 0
                newCampaignPrice = Math.round(darazPrice - amount)
            } else if (type === 'breakeven_pct' || type === 'breakeven_amt') {
                const commPct = item.commission_percent !== null ? item.commission_percent : 25
                const breakeven = item.purchasing_price / (1 - commPct / 100)
                if (type === 'breakeven_pct') {
                    newCampaignPrice = Math.round(breakeven + (breakeven * (amount / 100)))
                } else {
                    newCampaignPrice = Math.round(breakeven + amount)
                }
            }

            return { ...item, campaign_price: newCampaignPrice }
        }))
    }

    const handleCampaignBulkSave = async () => {
        if (!confirm(`Save Campaign Price changes for ${selectedProductIds.size} products?`)) return
        setIsBulkSaving(true)
        try {
            const updates = data.filter(d => selectedProductIds.has(d.product_id)).map(d => ({
                product_id: d.product_id,
                campaign_price: d.campaign_price
            }))
            const res = await bulkUpdateDarazAvgPrice(updates)
            if (res.success) {
                alert('✓ Campaign prices saved successfully!')
                loadData()
            }
        } catch (err: any) {
            alert(`Campaign save error: ${err.message}`)
        } finally {
            setIsBulkSaving(false)
        }
    }

    const handleBulkPush = async (targetStoreIds?: string[]) => {
        const selected = data.filter(d => selectedProductIds.has(d.product_id) && (d.market_price ?? 0) > 0)
        if (selected.length === 0) {
            alert('No valid items selected (make sure Daraz Price is set).')
            return
        }
        const storeLabel = targetStoreIds && targetStoreIds.length > 0 ? "selected store account(s)" : "all connected accounts"
        if (!confirm(`Push Daraz Prices for ${selected.length} products sequentially to ${storeLabel}?\nThis may take a few minutes.`)) return

        setIsBulkPushing(true)
        setBulkPushProgress({ current: 0, total: selected.length })

        let successCount = 0
        let failedProducts: string[] = []

        for (let i = 0; i < selected.length; i++) {
            setBulkPushProgress({ current: i + 1, total: selected.length })
            try {
                const res = await pushPriceToDaraz(selected[i].product_id, targetStoreIds)
                if (res.success) {
                    successCount++
                } else {
                    failedProducts.push(`${selected[i].product_name} (${res.message || 'Unknown error'})`)
                }
            } catch (err: any) {
                failedProducts.push(`${selected[i].product_name} (${err.message})`)
            }
        }

        setIsBulkPushing(false)
        let alertMsg = `Bulk push completed!\nSuccessful: ${successCount}\nFailed: ${failedProducts.length}`
        if (failedProducts.length > 0) {
            alertMsg += `\n\nFailed Products:\n- ${failedProducts.join('\n- ')}`
        }
        alert(alertMsg)
    }

    const handleToggleLock = async (productId: string, currentLockState: boolean) => {
        setTogglingLockId(productId)
        try {
            await toggleProductPriceLock(productId, !currentLockState)
            setData(prev => prev.map(item => {
                if (item.product_id === productId) {
                    return { ...item, is_price_locked: !currentLockState }
                }
                return item
            }))
        } catch (err: any) {
            alert(`Failed to update lock: ${err.message}`)
        } finally {
            setTogglingLockId(null)
        }
    }

    const handleApplyAutoDiscount = async () => {
        setIsApplyingAutoPrices(true)
        try {
            const res = await autoUpdateWebsitePrices()
            if (res.success) {
                alert(`✓ Auto-Discount rules applied successfully!\nRecalculated & pushed website prices for ${res.count} products.`)
                loadData()
            } else {
                alert(`✗ Pricing update failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`)
        } finally {
            setIsApplyingAutoPrices(false)
        }
    }

    const handleCompareFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result
                const workbook = XLSX.read(bstr, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const json: any[] = XLSX.utils.sheet_to_json(worksheet)

                if (json.length === 0) {
                    throw new Error('The uploaded sheet is empty.')
                }

                const parsed = json.map(row => {
                    const rawSku = String(row['Seller Sku'] || row['seller_sku'] || row['SKU'] || '').trim()
                    const reqPrice = parseFloat(row['Required Price'] || row['required_price'] || row['Price'] || '0') || 0

                    if (!rawSku) return null

                    const matchedProd = data.find(p =>
                        p.seller_sku1?.toLowerCase().trim() === rawSku.toLowerCase() ||
                        p.seller_sku2?.toLowerCase().trim() === rawSku.toLowerCase() ||
                        p.seller_sku3?.toLowerCase().trim() === rawSku.toLowerCase() ||
                        p.seller_sku4?.toLowerCase().trim() === rawSku.toLowerCase()
                    )

                    const breakeven = matchedProd ? (matchedProd.breakeven_price || 0) : 0
                    const reg15 = matchedProd ? (matchedProd.regular_sales_price || 0) : 0
                    const campaign = matchedProd ? (matchedProd.campaign_price || 0) : 0
                    const purchase = matchedProd ? (matchedProd.purchasing_price || 0) : 0
                    const commission = matchedProd ? (matchedProd.commission_percent !== null ? matchedProd.commission_percent : 25) : 25
                    const name = matchedProd ? matchedProd.product_name : 'Product Not Found'

                    let basePrice = 0
                    if (markupBaseCol === 'breakeven') {
                        basePrice = breakeven
                    } else if (markupBaseCol === 'campaign') {
                        basePrice = campaign
                    } else if (markupBaseCol === 'required') {
                        basePrice = reqPrice
                    }

                    const markup = parseFloat(markupPercent) || 0
                    const calculated = basePrice * (1 + markup / 100)
                    const customPrice = Math.ceil(calculated / 5) * 5

                    return {
                        sku: rawSku,
                        product_name: name,
                        breakeven_price: breakeven,
                        regular_15_price: reg15,
                        campaign_price: campaign,
                        purchasing_price: purchase,
                        commission_percent: commission,
                        required_price: reqPrice,
                        custom_price: customPrice,
                        is_manually_edited: false
                    }
                }).filter(Boolean)

                setCompareRows(parsed)
            } catch (err: any) {
                alert(`Error parsing file: ${err.message}`)
            }
        }
        reader.readAsBinaryString(file)
    }

    const handleCustomPriceChange = (sku: string, val: string) => {
        setCompareRows(prev => prev.map(row => {
            if (row.sku === sku) {
                return {
                    ...row,
                    custom_price: val === '' ? '' : parseFloat(val),
                    is_manually_edited: true
                }
            }
            return row
        }))
    }

    const getCustomPrice = (row: any) => {
        if (row.custom_price !== null && row.custom_price !== undefined && row.custom_price !== '') {
            return Number(row.custom_price)
        }
        const markup = parseFloat(markupPercent) || 0

        let basePrice = 0
        if (markupBaseCol === 'breakeven') {
            basePrice = row.breakeven_price || 0
        } else if (markupBaseCol === 'campaign') {
            basePrice = row.campaign_price || 0
        } else if (markupBaseCol === 'required') {
            basePrice = row.required_price || 0
        }

        const calculated = basePrice * (1 + markup / 100)
        return Math.ceil(calculated / 5) * 5
    }

    const getPriceOfCol = (row: any, colKey: string) => {
        switch (colKey) {
            case 'breakeven': return row.breakeven_price || 0;
            case 'regular15': return row.regular_15_price || 0;
            case 'campaign': return row.campaign_price || 0;
            case 'required': return row.required_price || 0;
            case 'custom': return getCustomPrice(row);
            default: return 0;
        }
    }

    const getColLabel = (colKey: string) => {
        switch (colKey) {
            case 'breakeven': return 'Breakeven';
            case 'regular15': return 'Regular 15%';
            case 'campaign': return 'Campaign Price';
            case 'required': return 'Required Price';
            case 'custom': return 'Custom Price (Formula)';
            default: return '';
        }
    }

    const getSortedCompareRows = () => {
        if (!compareSortOrder) return compareRows

        return [...compareRows].sort((a, b) => {
            const aNotFound = a.product_name === 'Product Not Found'
            const bNotFound = b.product_name === 'Product Not Found'

            // "Product Not Found" is forced to the bottom always
            if (aNotFound && !bNotFound) return 1
            if (!aNotFound && bNotFound) return -1
            if (aNotFound && bNotFound) return 0

            // Standard alphabetical sorting
            if (compareSortOrder === 'asc') {
                return a.product_name.localeCompare(b.product_name)
            } else {
                return b.product_name.localeCompare(a.product_name)
            }
        })
    }

    const handleDownloadCompare = () => {
        try {
            const sorted = getSortedCompareRows()
            const exportData = sorted.map(row => {
                const custom = getCustomPrice(row)
                const commissionAmt = custom * ((row.commission_percent || 0) / 100)
                const profit = custom - commissionAmt - (row.purchasing_price || 0) - 30

                const diffVal = getPriceOfCol(row, diffCol1) - getPriceOfCol(row, diffCol2)
                const diffLabel = `${getColLabel(diffCol1)} - ${getColLabel(diffCol2)}`

                return {
                    'Seller Sku': row.sku,
                    'Product Name': row.product_name,
                    'Purchase Price': row.purchasing_price || 0,
                    'Breakeven': row.breakeven_price || 0,
                    'Commission %': row.commission_percent !== undefined ? Number(row.commission_percent.toFixed(2)) : 25,
                    'Regular 15%': row.regular_15_price || 0,
                    'Campaign Price': row.campaign_price || 0,
                    'Required Price': row.required_price || 0,
                    'Custom Price (Formula)': custom,
                    [`Difference (${diffLabel})`]: diffVal,
                    'Net Profit': Number(profit.toFixed(2))
                }
            })

            const worksheet = XLSX.utils.json_to_sheet(exportData)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Price Comparison')

            XLSX.writeFile(workbook, 'daraz_price_comparison.xlsx')
        } catch (err: any) {
            alert(`Download failed: ${err.message}`)
        }
    }

    const handlePushToWebsiteSingle = async (item: DarazAvgPriceItem) => {
        if (item.is_price_locked) {
            alert(`✗ Push to website is not allowed for this product because its price is locked.`)
            return
        }
        let activeDarazPrice = item.market_price || 0
        if (activeDarazPrice === 0) {
            let lowest = Infinity
            Object.values(item.live_prices || {}).forEach(lp => {
                const price = lp.special_price || lp.price
                if (price > 0 && price < lowest) lowest = price
            })
            if (lowest !== Infinity) activeDarazPrice = lowest
        }
        if (activeDarazPrice === 0) {
            activeDarazPrice = item.regular_sales_price
        }

        const currentPrice = item.website_special_price || item.website_regular_price || activeDarazPrice;
        const input = prompt(`Enter Website Special Price to push for "${item.product_name}":\n(Regular Price will be set to Rs. ${activeDarazPrice})`, currentPrice.toString())
        if (input === null) return // cancelled
        const val = parseFloat(input)
        if (isNaN(val) || val < 0) {
            alert("Please enter a valid price.")
            return
        }

        setPushingId(item.product_id)
        try {
            const updates = [{
                inventory_id: item.product_id,
                regular_price: activeDarazPrice,
                special_price: Math.round(val)
            }]
            const res = await updateWebsitePricesBulk(updates)
            if (res.success) {
                alert(`✓ ${res.message}`)
                loadData()
            } else {
                alert(`✗ Website Push Failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`)
        } finally {
            setPushingId(null)
        }
    }

    const handleWebsiteBulkPush = async () => {
        const selected = data.filter(d => selectedProductIds.has(d.product_id))
        const activeNonLocked = selected.filter(item => !item.is_price_locked)
        const lockedCount = selected.length - activeNonLocked.length

        if (activeNonLocked.length === 0) {
            alert('No valid items selected or all selected items have locked prices.')
            return
        }

        let val = parseFloat(websiteDiscountValue)
        if ((websiteDiscountType === 'amount' || websiteDiscountType === 'percent') && (isNaN(val) || websiteDiscountValue.trim() === '')) {
            alert('Please enter a valid discount value.')
            return
        }

        const confirmMsg = lockedCount > 0
            ? `Calculate and push Website Prices for ${activeNonLocked.length} products? (${lockedCount} locked products will be skipped).\nRounding to nearest Rs. 5 will be applied.`
            : `Calculate and push Website Prices for ${selected.length} products?\nRounding to nearest Rs. 5 will be applied.`

        if (!confirm(confirmMsg)) return

        setIsWebsitePushing(true)
        try {
            const updates = activeNonLocked.map(item => {
                let activeDarazPrice = 0

                if (websiteDiscountType === 'daraz_campaign') {
                    // Use campaign price
                    activeDarazPrice = item.campaign_price || 0
                } else {
                    // Determine active daraz price
                    activeDarazPrice = item.market_price || 0
                    if (activeDarazPrice === 0) {
                        // Fallback to lowest live price
                        let lowest = Infinity
                        Object.values(item.live_prices || {}).forEach(lp => {
                            const price = lp.special_price || lp.price
                            if (price > 0 && price < lowest) lowest = price
                        })
                        if (lowest !== Infinity) activeDarazPrice = lowest
                    }
                }

                if (activeDarazPrice === 0) {
                    // If no Daraz price, fallback to regular_sales_price
                    activeDarazPrice = item.regular_sales_price
                }

                let newSpecialPrice = activeDarazPrice
                if (websiteDiscountType === 'amount') {
                    newSpecialPrice = activeDarazPrice - val
                } else if (websiteDiscountType === 'percent') {
                    newSpecialPrice = activeDarazPrice - (activeDarazPrice * (val / 100))
                }

                if (newSpecialPrice < 0) newSpecialPrice = 0

                // Rounding to nearest 5 ONLY for percentage discount
                if (websiteDiscountType === 'percent') {
                    newSpecialPrice = Math.round(newSpecialPrice / 5) * 5
                } else {
                    newSpecialPrice = Math.round(newSpecialPrice) // Standard integer rounding
                }

                const finalSpecial = newSpecialPrice < activeDarazPrice ? newSpecialPrice : activeDarazPrice

                return {
                    inventory_id: item.product_id,
                    regular_price: activeDarazPrice,
                    special_price: finalSpecial
                }
            })

            const res = await updateWebsitePricesBulk(updates)
            if (res.success) {
                alert(`✓ ${res.message}`)
                loadData()
            } else {
                alert(`✗ Website Push Failed: ${res.message}`)
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`)
        } finally {
            setIsWebsitePushing(false)
        }
    }
    const openStockModal = (item: DarazAvgPriceItem) => {
        setStockModalProduct(item)
        setStockEdits({})
    }

    const handleUpdateStock = async (isOutOfStock: boolean) => {
        if (!stockModalProduct) return

        const updates: Array<{ sku: string, quantity: number, store_id: string }> = []

        Object.keys(stockModalProduct.live_prices || {})
            .filter(key => !key.includes('_slot_'))
            .forEach(sku => {
                const lp = stockModalProduct.live_prices?.[sku]
                if (!lp) return

                const quantity = isOutOfStock ? 0 : (stockEdits[sku] ?? lp.quantity ?? 0)
                updates.push({ sku, quantity, store_id: lp.store_id || '' })
            })

        if (updates.length === 0) return

        setIsUpdatingStock(true)
        try {
            const { pushStockToDaraz } = await import('@/features/sales/actions/avg-price-actions')
            const res = await pushStockToDaraz(stockModalProduct.product_id, updates)
            if (res.success) {
                alert(`✓ Stock updated!\n${res.message}`)
                setStockModalProduct(null)
                loadData() // Refresh to show new stock
            } else {
                alert(`✗ Update failed:\n${res.message}`)
            }
        } catch (err: any) {
            alert(`Stock update failed: ${err.message}`)
        } finally {
            setIsUpdatingStock(false)
        }
    }

    const startEditing = (item: DarazAvgPriceItem) => {
        setEditingId(item.product_id)
        setEditMarketPrice(item.market_price ? item.market_price.toString() : '')
        setEditCampaignPrice(item.campaign_price ? item.campaign_price.toString() : '')
    }

    const cancelEditing = () => {
        setEditingId(null)
    }

    const savePrices = async (productId: string) => {
        setIsSaving(true)
        try {
            const mPrice = editMarketPrice.trim() !== '' ? parseFloat(editMarketPrice) : null
            const cPrice = editCampaignPrice.trim() !== '' ? parseFloat(editCampaignPrice) : null

            if ((editMarketPrice !== '' && isNaN(mPrice as number)) || (editCampaignPrice !== '' && isNaN(cPrice as number))) {
                alert('Please enter valid numbers')
                return
            }

            await updateDarazAvgPrice(productId, { market_price: mPrice, campaign_price: cPrice })

            // Optimistic update
            setData(prev => prev.map(item => {
                if (item.product_id === productId) {
                    const commissionFactor = (item.commission_percent !== null ? item.commission_percent : 25) / 100
                    return {
                        ...item,
                        market_price: mPrice,
                        market_price_profit: mPrice ? (mPrice - (mPrice * commissionFactor) - item.purchasing_price) : null,
                        campaign_price: cPrice,
                        campaign_price_profit: cPrice ? (cPrice - (cPrice * commissionFactor) - item.purchasing_price) : null
                    }
                }
                return item
            }))

            setEditingId(null)
        } catch (error: any) {
            console.error('Failed to save prices:', error)
            alert(`Save failed: ${error.message}`)
        } finally {
            setIsSaving(false)
        }
    }

    const allSellerAccounts = Array.from(new Set(data.flatMap(d => d.seller_accounts || []))).filter(Boolean).sort()

    const filteredData = data.filter(item => {
        let matches = true;
        if (debouncedSearch) {
            const s = debouncedSearch.toLowerCase()
            matches = (item.product_name?.toLowerCase().includes(s) || item.seller_skus.some(sku => sku?.toLowerCase().includes(s)))
        }

        if (filterAccount && matches) {
            matches = item.seller_accounts?.includes(filterAccount) || false;
        }

        if (livePriceFilter === 'daraz' && matches) {
            matches = Object.keys(item.live_prices || {}).length > 0;
        } else if (livePriceFilter === 'website' && matches) {
            matches = (item.website_regular_price != null || item.website_special_price != null);
        } else if (livePriceFilter === 'mrp' && matches) {
            matches = (item.mrp_price != null && item.mrp_price > 0);
        }

        if (targetPlatform === 'daraz' && applyBulkOnlyIfPurchase && matches) {
            matches = (item.purchasing_price != null && item.purchasing_price >= 1);
        }

        if (targetPlatform === 'daraz' && applyBulkOnlyIfEmpty && matches) {
            matches = (!item.market_price || item.market_price === 0);
        }

        if (targetPlatform === 'daraz' && applyBulkOnlyIfMrp && matches) {
            matches = (item.mrp_price != null && item.mrp_price > 0);
        }

        if (targetPlatform === 'campaign' && applyBulkOnlyIfPurchase && matches) {
            matches = (item.purchasing_price != null && item.purchasing_price >= 1);
        }

        if (targetPlatform === 'campaign' && applyBulkOnlyIfEmpty && matches) {
            matches = (!item.campaign_price || item.campaign_price === 0);
        }

        if (stockFilter !== 'all' && matches) {
            // Get active live prices for this product (exclude inactive SKUs)
            const activeLivePrices = Object.values(item.live_prices || {}).filter(lp => {
                const statusStr = (lp.status || '').toLowerCase().trim()
                return statusStr !== 'inactive' && statusStr !== 'deleted' && statusStr !== 'suspended' && statusStr !== 'deactivated'
            })

            // If a product has no active live price 1-4, hide/exclude it
            if (activeLivePrices.length === 0) {
                matches = false
            } else if (stockFilter === 'stock_out') {
                // Show if at least one active Live price has quantity === 0
                matches = activeLivePrices.some(lp => (lp.quantity || 0) === 0)
            } else if (stockFilter === 'low_stock') {
                // Show if at least one active Live price has stock > 0 and stock < 15
                matches = activeLivePrices.some(lp => (lp.quantity || 0) > 0 && (lp.quantity || 0) < 15)
            }
        }

        if (filterHasPurchasing && matches) {
            matches = (item.purchasing_price != null && item.purchasing_price > 0);
        }

        if (showPriorityOnly && matches) {
            matches = item.sales_priority === true;
        }

        if (competitorFilter === 'most_sold' && matches) {
            matches = (item.weekly_competitor_sold || 0) > 0;
        } else if (competitorFilter === 'price_alert' && matches) {
            matches = !!item.has_price_alert;
        } else if (competitorFilter === 'has_competitors' && matches) {
            matches = (item.competitors?.length ?? 0) > 0;
        }

        return matches;
    })

    if (competitorFilter === 'most_sold') {
        filteredData.sort((a, b) => (b.weekly_competitor_sold || 0) - (a.weekly_competitor_sold || 0))
    }

    const totalPages = Math.ceil(filteredData.length / itemsPerPage)
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    const handleBulkSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedProductIds(prev => {
                const next = new Set(prev)
                paginatedData.forEach(d => next.add(d.product_id))
                return next
            })
        } else {
            setSelectedProductIds(prev => {
                const next = new Set(prev)
                paginatedData.forEach(d => next.delete(d.product_id))
                return next
            })
        }
    }

    if (isCompareModalOpen) {
        const sortedRows = getSortedCompareRows()
        return (
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-zinc-900">
                {/* Full Page Header */}
                <div className="bg-white dark:bg-zinc-900 px-[24px] py-[18px] flex flex-col gap-3 z-20 shadow-sm animate-in fade-in duration-150 border-b dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setIsCompareModalOpen(false)
                                    setCompareRows([])
                                    setCompareSortOrder(null)
                                }}
                                className="p-2 hover:bg-gray-150 dark:hover:bg-zinc-800 rounded-lg text-gray-500 hover:text-gray-700 transition-all focus:outline-none cursor-pointer animate-in slide-in-from-left duration-200"
                                title="Back to Average Sales Price"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <FileSpreadsheet className="text-indigo-500" size={24} />
                                    <span>Price Comparison Tool</span>
                                </h1>
                                <p className="text-xs text-gray-500">Calculate margins, markup prices, and compare with required price lists in memory.</p>
                            </div>
                        </div>

                        {compareRows.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDownloadCompare}
                                    className="py-2.5 px-4 bg-emerald-600 hover:bg-[#047857] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors border-none whitespace-nowrap"
                                >
                                    <UploadCloud size={14} className="rotate-180" />
                                    <span>Download Excel</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setCompareRows([])
                                        setCompareSortOrder(null)
                                    }}
                                    className="py-2.5 px-4 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Upload Another File
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 overflow-hidden flex flex-col gap-4">
                    {compareRows.length === 0 ? (
                        /* Upload Area */
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center max-w-lg w-full shadow-lg space-y-5 animate-in zoom-in duration-200">
                                <UploadCloud size={54} className="text-indigo-500 animate-bounce" />
                                <div className="space-y-1.5">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Upload Comparison Sheet</h4>
                                    <p className="text-xs text-gray-500 max-w-sm">
                                        Import an Excel sheet containing a <strong>Seller Sku</strong> column and an optional <strong>Required Price</strong> column.
                                    </p>
                                </div>
                                <div className="relative w-full pt-2">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        onChange={handleCompareFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <button className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm border-none">
                                        Choose Excel File
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Comparison Grid */
                        <div className="w-full flex-1 overflow-hidden flex flex-col gap-4 animate-in fade-in duration-150">
                            {/* Action Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm">
                                <div className="flex flex-wrap items-center gap-6">
                                    {/* Markup Config */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Formula Markup % on</span>
                                        <select
                                            value={markupBaseCol}
                                            onChange={(e) => setMarkupBaseCol(e.target.value as any)}
                                            className="text-xs bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-lg p-2 font-bold cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="breakeven">Breakeven</option>
                                            <option value="campaign">Campaign Price</option>
                                            <option value="required">Required Price</option>
                                        </select>
                                        <div className="relative w-20">
                                            <input
                                                type="number"
                                                value={markupPercent}
                                                onChange={(e) => setMarkupPercent(e.target.value)}
                                                className="w-full text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg p-2 pr-6 focus:outline-none focus:border-indigo-500 font-bold text-right"
                                            />
                                            <span className="absolute right-2 top-2 text-gray-400 text-xs font-bold">%</span>
                                        </div>
                                    </div>

                                    {/* Difference Column Selector */}
                                    <div className="flex items-center gap-2 border-l pl-6 dark:border-zinc-800">
                                        <select
                                            value={diffCol1}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                if (val === diffCol2) setDiffCol2(diffCol1)
                                                setDiffCol1(val)
                                            }}
                                            className="text-xs bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-lg p-2 font-bold cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="breakeven">Breakeven</option>
                                            <option value="regular15">Regular 15%</option>
                                            <option value="campaign">Campaign Price</option>
                                            <option value="required">Required Price</option>
                                            <option value="custom">Custom Price (Formula)</option>
                                        </select>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">difference</span>
                                        <select
                                            value={diffCol2}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                if (val === diffCol1) setDiffCol1(diffCol2)
                                                setDiffCol2(val)
                                            }}
                                            className="text-xs bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-lg p-2 font-bold cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="breakeven">Breakeven</option>
                                            <option value="regular15">Regular 15%</option>
                                            <option value="campaign">Campaign Price</option>
                                            <option value="required">Required Price</option>
                                            <option value="custom">Custom Price (Formula)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="text-[11px] text-gray-400 italic">
                                    * Custom Price is rounded to nearest Rs. 5
                                </div>
                            </div>

                            {/* Table Container */}
                            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-[#F8FAFC] dark:bg-zinc-800 text-[#6B7280] dark:text-gray-400 font-bold uppercase tracking-wider sticky top-0 z-10 border-b dark:border-zinc-850 shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#27272a]">
                                        <tr className="h-12">
                                            <th className="p-3 text-center w-12 bg-[#F8FAFC] dark:bg-zinc-800">S.N</th>
                                            <th className="p-3 w-36 bg-[#F8FAFC] dark:bg-zinc-800">Seller SKU</th>
                                            <th className="p-3 w-64 bg-[#F8FAFC] dark:bg-zinc-800 select-none">
                                                <div className="flex items-center gap-1.5">
                                                    <span>Product Name</span>
                                                    <button
                                                        onClick={() => {
                                                            setCompareSortOrder(prev => {
                                                                if (!prev) return 'asc';
                                                                if (prev === 'asc') return 'desc';
                                                                return null;
                                                            });
                                                        }}
                                                        className="p-1 hover:bg-gray-205 dark:hover:bg-zinc-700 rounded transition-all focus:outline-none cursor-pointer"
                                                        title="Sort Alphabetical (Product Not Found always forced to end)"
                                                    >
                                                        <ArrowDown size={12} className={`transition-transform duration-200 ${compareSortOrder === 'desc' ? 'rotate-180' : ''} ${compareSortOrder ? 'text-indigo-650 font-bold' : 'text-gray-400'}`} />
                                                    </button>
                                                </div>
                                            </th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 w-28">Purchase Price</th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 w-28">Breakeven</th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 w-28">Commission</th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 w-28">Regular 15%</th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 w-28">Campaign Price</th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 w-28">Required Price</th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 w-36">Custom Price (Formula)</th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 font-bold text-gray-800 dark:text-gray-200 w-44">
                                                Difference ({getColLabel(diffCol1)} - {getColLabel(diffCol2)})
                                            </th>
                                            <th className="p-3 text-right bg-[#F8FAFC] dark:bg-zinc-800 font-bold text-indigo-650 dark:text-indigo-300 w-32">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-zinc-800 font-semibold text-gray-700 dark:text-gray-300">
                                        {sortedRows.map((row, index) => {
                                            const customPrice = getCustomPrice(row)
                                            const commissionAmt = customPrice * ((row.commission_percent || 0) / 100)
                                            const netProfit = customPrice - commissionAmt - (row.purchasing_price || 0) - 30

                                            const val1 = getPriceOfCol(row, diffCol1)
                                            const val2 = getPriceOfCol(row, diffCol2)
                                            const difference = val1 - val2

                                            const isNotFound = row.product_name === 'Product Not Found'

                                            return (
                                                <tr key={index} className={`hover:bg-gray-50 dark:hover:bg-zinc-850 h-12 transition-colors ${isNotFound ? 'bg-red-50/20 dark:bg-red-950/10' : ''}`}>
                                                    <td className="p-3 text-center text-gray-400">{index + 1}</td>
                                                    <td className="p-3 font-semibold">{row.sku}</td>
                                                    <td className="p-3 max-w-[240px] truncate font-medium text-gray-800 dark:text-gray-200" title={row.product_name}>
                                                        {isNotFound ? (
                                                            <span className="text-red-500 font-bold italic">{row.product_name}</span>
                                                        ) : (
                                                            row.product_name
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-bold">
                                                        {row.purchasing_price > 0 ? `Rs. ${row.purchasing_price.toLocaleString()}` : 'Rs. 0'}
                                                    </td>
                                                    <td className="p-3 text-right bg-blue-50/70 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-bold">
                                                        {row.breakeven_price > 0 ? `Rs. ${row.breakeven_price.toLocaleString()}` : 'Rs. 0'}
                                                    </td>
                                                    <td className="p-3 text-right bg-red-50/70 dark:bg-red-950/20 text-red-700 dark:text-red-300 font-bold">
                                                        {row.commission_percent !== undefined && row.commission_percent !== null ? `${row.commission_percent.toFixed(2)}%` : '25.00%'}
                                                    </td>
                                                    <td className="p-3 text-right text-gray-500 font-medium">
                                                        {row.regular_15_price > 0 ? `Rs. ${row.regular_15_price.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="p-3 text-right text-purple-650 dark:text-purple-400 font-bold">
                                                        {row.campaign_price > 0 ? `Rs. ${row.campaign_price.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-gray-700 dark:text-gray-300 bg-amber-50/5 dark:bg-amber-950/5">
                                                        {row.required_price > 0 ? `Rs. ${row.required_price.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className="text-[10px] text-gray-400 font-bold">Rs.</span>
                                                            <input
                                                                type="number"
                                                                value={row.custom_price ?? ''}
                                                                onChange={(e) => handleCustomPriceChange(row.sku, e.target.value)}
                                                                className="w-24 px-2.5 py-1 text-right text-xs border border-gray-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white dark:bg-zinc-900 font-bold"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className={`p-3 text-right font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {difference >= 0 ? '+' : ''}Rs. {difference.toLocaleString()}
                                                    </td>
                                                    <td className={`p-3 text-right font-bold ${netProfit >= 0 ? 'text-emerald-650 dark:text-emerald-400' : 'text-red-500'}`}>
                                                        Rs. {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 px-[24px] py-[18px] flex flex-col gap-4 z-20 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Link href="/dashboard/sales/daraz" className="p-1 hover:bg-gray-100 rounded md:hidden">
                            <ArrowLeft size={20} />
                        </Link>
                        Average Sales Price
                    </h1>
                </div>

                <div className="flex items-center gap-[12px] w-full overflow-x-auto hide-scrollbar">
                    <select
                        className="h-[42px] w-[180px] flex-none rounded-[12px] border border-[#E5E7EB] bg-white text-[13px] px-[16px] font-semibold text-gray-700 outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/[0.08] cursor-pointer"
                        value={filterAccount}
                        onChange={e => { setFilterAccount(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="">All Seller Accounts</option>
                        {allSellerAccounts.map(acc => (
                            <option key={acc} value={acc}>{acc}</option>
                        ))}
                    </select>

                    <select
                        className="h-[42px] w-[160px] flex-none rounded-[12px] border border-[#E5E7EB] bg-white text-[13px] px-[16px] font-semibold text-gray-700 outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/[0.08] cursor-pointer"
                        value={salesDays}
                        onChange={e => {
                            const val = e.target.value;
                            setSalesDays(val === 'new_listed' ? val : Number(val));
                            setCurrentPage(1);
                        }}
                    >
                        <option value={30}>30 Days Sales</option>
                        <option value={60}>60 Days Sales</option>
                        <option value={90}>90 Days Sales</option>
                        <option value={120}>120 Days Sales</option>
                        <option value="new_listed">New Listed Product</option>
                    </select>

                    <select
                        className="h-[42px] w-[160px] flex-none rounded-[12px] border border-[#E5E7EB] bg-white text-[13px] px-[16px] font-semibold text-gray-700 outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/[0.08] cursor-pointer"
                        value={showPriorityOnly ? 'Priority' : 'All'}
                        onChange={e => { setShowPriorityOnly(e.target.value === 'Priority'); setCurrentPage(1); }}
                    >
                        <option value="All">All Products</option>
                        <option value="Priority">Priority Products</option>
                    </select>

                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Product or SKU..."
                            style={{ fontFamily: 'Inter, sans-serif' }}
                            className="w-full h-[42px] pl-[44px] pr-[36px] text-[13px] rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] focus:bg-white focus:outline-none focus:border-[#4F46E5] focus:ring-[4px] focus:ring-[#4F46E5]/[0.08] transition-all"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        />
                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                title="Clear all filters"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <select
                        value={livePriceFilter}
                        onChange={(e) => {
                            const val = e.target.value as '' | 'daraz' | 'website' | 'mrp';
                            setLivePriceFilter(val);
                            setCurrentPage(1);
                            if (val === 'daraz') setTargetPlatform('daraz');
                            if (val === 'website') setTargetPlatform('website');
                        }}
                        className={`h-[42px] min-w-[160px] px-[12px] rounded-[12px] transition-all border text-[13px] font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer ${livePriceFilter !== '' ? 'bg-[#F3F4F6] text-[#111827] border-[#D1D5DB]' : 'bg-white text-gray-700 border-[#E5E7EB] hover:bg-gray-50'}`}
                    >
                        <option value="">Show All Prices</option>
                        <option value="daraz">Live on Daraz</option>
                        <option value="website">Live on Website</option>
                        <option value="mrp">Show Mrp Price</option>
                    </select>

                    <select
                        value={stockFilter}
                        onChange={(e) => {
                            setStockFilter(e.target.value as 'all' | 'stock_out' | 'low_stock');
                            setCurrentPage(1);
                        }}
                        className={`h-[42px] min-w-[150px] px-[12px] rounded-[12px] transition-all border text-[13px] font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer ${stockFilter !== 'all' ? 'bg-[#F3F4F6] text-[#111827] border-[#D1D5DB]' : 'bg-white text-gray-700 border-[#E5E7EB] hover:bg-gray-50'}`}
                    >
                        <option value="all">All Stock</option>
                        <option value="stock_out">Stock Out</option>
                        <option value="low_stock">Low Stock (&lt;15)</option>
                    </select>

                    <select
                        value={competitorFilter}
                        onChange={(e) => {
                            setCompetitorFilter(e.target.value as any);
                            setCurrentPage(1);
                        }}
                        className={`h-[42px] min-w-[210px] px-[12px] rounded-[12px] transition-all border text-[13px] font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer ${competitorFilter !== 'all' ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]' : 'bg-white text-gray-700 border-[#E5E7EB] hover:bg-gray-50'}`}
                    >
                        <option value="all">All Competitors Status</option>
                        <option value="most_sold">🔥 Most Unit Sold This Week</option>
                        <option value="price_alert">⚠️ Price Change Alert (7 Days)</option>
                        <option value="has_competitors">🎯 Has Competitors Added</option>
                    </select>

                    <button
                        onClick={handleSyncCompetitorsAll}
                        disabled={isSyncingCompetitors}
                        className="flex flex-row items-center justify-center gap-[8px] h-[42px] px-[16px] bg-indigo-50 hover:bg-indigo-100 text-[13px] font-semibold text-indigo-700 border border-indigo-200 rounded-[12px] transition-colors whitespace-nowrap"
                        title="Sync all live competitor prices & unit sales"
                    >
                        {isSyncingCompetitors ? <Loader2 size={16} className="animate-spin text-indigo-600" /> : <RefreshCw size={16} className="text-indigo-600" />}
                        Sync Competitors
                    </button>

                    <a
                        href="https://docs.google.com/spreadsheets/d/1ztKJH0rrE1Od2lXJA2f8AoQ_FQ3fmnpqQietx2ZulZE/edit"
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-row items-center justify-center gap-[8px] h-[42px] min-w-[120px] px-[16px] bg-white text-[13px] font-semibold text-gray-700 border border-[#E5E7EB] rounded-[12px] hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                        View Sheet
                    </a>

                    <button
                        onClick={handlePull}
                        disabled={isPulling}
                        className="flex flex-row items-center justify-center gap-[8px] h-[42px] min-w-[120px] px-[16px] bg-white hover:bg-gray-50 text-[13px] font-semibold text-gray-700 border border-[#E5E7EB] rounded-[12px] transition-colors whitespace-nowrap"
                    >
                        {isPulling ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} className="text-gray-400" />}
                        Sync by Sheet
                    </button>

                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex flex-row items-center justify-center gap-[8px] h-[42px] min-w-[120px] px-[16px] bg-white hover:bg-gray-50 text-[13px] font-semibold text-gray-700 border border-[#E5E7EB] rounded-[12px] transition-colors whitespace-nowrap"
                    >
                        {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} className="text-gray-400" />}
                        Sync with Sheets
                    </button>

                    <button
                        onClick={handleSyncLive}
                        disabled={isSyncingLive}
                        className="flex flex-row items-center justify-center gap-[8px] h-[42px] min-w-[180px] px-[16px] bg-[#4F46E5] hover:bg-[#4338ca] text-[13px] font-semibold text-white rounded-[12px] transition-all border-none whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow active:scale-[0.98]"
                        title="Sync Live Prices & Live Stock from Daraz"
                    >
                        {isSyncingLive ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Sync Live Prices & Stock
                    </button>

                    <button
                        onClick={handleApplyAutoDiscount}
                        disabled={isApplyingAutoPrices}
                        className="flex flex-row items-center justify-center gap-[8px] h-[42px] min-w-[160px] px-[16px] bg-emerald-600 hover:bg-[#047857] text-[13px] font-semibold text-white rounded-[12px] transition-colors border-none whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                        {isApplyingAutoPrices ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        Auto Price Push
                    </button>

                    <button
                        onClick={() => setIsCompareModalOpen(true)}
                        className="flex flex-row items-center justify-center gap-[8px] h-[42px] min-w-[140px] px-[16px] bg-indigo-650 hover:bg-indigo-700 text-[13px] font-semibold text-white rounded-[12px] transition-colors border-none whitespace-nowrap cursor-pointer"
                    >
                        <FileSpreadsheet size={16} />
                        Price Compare
                    </button>
                </div>
            </div>

            {/* Content - Card Based Layout */}
            <div className="flex-1 px-4 md:px-6 py-4 pb-0 flex flex-col overflow-hidden bg-[#F9FAFB] dark:bg-zinc-900">
                <div
                    ref={scrollContainerRef}
                    className={`flex-1 overflow-auto ${isDragging ? 'cursor-grabbing select-none' : 'cursor-default'}`}
                    onMouseDown={startDrag}
                    onMouseLeave={stopDrag}
                    onMouseUp={stopDrag}
                    onMouseMove={onDrag}
                >

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-400" />
                            <span className="text-sm font-medium">Evaluating metrics...</span>
                        </div>
                    ) : paginatedData.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-gray-400 text-sm">No products found.</div>
                    ) : (
                        <div className="flex flex-col gap-2.5 min-w-[1450px] pb-4 pt-1">
                            {paginatedData.map((item, index) => {
                                // === Derived values ===
                                const totalStock = Object.values(item.live_prices || {}).reduce((sum, lp) => sum + (lp.quantity || 0), 0)
                                const isOutOfStock = totalStock === 0 && Object.keys(item.live_prices || {}).length > 0

                                const commPct = item.commission_percent !== null ? item.commission_percent : 25
                                const rawReg = item.breakeven_price * (1 + regularPct / 100)
                                const regPrice = Math.ceil(rawReg / 5) * 5

                                const isBestSelling = (item.sold_qty || 0) > 30
                                const mrpVal = item.mrp_price
                                const mrpViolations: string[] = []
                                if (mrpVal != null) {
                                    if (item.market_price != null && item.market_price > mrpVal) mrpViolations.push('Daraz')
                                    if (item.campaign_price != null && item.campaign_price > mrpVal) mrpViolations.push('Campaign')
                                }
                                const hasMrpViolation = mrpViolations.length > 0

                                const isHighlight = (() => {
                                    if (!item.market_price) return false;
                                    const liveSkus = [item.seller_sku1, item.seller_sku2, item.seller_sku3, item.seller_sku4];
                                    for (const sku of liveSkus) {
                                        if (!sku) continue;
                                        const liveDet = item.live_prices?.[sku];
                                        if (liveDet) {
                                            const activePrice = liveDet.special_price || liveDet.price;
                                            const diff = Math.abs(activePrice - item.market_price) / item.market_price;
                                            if (diff > 0.05) return true;
                                        }
                                    }
                                    return false;
                                })()

                                // Left border color
                                let leftBorderColor = 'border-l-transparent'
                                if (isOutOfStock) leftBorderColor = 'border-l-[#EF4444]'
                                else if (hasMrpViolation || isHighlight) leftBorderColor = 'border-l-[#F97316]'
                                else if (isBestSelling) leftBorderColor = 'border-l-[#2563EB]'

                                const skusToShow = item.seller_skus.slice(0, 3)
                                const extraSkus = Math.max(0, item.seller_skus.length - 3)

                                const storeAliasMap: Record<string, string> = {
                                    'Bagmati Online': 'BAGMATI',
                                    'Ram': 'BALAJU',
                                    'Lamichhane Suppliers': 'COSMETICS',
                                    'Bagmati Traders': 'BTAS',
                                }
                                const storeColorMap: Record<string, string> = {
                                    'BAGMATI': 'bg-teal-50 text-teal-700 border-teal-200',
                                    'BALAJU': 'bg-blue-50 text-blue-700 border-blue-200',
                                    'COSMETICS': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
                                    'BTAS': 'bg-amber-50 text-amber-700 border-amber-200',
                                }

                                // Helper profit calculator for Daraz / Campaign prices based on purchasing price & commission
                                const calcPriceProfit = (price: number | null | undefined) => {
                                    if (price == null || price <= 0 || item.purchasing_price <= 0) return null
                                    const commPct = item.commission_percent !== null ? item.commission_percent : 25
                                    const netPayout = price * (1 - commPct / 100)
                                    return netPayout - item.purchasing_price
                                }

                                const darazProfit = item.market_price_profit !== null && item.market_price_profit !== undefined
                                    ? item.market_price_profit
                                    : calcPriceProfit(item.market_price)

                                const campaignProfit = item.campaign_price_profit !== null && item.campaign_price_profit !== undefined
                                    ? item.campaign_price_profit
                                    : calcPriceProfit(item.campaign_price)

                                return (
                                    <div
                                        key={item.product_id}
                                        className={`flex items-center bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-visible border-l-[4px] ${leftBorderColor} gap-6 p-5 min-h-[136px] max-h-[140px]`}
                                        style={{ fontFamily: 'Inter, sans-serif' }}
                                    >
                                        {/* ─── Checkbox & Row Number ─── */}
                                        <div className="flex flex-col items-center justify-center gap-2 shrink-0 w-[44px]">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5] cursor-pointer"
                                                checked={selectedProductIds.has(item.product_id)}
                                                onChange={() => toggleSelection(item.product_id)}
                                            />
                                            <span className="text-[11px] font-medium text-[#9CA3AF] tabular-nums">
                                                #{((currentPage - 1) * itemsPerPage) + index + 1}
                                            </span>
                                        </div>

                                        {/* ─── 1. Product Information ─── */}
                                        <div className="flex items-center gap-3 w-[310px] shrink-0">
                                            <div className="w-[72px] h-[72px] rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <div className="w-8 h-8 rounded-full border-2 border-gray-200 opacity-50" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0 gap-1">
                                                <p
                                                    className={`font-bold text-[14.5px] leading-snug ${hasMrpViolation ? 'text-[#DC2626]' : isOutOfStock ? 'text-[#DC2626]' : 'text-[#111827]'}`}
                                                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}
                                                    title={hasMrpViolation ? `MRP Violation: ${mrpViolations.join(', ')}` : item.product_name}
                                                >
                                                    {item.product_name}
                                                </p>
                                                <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                                                    {(item.sold_qty || 0) > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F46E5] bg-[#EEF2FF] px-[7px] py-[2px] rounded-full whitespace-nowrap">
                                                            🛒 {item.sold_qty} Sold
                                                        </span>
                                                    )}
                                                    <span className="text-[11px] font-medium text-[#9CA3AF]">
                                                        {typeof salesDays === 'number' ? `Last ${salesDays} Days` : 'Last 60 Days'}
                                                    </span>
                                                    {isOutOfStock && (
                                                        <span className="inline-flex text-[11px] font-semibold text-[#DC2626] bg-[#FEE2E2] px-[7px] py-[2px] rounded-full">
                                                            OUT
                                                        </span>
                                                    )}
                                                    {item.is_new_pushed && (
                                                        <span className="inline-flex text-[11px] font-semibold text-[#16A34A] bg-[#DCFCE7] px-[7px] py-[2px] rounded-full">
                                                            NEW
                                                        </span>
                                                    )}
                                                    {item.sales_priority && item.priority_seller_account && (
                                                        <span className="inline-flex text-[11px] font-semibold text-[#B45309] bg-[#FEF3C7] px-[7px] py-[2px] rounded-full whitespace-nowrap">
                                                            ⭐ {item.priority_seller_account}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="space-y-0.5 mt-0.5">
                                                    {skusToShow.map((sku, i) => (
                                                        <div key={i} className="font-mono text-[11px] font-medium text-[#6B7280] leading-[15px] truncate max-w-[200px]" title={sku}>
                                                            {sku}
                                                        </div>
                                                    ))}
                                                    {extraSkus > 0 && (
                                                        <span className="font-mono text-[11px] font-medium text-[#9CA3AF] italic">
                                                            +{extraSkus} More
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ─── 2. Cost Information ─── */}
                                        <div className="flex flex-col justify-center gap-1.5 w-[150px] shrink-0 border-l border-[#ECEEF3] pl-5">
                                            <div className="flex flex-col">
                                                <span className="text-[10.5px] font-semibold uppercase tracking-[0.8px] text-[#9CA3AF]">💰 PURCHASING</span>
                                                <span className="text-[15px] font-bold text-[#111827] leading-tight mt-0.5">
                                                    Rs.{item.purchasing_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10.5px] font-semibold uppercase tracking-[0.8px] text-[#9CA3AF]">📈 COMMISSION</span>
                                                <div className="mt-0.5">
                                                    {item.commission_percent !== null ? (
                                                        <span className="inline-flex items-center bg-gray-100 text-[#111827] border border-gray-200 text-[11px] font-bold px-[7px] py-[1.5px] rounded-full">
                                                            {item.commission_percent.toFixed(2)}%{item.is_default_commission ? ' (est)' : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] font-medium text-[#9CA3AF] italic">No orders</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10.5px] font-semibold uppercase tracking-[0.8px] text-[#9CA3AF]">🔥 BREAKEVEN</span>
                                                <span className="text-[15px] font-bold text-[#111827] leading-tight mt-0.5">
                                                    Rs.{item.breakeven_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* ─── 3. Live Price Section (4 Mini Cards) ─── */}
                                        <div className="flex items-center gap-2.5 w-[580px] shrink-0 border-l border-[#ECEEF3] pl-5">
                                            {[item.seller_sku1, item.seller_sku2, item.seller_sku3, item.seller_sku4].map((sku, idx) => {
                                                const slotKey = sku ? `${sku}_slot_${idx}` : null
                                                const liveDetails = (slotKey && item.live_prices?.[slotKey])
                                                    ? item.live_prices[slotKey]
                                                    : (sku ? item.live_prices?.[sku] : null)
                                                const isInactive = liveDetails?.status && ['inactive', 'deleted', 'suspended', 'deactivated'].includes(liveDetails.status.toLowerCase())
                                                const accountName = [item.seller_account1, item.seller_account2, item.seller_account3, item.seller_account4][idx]
                                                const accountSoldQty = accountName ? (item.sold_qty_by_account?.[accountName] || 0) : 0

                                                if (!liveDetails || isInactive) {
                                                    return (
                                                        <div key={idx} className="flex-1 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] flex flex-col items-center justify-center gap-1 h-[112px]">
                                                            <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#9CA3AF]">LIVE {idx + 1}</span>
                                                            <span className="text-[11px] text-[#9CA3AF]">—</span>
                                                        </div>
                                                    )
                                                }

                                                const sellingPrice = liveDetails.special_price || liveDetails.price
                                                const originalPrice = liveDetails.special_price ? liveDetails.price : null
                                                const stockQty = liveDetails.quantity || 0
                                                const isStockOut = stockQty === 0
                                                const isLowStock = stockQty > 0 && stockQty <= 5
                                                const isAboveMrpLive = mrpVal != null && sellingPrice > mrpVal
                                                const liveProfit = calcPriceProfit(sellingPrice)

                                                const getStoreAlias = (storeName?: string | null) => {
                                                    if (!storeName) return 'STORE'
                                                    const name = storeName.toLowerCase().trim()
                                                    if (name.includes('balaju') || name.includes('lamichhaneram100')) return 'BALAJU'
                                                    if (name.includes('btas') || name.includes('shop.bagmati')) return 'BTAS'
                                                    if (name.includes('cosmetics') || name.includes('supplierslamichhane9')) return 'COSMETICS'
                                                    if (name.includes('bagmati') || name.includes('bagmationline8')) return 'BAGMATI'
                                                    return storeName.toUpperCase().slice(0, 10)
                                                }

                                                const storeAlias = getStoreAlias(liveDetails.store_name)
                                                const storeTheme = (storeColorMap[storeAlias] || DEFAULT_STORE_THEME) as { bg: string; text: string; border: string }

                                                let miniCardBg = 'bg-white border-[#E5E7EB]'
                                                let priceClass = isAboveMrpLive ? 'text-[#DC2626]' : 'text-[#111827]'
                                                let stockText = `📦 ${stockQty}`
                                                let stockBadgeClass = 'bg-[#DCFCE7] text-[#16A34A] border-transparent'

                                                if (isStockOut) {
                                                    miniCardBg = 'bg-[#FEF2F2] border-[#F87171]'
                                                    priceClass = 'text-[#DC2626]'
                                                    stockBadgeClass = 'bg-[#FEE2E2] text-[#DC2626] border-transparent font-semibold'
                                                    stockText = '⚠ Out of Stock'
                                                } else if (isLowStock) {
                                                    miniCardBg = 'bg-[#FFF7ED] border-[#F97316]'
                                                    stockBadgeClass = 'bg-[#FFEDD5] text-[#EA580C] border-transparent font-semibold'
                                                    stockText = `Low Stock (${stockQty})`
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`flex-1 rounded-xl border ${miniCardBg} p-2 flex flex-col justify-between h-[112px] cursor-default overflow-hidden`}
                                                        title={isAboveMrpLive ? `Price is above MRP (MRP: Rs.${mrpVal})` : undefined}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#6C4CF1]">LIVE {idx + 1}</span>
                                                            <span className={`inline-flex text-[10px] font-extrabold px-[7px] py-[1.5px] rounded-[6px] border ${storeTheme.bg} ${storeTheme.text} ${storeTheme.border}`}>
                                                                {storeAlias}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-baseline justify-between gap-1 leading-tight my-0.5">
                                                            <div className="flex items-baseline gap-1 truncate">
                                                                <span className={`text-[14px] font-bold ${priceClass}`}>
                                                                    Rs.{sellingPrice.toLocaleString()}
                                                                </span>
                                                                {originalPrice && (
                                                                    <span className="text-[10px] font-medium text-[#9CA3AF] line-through">
                                                                        Rs.{originalPrice.toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {liveProfit !== null && (
                                                                <span className={`text-[11px] font-bold shrink-0 ${liveProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                                                    {liveProfit >= 0 ? '+' : ''}Rs.{liveProfit.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            {accountSoldQty > 0 && (
                                                                <span className="inline-flex text-[10px] font-semibold bg-[#EEF2FF] text-[#4F46E5] px-[6px] py-[2px] rounded-full">
                                                                    {accountSoldQty} Sold
                                                                </span>
                                                            )}
                                                            <span className={`inline-flex items-center text-[10px] px-[6px] py-[2px] rounded-full border ${stockBadgeClass}`}>
                                                                {stockText}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* ─── 4. Regular Price ─── */}
                                        <div className="flex flex-col items-center justify-center gap-1.5 w-[115px] shrink-0 border-l border-[#ECEEF3] pl-5 text-center">
                                            <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#9CA3AF]">REGULAR</span>
                                            <span className="inline-flex items-center bg-[#DBEAFE] text-[#2563EB] text-[11px] font-bold px-[8px] py-[2px] rounded-full">
                                                {regularPct}%
                                            </span>
                                            <span className="text-[20px] font-bold text-[#2563EB] leading-tight">
                                                Rs.{regPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                            {item.purchasing_price > 0 && regPrice > 0 && (() => {
                                                const marginVal = ((regPrice - item.purchasing_price) / regPrice) * 100
                                                const meterColor = marginVal > 25 ? '#16A34A' : marginVal > 15 ? '#EA580C' : '#DC2626'
                                                const meterWidth = Math.min(100, Math.max(4, marginVal * 2))
                                                return (
                                                    <div className="w-full space-y-0.5 mt-0.5">
                                                        <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${meterWidth}%`, backgroundColor: meterColor }} />
                                                        </div>
                                                        <span className="text-[11px] font-medium text-[#9CA3AF] block">Margin {marginVal.toFixed(0)}%</span>
                                                    </div>
                                                )
                                            })()}
                                        </div>

                                        {/* ─── 5. Marketplace Prices ─── */}
                                        <div className="flex flex-col justify-center gap-2 w-[245px] shrink-0 border-l border-[#ECEEF3] pl-5">
                                            {/* Website */}
                                            <div className="flex items-center justify-between gap-1">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleToggleLock(item.product_id, !!item.is_price_locked)}
                                                        disabled={togglingLockId === item.product_id}
                                                        className="shrink-0 focus:outline-none"
                                                        title={item.is_price_locked ? 'Unlock Website Price' : 'Lock Website Price'}
                                                    >
                                                        {togglingLockId === item.product_id ? (
                                                            <Loader2 size={11} className="animate-spin text-[#2563EB]" />
                                                        ) : item.is_price_locked ? (
                                                            <Lock size={11} className="text-[#DC2626]" />
                                                        ) : (
                                                            <Unlock size={11} className="text-[#9CA3AF] hover:text-[#111827] transition-colors" />
                                                        )}
                                                    </button>
                                                    <span className="text-[11px] font-semibold text-[#6B7280]">🌐 Website</span>
                                                </div>
                                                <span className="text-[14.5px] font-semibold text-[#111827]">
                                                    {item.website_special_price || item.website_regular_price ? `Rs.${(item.website_special_price || item.website_regular_price)!.toLocaleString()}` : '—'}
                                                </span>
                                            </div>

                                            {/* Daraz */}
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[11px] font-semibold text-[#6B7280]">🛒 Daraz</span>
                                                <div className="flex items-center gap-2">
                                                    {editingId === item.product_id ? (
                                                        <input
                                                            type="number"
                                                            value={editMarketPrice}
                                                            onChange={(e) => setEditMarketPrice(e.target.value)}
                                                            className="w-[75px] px-1.5 py-0.5 text-right text-xs border border-[#2563EB] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                                                            autoFocus
                                                        />
                                                    ) : item.market_price != null ? (
                                                        <span className={`text-[14.5px] font-semibold ${(mrpVal != null && item.market_price > mrpVal) ? 'text-[#DC2626]' : 'text-[#111827]'}`}>
                                                            Rs.{item.market_price.toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[14.5px] font-semibold text-[#9CA3AF]">—</span>
                                                    )}
                                                    {darazProfit !== null && (
                                                        <span className={`text-[11.5px] font-bold ${darazProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                                            {darazProfit >= 0 ? '+' : ''}Rs.{darazProfit.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Campaign */}
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[11px] font-semibold text-[#6B7280]">🏷 Campaign</span>
                                                <div className="flex items-center gap-2">
                                                    {editingId === item.product_id ? (
                                                        <input
                                                            type="number"
                                                            value={editCampaignPrice}
                                                            onChange={(e) => setEditCampaignPrice(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') savePrices(item.product_id) }}
                                                            className="w-[75px] px-1.5 py-0.5 text-right text-xs border border-[#6C4CF1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C4CF1]"
                                                        />
                                                    ) : item.campaign_price != null ? (
                                                        <span className={`text-[14.5px] font-semibold ${(mrpVal != null && item.campaign_price > mrpVal) ? 'text-[#DC2626]' : 'text-[#111827]'}`}>
                                                            Rs.{item.campaign_price.toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[14.5px] font-semibold text-[#9CA3AF]">—</span>
                                                    )}
                                                    {campaignProfit !== null && (
                                                        <span className={`text-[11.5px] font-bold ${campaignProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                                            {campaignProfit >= 0 ? '+' : ''}Rs.{campaignProfit.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ─── 6. Action Buttons ─── */}
                                        <div className="flex flex-col items-center justify-center gap-2 w-[50px] shrink-0 border-l border-[#ECEEF3] pl-5">
                                            {editingId === item.product_id ? (
                                                <>
                                                    <button
                                                        onClick={() => savePrices(item.product_id)}
                                                        disabled={isSaving}
                                                        className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] bg-[#DCFCE7] text-[#16A34A] shadow-sm"
                                                        title="Save Prices"
                                                    >
                                                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        disabled={isSaving}
                                                        className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] bg-[#FEE2E2] text-[#DC2626] shadow-sm"
                                                        title="Cancel"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEditing(item)}
                                                        className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
                                                        title="Edit Prices"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <div className="relative inline-block">
                                                        <button
                                                            onClick={() => setActiveSyncMenuProductId(activeSyncMenuProductId === item.product_id ? null : item.product_id)}
                                                            disabled={pushingId === item.product_id || syncingLiveProductId === item.product_id}
                                                            className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors disabled:opacity-40"
                                                            title="Sync / Push Actions"
                                                        >
                                                            {pushingId === item.product_id || syncingLiveProductId === item.product_id ? (
                                                                <Loader2 size={16} className="animate-spin text-[#16A34A]" />
                                                            ) : (
                                                                <RefreshCw size={16} />
                                                            )}
                                                        </button>
                                                        {activeSyncMenuProductId === item.product_id && (
                                                            <>
                                                                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveSyncMenuProductId(null)} />
                                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 py-1.5 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                                                                    <button
                                                                        onClick={() => { setActiveSyncMenuProductId(null); setPushSelectProduct(item) }}
                                                                        className="w-full text-left px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <UploadCloud size={14} className="text-[#16A34A]" />
                                                                        Push to Daraz
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setActiveSyncMenuProductId(null); handleSyncLiveForProduct(item.product_id, item.product_name) }}
                                                                        className="w-full text-left px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 transition-colors border-t border-[#F3F4F6]"
                                                                    >
                                                                        <RefreshCw size={14} className="text-[#2563EB]" />
                                                                        Sync Live Price
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setActiveSyncMenuProductId(null); handlePushToWebsiteSingle(item) }}
                                                                        className="w-full text-left px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2 transition-colors border-t border-[#F3F4F6]"
                                                                    >
                                                                        <UploadCloud size={14} className="text-teal-500" />
                                                                        Push to Website
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => openStockModal(item)}
                                                        className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] text-[#6B7280] hover:text-[#EA580C] hover:bg-[#FFF7ED] transition-colors"
                                                        title="Manage Stock"
                                                    >
                                                        <AlertTriangle size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* ─── 7. Competitor Compartment ─── */}
                                        <div className="flex flex-col justify-center gap-1.5 w-[310px] shrink-0 border-l border-[#ECEEF3] pl-4 pr-2">
                                            <div className="flex items-center justify-between gap-1 border-b border-[#F3F4F6] pb-1">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">🎯 Competitors</span>
                                                    {item.competitors && item.competitors.length > 0 && (
                                                        <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">
                                                            {item.competitors.length}/4
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {item.competitors && item.competitors.length > 0 && (
                                                        <button
                                                            onClick={() => setViewCompetitorProduct(item)}
                                                            className="p-1 text-[#6B7280] hover:text-[#4F46E5] hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="View Competitor Detailed Analytics & History"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => openCompetitorEditModal(item)}
                                                        className="p-1 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-lg transition-colors"
                                                        title={item.competitors && item.competitors.length > 0 ? "Edit Competitor Links" : "Add Competitor Links"}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {item.competitors && item.competitors.length > 0 ? (
                                                <div className="space-y-1.5 max-h-[105px] overflow-y-auto hide-scrollbar">
                                                    {item.competitors.map((comp, idx) => {
                                                        const compPrice = comp.current_price || 0
                                                        const commFactor = (item.commission_percent !== null ? item.commission_percent : 25) / 100
                                                        const compProfit = compPrice > 0 && item.purchasing_price > 0
                                                            ? compPrice - (compPrice * commFactor) - item.purchasing_price
                                                            : null

                                                        return (
                                                            <div
                                                                key={comp.id || idx}
                                                                className={`flex items-center justify-between text-[11px] px-2 py-1 rounded-md border gap-1 min-w-0 overflow-hidden ${
                                                                    idx === 0
                                                                        ? 'bg-[#EEF2FF]/60 dark:bg-indigo-950/20 border-[#C7D2FE] dark:border-indigo-900'
                                                                        : 'bg-[#F9FAFB] dark:bg-zinc-800 border-[#F3F4F6] dark:border-zinc-700'
                                                                }`}
                                                            >
                                                                <span className="font-bold text-[#374151] dark:text-gray-200 shrink-0 text-[11px]">
                                                                    Comp {comp.competitor_index}:
                                                                </span>

                                                                <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                                                                    <span className={`font-semibold text-[#111827] dark:text-gray-100 whitespace-nowrap ${
                                                                        (comp.price_display && comp.price_display.length > 10) ? 'text-[12px]' : 'text-[14px]'
                                                                    }`}>
                                                                        {comp.price_display || (compPrice > 0 ? `Rs.${compPrice.toLocaleString()}` : '—')}
                                                                    </span>
                                                                    <span className="text-[10.5px] font-semibold text-[#4F46E5] dark:text-indigo-400 whitespace-nowrap">
                                                                        {comp.sold_7d != null ? `${comp.sold_7d} Wk Sold` : `${comp.total_sold || 0} Total`}
                                                                    </span>
                                                                    {compProfit !== null && (
                                                                        <span className={`text-[11px] font-bold whitespace-nowrap ${compProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                                                            {compProfit >= 0 ? '+' : ''}Rs.{compProfit.toFixed(0)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-2.5 bg-[#F9FAFB] dark:bg-zinc-800/40 rounded-lg border border-dashed border-[#E5E7EB] dark:border-zinc-700">
                                                    <span className="text-[11px] text-[#9CA3AF] font-medium">No Competitors Added</span>
                                                    <button
                                                        onClick={() => openCompetitorEditModal(item)}
                                                        className="mt-1 text-[11px] text-[#4F46E5] font-bold hover:underline flex items-center gap-1"
                                                    >
                                                        <Plus size={12} /> Add Competitor Links (1-4)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Pagination controls */}

            {!isLoading && filteredData.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 px-4 py-3 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sticky bottom-0 z-20">
                    <div className="text-sm text-gray-500">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Rows per page selector */}
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>Rows per page:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value))
                                    setCurrentPage(1)
                                }}
                                className="h-8 rounded-[8px] border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                            >
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={250}>250</option>
                                <option value={500}>500</option>
                                <option value={1000}>1000</option>
                                <option value={5000}>5000 (All)</option>
                            </select>
                        </div>

                        {/* Page navigation */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline" size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={16} />
                            </Button>
                            <span className="text-sm px-2 whitespace-nowrap">Page {currentPage} of {totalPages}</span>
                            <Button
                                variant="outline" size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Bulk Action Bar */}
            {selectedProductIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 p-3 flex flex-row items-center gap-4 transition-all animate-in slide-in-from-bottom-10 fade-in duration-300 w-max max-w-[95vw] overflow-x-auto hide-scrollbar">
                    <div className="flex items-center gap-2 px-3 border-r border-gray-200 dark:border-zinc-800">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-bold whitespace-nowrap">
                            {selectedProductIds.size}
                        </span>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Selected</span>
                    </div>

                    <div className="flex items-center gap-3 border-r border-gray-200 dark:border-zinc-800 pr-3 pl-1">
                        <select
                            value={targetPlatform}
                            onChange={(e) => {
                                const val = e.target.value as 'daraz' | 'website' | 'campaign';
                                setTargetPlatform(val);
                                setBulkMathAction('');
                                setCampaignMathAction('');
                            }}
                            className="h-[38px] text-[13px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer text-indigo-700 dark:text-indigo-400 shadow-sm"
                        >
                            <option value="daraz">Target: Daraz</option>
                            <option value="campaign">Target: Campaign</option>
                            <option value="website">Target: Website</option>
                        </select>
                    </div>

                    {targetPlatform === 'daraz' ? (
                        <>
                            <div className="flex items-center gap-3 border-r border-gray-200 dark:border-zinc-800 pr-3">
                                <div className="flex flex-col gap-1 pr-2">
                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={applyBulkOnlyIfEmpty}
                                            onChange={(e) => setApplyBulkOnlyIfEmpty(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 w-3.5 h-3.5 cursor-pointer"
                                        />
                                        Empty Daraz Price
                                    </label>

                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={applyBulkOnlyIfPurchase}
                                            onChange={(e) => setApplyBulkOnlyIfPurchase(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 w-3.5 h-3.5 cursor-pointer"
                                        />
                                        Purchase
                                    </label>

                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={applyBulkOnlyIfMrp}
                                            onChange={(e) => setApplyBulkOnlyIfMrp(e.target.checked)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 w-3.5 h-3.5 cursor-pointer"
                                        />
                                        MRP Price
                                    </label>
                                </div>

                                <select
                                    value={bulkMathAction}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setBulkMathAction(val);
                                        if (val) {
                                            handleBulkMath(val as any);
                                        }
                                    }}
                                    className="h-[38px] text-[13px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="">Apply Bulk Math...</option>
                                    <option value="increase">Increase Amount...</option>
                                    <option value="decrease">Decrease Amount...</option>
                                    <option value="regular">Set to Regular Price</option>
                                    <option value="mrp">Set to MRP Price</option>
                                    <option value="breakeven">Set to Breakeven</option>
                                    <option value="lowest_live">Set to Lowest Live Price</option>
                                    <option value="live_1">Set to Live Price 1</option>
                                    <option value="live_2">Set to Live Price 2</option>
                                    <option value="live_3">Set to Live Price 3</option>
                                    <option value="live_4">Set to Live Price 4</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pl-2 flex-none">
                                <button
                                    onClick={handleBulkSave}
                                    disabled={isBulkSaving}
                                    className="flex items-center gap-2 h-[38px] px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {isBulkSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    Save Prices
                                </button>

                                <button
                                    onClick={() => setBulkPushModalOpen(true)}
                                    disabled={isBulkPushing}
                                    className="flex items-center gap-2 h-[38px] px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {isBulkPushing ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Pushing {bulkPushProgress.current} / {bulkPushProgress.total}...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw size={16} />
                                            Push to Daraz
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : targetPlatform === 'campaign' ? (
                        <>
                            <div className="flex items-center gap-3 border-r border-gray-200 dark:border-zinc-800 pr-3">
                                <div className="flex flex-col gap-1 pr-2">
                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={applyBulkOnlyIfEmpty}
                                            onChange={(e) => setApplyBulkOnlyIfEmpty(e.target.checked)}
                                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-600 w-3.5 h-3.5 cursor-pointer"
                                        />
                                        Empty Daraz Price
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={applyBulkOnlyIfPurchase}
                                            onChange={(e) => setApplyBulkOnlyIfPurchase(e.target.checked)}
                                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-600 w-3.5 h-3.5 cursor-pointer"
                                        />
                                        Purchase
                                    </label>
                                </div>

                                <select
                                    value={campaignMathAction}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setCampaignMathAction(val);
                                        if (val) {
                                            handleCampaignBulkMath(val as any);
                                        }
                                    }}
                                    className="h-[38px] text-[13px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 font-medium outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                                >
                                    <option value="">Apply Campaign Math...</option>
                                    <option value="discount_pct">Discount by % from Daraz</option>
                                    <option value="discount_amt">Discount by Amount from Daraz</option>
                                    <option value="breakeven_pct">Breakeven + %</option>
                                    <option value="breakeven_amt">Breakeven + Amount</option>
                                    <option value="regular">Set to Regular Price</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pl-2">
                                <button
                                    onClick={handleCampaignBulkSave}
                                    disabled={isBulkSaving}
                                    className="flex items-center gap-2 h-[38px] px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-50 shadow-sm"
                                >
                                    {isBulkSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    Save Price
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 border-r border-gray-200 dark:border-zinc-800 pr-3">
                                <select
                                    value={websiteDiscountType}
                                    onChange={(e) => setWebsiteDiscountType(e.target.value as any)}
                                    className="h-[38px] text-[13px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 font-medium outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                                >
                                    <option value="daraz_price">Set to Daraz Price (No Discount)</option>
                                    <option value="daraz_campaign">Set to Daraz Campaign</option>
                                    <option value="amount">Discount by Amount (Rs)</option>
                                    <option value="percent">Discount by Percentage (%)</option>
                                </select>

                                {(websiteDiscountType === 'amount' || websiteDiscountType === 'percent') && (
                                    <input
                                        type="number"
                                        placeholder={websiteDiscountType === 'amount' ? 'Rs (e.g. 50)' : '% (e.g. 5)'}
                                        value={websiteDiscountValue}
                                        onChange={(e) => setWebsiteDiscountValue(e.target.value)}
                                        className="h-[38px] w-28 text-[13px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 font-medium outline-none focus:ring-2 focus:ring-teal-500/20"
                                    />
                                )}
                            </div>

                            <div className="flex items-center gap-2 pl-2">
                                <button
                                    onClick={handleWebsiteBulkPush}
                                    disabled={isWebsitePushing}
                                    className="flex items-center gap-2 h-[38px] px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[13px] font-semibold transition-colors disabled:opacity-50"
                                >
                                    {isWebsitePushing ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Pushing...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={16} />
                                            Push to Website
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    <button
                        onClick={() => {
                            setSelectedProductIds(new Set());
                            setBulkMathAction('');
                            setCampaignMathAction('');
                        }}
                        className="p-2 ml-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors flex-none"
                    >
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>
            )}

            {/* Stock Management Modal */}
            {stockModalProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-lg bg-white dark:bg-zinc-900 shadow-2xl border-none">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <AlertTriangle className="text-amber-500" size={24} />
                                        Stock Management
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stockModalProduct.product_name}</p>
                                </div>
                                <button onClick={() => setStockModalProduct(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                {(() => {
                                    const uniqueEntries = Object.entries(stockModalProduct.live_prices || {})
                                        .filter(([key]) => !key.includes('_slot_'))

                                    if (uniqueEntries.length === 0) {
                                        return (
                                            <div className="text-center py-8 text-gray-500 italic bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-dashed border-gray-200 dark:border-zinc-700">
                                                No live SKUs found for this product. Sync live prices first.
                                            </div>
                                        )
                                    }

                                    return uniqueEntries.map(([sku, lp]) => {
                                        return (
                                            <div key={sku} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-100 dark:border-zinc-800 group hover:border-blue-200 dark:hover:border-blue-900 transition-colors">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                            {lp.store_name}
                                                        </span>
                                                        <span className="text-xs font-mono text-gray-400 truncate" title={sku}>{sku}</span>
                                                    </div>
                                                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        Current: <span className={lp.quantity === 0 ? "text-red-500" : "text-green-600"}>{lp.quantity || 0}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={stockEdits[sku] ?? (lp.quantity || 0)}
                                                        onChange={(e) => setStockEdits(prev => ({ ...prev, [sku]: parseInt(e.target.value) || 0 }))}
                                                        className="w-20 px-3 py-2 text-right bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                })()}
                            </div>

                            <div className="mt-8 flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => handleUpdateStock(true)}
                                        disabled={isUpdatingStock || Object.keys(stockModalProduct.live_prices || {}).length === 0}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                                    >
                                        {isUpdatingStock ? <Loader2 size={18} className="animate-spin" /> : "Out of Stock (Zero All)"}
                                    </Button>
                                    <Button
                                        onClick={() => handleUpdateStock(false)}
                                        disabled={isUpdatingStock || Object.keys(stockModalProduct.live_prices || {}).length === 0}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                                    >
                                        {isUpdatingStock ? <Loader2 size={18} className="animate-spin" /> : "Apply Stock"}
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => setStockModalProduct(null)}
                                    className="w-full border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Push single product selection modal */}
            {pushSelectProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl border-none rounded-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <UploadCloud className="text-green-500" size={22} />
                                    Push Price to Daraz
                                </h2>
                                <button onClick={() => setPushSelectProduct(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="mb-4 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">
                                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate mb-1">
                                    {pushSelectProduct.product_name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Price to push: <span className="font-bold text-blue-600 dark:text-blue-400">Rs. {pushSelectProduct.market_price?.toLocaleString() || '-'}</span>
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Select Store Account:
                                </div>

                                {/* All Accounts Option */}
                                <button
                                    onClick={() => {
                                        setPushSelectProduct(null)
                                        handlePushPrice(pushSelectProduct.product_id, pushSelectProduct.product_name)
                                    }}
                                    className="w-full text-left px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-xl font-semibold text-sm transition-colors border border-indigo-100 dark:border-indigo-900 flex items-center justify-between shadow-sm"
                                >
                                    <span>All Accounts</span>
                                    <span className="text-xs bg-indigo-200 dark:bg-indigo-900 px-2 py-0.5 rounded-full">Default</span>
                                </button>

                                {/* Stores with Live Price */}
                                {(() => {
                                    const stores = getStoresWithLivePrice(pushSelectProduct);
                                    if (stores.length === 0) {
                                        return (
                                            <div className="text-xs text-gray-400 dark:text-gray-500 italic p-3 text-center bg-gray-50 dark:bg-zinc-800/20 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
                                                No accounts with live prices found. You can still push to All Accounts.
                                            </div>
                                        )
                                    }
                                    return stores.map(store => (
                                        <button
                                            key={store.store_id}
                                            onClick={() => {
                                                setPushSelectProduct(null)
                                                handlePushPrice(pushSelectProduct.product_id, pushSelectProduct.product_name, [store.store_id])
                                            }}
                                            className="w-full text-left px-4 py-3 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm transition-colors border border-gray-200 dark:border-zinc-700 flex items-center justify-between group shadow-sm"
                                        >
                                            <span className="font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">{store.store_name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                Live: Rs. {(store.special_price || store.price).toLocaleString()}
                                            </span>
                                        </button>
                                    ))
                                })()}
                            </div>

                            <div className="mt-6 flex justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setPushSelectProduct(null)}
                                    className="border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Bulk push selection modal */}
            {bulkPushModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl border-none rounded-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <UploadCloud className="text-green-500" size={22} />
                                    Bulk Push to Daraz
                                </h2>
                                <button onClick={() => setBulkPushModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            {(() => {
                                const selected = data.filter(d => selectedProductIds.has(d.product_id) && (d.market_price ?? 0) > 0);
                                const totalSelected = selected.length;

                                if (totalSelected === 0) {
                                    return (
                                        <div className="text-center py-6 text-red-500 font-semibold text-sm">
                                            No valid items selected (make sure Daraz Price is set).
                                        </div>
                                    )
                                }

                                const stores = getBulkStoresWithLivePrice(selected);

                                return (
                                    <>
                                        <div className="mb-4 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 text-sm text-gray-600 dark:text-gray-400">
                                            You are pushing prices for <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalSelected}</span> selected product(s).
                                        </div>

                                        <div className="space-y-2 mt-4">
                                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                Select Store Account to push to:
                                            </div>

                                            {/* All Accounts Option */}
                                            <button
                                                onClick={() => {
                                                    setBulkPushModalOpen(false)
                                                    handleBulkPush()
                                                }}
                                                className="w-full text-left px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-xl font-semibold text-sm transition-colors border border-indigo-100 dark:border-indigo-900 flex items-center justify-between shadow-sm"
                                            >
                                                <span>All Accounts</span>
                                                <span className="text-xs bg-indigo-200 dark:bg-indigo-900 px-2 py-0.5 rounded-full">Default</span>
                                            </button>

                                            {/* Stores with Live Price */}
                                            {stores.length === 0 ? (
                                                <div className="text-xs text-gray-400 dark:text-gray-500 italic p-3 text-center bg-gray-50 dark:bg-zinc-800/20 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
                                                    No accounts with live prices found for selected products. You can still push to All Accounts.
                                                </div>
                                            ) : (
                                                stores.map(store => (
                                                    <button
                                                        key={store.store_id}
                                                        onClick={() => {
                                                            setBulkPushModalOpen(false)
                                                            handleBulkPush([store.store_id])
                                                        }}
                                                        className="w-full text-left px-4 py-3 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm transition-colors border border-gray-200 dark:border-zinc-700 flex items-center justify-between group shadow-sm"
                                                    >
                                                        <span className="font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">{store.store_name}</span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                            {store.count} / {totalSelected} products live
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )
                            })()}

                            <div className="mt-6 flex justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setBulkPushModalOpen(false)}
                                    className="border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Modal 1: Edit Competitor Links Popup */}
            {editCompetitorProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-xl bg-white dark:bg-zinc-900 shadow-2xl border-none rounded-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b dark:border-zinc-800">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        🎯 Manage Competitor Links (1-4)
                                    </h2>
                                    <p className="text-xs text-gray-500 truncate max-w-md mt-0.5">
                                        {editCompetitorProduct.product_name}
                                    </p>
                                </div>
                                <button onClick={() => setEditCompetitorProduct(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {[0, 1, 2, 3].map(idx => (
                                    <div key={idx} className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                            <span>Competitor {idx + 1} Daraz URL</span>
                                            <span className="text-[10px] text-gray-400 font-normal">Pasting link extracts price & units sold automatically</span>
                                        </label>
                                        <input
                                            type="url"
                                            placeholder={`https://www.daraz.com.np/products/... (Competitor ${idx + 1})`}
                                            value={editCompetitorUrls[idx] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setEditCompetitorUrls(prev => {
                                                    const next = [...prev]
                                                    next[idx] = val
                                                    return next
                                                })
                                            }}
                                            className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-gray-800 dark:text-gray-200"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setEditCompetitorProduct(null)}
                                    disabled={isSavingCompetitors}
                                    className="border-gray-200 dark:border-zinc-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 text-xs h-10"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveCompetitors}
                                    disabled={isSavingCompetitors}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-10 px-5 flex items-center gap-2"
                                >
                                    {isSavingCompetitors ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    Save Competitor Links
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Modal 2: Competitor Analytics Popup */}
            {viewCompetitorProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-4xl bg-white dark:bg-zinc-900 shadow-2xl border-none rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b dark:border-zinc-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                {viewCompetitorProduct.image_url && (
                                    <img src={viewCompetitorProduct.image_url} alt="" className="w-12 h-12 object-cover rounded-xl border" />
                                )}
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                        Competitor Analytics & Sales Velocity
                                    </h2>
                                    <p className="text-xs text-gray-500 truncate max-w-xl">
                                        {viewCompetitorProduct.product_name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setViewCompetitorProduct(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            <div className="space-y-4">
                                {(viewCompetitorProduct.competitors || []).map((comp) => {
                                    const compPrice = comp.current_price || 0
                                    const commFactor = (viewCompetitorProduct.commission_percent !== null ? viewCompetitorProduct.commission_percent : 25) / 100
                                    const compProfit = compPrice > 0 && viewCompetitorProduct.purchasing_price > 0
                                        ? compPrice - (compPrice * commFactor) - viewCompetitorProduct.purchasing_price
                                        : null

                                    return (
                                        <div key={comp.id || comp.competitor_index} className="bg-gray-50 dark:bg-zinc-800/60 border dark:border-zinc-700 rounded-xl p-4 space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b dark:border-zinc-700 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                                                        Competitor {comp.competitor_index}
                                                    </span>
                                                    <a href={comp.competitor_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                                        View on Daraz <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                                <span className="text-xs text-gray-400 font-medium">
                                                    Added On: {comp.added_at ? new Date(comp.added_at).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>

                                            {/* Price Change Detected Banner if price was updated */}
                                            {comp.previous_price && comp.previous_price !== compPrice && comp.price_changed_at && (Math.abs(comp.previous_price - compPrice) / comp.previous_price < 0.20) && (
                                                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                                                    <div className="flex items-center gap-1.5 font-bold">
                                                        <span>🔔 Price Change Detected:</span>
                                                        <span>Changed from <span className="line-through opacity-70">Rs. {comp.previous_price.toLocaleString()}</span> to <span className="font-extrabold text-[#111827] dark:text-white">Rs. {compPrice.toLocaleString()}</span></span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${compPrice < comp.previous_price ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                            {compPrice < comp.previous_price ? '↓ Reduced by' : '↑ Increased by'} Rs. {Math.abs(compPrice - comp.previous_price).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] opacity-70">
                                                        {new Date(comp.price_changed_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )}

                                            {(() => {
                                                 const rawDisplay = comp.price_display || (compPrice > 0 ? `Rs. ${compPrice.toLocaleString()}` : '—')
                                                 const parsedPrices = rawDisplay.includes('/')
                                                     ? rawDisplay.split('/').map(s => parseFloat(s.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n) && n > 0)
                                                     : [compPrice].filter(n => n > 0)

                                                 const live1 = Object.values(viewCompetitorProduct.live_prices || {})[0]
                                                 const live1Price = live1 ? (live1.special_price || live1.price) : 0

                                                 if (parsedPrices.length > 1) {
                                                     return (
                                                         <div className="space-y-2">
                                                             <div className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center justify-between">
                                                                 <span>🏷️ Product Variations & Profit Breakdown ({parsedPrices.length} Variations):</span>
                                                                 <span className="text-[10px] text-gray-400 lowercase font-normal">
                                                                     {comp.total_sold ? `${comp.total_sold.toLocaleString()} total sold` : '0 sold'} • {comp.review_count || 0} reviews
                                                                 </span>
                                                             </div>
                                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                                 {parsedPrices.map((vPrice, vIdx) => {
                                                                     const vProfit = vPrice > 0 && viewCompetitorProduct.purchasing_price > 0
                                                                         ? vPrice - (vPrice * commFactor) - viewCompetitorProduct.purchasing_price
                                                                         : null
                                                                     const vDiff = vPrice > 0 && live1Price > 0 ? vPrice - live1Price : null

                                                                     return (
                                                                         <div key={vIdx} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border dark:border-zinc-800 flex items-center justify-between gap-2 shadow-sm">
                                                                             <div className="space-y-0.5">
                                                                                 <div className="text-[10px] font-bold text-gray-400 uppercase">
                                                                                     Var {vIdx + 1} Price
                                                                                 </div>
                                                                                 <div className="text-[14.5px] font-semibold text-[#111827] dark:text-gray-100">
                                                                                     Rs.{vPrice.toLocaleString()}
                                                                                 </div>
                                                                             </div>
                                                                             <div className="text-right space-y-0.5">
                                                                                 <div className="text-[10px] font-bold text-gray-400 uppercase">Calculated Profit</div>
                                                                                 <div className={`text-[11.5px] font-bold ${vProfit !== null && vProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                                                                     {vProfit !== null ? `${vProfit >= 0 ? '+' : ''}Rs.${vProfit.toFixed(2)}` : '—'}
                                                                                 </div>
                                                                             </div>
                                                                             <div className="text-right space-y-0.5 border-l border-gray-100 dark:border-zinc-800 pl-3">
                                                                                 <div className="text-[10px] font-bold text-gray-400 uppercase">vs Live 1</div>
                                                                                 <div className={`text-xs font-extrabold ${vDiff !== null && vDiff >= 0 ? 'text-amber-600' : 'text-[#16A34A]'}`}>
                                                                                     {vDiff !== null ? `${vDiff >= 0 ? '+' : ''}Rs.${vDiff}` : '—'}
                                                                                 </div>
                                                                             </div>
                                                                         </div>
                                                                     )
                                                                 })}
                                                             </div>
                                                         </div>
                                                     )
                                                 }

                                                 return (
                                                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                         <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border dark:border-zinc-800">
                                                             <div className="text-gray-400 font-bold text-[10px] uppercase">Live Price</div>
                                                             <div className="text-[14.5px] font-semibold text-[#111827] dark:text-gray-100">
                                                                 {rawDisplay}
                                                             </div>
                                                             {comp.previous_price && comp.previous_price !== compPrice && (
                                                                 <div className="text-[10px] text-gray-400">
                                                                     Was Rs.{comp.previous_price.toLocaleString()}
                                                                 </div>
                                                             )}
                                                         </div>

                                                         <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border dark:border-zinc-800">
                                                             <div className="text-gray-400 font-bold text-[10px] uppercase">Calculated Profit</div>
                                                             <div className={`text-[11.5px] font-bold ${compProfit !== null && compProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                                                                 {compProfit !== null ? `Rs.${compProfit.toFixed(2)}` : '—'}
                                                             </div>
                                                             <div className="text-[10px] text-gray-400">
                                                                 Purchasing Rs.{viewCompetitorProduct.purchasing_price}
                                                             </div>
                                                         </div>

                                                         <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border dark:border-zinc-800">
                                                             <div className="text-gray-400 font-bold text-[10px] uppercase">Total Units Sold</div>
                                                             <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                                                                 {comp.total_sold ? comp.total_sold.toLocaleString() : '0'} sold
                                                             </div>
                                                             <div className="text-[10px] text-gray-400">
                                                                 {comp.review_count || 0} reviews
                                                             </div>
                                                         </div>

                                                         <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border dark:border-zinc-800">
                                                             <div className="text-gray-400 font-bold text-[10px] uppercase">Price Diff vs Live 1</div>
                                                             {(() => {
                                                                 const diff = compPrice > 0 && live1Price > 0 ? compPrice - live1Price : null
                                                                 return (
                                                                     <div className={`text-base font-extrabold ${diff !== null && diff >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                         {diff !== null ? `${diff >= 0 ? '+' : ''}Rs. ${diff}` : '—'}
                                                                     </div>
                                                                 )
                                                             })()}
                                                             <div className="text-[10px] text-gray-400">Compared to your store</div>
                                                         </div>
                                                     </div>
                                                 )
                                             })()}

                                            <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border dark:border-zinc-800">
                                                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                                                    <TrendingUp size={14} className="text-indigo-600" />
                                                    Sales Velocity Breakdown (Units Sold):
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-md">
                                                        <div className="text-gray-400 text-[10px] font-bold">1 DAY</div>
                                                        <div className="font-extrabold text-indigo-700 dark:text-indigo-300">{comp.sold_1d || 0} units</div>
                                                    </div>
                                                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-md">
                                                        <div className="text-gray-400 text-[10px] font-bold">7 DAYS (WEEK)</div>
                                                        <div className="font-extrabold text-indigo-700 dark:text-indigo-300">{comp.sold_7d || 0} units</div>
                                                    </div>
                                                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-md">
                                                        <div className="text-gray-400 text-[10px] font-bold">30 DAYS (MONTH)</div>
                                                        <div className="font-extrabold text-indigo-700 dark:text-indigo-300">{comp.sold_30d || 0} units</div>
                                                    </div>
                                                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-md">
                                                        <div className="text-gray-400 text-[10px] font-bold">6 MONTHS</div>
                                                        <div className="font-extrabold text-indigo-700 dark:text-indigo-300">{comp.sold_180d || 0} units</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="p-4 border-t dark:border-zinc-800 flex justify-end">
                            <Button variant="outline" onClick={() => setViewCompetitorProduct(null)} className="text-xs h-9">
                                Close
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}
