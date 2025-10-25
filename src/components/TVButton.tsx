'use client'

import { useState, useEffect } from 'react'
import { Monitor, Loader2 } from 'lucide-react'

interface TVButtonProps {
  tvNumber: number
  outputNumber: number
  label?: string
  currentSource?: string
  sourceName?: string
  area?: string
  isRouting?: boolean
  onClick: () => void
}

// Color scheme for different sources
const SOURCE_COLORS: Record<string, string> = {
  'Cable Box 1': 'bg-blue-500/80 border-blue-400',
  'Cable Box 2': 'bg-blue-600/80 border-blue-500',
  'Cable Box 3': 'bg-blue-700/80 border-blue-600',
  'Cable Box 4': 'bg-blue-800/80 border-blue-700',
  'DirecTV 1': 'bg-green-500/80 border-green-400',
  'DirecTV 2': 'bg-green-600/80 border-green-500',
  'DirecTV 3': 'bg-green-700/80 border-green-600',
  'DirecTV 4': 'bg-green-800/80 border-green-700',
  'Streaming': 'bg-purple-500/80 border-purple-400',
  'Gaming': 'bg-orange-500/80 border-orange-400',
}

// Area colors for better organization
const AREA_COLORS: Record<string, string> = {
  'EAST': 'from-blue-900/20 to-blue-800/20',
  'BAR': 'from-green-900/20 to-green-800/20',
  'DINING': 'from-purple-900/20 to-purple-800/20',
  'PARTY EAST': 'from-red-900/20 to-red-800/20',
  'PARTY WEST': 'from-yellow-900/20 to-yellow-800/20',
  'PATIO': 'from-orange-900/20 to-orange-800/20',
  'WEST': 'from-pink-900/20 to-pink-800/20',
}

export default function TVButton({
  tvNumber,
  outputNumber,
  label,
  currentSource,
  sourceName,
  area,
  isRouting,
  onClick
}: TVButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  // Get color based on source name
  const getSourceColor = () => {
    if (!sourceName) return 'bg-slate-700/80 border-slate-600'
    
    for (const [key, color] of Object.entries(SOURCE_COLORS)) {
      if (sourceName.includes(key)) return color
    }
    
    // Default color
    return 'bg-slate-600/80 border-slate-500'
  }

  const sourceColor = getSourceColor()
  const areaGradient = area ? AREA_COLORS[area] || 'from-slate-900/20 to-slate-800/20' : 'from-slate-900/20 to-slate-800/20'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isRouting}
      className={`
        relative group w-full h-full min-h-[80px] rounded-lg border-2 
        transition-all duration-200 ease-in-out
        ${isHovered ? 'scale-105 shadow-xl' : 'shadow-md'}
        ${isRouting ? 'opacity-75 cursor-wait' : 'cursor-pointer hover:brightness-110'}
        ${sourceColor}
        backdrop-blur-sm
      `}
    >
      {/* Background gradient based on area */}
      <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${areaGradient} opacity-30`} />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-2 h-full">
        {/* TV Icon */}
        <div className="mb-1">
          {isRouting ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Monitor className="w-6 h-6 text-white" />
          )}
        </div>
        
        {/* TV Number */}
        <div className="text-white font-bold text-lg mb-1">
          TV {tvNumber.toString().padStart(2, '0')}
        </div>
        
        {/* Label */}
        {label && (
          <div className="text-xs text-white/90 font-medium mb-1 text-center">
            {label}
          </div>
        )}
        
        {/* Current Source */}
        <div className="text-xs text-white/80 text-center px-1">
          {sourceName || 'No Source'}
        </div>
        
        {/* Area Badge (only show on hover) */}
        {area && isHovered && (
          <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
            {area}
          </div>
        )}
        
        {/* Output number (bottom left, small) */}
        <div className="absolute bottom-1 left-1 bg-black/40 text-white text-[10px] px-1 py-0.5 rounded">
          Out {outputNumber}
        </div>
      </div>
      
      {/* Hover effect overlay */}
      {isHovered && !isRouting && (
        <div className="absolute inset-0 rounded-lg bg-white/10 pointer-events-none" />
      )}
    </button>
  )
}
