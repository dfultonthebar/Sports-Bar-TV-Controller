'use client'

import { useState, useEffect } from 'react'
import { getAvailableShortcuts } from '@/hooks/useKeyboardShortcuts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)
  const shortcuts = getAvailableShortcuts()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show dialog when '?' is pressed
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const target = e.target as HTMLElement
        // Don't trigger in inputs
        if (
          target.tagName !== 'INPUT' &&
          target.tagName !== 'TEXTAREA' &&
          !target.isContentEditable
        ) {
          e.preventDefault()
          setOpen(true)
        }
      }
      // Close dialog on Escape
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate quickly through the application
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
              <span className="text-sm text-slate-300">
                {shortcut.description}
              </span>
              <kbd className="px-2 py-1 text-xs font-semibold text-slate-200 bg-slate-700 rounded border border-slate-600 font-mono">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <p className="text-sm text-slate-400">
            <strong className="text-slate-300">Tip:</strong> Press{' '}
            <kbd className="px-1.5 py-0.5 text-xs bg-slate-700 rounded border border-slate-600 font-mono">
              ?
            </kbd>{' '}
            anytime to toggle this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
