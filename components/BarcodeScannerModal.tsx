'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

interface BarcodeScannerModalProps {
    isOpen: boolean
    onClose: () => void
    onScan: (barcode: string) => Promise<boolean> // Returns true if order found, false if not found
}

export function BarcodeScannerModal({ isOpen, onClose, onScan }: BarcodeScannerModalProps) {
    const [scanning, setScanning] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [cameraActive, setCameraActive] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        setMounted(true)
        codeReaderRef.current = new BrowserMultiFormatReader()

        return () => {
            stopScanning()
        }
    }, [])

    // Handle browser back button when camera is open
    useEffect(() => {
        if (!isOpen) return

        // Add a history entry when modal opens
        const historyState = { scannerOpen: true }
        window.history.pushState(historyState, '')

        const handlePopState = (event: PopStateEvent) => {
            // Back button pressed while modal is open - close it
            onClose()
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
            // Only remove history entry if we're still on our scanner state
            // This prevents issues when closing via the X button
            if (window.history.state?.scannerOpen) {
                window.history.back()
            }
        }
    }, [isOpen, onClose])

    // Start camera and scanning when modal opens
    useEffect(() => {
        if (isOpen && !cameraActive) {
            startScanning()
        } else if (!isOpen && cameraActive) {
            stopScanning()
        }
    }, [isOpen])

    const startScanning = async () => {
        try {
            console.log('[BarcodeScanner] Starting camera...')
            setScanning(true)
            setError(null)
            setCameraActive(true)

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device')
            }

            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Use back camera on mobile
            })

            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }

            // Start barcode detection
            if (codeReaderRef.current && videoRef.current) {
                startBarcodeDetection()
            }

            console.log('[BarcodeScanner] Camera started successfully!')
        } catch (error: any) {
            console.error('[BarcodeScanner] Failed to start camera:', error)
            toast.error(`Camera error: ${error?.message || 'Unknown error'}`)
            handleClose()
        }
    }

    const startBarcodeDetection = async () => {
        if (!codeReaderRef.current || !videoRef.current) return

        try {
            const result = await codeReaderRef.current.decodeOnceFromVideoDevice(undefined, videoRef.current)

            if (result) {
                const barcode = result.getText()
                console.log('[BarcodeScanner] Barcode detected:', barcode)
                await handleBarcodeDetected(barcode)
            }
        } catch (error: any) {
            if (error instanceof NotFoundException) {
                // No barcode found, try again
                if (scanning && cameraActive) {
                    setTimeout(() => startBarcodeDetection(), 100)
                }
            } else {
                console.error('[BarcodeScanner] Scan error:', error)
                setError(error?.message || 'Scanning failed')
            }
        }
    }

    const handleBarcodeDetected = async (barcode: string) => {
        console.log('[BarcodeScanner] Processing barcode:', barcode)
        setScanning(false)

        try {
            // Call the onScan callback to check if order exists
            const orderFound = await onScan(barcode)

            if (orderFound) {
                // Success: play beep sound and close
                playBeepSound()
                toast.success('Order found!')
                await stopScanning()
                onClose()
            } else {
                // Failure: play buzz sound, show error, keep scanner open
                playBuzzSound()
                setError('Order not found. Please scan again.')
                // Restart scanning after a brief delay
                setTimeout(() => {
                    setError(null)
                    setScanning(true)
                    startBarcodeDetection()
                }, 2000)
            }
        } catch (error: any) {
            console.error('[BarcodeScanner] Error processing barcode:', error)
            playBuzzSound()
            setError(error?.message || 'Error processing barcode')
            // Restart scanning
            setTimeout(() => {
                setError(null)
                setScanning(true)
                startBarcodeDetection()
            }, 2000)
        }
    }

    const stopScanning = async () => {
        console.log('[BarcodeScanner] Stopping scanner...')

        setScanning(false)
        setCameraActive(false)

        // Stop video stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }

        // Stop video element
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }

        // Reset code reader
        if (codeReaderRef.current) {
            codeReaderRef.current.reset()
        }

        console.log('[BarcodeScanner] Scanner stopped successfully')
    }

    const handleClose = async () => {
        await stopScanning()
        onClose()
    }

    const playBeepSound = () => {
        const audio = new Audio('/sounds/beep.mp3')
        audio.play().catch(err => console.error('Failed to play beep sound:', err))
    }

    const playBuzzSound = () => {
        const audio = new Audio('/sounds/buzz.mp3')
        audio.play().catch(err => console.error('Failed to play buzz sound:', err))
    }

    if (!mounted || !isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black">
            {/* Video Preview */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
            />

            {/* SCANNER OVERLAY */}
            {cameraActive && (
                <div className="absolute inset-0 z-50 pointer-events-none">
                    {/* Top Controls */}
                    <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 pt-8 pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
                        <button
                            onClick={handleClose}
                            className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white shadow-lg border border-white/60 active:scale-95"
                        >
                            <X size={24} />
                        </button>
                        <div className="flex flex-col items-end gap-2">
                            <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-lg text-white text-sm font-medium">
                                {scanning ? 'Scanning...' : 'Ready'}
                            </div>
                        </div>
                    </div>

                    {/* Center: Rectangle Scan Area */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-[280px] h-[200px]">
                            {/* Semi-transparent overlay outside scan area */}
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Top */}
                                <div className="absolute top-0 left-0 right-0 h-[calc(50vh-100px)] bg-black/50" style={{ transform: 'translateY(-100%)' }} />
                                {/* Bottom */}
                                <div className="absolute bottom-0 left-0 right-0 h-[calc(50vh-100px)] bg-black/50" style={{ transform: 'translateY(100%)' }} />
                                {/* Left */}
                                <div className="absolute top-0 left-0 bottom-0 w-[calc(50vw-140px)] bg-black/50" style={{ transform: 'translateX(-100%)' }} />
                                {/* Right */}
                                <div className="absolute top-0 right-0 bottom-0 w-[calc(50vw-140px)] bg-black/50" style={{ transform: 'translateX(100%)' }} />
                            </div>

                            {/* Scan rectangle border */}
                            <div className="absolute inset-0 border-4 border-white rounded-lg shadow-2xl">
                                {/* Corner markers */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

                                {/* Scanning line animation */}
                                {scanning && (
                                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Instructions and Error */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-auto">
                        <div className="text-center text-white space-y-3">
                            {error ? (
                                <div className="p-4 bg-red-500/90 backdrop-blur-md rounded-lg font-medium text-lg">
                                    {error}
                                </div>
                            ) : (
                                <>
                                    <p className="text-lg font-semibold">
                                        Scan Order Barcode
                                    </p>
                                    <p className="text-sm text-white/80">
                                        Position the barcode within the rectangle
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for scanning animation */}
            <style jsx>{`
                @keyframes scan {
                    0% {
                        top: 0;
                    }
                    50% {
                        top: 100%;
                    }
                    100% {
                        top: 0;
                    }
                }
                .animate-scan {
                    animation: scan 2s linear infinite;
                }
            `}</style>
        </div>,
        document.body
    )
}
