'use client';

import { Menu, Plus } from 'lucide-react';
import { AddProductModal } from '@/features/inventory/components/AddProductModal';

interface MobileHeaderProps {
  pathname: string;
  isMobileMode: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  headerTitle: string | React.ReactNode | null;
  headerAction: React.ReactNode | null;
  isAddProductModalOpen: boolean;
  setIsAddProductModalOpen: (open: boolean) => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  pathname,
  isMobileMode,
  setIsMobileMenuOpen,
  headerTitle,
  headerAction,
  isAddProductModalOpen,
  setIsAddProductModalOpen
}) => {
  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/dashboard/sales/daraz':
        return 'E-commerce Sales & Orders';
      case '/dashboard/sales/daraz/sales-entry':
        return 'Order Entry';
      case '/dashboard/sales/daraz/update-status':
        return 'Update Order Status';
      case '/dashboard/sales/daraz/dashboard':
        return 'Order Summary';
      case '/dashboard/inventory/stock-adjustment':
        return 'Stock Adjustment';
      case '/dashboard/inventory/product-list':
        return 'Inventory List';
      case '/dashboard/inventory/damaged-stocks':
        return 'Damaged Goods';
      case '/dashboard/purchase':
        return 'Purchasing';
      case '/dashboard/purchase/purchase-entry':
        return 'Purchase Summary';
      case '/dashboard/purchase/all-purchase-list':
        return 'Purchase History';
      case '/dashboard/purchase/daily-purchase-list':
        return 'Daily Purchases';
      case '/dashboard/purchase/buy-sell-suppliers':
        return 'Vendor Trade Report';
      case '/dashboard/suppliers':
        return 'Supplier Management';
      case '/dashboard/suppliers/suppliers-transaction':
        return 'Supplier Transactions';
      case '/dashboard/suppliers/suppliers-account':
        return 'Supplier Ledger';
      case '/dashboard/sales/daraz/status-sync':
        return 'Order Status Sync';
      case '/dashboard/sales/daraz/order-sync':
        return 'Order Sync';
      case '/dashboard/profile':
        return 'My Profile';
      case '/dashboard/sales/daraz/profit-tracker':
        return 'Profit Tracker';
      case '/dashboard/mobile-uploads':
        return 'Field Data Entry';
      case '/dashboard/stock-analysis':
        return 'Stock Analysis';
      case '/dashboard/account':
        return 'Finance & Accounts';
      default:
        return 'BAGMATI TRADERS';
    }
  };

  const isProductListPage = pathname === '/dashboard/inventory/product-list';

  return (
    <div className={`md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-800 border-b z-30 flex items-center justify-between px-4 transition-all ${isMobileMode ? 'shadow-sm' : ''}`}>
      <div className="flex items-center gap-3 relative z-20">
        {!isMobileMode && (
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md"
          >
            <Menu size={24} />
          </button>
        )}
      </div>

      {/* Centered Titles */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        {headerTitle ? (
          typeof headerTitle === 'string' ? (
            <span className="font-bold text-lg whitespace-nowrap">{headerTitle}</span>
          ) : (
            headerTitle
          )
        ) : (
          <span className="font-bold text-lg text-black dark:text-white whitespace-nowrap">
            {getPageTitle(pathname)}
          </span>
        )}
      </div>

      {/* Portal Target for Page Actions */}
      <div id="mobile-header-actions" className="flex items-center gap-2 relative z-30" />

      <div id="navbar-actions" className="flex items-center gap-2 relative z-20">
        {isProductListPage && (
          <>
            <button
              onClick={() => setIsAddProductModalOpen(true)}
              className="p-1.5 bg-blue-600 text-white rounded-md shadow-sm"
            >
              <Plus size={18} />
            </button>
            <AddProductModal
              isOpen={isAddProductModalOpen}
              onClose={() => setIsAddProductModalOpen(false)}
            />
          </>
        )}
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2 relative z-20">
        {headerAction}
      </div>
    </div>
  );
};

export default MobileHeader;