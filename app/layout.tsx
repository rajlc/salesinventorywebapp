import type { Metadata } from "next";
import { Inter, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/lib/providers/ReactQueryProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import CapacitorAppListener from "@/components/CapacitorAppListener";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
    display: "swap",
});

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Bagmati Traders ERP",
    description: "Next Gen Inventory System",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head suppressHydrationWarning>
                {/* Prevent dark-mode flash of unstyled content (FOUC) before hydration */}
                <script
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}`,
                    }}
                />
            </head>
            <body
                className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
                suppressHydrationWarning
            >
                <ThemeProvider>
                    <ReactQueryProvider>
                        <ToastProvider>
                            <CapacitorAppListener />
                            <main id="app-content" className="min-h-screen bg-background text-foreground">
                                {children}
                            </main>
                        </ToastProvider>
                    </ReactQueryProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
