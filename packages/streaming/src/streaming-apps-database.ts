/**
 * Streaming Apps Database
 * 
 * Comprehensive database of streaming apps with their package names,
 * capabilities, and API information for Fire TV devices.
 */

export interface StreamingApp {
  id: string
  name: string
  /**
   * v2.32.9 — Alternate human-readable display names this app is known as.
   * The catalog's `name` field is the canonical "what we show in the UI";
   * aliases cover the cosmetic drift between scout reports, network resolver
   * output, broadcast feeds, and operator-typed names. Used by
   * `findStreamingAppByDisplayName()` for case-insensitive matching.
   *
   * Example: `name='ESPN'` with `displayNameAliases=['ESPN+','ESPN Plus']`
   * — the resolver returns "ESPN+" for ESPN+ broadcasts but the catalog
   * id is `espn-plus` for the unified ESPN app on Fire TV.
   *
   * Replaces the inline DISPLAY_NAME_TO_CATALOG_ID map that lived in
   * channel-guide/route.ts (v2.31.3 → v2.32.9). Single source of truth
   * keeps a new app addition from forgetting one of two structures.
   */
  displayNameAliases?: string[]
  /** Primary package name — the most common Fire TV/Android TV build. */
  packageName: string
  /**
   * Alternate package names to try when the primary isn't installed. Fire TV
   * Cubes often ship Amazon-specific builds (e.g. com.apple.atve.amazon.appletv)
   * while generic Android TVs use the androidtv build. Ordered most-to-least
   * likely.
   */
  packageAliases?: string[]
  category: 'sports' | 'general' | 'live-tv'
  hasPublicApi: boolean
  apiDocUrl?: string
  deepLinkSupport: boolean
  deepLinkFormat?: string
  liveTvDeepLink?: string
  description: string
  sports: string[]
  requiresSubscription: boolean
  notes?: string
}

