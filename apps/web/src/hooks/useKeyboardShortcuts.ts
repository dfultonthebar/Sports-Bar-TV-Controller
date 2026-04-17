import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  action: () => void
  description: string
}

/**
 * Global keyboard shortcuts hook
 * Provides customizable keyboard shortcuts for any component
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
          event.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

/**
 * Navigation shortcuts for the entire app
 * Implements Ctrl+H, Ctrl+G, Ctrl+T, Ctrl+A, Ctrl+S, etc.
 */
export function useNavigationShortcuts() {
  const router = useRouter()

  useKeyboardShortcuts([
    {
      key: 'h',
      ctrl: true,
      action: () => router.push('/'),
      description: 'Go to Home',
    },
    {
      key: 'g',
      ctrl: true,
      action: () => router.push('/sports-guide'),
      description: 'Open Sports Guide',
    },
    {
      key: 't',
      ctrl: true,
      action: () => router.push('/remote'),
      description: 'Go to TVs',
    },
    {
      key: 'a',
      ctrl: true,
      action: () => router.push('/audio-control'),
      description: 'Go to Audio',
    },
    {
      key: 's',
      ctrl: true,
      action: () => router.push('/system-health'),
      description: 'Go to System Health',
    },
    {
      key: 'm',
      ctrl: true,
      action: () => router.push('/matrix-control'),
      description: 'Go to Matrix',
    },
    {
      key: 'd',
      ctrl: true,
      action: () => router.push('/system-admin'),
      description: 'Go to Admin Dashboard',
    },
    {
      key: 'i',
      ctrl: true,
      action: () => router.push('/ai-hub'),
      description: 'Go to AI Hub',
    },
  ])
}

/**
 * Get all available keyboard shortcuts
 * Used for help dialog and settings page
 */
export function getAvailableShortcuts(): Array<{
  keys: string
  description: string
}> {
  return [
    { keys: 'Ctrl+H', description: 'Go to Home' },
    { keys: 'Ctrl+G', description: 'Open Sports Guide' },
    { keys: 'Ctrl+T', description: 'Go to TVs' },
    { keys: 'Ctrl+A', description: 'Go to Audio' },
    { keys: 'Ctrl+S', description: 'Go to System Health' },
    { keys: 'Ctrl+M', description: 'Go to Matrix' },
    { keys: 'Ctrl+D', description: 'Go to Admin Dashboard' },
    { keys: 'Ctrl+I', description: 'Go to AI Hub' },
    { keys: 'Escape', description: 'Close modal/dialog' },
    { keys: '?', description: 'Show keyboard shortcuts' },
  ]
}
