/**
 * Channel logo lookup
 *
 * Maps a channel-preset display name (e.g. "ESPN", "Fan Duel",
 * "Bally Sports WI") to a logo URL. Used by the bartender remote's
 * preset grid and the channel guide to display network branding next
 * to the preset name.
 *
 * Lookup strategy:
 *   1. Normalize the preset name (uppercase, strip HD/Network/Channel
 *      suffixes, spaces, dashes — same as network-channel-resolver)
 *   2. Match against `LOGO_MAP` which covers ~50 major US sports and
 *      entertainment networks.
 *   3. Matches point at SimpleIcons CDN URLs (https://cdn.simpleicons.org)
 *      for brands that exist there, or local /channel-logos/*.svg files
 *      for the rest (operator-managed).
 *   4. No match → return null. The UI is expected to fall back to a
 *      text-only display.
 *
 * Why SimpleIcons: it's a well-maintained free SVG icon set covering
 * most major brands, served from a reliable CDN. Logos are monochrome
 * (we pick the white variant for dark UI). For networks without a
 * SimpleIcons entry (SEC Network, ACC Network, regional sports nets,
 * local affiliates), we ship local SVGs under
 * apps/web/public/channel-logos/ — or fall back to a colored text
 * badge.
 *
 * Operator override: if a ChannelPreset row has a `logoUrl` column set
 * (future schema addition), the caller should prefer that value over
 * this lookup. This helper is the SOURCE OF DEFAULTS, not the source
 * of truth.
 */

/**
 * Normalize a preset name for logo lookup. Mirrors the normalization
 * used by `network-channel-resolver.ts` so a preset named "ESPN HD"
 * and a station alias "ESPNHD" both resolve to the same logo.
 */
export function normalizeForLogo(name: string): string {
  return (name || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[/\\]/g, '')   // strip slashes — preset names like "Peacock/NBC Sports"
    .replace(/-TV$/i, '')
    .replace(/-/g, '')
    .replace(/HD$/i, '')
    .replace(/NETWORK$/i, '')
    .replace(/CHANNEL$/i, '')
}

// SimpleIcons CDN white-variant URL
const SI = (slug: string) => `https://cdn.simpleicons.org/${slug}/ffffff`

/**
 * Brand metadata for the text-badge fallback and as a lookup return.
 */
export interface ChannelLogo {
  /** URL of an SVG/PNG logo, or null to render a text badge instead */
  src: string | null
  /** Background color for the text badge (CSS color string) */
  badgeBg: string
  /** Foreground color for the text badge */
  badgeFg: string
  /** Short text to show in the badge fallback (2-5 chars typically) */
  badgeText: string
  /** Full canonical name (for alt text and tooltips) */
  name: string
}

/**
 * The map of normalized preset name → logo definition.
 * Keys are the result of `normalizeForLogo()` applied to the canonical
 * network name. Aliases are handled by having multiple keys pointing
 * at the same value.
 */
const LOGO_MAP: Record<string, ChannelLogo> = {}

function register(keys: string[], logo: Omit<ChannelLogo, 'name'> & { name?: string }) {
  const canonical = keys[0]
  const entry: ChannelLogo = { name: logo.name || canonical, ...logo }
  for (const k of keys) {
    LOGO_MAP[normalizeForLogo(k)] = entry
  }
}

// ------------------------------------------------------------------
// Sports networks (highest priority for a sports bar)
// ------------------------------------------------------------------

register(['ESPN', 'ESPN1'], {
  src: SI('espn'),
  badgeBg: '#CC0000', badgeFg: '#FFFFFF', badgeText: 'ESPN',
  name: 'ESPN',
})
register(['ESPN2'], {
  src: SI('espn'),
  badgeBg: '#B30000', badgeFg: '#FFFFFF', badgeText: 'ESPN2',
  name: 'ESPN 2',
})
register(['ESPNU'], {
  src: null,
  badgeBg: '#9F0000', badgeFg: '#FFFFFF', badgeText: 'ESPNU',
  name: 'ESPNU',
})
register(['ESPNEWS', 'ESPNNEWS', 'ESPNN'], {
  src: null,
  badgeBg: '#990000', badgeFg: '#FFFFFF', badgeText: 'ESPN NEWS',
  name: 'ESPN News',
})
register(['ESPN+', 'ESPND'], {
  src: SI('espn'),
  badgeBg: '#CC0000', badgeFg: '#FFFFFF', badgeText: 'ESPN+',
  name: 'ESPN+',
})