export const STREAMING_APPS_DATABASE: StreamingApp[] = [
  // NFHS Network
  {
    id: 'nfhs-network',
    name: 'NFHS Network',
    displayNameAliases: ['NFHS', 'nfhs-network'],
    packageName: 'com.playon.nfhslive',  // Updated for Fire TV
    category: 'sports',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'nfhs://event/{eventId}',
    description: 'High school sports streaming',
    sports: ['football', 'basketball', 'volleyball', 'soccer', 'baseball', 'softball', 'wrestling', 'track', 'swimming'],
    requiresSubscription: true,
    notes: 'No public API available. Fire TV package: com.playon.nfhslive'
  },

  // ESPN
  {
    id: 'espn-plus',
    name: 'ESPN',
    displayNameAliases: ['ESPN+', 'ESPN Plus', 'espn-plus'],
    packageName: 'com.espn.gtv',  // Updated for Fire TV (ESPN app, includes ESPN+)
    category: 'sports',
    hasPublicApi: true,
    apiDocUrl: 'https://www.espn.com/apis/devcenter/docs/',
    deepLinkSupport: true,
    deepLinkFormat: 'espn://x-callback-url/showEvent?eventId={eventId}',
    description: 'ESPN streaming with live sports, ESPN+, and original content',
    sports: ['football', 'basketball', 'baseball', 'hockey', 'soccer', 'ufc', 'boxing', 'tennis', 'cricket'],
    requiresSubscription: true,
    notes: 'Fire TV package: com.espn.gtv (includes ESPN+)'
  },

  // Fox Sports
  {
    id: 'fox-sports',
    name: 'Fox Sports',
    packageName: 'com.foxsports.videogo',
    category: 'sports',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'foxsports://video/{videoId}',
    description: 'Fox Sports live streaming and on-demand content',
    sports: ['football', 'baseball', 'basketball', 'soccer', 'nascar', 'golf', 'boxing'],
    requiresSubscription: true,
    notes: 'Limited API access. May require partnership for API integration'
  },

  // NBC Sports
  {
    id: 'nbc-sports',
    name: 'NBC Sports',
    packageName: 'com.nbcsports.liveextra',
    category: 'sports',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'nbcsports://video/{videoId}',
    description: 'NBC Sports live streaming including NFL, NHL, Premier League',
    sports: ['football', 'hockey', 'soccer', 'golf', 'olympics', 'rugby'],
    requiresSubscription: true,
    notes: 'Limited public API. Consider RSS feeds for schedule data'
  },

  // YouTube TV
  {
    id: 'youtube-tv',
    name: 'YouTube TV',
    displayNameAliases: ['YouTube', 'youtube-tv'],
    packageName: 'com.amazon.firetv.youtube',  // Updated for Fire TV
    category: 'live-tv',
    hasPublicApi: true,
    apiDocUrl: 'https://developers.google.com/youtube/v3',
    deepLinkSupport: true,
    deepLinkFormat: 'https://www.youtube.com/tv#/watch?v={videoId}',
    description: 'Live TV streaming service with sports channels',
    sports: ['all'],
    requiresSubscription: true,
    notes: 'Fire TV package: com.amazon.firetv.youtube - includes YouTube TV for subscribers'
  },

  // Hulu Live TV
  {
    id: 'hulu-live',
    name: 'Hulu',
    displayNameAliases: ['Hulu Live', 'Hulu Live TV', 'hulu-live'],
    packageName: 'com.hulu.plus',
    category: 'live-tv',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'hulu://play/{contentId}',
    description: 'Hulu Live TV with sports channels',
    sports: ['all'],
    requiresSubscription: true,
    notes: 'No public API. Requires partnership for integration'
  },

  // Sling TV
  {
    id: 'sling-tv',
    name: 'Sling TV',
    displayNameAliases: ['Sling', 'sling-tv'],
    packageName: 'com.sling',
    category: 'live-tv',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'sling://channel/{channelId}',
    description: 'Sling TV live streaming with sports packages',
    sports: ['all'],
    requiresSubscription: true,
    notes: 'No public API available'
  },

  // FuboTV
  {
    id: 'fubo-tv',
    name: 'FuboTV',
    displayNameAliases: ['fuboTV', 'Fubo', 'fubo-tv'],
    packageName: 'com.fubotv.android',
    // v2.32.8 — Holmgren Way Fire TV Cubes ship Fubo as
    // `com.fubo.firetv.screen` (the Fire TV-specific build), not the
    // generic Android TV `com.fubotv.android`. Same launcher-aliased
    // pattern as Prime Video (v2.28.8 / firebat) and Peacock (v2.31.9 /
    // peacockfiretv). Without this alias, streamingManager.launchApp
    // probes only the primary and reports "not installed" — bartender
    // click + walker both silently fail on these Cubes.
    packageAliases: ['com.fubo.firetv.screen'],
    category: 'sports',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'fubo://channel/{channelId}',
    description: 'Sports-focused live TV streaming service',
    sports: ['football', 'soccer', 'basketball', 'baseball', 'hockey', 'golf', 'tennis'],
    requiresSubscription: true,
    notes: 'Sports-focused service with no public API'
  },

  // DAZN
  {
    id: 'dazn',
    name: 'DAZN',
    packageName: 'com.dazn',
    category: 'sports',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'dazn://video/{videoId}',
    description: 'Sports streaming service with boxing, MMA, and more',
    sports: ['boxing', 'mma', 'soccer', 'baseball', 'motorsports'],
    requiresSubscription: true,
    notes: 'No public API available'
  },

  // Paramount+
  {
    id: 'paramount-plus',
    name: 'Paramount+',
    displayNameAliases: ['Paramount Plus', 'Paramount', 'paramount-plus'],
    packageName: 'com.cbs.ott',
    category: 'live-tv',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'pplus://www.paramountplus.com/watch/{contentId}',
    liveTvDeepLink: 'https://www.paramountplus.com/live-tv/',
    description: 'Paramount+ with CBS Sports content and Live TV guide',
    sports: ['football', 'basketball', 'soccer', 'golf'],
    requiresSubscription: true,
    notes: 'CBS Sports content available. No public API'
  },

  // Peacock
  {
    id: 'peacock',
    name: 'Peacock',
    packageName: 'com.peacocktv.peacockandroid',
    // v2.31.9 — Holmgren Way Fire TV Cubes ship Peacock as
    // `com.peacock.peacockfiretv` (the Fire TV-specific build), not the
    // generic Android TV `com.peacocktv.peacockandroid`. Same launcher-
    // hosted situation as Prime Video / firebat (CLAUDE.md gotcha #10) —
    // streamingManager probes the alias when the primary package isn't
    // found and falls through. Without this, walker / bartender click
    // for Peacock games silently fails on these Cubes.
    packageAliases: ['com.peacock.peacockfiretv'],
    category: 'live-tv',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'peacock://play/{contentId}',
    description: 'NBCUniversal streaming with live sports',
    sports: ['football', 'soccer', 'golf', 'olympics', 'wrestling'],
    requiresSubscription: true,
    notes: 'Premier League and WWE content. No public API'
  },

  // MLB.TV
  {
    id: 'mlb-tv',
    name: 'MLB.TV',
    displayNameAliases: ['MLB TV', 'MLB', 'mlb-tv'],
    packageName: 'com.bamnetworks.mobile.android.gameday.atbat',
    category: 'sports',
    hasPublicApi: true,
    apiDocUrl: 'https://appac.github.io/mlb-data-api-docs/',
    deepLinkSupport: true,
    deepLinkFormat: 'mlb://game/{gameId}',
    description: 'Official MLB streaming service',
    sports: ['baseball'],
    requiresSubscription: true,
    notes: 'MLB Stats API available for game data and schedules'
  },

  // NBA League Pass
  {
    id: 'nba-league-pass',
    name: 'NBA League Pass',
    displayNameAliases: ['NBA', 'League Pass', 'nba-league-pass'],
    packageName: 'com.nbaimd.gametime.nba2011',
    category: 'sports',
    hasPublicApi: true,
    apiDocUrl: 'https://www.nba.com/stats/',
    deepLinkSupport: true,
    deepLinkFormat: 'nba://game/{gameId}',
    description: 'Official NBA streaming service',
    sports: ['basketball'],
    requiresSubscription: true,
    notes: 'NBA Stats API available for game data and schedules'
  },

  // NHL.TV / ESPN+
  {
    id: 'nhl-tv',
    name: 'NHL on ESPN+',
    displayNameAliases: ['NHL', 'NHL TV', 'NHL.TV', 'nhl-tv'],
    packageName: 'com.espn.score_center',
    category: 'sports',
    hasPublicApi: true,
    apiDocUrl: 'https://gitlab.com/dword4/nhlapi',
    deepLinkSupport: true,
    deepLinkFormat: 'espn://nhl/game/{gameId}',
    description: 'NHL games via ESPN+',
    sports: ['hockey'],
    requiresSubscription: true,
    notes: 'Unofficial NHL API available for game data'
  },

  // Amazon Prime Video
  {
    id: 'amazon-prime',
    name: 'Amazon Prime Video',
    displayNameAliases: ['Prime Video', 'Amazon Prime', 'amazon-prime'],
    packageName: 'com.amazon.avod',
    // v2.28.8 — On Fire TV Cube 2nd gen (AFTR) and other Fire OS Cubes that
    // ship Prime Video baked into the launcher (com.amazon.firebat / PVFTV
    // build), there is no separate com.amazon.avod APK on disk. The launcher
    // hosts Prime Video as its default LEANBACK_LAUNCHER activity
    // (DeepLinkRoutingActivity → livingroom.landing.LandingActivity), so
    // adding firebat as an alias lets streaming-service-manager find a
    // launchable package on these Cubes. adb-client.launchApp() will resolve
    // the LEANBACK_LAUNCHER activity automatically.
    packageAliases: ['com.amazon.avod.thirdpartyclient', 'com.amazon.firebat'],
    category: 'general',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'aiv://aiv/view?gti={contentId}',
    description: 'Amazon Prime Video with Thursday Night Football',
    sports: ['football'],
    requiresSubscription: true,
    notes: 'Thursday Night Football exclusive. No public API'
  },

  // Apple TV+
  {
    id: 'apple-tv',
    name: 'Apple TV',
    displayNameAliases: ['Apple TV+', 'Apple TV Plus', 'apple-tv'],
    packageName: 'com.apple.atve.amazon.appletv',
    packageAliases: ['com.apple.atve.androidtv.appletv'],
    category: 'general',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'https://tv.apple.com/{contentId}',
    description: 'Apple TV+ with MLB Friday Night Baseball and MLS Season Pass',
    sports: ['baseball', 'soccer'],
    requiresSubscription: true,
    notes: 'MLS Season Pass and MLB Friday games. No public API'
  }
]

