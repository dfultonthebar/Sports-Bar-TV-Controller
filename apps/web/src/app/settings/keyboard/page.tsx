'use client'

import { getAvailableShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Keyboard, Info } from 'lucide-react'
import Link from 'next/link'

export default function KeyboardShortcutsPage() {
  const shortcuts = getAvailableShortcuts()

  // Separate navigation and general shortcuts
  const navigationShortcuts = shortcuts.filter(s => s.keys.startsWith('Ctrl'))
  const generalShortcuts = shortcuts.filter(s => !s.keys.startsWith('Ctrl'))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-400 hover:text-slate-300 mb-4 transition-colors"
          >
            ← Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl p-3 shadow-lg">
              <Keyboard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Keyboard Shortcuts
              </h1>
              <p className="text-slate-300 text-lg">Navigate faster with keyboard commands</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Info Banner */}
          <div className="backdrop-blur-xl bg-blue-500/10 border border-blue-400/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-blue-300 mb-1">Quick Access</p>
                <p>
                  Press <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-mono text-xs">?</kbd> anywhere
                  in the app to see this shortcut list in a quick dialog.
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Shortcuts */}
          <section className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span className="text-blue-400">→</span> Navigation
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Quickly jump between different sections of the application
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {navigationShortcuts.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="group p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg hover:border-blue-400/50 hover:from-blue-900/20 hover:to-purple-900/20 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-medium">{shortcut.description}</span>
                    <kbd className="px-3 py-1.5 bg-slate-700 group-hover:bg-slate-600 rounded border border-slate-600 group-hover:border-blue-500 font-mono text-sm text-slate-200 transition-colors">
                      {shortcut.keys}
                    </kbd>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* General Shortcuts */}
          <section className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span className="text-purple-400">⚡</span> General
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              General purpose keyboard commands for better usability
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generalShortcuts.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="group p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg hover:border-purple-400/50 hover:from-purple-900/20 hover:to-pink-900/20 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-medium">{shortcut.description}</span>
                    <kbd className="px-3 py-1.5 bg-slate-700 group-hover:bg-slate-600 rounded border border-slate-600 group-hover:border-purple-500 font-mono text-sm text-slate-200 transition-colors">
                      {shortcut.keys}
                    </kbd>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Platform Notes */}
          <section className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span className="text-green-400">💡</span> Platform Notes
            </h2>
            <div className="space-y-3 text-slate-300">
              <div className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">Windows/Linux:</span>
                <span>Use <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-mono text-xs">Ctrl</kbd> key</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-purple-400 font-bold">macOS:</span>
                <span>Use <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-700 font-mono text-xs">Cmd</kbd> key (⌘)</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-orange-400 font-bold">Note:</span>
                <span>Shortcuts are disabled when typing in text fields</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