register(['FS1', 'FOXSPORTS1', 'FOXSPORT1'], {
  src: SI('foxsports'),
  badgeBg: '#003366', badgeFg: '#FFFFFF', badgeText: 'FS1',
  name: 'FOX Sports 1',
})
register(['FS2', 'FOXSPORTS2'], {
  src: SI('foxsports'),
  badgeBg: '#003366', badgeFg: '#FFFFFF', badgeText: 'FS2',
  name: 'FOX Sports 2',
})
register(['CBSSN', 'CBSSPORTSNETWORK', 'CBSSPORTS'], {
  src: null,
  badgeBg: '#003366', badgeFg: '#FFFFFF', badgeText: 'CBS SN',
  name: 'CBS Sports Network',
})

register(['NFLN', 'NFLNETWORK', 'NFLNET', 'NFL'], {
  src: SI('nfl'),
  badgeBg: '#013369', badgeFg: '#FFFFFF', badgeText: 'NFL',
  name: 'NFL Network',
})
register(['NFLREDZONE', 'REDZONE'], {
  src: null,
  badgeBg: '#E31837', badgeFg: '#FFFFFF', badgeText: 'RED ZONE',
  name: 'NFL RedZone',
})
register(['NBATV', 'NBA'], {
  src: SI('nba'),
  badgeBg: '#17408B', badgeFg: '#FFFFFF', badgeText: 'NBA TV',
  name: 'NBA TV',
})
register(['MLBN', 'MLB', 'MLBNETWORK', 'MLBNET', 'MBL'], {
  src: SI('mlb'),
  badgeBg: '#002D72', badgeFg: '#FFFFFF', badgeText: 'MLB',
  name: 'MLB Network',
})
register(['MLBSTRIKEZONE', 'STRIKEZONE'], {
  src: null,
  badgeBg: '#002D72', badgeFg: '#E31837', badgeText: 'STRIKE',
  name: 'MLB Strike Zone',
})
register(['NHLN', 'NHL', 'NHLNETWORK', 'NHLNET'], {
  src: SI('nhl'),
  badgeBg: '#000000', badgeFg: '#FFFFFF', badgeText: 'NHL',
  name: 'NHL Network',
})

register(['BTN', 'BIGTENNETWORK', 'BIGTEN', 'BIG10', 'B10'], {
  src: null,
  badgeBg: '#0088CE', badgeFg: '#FFFFFF', badgeText: 'B1G',
  name: 'Big Ten Network',
})
register(['SEC', 'SECN', 'SECNETWORK'], {
  src: null,
  badgeBg: '#0033A0', badgeFg: '#FFD100', badgeText: 'SEC',
  name: 'SEC Network',
})
register(['ACC', 'ACCN', 'ACCNETWORK'], {
  src: null,
  badgeBg: '#003087', badgeFg: '#FFFFFF', badgeText: 'ACC',
  name: 'ACC Network',
})
register(['PAC12', 'PAC-12'], {
  src: null,
  badgeBg: '#004B87', badgeFg: '#FFFFFF', badgeText: 'PAC-12',
  name: 'Pac-12 Network',
})
register(['BIG12'], {
  src: null,
  badgeBg: '#E31837', badgeFg: '#FFFFFF', badgeText: 'BIG 12',
  name: 'Big 12',
})

register(['GOLF', 'GOLFCHANNEL'], {
  src: null,
  badgeBg: '#004B23', badgeFg: '#FFFFFF', badgeText: 'GOLF',
  name: 'Golf Channel',
})
register(['TENNIS', 'TENNISCHANNEL'], {
  src: null,
  badgeBg: '#003B2F', badgeFg: '#FFFF00', badgeText: 'TENNIS',
  name: 'Tennis Channel',
})

