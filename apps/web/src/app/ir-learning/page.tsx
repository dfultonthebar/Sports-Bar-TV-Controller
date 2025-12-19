'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function IRLearningRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to device-config page with IR tab selected
    router.push('/device-config?tab=ir')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto" />
        <p className="text-lg text-slate-300">Redirecting to Device Configuration...</p>
        <p className="text-sm text-slate-400">
          IR Learning is now integrated into the Device Config page
        </p>
      </div>
    </div>
  )
}
