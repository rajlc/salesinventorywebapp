"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import { Images, X, ChevronLeft, ChevronRight } from "lucide-react"
import { registerBackHandler, unregisterBackHandler } from "@/components/CapacitorAppListener"

type Capture = {
    id: string
    created_at: string
    image_url: string
    price?: number | null
    remarks?: string | null
    group_id?: string | null
}

type PhotoGroup = {
    id: string
    captures: Capture[]
    created_at: string
}

interface MobileGalleryProps {
    captures: Capture[]
}

// Client-side grouping function
function groupCaptures(captures: Capture[]): PhotoGroup[] {
    const grouped = new Map<string, Capture[]>()

    captures.forEach(capture => {
        const key = capture.group_id || `single-${capture.id}`
        if (!grouped.has(key)) {
            grouped.set(key, [])
        }
        grouped.get(key)!.push(capture)
    })

    const groups: PhotoGroup[] = Array.from(grouped.entries()).map(([id, groupCaptures]) => {
        const sortedCaptures = groupCaptures.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )

        return {
            id,
            captures: sortedCaptures,
            created_at: sortedCaptures[0].created_at
        }
    })

    return groups.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
}

export function MobileGallery({ captures }: MobileGalleryProps) {
    const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null)
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
    const [touchStart, setTouchStart] = useState(0)
    const [touchEnd, setTouchEnd] = useState(0)

    // Group photos with useMemo for performance
    const photoGroups = useMemo(() => groupCaptures(captures), [captures])

    const openModal = (groupIndex: number) => {
        setSelectedGroupIndex(groupIndex)
        setCurrentPhotoIndex(0)
    }

    const closeModal = () => {
        setSelectedGroupIndex(null)
        setCurrentPhotoIndex(0)
    }

    useEffect(() => {
        if (selectedGroupIndex === null) return

        registerBackHandler(() => {
            closeModal()
            return true // Handled
        })

        return () => unregisterBackHandler()
    }, [selectedGroupIndex])

    const navigatePhoto = (direction: 'left' | 'right') => {
        if (selectedGroupIndex === null) return
        const currentGroup = photoGroups[selectedGroupIndex]

        if (direction === 'left') {
            setCurrentPhotoIndex(prev =>
                prev > 0 ? prev - 1 : currentGroup.captures.length - 1
            )
        } else {
            setCurrentPhotoIndex(prev =>
                prev < currentGroup.captures.length - 1 ? prev + 1 : 0
            )
        }
    }

    // Touch handlers for swipe gesture
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0].clientX)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX)
    }

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return

        const distance = touchStart - touchEnd
        const isLeftSwipe = distance > 50
        const isRightSwipe = distance < -50

        if (isLeftSwipe) {
            navigatePhoto('right')
        }
        if (isRightSwipe) {
            navigatePhoto('left')
        }

        setTouchStart(0)
        setTouchEnd(0)
    }

    const selectedGroup = selectedGroupIndex !== null ? photoGroups[selectedGroupIndex] : null
    const currentCapture = selectedGroup ? selectedGroup.captures[currentPhotoIndex] : null

    return (
        <>
            {/* Mobile Grid */}
            <div className="grid grid-cols-3 gap-2">
                {photoGroups.map((group, groupIndex) => {
                    const firstCapture = group.captures[0]
                    const isGroup = group.captures.length > 1

                    return (
                        <div
                            key={group.id}
                            className="relative aspect-[3/4] bg-white dark:bg-zinc-800 rounded-lg overflow-hidden border dark:border-zinc-800 shadow-sm active:scale-95 transition-transform"
                            onClick={() => openModal(groupIndex)}
                        >
                            <Image
                                src={firstCapture.image_url}
                                alt="Capture"
                                fill
                                className="object-cover"
                            />

                            {/* Group Count Badge */}
                            {isGroup && (
                                <div className="absolute top-1 right-1 bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-0.5 shadow-lg">
                                    <Images size={10} />
                                    {group.captures.length}
                                </div>
                            )}

                            {/* Price Badge */}
                            {firstCapture.price && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate text-center font-medium backdrop-blur-sm">
                                    Rs. {firstCapture.price}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Full Screen Modal with Carousel */}
            {currentCapture && selectedGroup && (
                <div
                    className="fixed inset-0 z-50 bg-black flex flex-col"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Top Bar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/80 to-transparent">
                        <div className="text-white">
                            {/* Show group price if any photo has it */}
                            {(() => {
                                const groupPrice = selectedGroup.captures.find(c => c.price)?.price
                                return groupPrice && (
                                    <p className="font-bold text-lg">Rs. {groupPrice}</p>
                                )
                            })()}
                            {currentCapture.remarks && (
                                <p className="text-sm text-gray-300">{currentCapture.remarks}</p>
                            )}
                            {selectedGroup.captures.length > 1 && (
                                <p className="text-sm text-blue-400 mt-1 font-semibold">
                                    Photo {currentPhotoIndex + 1} of {selectedGroup.captures.length}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={closeModal}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md active:scale-95 transition-all"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Image Container */}
                    <div className="relative w-full h-full flex items-center justify-center">
                        <Image
                            key={currentCapture.id}
                            src={currentCapture.image_url}
                            alt="Full view"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>

                    {/* Navigation Arrows (only if group has multiple photos) */}
                    {selectedGroup.captures.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    navigatePhoto('left')
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-md active:scale-95 transition-all"
                            >
                                <ChevronLeft size={24} strokeWidth={3} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    navigatePhoto('right')
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-md active:scale-95 transition-all"
                            >
                                <ChevronRight size={24} strokeWidth={3} />
                            </button>
                        </>
                    )}

                    {/* Swipe Hint (only shown for groups) */}
                    {selectedGroup.captures.length > 1 && (
                        <div className="absolute bottom-4 left-0 right-0 text-center">
                            <p className="text-white/60 text-xs">Swipe left or right to navigate</p>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
