'use client'

/**
 * Bartender-facing empty-state card.
 *
 * Rendered when a bartender tab (Video / Audio / Music) loads but the
 * underlying data has not been configured yet — typically a fresh install,
 * or a botched merge that wiped location data files back to main's empty
 * templates (CLAUDE.md Gotcha #7).
 *
 * Without this, the bartender opens the iPad mid-shift and sees a blank
 * tab with no recovery path; they'd have to text the manager who SSHs in
 * and re-runs seed scripts. This card gives them:
 *   - reassurance that they didn't break anything,
 *   - the exact admin URL the manager needs to open,
 *   - a copy-paste message they can text the manager verbatim.
 *
 * Voice matches /apps/web/src/app/remote/error.tsx — "you didn't do
 * anything wrong" tone, no jargon, single-action steps. v2.54.57.
 *
 * Structure (same across all three tabs):
 *   - icon (lucide)
 *   - heading (bartender-friendly framing)
 *   - 2-3 sentence body (what's missing, why it's normal, what to do)
 *   - optional configured-but-empty hint (distinguishes fresh install
 *     from a half-done setup, so the manager knows where to look)
 *   - primary CTA: open admin page (≥44px touch target)
 *   - secondary CTA: copy text message to manager (≥44px)
 */

import { useState, type ReactNode } from 'react'
import { Copy, ExternalLink, Check } from 'lucide-react'

interface Props {
  /** Lucide icon component, rendered ~48px */
  icon: ReactNode
  /** Short heading — bartender lens, no jargon */
  heading: string
  /** 2-3 sentence explanation */
  body: ReactNode
  /**
   * When true, the data store exists but is empty — e.g. layout row
   * exists with zero zones. Different framing: "setup was started but
   * not finished" instead of "this is a fresh install".
   */
  partiallyConfigured?: boolean
  /** Admin URL the manager should open */
  adminUrl: string
  /** Label for the primary CTA button */
  adminLabel: string
  /** Verbatim message the bartender should text the manager */
  managerMessage: string
}

export default function BartenderEmptyState({
  icon,
  heading,
  body,
  partiallyConfigured = false,
  adminUrl,
  adminLabel,
  managerMessage,
}: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(managerMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // clipboard API can fail on insecure-context iPad browsers; fall
      // back to selecting the textarea so the bartender can long-press
      // copy manually. We render the message verbatim in the card so
      // they always have something to read off.
      setCopied(false)
    }
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 text-slate-300">{icon}</div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{heading}</h3>
        <div className="text-sm sm:text-base text-slate-300 leading-relaxed mb-2 space-y-2">
          {body}
        </div>
        {partiallyConfigured && (
          <p className="text-xs sm:text-sm text-amber-300/90 mt-3 mb-1 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-400/20">
            It looks like setup was started but not finished. The manager just needs to open the admin page and complete it.
          </p>
        )}
      </div>

      {/* Verbatim message preview so the bartender can read it off
          even if clipboard copy is blocked by the browser. */}
      <div className="mt-5 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
          Text to manager
        </p>
        <p className="text-sm text-slate-200 leading-relaxed select-all">
          {managerMessage}
        </p>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <a
          href={adminUrl}
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm sm:text-base transition-colors active:scale-95"
        >
          <ExternalLink className="w-5 h-5" />
          {adminLabel}
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold text-sm sm:text-base transition-colors active:scale-95"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-emerald-300" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copy message
            </>
          )}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-500 text-center">
        You didn&apos;t do anything wrong — this just means the system hasn&apos;t been set up at this location yet.
      </p>
    </div>
  )
}