/**
 * Get streaming app by ID
 */
export function getStreamingAppById(id: string): StreamingApp | undefined {
  return STREAMING_APPS_DATABASE.find(app => app.id === id)
}

/**
 * Get streaming apps by category
 */
export function getStreamingAppsByCategory(category: StreamingApp['category']): StreamingApp[] {
  return STREAMING_APPS_DATABASE.filter(app => app.category === category)
}

/**
 * Get streaming apps that have public APIs
 */
export function getAppsWithPublicApi(): StreamingApp[] {
  return STREAMING_APPS_DATABASE.filter(app => app.hasPublicApi)
}

/**
 * Get streaming apps by sport
 */
export function getStreamingAppsBySport(sport: string): StreamingApp[] {
  return STREAMING_APPS_DATABASE.filter(app => 
    app.sports.includes(sport.toLowerCase()) || app.sports.includes('all')
  )
}

/**
 * Search streaming apps by name or package
 */
export function searchStreamingApps(query: string): StreamingApp[] {
  const lowerQuery = query.toLowerCase()
  return STREAMING_APPS_DATABASE.filter(app =>
    app.name.toLowerCase().includes(lowerQuery) ||
    app.packageName.toLowerCase().includes(lowerQuery) ||
    app.description.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get package name for a streaming app
 */
export function getPackageNameByAppId(appId: string): string | undefined {
  const app = getStreamingAppById(appId)
  return app?.packageName
}

/**
 * v2.32.9 — Find a catalog entry by display name OR any registered alias.
 *
 * Single source of truth for the "Prime Video" / "Amazon Prime Video" /
 * "ESPN" vs "ESPN+" name-drift problem. Replaces the inline
 * DISPLAY_NAME_TO_CATALOG_ID map in channel-guide/route.ts (v2.31.3).
 *
 * Match order: exact `name` (case-insensitive) → any `displayNameAliases`
 * entry (case-insensitive) → exact `id` (rare but defensive).
 *
 * Returns the catalog entry or undefined. Callers can use `.id`,
 * `.packageName`, `.packageAliases`, etc. as needed.
 */
export function findStreamingAppByDisplayName(name: string | undefined | null): StreamingApp | undefined {
  if (!name) return undefined
  const needle = name.toLowerCase().trim()
  if (!needle) return undefined
  for (const app of STREAMING_APPS_DATABASE) {
    if (app.name.toLowerCase() === needle) return app
    if (app.displayNameAliases?.some((a) => a.toLowerCase() === needle)) return app
    if (app.id.toLowerCase() === needle) return app
  }
  return undefined
}

/**
 * v2.32.9 — Find a catalog entry by Android package name OR any
 * registered alias. Inverse of findStreamingAppByDisplayName for the
 * scout-heartbeat → display-name path. Replaces the inline
 * PACKAGE_TO_DISPLAY_NAME map in firetv-app-sync.ts.
 */
export function findStreamingAppByPackageName(pkg: string | undefined | null): StreamingApp | undefined {
  if (!pkg) return undefined
  const needle = pkg.toLowerCase().trim()
  if (!needle) return undefined
  for (const app of STREAMING_APPS_DATABASE) {
    if (app.packageName.toLowerCase() === needle) return app
    if (app.packageAliases?.some((a) => a.toLowerCase() === needle)) return app
  }
  return undefined
}

/**
 * v2.32.9 — Get the canonical display name for an Android package.
 * Returns undefined if the package isn't in the catalog. Used by
 * firetv-app-sync to translate scout's package list into the display
 * names that go into input_sources.available_networks.
 */
export function getDisplayNameForPackage(pkg: string | undefined | null): string | undefined {
  return findStreamingAppByPackageName(pkg)?.name
}