// ------------------------------------------------------------------
// Regional Sports Networks (sports bar critical — WI/Midwest-centric)
// ------------------------------------------------------------------

// FanDuel Sports Wisconsin (formerly Bally Sports WI, formerly FSN Wisconsin)
// Main Wisconsin RSN — Bucks, Brewers overflow, general WI sports
register([
  'FanDuel', 'FANDUEL', 'FanDuelSN', 'FANDUELSN',
  'FanDuelSportsWisconsin', 'FANDUELSPORTSWISCONSIN',
  'BallySportsWisconsin', 'BALLYSPORTSWISCONSIN',
  'FSWI', 'BSWI',
  'FOXSportsWisconsin',
], {
  src: null,
  badgeBg: '#002D72', badgeFg: '#00A3E0', badgeText: 'FANDUEL SN',
  name: 'FanDuel Sports Wisconsin',
})

// Bally Sports WI+ — Brewers overflow feed (channel 308 on Spectrum GB)
register([
  'BallySportsWI', 'BALLYSPORTSWI',
  'BallySportsWI+', 'BALLYSPORTSWIPLUS',
  'FanDuelSNWI+',
], {
  src: null,
  badgeBg: '#001A3D', badgeFg: '#00A3E0', badgeText: 'BSWI+',
  name: 'Bally Sports Wisconsin+',
})

register([
  'BallySportsNorth', 'BSNORTH', 'BSN',
  'FanDuelSportsNorth', 'FANDUELSPORTSNORTH',
  'FanDuelNorth', 'FANDUELNORTH', 'FDNOR',
], {
  src: null,
  badgeBg: '#002147', badgeFg: '#FFFFFF', badgeText: 'FANDUEL N',
  name: 'FanDuel Sports North',
})

// NESN — New England Sports Network (Red Sox / Bruins)
register(['NESN', 'NEWENGLANDSPORTSNETWORK'], {
  src: null,
  badgeBg: '#002B5C', badgeFg: '#C8102E', badgeText: 'NESN',
  name: 'NESN',
})

// MSG networks — New York Knicks/Rangers/Islanders/Sabres
register(['MSG', 'MSGNETWORK', 'MADISONSQUAREGARDEN'], {
  src: null,
  badgeBg: '#F58220', badgeFg: '#000000', badgeText: 'MSG',
  name: 'MSG Network',
})
register(['MSG2', 'MSGPLUS', 'MSG+'], {
  src: null,
  badgeBg: '#D75A1E', badgeFg: '#FFFFFF', badgeText: 'MSG2',
  name: 'MSG2',
})

// beIN Sports — international soccer / UEFA / La Liga
register(['BEIN', 'BEINS', 'BEINSPORTS'], {
  src: null,
  badgeBg: '#000000', badgeFg: '#E60012', badgeText: 'beIN',
  name: 'beIN Sports',
})

// ------------------------------------------------------------------
// Turner / Warner (sports-adjacent)
// ------------------------------------------------------------------

register(['TNT'], {
  src: null,
  badgeBg: '#C8102E', badgeFg: '#FFFFFF', badgeText: 'TNT',
  name: 'TNT',
})
register(['TBS'], {
  src: null,
  badgeBg: '#003A70', badgeFg: '#FFFFFF', badgeText: 'TBS',
  name: 'TBS',
})
register(['TRUTV', 'TRU'], {
  src: null,
  badgeBg: '#662D91', badgeFg: '#FFFFFF', badgeText: 'truTV',
  name: 'truTV',
})

// ------------------------------------------------------------------
// Broadcast networks (for Sunday NFL / weekend games)
// ------------------------------------------------------------------

