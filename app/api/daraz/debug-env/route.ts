import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        appKey: process.env.NEXT_PUBLIC_DARAZ_APP_KEY,
        appKeyLength: process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.length,
        hasSecret: !!process.env.DARAZ_APP_SECRET,
        secretLength: process.env.DARAZ_APP_SECRET?.length,
        hasEcommerceUrl: !!process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL,
        ecommerceUrlLength: process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_URL?.length,
        hasEcommerceServiceKey: !!process.env.ECOMMERCE_SUPABASE_SERVICE_ROLE_KEY,
        hasEcommerceAnonKey: !!process.env.NEXT_PUBLIC_ECOMMERCE_SUPABASE_ANON_KEY,
        detectedKeys: Object.keys(process.env).filter(k => k.includes('ECOMMERCE') || k.includes('SUPABASE'))
    });
}
