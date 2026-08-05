"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { Download, X, ZoomIn, ChevronLeft, ChevronRight, Images } from "lucide-react"

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

interface GalleryGridProps {
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

export function GalleryGrid({ captures }: GalleryGridProps) {
    const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null)
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

    // Group photos with useMemo for performance
    const photoGroups = useMemo(() => groupCaptures(captures), [captures])

    // Keyboard navigation
    useEffect(() => {
        if (selectedGroupIndex === null) return

        const handleKeyDown = (e: KeyboardEvent) => {
            const currentGroup = photoGroups[selectedGroupIndex]

            if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setCurrentPhotoIndex(prev =>
                    prev > 0 ? prev - 1 : currentGroup.captures.length - 1
                )
            } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setCurrentPhotoIndex(prev =>
                    prev < currentGroup.captures.length - 1 ? prev + 1 : 0
                )
            } else if (e.key === 'Escape') {
                closeModal()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedGroupIndex, photoGroups])

    const openModal = (groupIndex: number) => {
        setSelectedGroupIndex(groupIndex)
        setCurrentPhotoIndex(0)
    }

    const closeModal = () => {
        setSelectedGroupIndex(null)
        setCurrentPhotoIndex(0)
    }

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

    const handleDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url)
            const blob = await response.blob()
            const link = document.createElement("a")
            link.href = window.URL.createObjectURL(blob)
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (error) {
            console.error("Download failed:", error)
        }
    }

    const selectedGroup = selectedGroupIndex !== null ? photoGroups[selectedGroupIndex] : null
    const currentCapture = selectedGroup ? selectedGroup.captures[currentPhotoIndex] : null

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {photoGroups.map((group, groupIndex) => {
                    const firstCapture = group.captures[0]
                    const isGroup = group.captures.length > 1
                    // Find first non-null price in group
                    const groupPrice = group.captures.find(c => c.price)?.price

                    return (
                        <div
                            key={group.id}
                            className="group relative aspect-[3/4] bg-gray-100 dark:bg-zinc-800 rounded-lg overflow-hidden border dark:border-zinc-800 cursor-pointer hover:shadow-md transition-all"
                            onClick={() => openModal(groupIndex)}
                        >
                            <Image
                                src={firstCapture.image_url}
                                alt={firstCapture.remarks || "Capture"}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {/* Group Count Badge */}
                            {isGroup && (
                                <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                                    <Images size={14} />
                                    {group.captures.length}
                                </div>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <ZoomIn className="text-white drop-shadow-md" />
                            </div>

                            {/* Info Bar - Show group price if any photo has it */}
                            <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 p-2 border-t dark:border-zinc-800 backdrop-blur-sm">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold truncate">
                                        {groupPrice ? `Rs. ${groupPrice}` : '-'}
                                    </span>
                                    <span className="text-gray-500 text-[10px]">
                                        {formatDistanceToNow(new Date(firstCapture.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Lightbox Modal with Carousel */}
            {currentCapture && selectedGroup && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">

                    {/* Top Bar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50">
                        <div className="text-white">
                            {/* Show group price if any photo has it */}
                            {(() => {
                                const groupPrice = selectedGroup.captures.find(c => c.price)?.price
                                return groupPrice ? (
                                    <h2 className="font-bold text-lg">Rs. {groupPrice}</h2>
                                ) : (
                                    currentCapture.price && <h2 className="font-bold text-lg">Rs. {currentCapture.price}</h2>
                                )
                            })()}
                            <p className="text-sm text-gray-400">
                                {currentCapture.remarks || 'No remarks'}
                            </p>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                                {new Date(currentCapture.created_at).toLocaleString()}
                            </p>
                            {selectedGroup.captures.length > 1 && (
                                <p className="text-sm text-blue-400 mt-2 font-semibold">
                                    Photo {currentPhotoIndex + 1} of {selectedGroup.captures.length}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownload(currentCapture.image_url, `capture-${currentCapture.id}.jpg`)
                                }}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                                title="Download Image"
                            >
                                <Download size={24} />
                            </button>
                            <button
                                onClick={closeModal}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors"
                                title="Close"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Navigation Arrows */}
                    {selectedGroup.captures.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    navigatePhoto('left')
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-50"
                                title="Previous photo (←)"
                            >
                                <ChevronLeft size={32} strokeWidth={3} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    navigatePhoto('right')
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-50"
                                title="Next photo (→)"
                            >
                                <ChevronRight size={32} strokeWidth={3} />
                            </button>
                        </>
                    )}

                    {/* Image Container */}
                    <div
                        className="relative w-full h-full max-w-5xl max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Image
                            key={currentCapture.id}
                            src={currentCapture.image_url}
                            alt="Full view"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>
            )}
        </>
    )
}
