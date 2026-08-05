export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 p-4">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl text-blue-600">
                    Bagmati Traders
                </h1>
                <p className="text-muted-foreground">Inventory & ERP System</p>
            </div>
            {children}
        </div>
    )
}
