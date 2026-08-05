'use client'

import { useState, useEffect } from 'react'
import {
    Card,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui-shim'
import { Plus, Eye, FileText, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { 
    getDarazOrderReports, 
    createDarazOrderReport, 
    getDarazOrderReportDetails, 
    deleteDarazOrderReport,
    DarazOrderReport as DarazOrderReportType
} from '@/features/sales/actions/daraz-report-actions'
import { toast } from 'sonner'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

export function DarazOrderReport() {
    const [reports, setReports] = useState<DarazOrderReportType[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [selectedReport, setSelectedReport] = useState<DarazOrderReportType | null>(null)
    const [reportDetails, setReportDetails] = useState<any[]>([])
    const [isDetailsLoading, setIsDetailsLoading] = useState(false)

    // Form state
    const [reportName, setReportName] = useState('')
    const [orderNumber, setOrderNumber] = useState('')
    const [uploadedOrders, setUploadedOrders] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchReports()
    }, [])

    const fetchReports = async () => {
        setIsLoading(true)
        try {
            const data = await getDarazOrderReports()
            setReports(data)
        } catch (error) {
            toast.error('Failed to fetch reports')
        } finally {
            setIsLoading(false)
        }
    }

    const handleViewDetails = async (report: DarazOrderReportType) => {
        setSelectedReport(report)
        setIsDetailModalOpen(true)
        setIsDetailsLoading(true)
        try {
            const details = await getDarazOrderReportDetails(report.id)
            setReportDetails(details)
        } catch (error) {
            toast.error('Failed to fetch report details')
        } finally {
            setIsDetailsLoading(false)
        }
    }

    const handleDeleteReport = async (id: string) => {
        if (!confirm('Are you sure you want to delete this report?')) return
        try {
            await deleteDarazOrderReport(id)
            toast.success('Report deleted')
            fetchReports()
        } catch (error) {
            toast.error('Failed to delete report')
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target?.result
            if (!content) return

            let orders: string[] = []

            if (file.name.endsWith('.csv')) {
                Papa.parse(content as string, {
                    header: true,
                    complete: (results) => {
                        orders = results.data
                            .map((row: any) => row['Order Number']?.toString().trim())
                            .filter(Boolean)
                        setUploadedOrders(orders)
                        if (orders.length > 0) {
                            setOrderNumber('') // Clear manual input
                            toast.success(`Found ${orders.length} orders in CSV`)
                        } else {
                            toast.error('No "Order Number" column found or file is empty')
                        }
                    }
                })
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                const workbook = XLSX.read(content, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const data = XLSX.utils.sheet_to_json(worksheet)
                orders = data
                    .map((row: any) => row['Order Number']?.toString().trim())
                    .filter(Boolean)
                setUploadedOrders(orders)
                if (orders.length > 0) {
                    setOrderNumber('') // Clear manual input
                    toast.success(`Found ${orders.length} orders in Excel`)
                } else {
                    toast.error('No "Order Number" column found or file is empty')
                }
            }
        }

        if (file.name.endsWith('.csv')) {
            reader.readAsText(file)
        } else {
            reader.readAsBinaryString(file)
        }
    }

    const handleSaveReport = async () => {
        if (!reportName.trim()) {
            toast.error('Please enter a report name')
            return
        }

        const orders = orderNumber.trim() ? [orderNumber.trim()] : uploadedOrders
        if (orders.length === 0) {
            toast.error('Please enter an order number or upload a file')
            return
        }

        setIsSaving(true)
        try {
            await createDarazOrderReport(reportName, orders)
            toast.success('Report created successfully')
            setIsCreateModalOpen(false)
            setReportName('')
            setOrderNumber('')
            setUploadedOrders([])
            fetchReports()
        } catch (error: any) {
            toast.error(error.message || 'Failed to create report')
        } finally {
            setIsSaving(false)
        }
    }

    const totalPurchaseCost = reportDetails.reduce((sum, item) => sum + (item.total_cost || 0), 0)

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daraz Order Reports</h1>
                    <p className="text-sm text-gray-500">Manage and view order reports for Daraz sales</p>
                </div>
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add Order
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Order Report</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label htmlFor="reportName" className="text-sm font-medium">Report Name</label>
                                <input
                                    id="reportName"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    className="h-10 px-3 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                    placeholder="e.g. June Sales Report"
                                />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="orderNumber" className="text-sm font-medium">Order Number</label>
                                <input
                                    id="orderNumber"
                                    value={orderNumber}
                                    onChange={(e) => {
                                        setOrderNumber(e.target.value)
                                        if (e.target.value) setUploadedOrders([]) // Clear upload if manual input
                                    }}
                                    disabled={uploadedOrders.length > 0}
                                    className="h-10 px-3 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
                                    placeholder="Enter single order number"
                                />
                                {uploadedOrders.length > 0 && (
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Manual input disabled because a file is uploaded
                                    </p>
                                )}
                            </div>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-gray-300 dark:border-zinc-700"></span>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white dark:bg-zinc-900 px-2 text-gray-500">Or Upload File</span>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Upload CSV/Excel</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileUpload}
                                        disabled={!!orderNumber}
                                        className="hidden"
                                        id="fileUpload"
                                    />
                                    <label
                                        htmlFor="fileUpload"
                                        className={`flex-1 flex items-center justify-center gap-2 h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                                            orderNumber 
                                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                                            : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                                        }`}
                                    >
                                        <Upload className="h-6 w-6 text-gray-400" />
                                        <span className="text-sm text-gray-500">
                                            {uploadedOrders.length > 0 
                                                ? `${uploadedOrders.length} orders found` 
                                                : 'Click to upload CSV or Excel'}
                                        </span>
                                    </label>
                                </div>
                                {orderNumber && (
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        File upload disabled because order number is entered
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveReport} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Report
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900">
                <Table>
                    <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                        <TableRow>
                            <TableHead>Report Name</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-center">Order Count</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-48 text-center text-gray-500">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                    Loading reports...
                                </TableCell>
                            </TableRow>
                        ) : reports.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                                    No reports found. Add your first order report!
                                </TableCell>
                            </TableRow>
                        ) : (
                            reports.map((report) => (
                                <TableRow key={report.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                    <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-blue-500" />
                                            {report.report_name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-gray-500">
                                        {format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                            {report.order_count}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-8 flex items-center gap-1"
                                                onClick={() => handleViewDetails(report)}
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                View
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDeleteReport(report.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Details Modal */}
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Report Details: {selectedReport?.report_name}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-12">S.N</TableHead>
                                    <TableHead>Order Number</TableHead>
                                    <TableHead>Product Name</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Purchase Cost</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isDetailsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-48 text-center text-gray-500">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                            Fetching order details...
                                        </TableCell>
                                    </TableRow>
                                ) : reportDetails.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                                            No order details found for the provided order numbers.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    reportDetails.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="text-gray-500">{index + 1}</TableCell>
                                            <TableCell className="font-mono text-sm">{item.order_number}</TableCell>
                                            <TableCell className="text-sm">{item.product_name || 'N/A'}</TableCell>
                                            <TableCell className="text-center">{item.quantity || 0}</TableCell>
                                            <TableCell className="text-right">Rs. {item.purchase_cost?.toLocaleString() || '0'}</TableCell>
                                            <TableCell className="text-right font-medium">Rs. {item.total_cost?.toLocaleString() || '0'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="pt-4 border-t flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                            Total {reportDetails.length} items
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            Total Purchase Cost: <span className="text-blue-600">Rs. {totalPurchaseCost.toLocaleString()}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