register(['ABC', 'WBAY'], {
  src: null,
  badgeBg: '#000000', badgeFg: '#FFFFFF', badgeText: 'ABC',
  name: 'ABC',
})
register(['NBC', 'WGBA'], {
  src: null,
  badgeBg: '#FFCB05', badgeFg: '#000000', badgeText: 'NBC',
  name: 'NBC',
})
register(['CBS', 'WFRV'], {
  src: null,
  badgeBg: '#003C7F', badgeFg: '#FFFFFF', badgeText: 'CBS',
  name: 'CBS',
})
register(['FOX', 'WLUK'], {
  src: null,
  badgeBg: '#003DA5', badgeFg: '#FFFFFF', badgeText: 'FOX',
  name: 'FOX',
})
register(['CW', 'WACY'], {
  src: null,
  badgeBg: '#00AEEF', badgeFg: '#FFFFFF', badgeText: 'CW',
  name: 'The CW',
})

// ------------------------------------------------------------------
// USA / Peacock / Paramount / Prime (streaming-linear hybrids)
// ------------------------------------------------------------------

register(['USA', 'USANETWORK'], {
  src: null,
  badgeBg: '#1B3E85', badgeFg: '#FFFFFF', badgeText: 'USA',
  name: 'USA Network',
})
register([
  'PEACOCK', 'NBCUN',
  'PEACOCKNBCSPORTS', 'PEACOCK/NBCSPORTS',
  'NBCSN', 'NBCSPORTS',  // some locations preset NBC Sports as "NBCSN"
], {
  src: SI('peacock'),
  badgeBg: '#000000', badgeFg: '#FFFFFF', badgeText: 'PEACOCK',
  name: 'Peacock / NBC Sports',
})

// Cowboy Channel — Western/rodeo programming
register(['COWBOY', 'COWBOYCHANNEL'], {
  src: null,
  badgeBg: '#7B3F00', badgeFg: '#FFD700', badgeText: 'COWBOY',
  name: 'Cowboy Channel',
})
register(['PARAMOUNT+', 'PARAMOUNT'], {
  src: SI('paramountplus'),
  badgeBg: '#0064FF', badgeFg: '#FFFFFF', badgeText: 'PARA+',
  name: 'Paramount+',
})
register(['PRIME', 'PRIMEVIDEO', 'AMAZONPRIME', 'AMZN'], {
  src: SI('primevideo'),
  badgeBg: '#00A8E1', badgeFg: '#FFFFFF', badgeText: 'PRIME',
  name: 'Prime Video',
})
register(['APPLETV+', 'APPLETV'], {
  src: SI('appletv'),
  badgeBg: '#000000', badgeFg: '#FFFFFF', badgeText: 'TV+',
  name: 'Apple TV+',
})

// ------------------------------------------------------------------
// Lookup
// ------------------------------------------------------------------

/**
 * Main lookup: take a preset name and return a logo definition
 * suitable for rendering. Returns `null` if no match so the caller
 * can fall back to text-only.
 *
 * Performance: single Map get on a normalized key. Safe to call on
 * every render.
 */
export function getChannelLogo(name: string | null | undefined): ChannelLogo | null {
  if (!name) return null
  const normalized = normalizeForLogo(name)
  return LOGO_MAP[normalized] || null
}

/**
 * Convenience: just return the image URL (or null). Equivalent to
 * `getChannelLogo(name)?.src || null`.
 */
export function getChannelLogoUrl(name: string | null | undefined): string | null {
  return getChannelLogo(name)?.src || null
}

/**
 * For a preset name, return a pair of { src, fallbackBadge } so the
 * caller can conditionally render `<img>` when src is present, or a
 * styled text badge when it's null. Both with correct alt text and
 * colors for the dark slate UI.
 */
export function getChannelLogoOrBadge(
  name: string | null | undefined
): { src: string | null; badge: { bg: string; fg: string; text: string }; alt: string } {
  const logo = getChannelLogo(name)
  if (logo) {
    return {
      src: logo.src,
      badge: { bg: logo.badgeBg, fg: logo.badgeFg, text: logo.badgeText },
      alt: logo.name,
    }
  }
  // Unknown preset — derive a placeholder from the name itself
  const text = (name || '?').slice(0, 4).toUpperCase()
  return {
    src: null,
    badge: { bg: '#1e293b', fg: '#94a3b8', text },
    alt: name || 'Unknown channel',
  }
}
