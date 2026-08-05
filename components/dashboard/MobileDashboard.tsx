"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMobileMode } from "@/context/MobileModeContext"
import { useState, useRef } from "react"
import {
    LayoutDashboard,
    ShoppingCart,
    RefreshCcw,
    Truck,
    Wallet,
    Users,
    FileText,
    AlertTriangle,
    Sliders,
    Package,
    FilePlus,
    TrendingUp,
    Store,
    User,
    ArrowLeftRight,
    Camera,
    ClipboardList,
    Briefcase,
    BookOpen,
    BarChart2
} from "lucide-react"

export function MobileDashboard() {
    const { setMobileMode } = useMobileMode()
    const searchParams = useSearchParams()
    const router = useRouter()
    const view = searchParams.get('view')

    // Swipe handlers using refs to avoid re-renders
    const touchStartX = useRef(0)
    const touchEndX = useRef(0)

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX
    }

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return

        const distance = touchStartX.current - touchEndX.current
        const isLeftSwipe = distance > 50
        const isRightSwipe = distance < -50

        if (isLeftSwipe && view !== 'more') {
            // Swipe Left -> Go to More
            router.push('/dashboard?view=more')
        }

        if (isRightSwipe && view === 'more') {
            // Swipe Right -> Go to Home
            router.push('/dashboard')
        }

        // Reset
        touchStartX.current = 0
        touchEndX.current = 0
    }

    const homeItems = [
        {
            title: "Daily Purchase List",
            href: "/dashboard/purchase/daily-purchase-list",
            icon: <ClipboardList className="h-8 w-8 text-blue-600" />,
            color: "bg-blue-50"
        },
        {
            title: "Suppliers",
            href: "/dashboard/suppliers",
            icon: <Users className="h-8 w-8 text-green-600" />,
            color: "bg-green-50"
        },
        {
            title: "Order Status Sync",
            href: "/dashboard/sales/daraz/status-sync",
            icon: <RefreshCcw className="h-8 w-8 text-purple-600" />,
            color: "bg-purple-50"
        },
        {
            title: "E-commerce Sales",
            href: "/dashboard/sales/daraz",
            icon: <ShoppingCart className="h-8 w-8 text-orange-600" />,
            color: "bg-orange-50"
        },
        {
            title: "Order Sync",
            href: "/dashboard/sales/daraz/order-sync",
            icon: <ArrowLeftRight className="h-8 w-8 text-cyan-600" />,
            color: "bg-cyan-50"
        },

        {
            title: "Mobile Capture",
            href: "/mobile/quick-capture",
            icon: <Camera className="h-8 w-8 text-red-600" />,
            color: "bg-red-50"
        },
        {
            title: "Store Sales",
            href: "/dashboard/sales/store-sales",
            icon: <TrendingUp className="h-8 w-8 text-indigo-600" />,
            color: "bg-indigo-50"
        }
    ]

    const moreItems = [
        {
            title: "Buy/Sell Suppliers",
            href: "/dashboard/purchase/buy-sell-suppliers",
            icon: <Briefcase className="h-8 w-8 text-blue-600" />,
            color: "bg-blue-50"
        },
        {
            title: "Stock Ledger",
            href: "/dashboard/inventory/stock-ledger",
            icon: <BookOpen className="h-8 w-8 text-gray-600" />,
            color: "bg-gray-50"
        },
        {
            title: "Vat Billing",
            href: "/dashboard/account/pan-vat-billing",
            icon: <FileText className="h-8 w-8 text-amber-600" />,
            color: "bg-amber-50"
        },
        {
            title: "Damage Stock",
            href: "/dashboard/inventory/damaged-stocks",
            icon: <AlertTriangle className="h-8 w-8 text-red-600" />,
            color: "bg-red-50"
        },
        {
            title: "Product List",
            href: "/dashboard/inventory/product-list",
            icon: <Package className="h-8 w-8 text-purple-600" />,
            color: "bg-purple-50"
        },
        {
            title: "Stock Adjustment",
            href: "/dashboard/inventory/stock-adjustment",
            icon: <Sliders className="h-8 w-8 text-yellow-600" />,
            color: "bg-yellow-50"
        },
        {
            title: "Profit Tracker",
            href: "/dashboard/sales/daraz/profit-tracker",
            icon: <BarChart2 className="h-8 w-8 text-green-600" />,
            color: "bg-green-50"
        },
        {
            title: "My Profile",
            href: "/dashboard/profile",
            icon: <User className="h-8 w-8 text-gray-600" />,
            color: "bg-gray-50"
        }
    ]

    const items = view === 'more' ? moreItems : homeItems

    return (
        <div
            className="w-full min-h-[50vh]"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Grid Content */}
            <div className="grid grid-cols-2 gap-3 pb-24">
                {items.map((item, index) => (
                    <Link
                        key={index}
                        href={item.href}
                        className="relative group rounded-xl overflow-hidden aspect-[4/3]"
                    >
                        {/* Rotating Border Background */}
                        <div className="absolute inset-0 bg-transparent z-0">
                            <div className="absolute inset-[-50%] animate-[spin_3s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity duration-300 md:group-hover:opacity-100
                                bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)]
                                dark:bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)]"
                            />
                        </div>

                        {/* Static Border Container */}
                        <div className="absolute inset-[1px] rounded-xl bg-white dark:bg-white z-10 flex flex-col items-center justify-center p-2 border border-black dark:border-white group-hover:border-transparent dark:group-hover:border-transparent transition-colors">
                            <div className={`p-2 rounded-full mb-2 ${item.color} dark:bg-white relative z-20`}>
                                {item.icon}
                            </div>
                            <span className="text-xs font-bold text-center text-gray-800 dark:text-gray-900 leading-tight relative z-20 uppercase tracking-tight">
                                {item.title}
                            </span>
                        </div>

                        {/* "3D" Glow Effect Overlay */}
                        <div className="absolute inset-0 rounded-xl ring-1 ring-black/5 dark:ring-white/10 z-20 pointer-events-none group-hover:ring-transparent" />
                    </Link>
                ))}
            </div>
        </div>
    )
}
