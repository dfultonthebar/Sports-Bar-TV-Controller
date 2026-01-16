'use client'

/**
 * LayoutSwitcher Component
 *
 * A dropdown/tabs component for switching between different bar layouts
 * (e.g., Main Bar, Patio, VIP Room). Supports quick switching in both
 * the manager view and bartender remote.
 */

import { useState, useEffect } from 'react'
import {
  ChevronDown,
  Check,
  Layout,
  Plus,
  Star,
  MapPin
} from 'lucide-react'

export interface LayoutSummary {
  id: string
  name: string
  description?: string
  isDefault: boolean
  zoneCount: number
}

interface LayoutSwitcherProps {
  layouts: LayoutSummary[]
  currentLayoutId: string | null
  onLayoutChange: (layoutId: string) => void
  onCreateNew?: () => void
  variant?: 'dropdown' | 'tabs'
  showCreateButton?: boolean
  className?: string
}

export default function LayoutSwitcher({
  layouts,
  currentLayoutId,
  onLayoutChange,
  onCreateNew,
  variant = 'dropdown',
  showCreateButton = false,
  className = ''
}: LayoutSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentLayout = layouts.find(l => l.id === currentLayoutId)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.layout-switcher')) {
        setIsOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen])

  if (variant === 'tabs') {
    return (
      <div className={`flex items-center gap-1 bg-slate-800 rounded-lg p-1 ${className}`}>
        {layouts.map(layout => (
          <button
            key={layout.id}
            onClick={() => onLayoutChange(layout.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              currentLayoutId === layout.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{layout.name}</span>
            {layout.isDefault && (
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            )}
          </button>
        ))}
        {showCreateButton && onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Add new layout"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // Dropdown variant
  return (
    <div className={`relative layout-switcher ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors min-w-[180px]"
      >
        <Layout className="w-4 h-4 text-slate-400" />
        <span className="flex-1 text-left truncate">
          {currentLayout?.name || 'Select Layout'}
        </span>
        {currentLayout?.isDefault && (
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="max-h-64 overflow-y-auto">
            {layouts.map(layout => (
              <button
                key={layout.id}
                onClick={() => {
                  onLayoutChange(layout.id)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-700 transition-colors ${
                  currentLayoutId === layout.id ? 'bg-slate-700/50' : ''
                }`}
              >
                <MapPin className={`w-4 h-4 ${currentLayoutId === layout.id ? 'text-blue-400' : 'text-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${currentLayoutId === layout.id ? 'text-white' : 'text-slate-300'}`}>
                      {layout.name}
                    </span>
                    {layout.isDefault && (
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  {layout.description && (
                    <p className="text-xs text-slate-500 truncate">{layout.description}</p>
                  )}
                  <p className="text-xs text-slate-500">{layout.zoneCount} TV zones</p>
                </div>
                {currentLayoutId === layout.id && (
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {showCreateButton && onCreateNew && (
            <>
              <div className="border-t border-slate-700" />
              <button
                onClick={() => {
                  onCreateNew()
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-700 transition-colors text-green-400"
              >
                <Plus className="w-4 h-4" />
                <span className="font-medium">Create New Layout</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
