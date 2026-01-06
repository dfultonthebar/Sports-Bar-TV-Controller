'use client'

import { useNavigationShortcuts } from '@/hooks/useKeyboardShortcuts'
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog'

/**
 * Client-side layout wrapper that enables keyboard shortcuts
 * This component is used in the root layout to add keyboard navigation
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  // Enable global navigation shortcuts
  useNavigationShortcuts()

  return (
    <>
      {children}
      <KeyboardShortcutsDialog />
    </>
  )
}
