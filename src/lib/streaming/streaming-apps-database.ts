/**
 * Streaming Apps Database
 * 
 * Comprehensive database of streaming apps with their package names,
 * capabilities, and API information for Fire TV devices.
 */

export interface StreamingApp {
  id: string
  name: string
  packageName: string
  category: 'sports' | 'general' | 'live-tv'
  hasPublicApi: boolean
  apiDocUrl?: string
  deepLinkSupport: boolean
  deepLinkFormat?: string
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
    packageName: 'com.fox.nowapp',
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
    packageName: 'com.fubotv.android',
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
    packageName: 'com.cbs.ott',
    category: 'live-tv',
    hasPublicApi: false,
    deepLinkSupport: true,
    deepLinkFormat: 'paramountplus://play/{contentId}',
    description: 'Paramount+ with CBS Sports content',
    sports: ['football', 'basketball', 'soccer', 'golf'],
    requiresSubscription: true,
    notes: 'CBS Sports content available. No public API'
  },

  // Peacock
  {
    id: 'peacock',
    name: 'Peacock',
    packageName: 'com.peacocktv.peacockandroid',
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
    packageName: 'com.amazon.avod.thirdpartyclient',
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
    packageName: 'com.apple.atve.androidtv.appletv',
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
