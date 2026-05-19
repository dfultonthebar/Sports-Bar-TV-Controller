'use client'

/**
 * Local error boundary — isolates a render crash to its subtree so a
 * single misbehaving component (e.g. a new SDR panel still being
 * stabilized) doesn't escalate to the Next.js global error boundary
 * + the "Something went wrong" full-page replacement.
 *
 * Use for newly-added panels or anywhere a child failure should be
 * recoverable in place. Renders a tiny inline failure card so the
 * operator sees what crashed + can keep using the rest of the page.
 *
 * Usage:
 *   <SafeBoundary label="SDR Spectrum Monitor">
 *     <ShureSdrSpectrumPanel ourFrequencies={...} />
 *   </SafeBoundary>
 */

import { Component, type ReactNode } from 'react'

interface Props {
  label: string
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string | null
}

export default class SafeBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'render failed' }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Surface to the browser console for dev inspection. Server-side
    // logger doesn't reach here — this is the React tree boundary.
    if (typeof window !== 'undefined' && (window as any).console) {
      // eslint-disable-next-line no-console
      console.error(`[SafeBoundary:${this.props.label}]`, error, info?.componentStack)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-700/40 bg-red-950/20 p-4 text-xs">
          <div className="font-medium text-red-300 mb-1">⚠ {this.props.label} failed to render</div>
          <div className="text-red-400/80 font-mono break-all">{this.state.message}</div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: null })}
            className="mt-2 px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
