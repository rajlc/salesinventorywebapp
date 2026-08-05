'use client'

import { useState, useEffect } from 'react'
import { Smartphone, RotateCw, Monitor, X } from 'lucide-react'

export default function MobileLandscapePrompt() {
    const [showPrompt, setShowPrompt] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const checkMobileAndOrientation = () => {
            // Basic mobile check (width < 768px)
            const isMobile = window.innerWidth < 768
            // Check if user is in portrait mode
            const isPortrait = window.matchMedia("(orientation: portrait)").matches

            // Only show if mobile and in portrait
            if (isMobile && isPortrait) {
                // Check if we haven't already asked in this session (optional, but good UX)
                // For now, per requirement "when user open this page" -> showing it every time is safer to match requirement
                setShowPrompt(true)
            } else {
                setShowPrompt(false)
            }
        }

        checkMobileAndOrientation()

        const handleResize = () => {
            checkMobileAndOrientation()
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const handleYes = async () => {
        try {
            const element = document.documentElement

            // Request full screen
            if (element.requestFullscreen) {
                await element.requestFullscreen()
            } else if ((element as any).webkitRequestFullscreen) {
                await (element as any).webkitRequestFullscreen()
            } else if ((element as any).msRequestFullscreen) {
                await (element as any).msRequestFullscreen()
            }

            // Request orientation lock
            // Note: This often works only on Android Chrome and requires Fullscreen
            if (screen.orientation && (screen.orientation as any).lock) {
                await (screen.orientation as any).lock('landscape')
            }
        } catch (err) {
            console.error("Failed to force landscape:", err)
            // If automatic lock fails (e.g. iOS), user naturally sees they need to rotate 
            // because they are in fullscreen or they just agreed to "Landscape View".
        }
        setShowPrompt(false)
    }

    const handleNo = () => {
        setShowPrompt(false)
    }

    if (!mounted || !showPrompt) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                <div className="p-6 flex flex-col items-center text-center space-y-4">
                    <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <RotateCw size={32} className="animate-pulse" />
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            Landscape View?
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            The POS experience is much better in landscape mode. Would you like to switch?
                        </p>
                    </div>

                    <div className="flex flex-col w-full gap-2 pt-2">
                        <button
                            onClick={handleYes}
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                        >
                            <Monitor size={18} />
                            Yes, Switch View
                        </button>
                        <button
                            onClick={handleNo}
                            className="w-full py-2.5 px-4 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            No, Keep Portrait
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
