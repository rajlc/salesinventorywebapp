import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/lib/providers/ReactQueryProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import CapacitorAppListener from "@/components/CapacitorAppListener";

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
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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

