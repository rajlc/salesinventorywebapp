'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isCollapsed: boolean;
  subItems?: { label: string; href: string; icon?: React.ReactNode }[];
  onMobileItemClick?: () => void;
}

const NavItemWithParams = ({
  href,
  icon,
  children,
  isCollapsed,
  subItems,
  onMobileItemClick
}: NavItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
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
          className={`w-full flex items-center justify-between px-2.5 py-2 text-[13px] rounded-lg transition-colors cursor-pointer ${isActive
            ? 'bg-slate-100 text-slate-950 dark:bg-zinc-800 dark:text-zinc-50 font-semibold'
            : 'text-slate-600 dark:text-zinc-400 font-medium hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
            }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`shrink-0 ${isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'}`}>{icon}</span>
            <span className="truncate">{children}</span>
          </div>
          {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
        </button>

        {isOpen && (
          <div className="pl-8 space-y-0.5 mt-0.5 border-l border-slate-200/70 dark:border-zinc-800 ml-4">
            {subItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onMouseEnter={() => router.prefetch(item.href)}
                onClick={onMobileItemClick}
                className={`px-2.5 py-1.5 text-[12.5px] rounded-md transition-colors flex items-center gap-2 ${isLinkActive(item.href)
                  ? 'bg-slate-100/80 text-slate-950 dark:bg-zinc-800 dark:text-white font-medium'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                  }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={() => router.prefetch(href)}
      onClick={onMobileItemClick}
      className={`flex items-center gap-2.5 px-2.5 py-2 text-[13px] rounded-lg transition-colors ${isActive
        ? 'bg-slate-100 text-slate-950 dark:bg-zinc-800 dark:text-zinc-50 font-semibold'
        : 'text-slate-600 dark:text-zinc-400 font-medium hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
        } ${isCollapsed ? 'justify-center px-2' : ''}`}
      title={isCollapsed ? String(children) : undefined}
    >
      <span className={`shrink-0 ${isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'}`}>{icon}</span>
      {!isCollapsed && <span className="truncate">{children}</span>}
    </Link>
  );
};

const NavItemStandard = ({
  href,
  icon,
  children,
  isCollapsed,
  subItems,
  onMobileItemClick
}: NavItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isLinkActive = (targetHref: string) => {
    const basePath = targetHref.split('?')[0];
    if (basePath === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === basePath || pathname.startsWith(basePath + '/');
  };

  const isActive = isLinkActive(href) || (subItems && subItems.some(item => isLinkActive(item.href)));

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
          className={`w-full flex items-center justify-between px-2.5 py-2 text-[13px] rounded-lg transition-colors cursor-pointer ${isActive
            ? 'bg-slate-100 text-slate-950 dark:bg-zinc-800 dark:text-zinc-50 font-semibold'
            : 'text-slate-600 dark:text-zinc-400 font-medium hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
            }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`shrink-0 ${isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'}`}>{icon}</span>
            <span className="truncate">{children}</span>
          </div>
          {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
        </button>

        {isOpen && (
          <div className="pl-8 space-y-0.5 mt-0.5 border-l border-slate-200/70 dark:border-zinc-800 ml-4">
            {subItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onMouseEnter={() => router.prefetch(item.href)}
                onClick={onMobileItemClick}
                className={`px-2.5 py-1.5 text-[12.5px] rounded-md transition-colors flex items-center gap-2 ${isLinkActive(item.href)
                  ? 'bg-slate-100/80 text-slate-950 dark:bg-zinc-800 dark:text-white font-medium'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                  }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={() => router.prefetch(href)}
      onClick={onMobileItemClick}
      className={`flex items-center gap-2.5 px-2.5 py-2 text-[13px] rounded-lg transition-colors ${isActive
        ? 'bg-slate-100 text-slate-950 dark:bg-zinc-800 dark:text-zinc-50 font-semibold'
        : 'text-slate-600 dark:text-zinc-400 font-medium hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
        } ${isCollapsed ? 'justify-center px-2' : ''}`}
      title={isCollapsed ? String(children) : undefined}
    >
      <span className={`shrink-0 ${isActive ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'}`}>{icon}</span>
      {!isCollapsed && <span className="truncate">{children}</span>}
    </Link>
  );
};

export const NavItem = (props: NavItemProps) => {
  const hasQueryParams = props.href.includes('?') || props.subItems?.some(item => item.href.includes('?'));

  if (!hasQueryParams) {
    return <NavItemStandard {...props} />;
  }

  return (
    <Suspense fallback={<NavItemStandard {...props} />}>
      <NavItemWithParams {...props} />
    </Suspense>
  );
};