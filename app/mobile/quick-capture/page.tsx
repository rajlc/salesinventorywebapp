import CaptureInterface from '@/features/mobile-capture/components/CaptureInterface'
import { getMobileCaptures } from '@/features/mobile-capture/actions'
import { MobileGallery } from '@/features/mobile-capture/components/MobileGallery'
import { Camera } from 'lucide-react'

export default async function MobileCapturePage() {
    const captures = await getMobileCaptures()

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black py-4">
            <div className="px-4 mb-4">
                <h1 className="text-xl font-bold">Product Photo Capture</h1>
            </div>

            {/* Gallery Grid with Grouping */}
            <div className="px-4 pb-24">
                {captures.length === 0 ? (
                    <div className="col-span-3 py-12 text-center text-gray-400 border-2 border-dashed rounded-lg bg-white dark:bg-zinc-900">
                        <Camera className="mx-auto mb-2 opacity-50" size={32} />
                        <p className="text-sm">No photos yet</p>
                        <p className="text-xs mt-1">Tap the camera button to start</p>
                    </div>
                ) : (
                    <MobileGallery captures={captures} />
                )}
            </div>

            {/* Floating Action Button for Camera */}
            <div className="fixed bottom-6 right-4 z-40">
                <CaptureInterface
                    trigger={
                        <button className="h-14 w-14 bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-orange-700 active:scale-95 transition-all border-4 border-white dark:border-zinc-900">
                            <Camera size={28} />
                        </button>
                    }
                />
            </div>
        </div>
    )
}
