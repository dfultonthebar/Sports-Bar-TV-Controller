/**
 * why-builder.ts — Piece C (Wave 7) of #349
 *
 * Builds a short, bartender-facing one-line "why" rationale for each game in
 * the Game Plan UI. PURE TypeScript string concatenation — NO LLM anywhere
 * (CLAUDE.md Gotcha #12 / feedback-llm-server-built-verbatim: llama3.1:8b
 * paraphrases short verbatim text ~50% of the time, so this MUST be
 * server-built and rendered verbatim). No async, no DB, no network.
 */

export function buildWhyReason(
  game: {
    homeTeam: string
    awayTeam: string
    cableChannel?: string
    directvChannel?: string
  },
  isHomeTeam: boolean,
  assignedTVs: number | null,
  patternSampleSize: number | null
): string {
  // Guard: non-team / channel-only entries (no home & away) get NO rationale —
  // a label like " @ " is meaningless. Return '' so the UI renders nothing.
  const home = (game.homeTeam || '').trim()
  const away = (game.awayTeam || '').trim()
  if (!home && !away) return ''

  // Team label: home games lead with "<team> home"; otherwise "<away> @ <home>"
  const teamLabel = isHomeTeam && home
    ? `${home} home`
    : away && home
      ? `${away} @ ${home}`
      : (home || away)

  const parts: string[] = []

  // TV count (only known for currently-showing games; upcoming pass null → omit)
  if (assignedTVs != null && assignedTVs > 0) {
    parts.push(`${assignedTVs} TV${assignedTVs !== 1 ? 's' : ''}`)
  }

  // Channel — cable preferred, then DirecTV, else omit
  if (game.cableChannel) {
    parts.push(`cable ch ${game.cableChannel}`)
  } else if (game.directvChannel) {
    parts.push(`DirecTV ch ${game.directvChannel}`)
  }

  // Historical pattern occurrence count (sample_size); only meaningful when >1
  if (patternSampleSize != null && patternSampleSize > 1) {
    parts.push(`assigned here ${patternSampleSize}× before`)
  }

  return parts.length > 0 ? `${teamLabel} → ${parts.join('; ')}` : teamLabel
}
