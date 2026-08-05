import type { NextConfig } from "next";
// @ts-ignore - next-pwa doesn't have types
import withPWA from 'next-pwa';

const allowedOrigins: string[] = [
  "localhost:3000",
  "localhost:3001",
  "localhost:3002",
  "daraz.bagmati.shop",
  "bagmati.shop",
];

const addOrigin = (originStr: string | undefined) => {
  if (!originStr) return;
  const trimmed = originStr.trim();
  if (!trimmed) return;
  
  try {
    const urlStr = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const url = new URL(urlStr);
    if (url.host && !allowedOrigins.includes(url.host)) {
      allowedOrigins.push(url.host);
    }
  } catch (e) {
    const cleaned = trimmed.replace(/^https?:\/\//, '').split('/')[0];
    if (cleaned && !allowedOrigins.includes(cleaned)) {
      allowedOrigins.push(cleaned);
    }
  }
};

// Add origins from environment variables
addOrigin(process.env.NEXT_PUBLIC_APP_URL);
addOrigin(process.env.NEXT_PUBLIC_MESSENGER_APP_URL);
addOrigin(process.env.VERCEL_URL);

// Support a comma-separated list of allowed origins from env for dynamic Vercel configurations
if (process.env.NEXT_PUBLIC_ALLOWED_ORIGINS) {
  process.env.NEXT_PUBLIC_ALLOWED_ORIGINS.split(',').forEach(origin => {
    addOrigin(origin);
  });
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins,
    },
    optimizePackageImports: [
      'lucide-react', 
      'date-fns', 
      'lodash', 
      '@radix-ui/react-dialog', 
      'recharts',
      'react-select',
      'zod',
      'axios',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'react-hook-form',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'sonner',
      'xlsx',
      'papaparse',
      'fast-levenshtein',
      'nepali-date-converter',
      'crypto-js',
      'react-barcode',
      '@zxing/library',
      '@zxing/browser'
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static-01.daraz.com.np',
      },
      {
        protocol: 'https',
        hostname: '*.daraz.com.np',
      },
      {
        protocol: 'https',
        hostname: 'u-d-s.r.worldssl.net', // Common generic placeholder sometimes used
      },
      {
        protocol: 'https',
        hostname: 'img.alicdn.com',
      },
      {
        protocol: 'https',
        hostname: 'img.drz.lazcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'lzd-img-global.slatic.net',
      },
      {
        protocol: 'https',
        hostname: 'np-live-21.slatic.net',
      },
      {
        protocol: 'https',
        hostname: '*.slatic.net',
      },
      {
        protocol: 'https',
        hostname: 'shblzjrzulnrsarfxptv.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.sybazzar.com',
      },
      {
        protocol: 'https',
        hostname: 'qualitycomputer.com.np',
      },
      {
        protocol: 'https',
        hostname: 'www.wishluck.in',
      },
      {
        protocol: 'https',
        hostname: '*.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  // Add empty turbopack config to silence Turbopack warning
  // This allows next-pwa's webpack config to work properly
  turbopack: {},
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  sw: 'sw.js',
  scope: '/',
});

export default pwaConfig(nextConfig);

