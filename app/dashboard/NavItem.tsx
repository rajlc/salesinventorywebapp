'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isCollapsed: boolean;
  subItems?: { label: string; href: string; icon?: React.ReactNode }[];
  onMobileItemClick?: () => void;
}

export const NavItem = ({
  href,
  icon,
  children,
  isCollapsed,
  subItems,
  onMobileItemClick
}: NavItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Helper to check if a specific link is active, considering query params if present
  const isLinkActive = (targetHref: string) => {
    if (targetHref.includes('?')) {
      const [path, query] = targetHref.split('?');
      if (pathname !== path) return false;
      const params = new URLSearchParams(query);
      for (const [key, val] of params.entries()) {
        if (searchParams.get(key) !== val) return false;
      }
      return true;
    }
    return pathname === targetHref || pathname.startsWith(targetHref + '/');
  };

  const isActive = isLinkActive(href) || (subItems && subItems.some(item => isLinkActive(item.href)));

  // Auto-expand if active or one of sub-items is active
  useEffect(() => {
    if (isActive && !isCollapsed && subItems) {
      setIsOpen(true);
    }
  }, [isActive, isCollapsed, subItems]);

  if (subItems && !isCollapsed) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700/50'
            }`}
        >
          <div className="flex items-center gap-3">
            <span className="shrink-0">{icon}</span>
            <span>{children}</span>
          </div>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {isOpen && (
          <div className="pl-10 space-y-1">
            {subItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileItemClick}
                className={`block px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${isLinkActive(item.href)
                  ? 'bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-white font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                  }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={href}
      onClick={onMobileItemClick}
      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700/50'
        } ${isCollapsed ? 'justify-center' : ''}`}
      title={isCollapsed ? String(children) : undefined}
    >
      <span className="shrink-0">{icon}</span>
      {!isCollapsed && children}
    </Link>
  )
};