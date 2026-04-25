'use client'

import { useState } from 'react'
import { getChannelLogoOrBadge } from '@/lib/channel-logos'

interface ChannelLogoProps {
  name: string | null | undefined
  className?: string
}

/**
 * Render a channel logo with a guaranteed text-badge fallback.
 *
 * SimpleIcons removed many sports/streaming brand logos due to TM disputes
 * (espn, nfl, hulu, peacock, primevideo, foxsports, etc. all 404 as of
 * v2.32.17). The previous render path hid the failed <img> via onError but
 * never showed the badge instead, so input tiles ended up logo-less. This
 * component swaps to the badge when the <img> errors so the user always
 * sees brand identity.
 */
export function ChannelLogo({ name, className }: ChannelLogoProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const { src, badge, alt } = getChannelLogoOrBadge(name)

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={alt}
        title={alt}
        className={className ?? 'h-8 w-8 object-contain flex-shrink-0 bg-white/10 rounded p-0.5'}
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <span
      title={alt}
      className="inline-flex items-center justify-center h-8 px-1.5 rounded text-[10px] font-bold flex-shrink-0 tracking-tight"
      style={{ backgroundColor: badge.bg, color: badge.fg, minWidth: '32px' }}
    >
      {badge.text}
    </span>
  )
}
