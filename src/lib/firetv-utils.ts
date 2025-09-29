

// Amazon Fire TV Cube utility functions for sports bars

export interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  deviceType: 'Fire TV Cube' | 'Fire TV Stick' | 'Fire TV' | 'Fire TV Stick 4K Max'
  lastResponse?: string
  softwareVersion?: string
  serialNumber?: string
  adbEnabled?: boolean
}

export interface StreamingApp {
  packageName: string
  displayName: string
  category: 'Sports' | 'Entertainment' | 'News' | 'Premium'
  icon?: string
  sportsContent?: boolean
}

// Fire TV ADB command mappings
export const FIRETV_COMMANDS = {
  // Navigation Commands
  'UP': 'input keyevent 19',
  'DOWN': 'input keyevent 20',
  'LEFT': 'input keyevent 21',
  'RIGHT': 'input keyevent 22',
  'OK': 'input keyevent 23',
  'SELECT': 'input keyevent 23',
  'BACK': 'input keyevent 4',
  'HOME': 'input keyevent 3',
  'MENU': 'input keyevent 82',
  
  // Media Controls
  'PLAY_PAUSE': 'input keyevent 85',
  'PLAY': 'input keyevent 126',
  'PAUSE': 'input keyevent 127',
  'STOP': 'input keyevent 86',
  'REWIND': 'input keyevent 89',
  'FAST_FORWARD': 'input keyevent 90',
  'SKIP_PREVIOUS': 'input keyevent 88',
  'SKIP_NEXT': 'input keyevent 87',
  
  // Volume Controls (if supported by device)
  'VOL_UP': 'input keyevent 24',
  'VOL_DOWN': 'input keyevent 25',
  'MUTE': 'input keyevent 164',
  
  // Power Controls
  'POWER': 'input keyevent 26',
  'SLEEP': 'input keyevent 223',
  'WAKE': 'input keyevent 224',
  
  // Search and Voice
  'SEARCH': 'input keyevent 84',
  'VOICE': 'input keyevent 231',
  
  // System Commands
  'SETTINGS': 'am start -n com.amazon.tv.settings/.tv.TvSettingsActivity',
  'APPS': 'am start -n com.amazon.venezia/.VeneziaActivity',
  'RECENT': 'input keyevent 187'
}

// Popular streaming apps for sports bars
export const FIRETV_SPORTS_APPS: StreamingApp[] = [
  // Major Sports Streaming
  { packageName: 'com.espn.score_center', displayName: 'ESPN', category: 'Sports', sportsContent: true },
  { packageName: 'com.fox.now', displayName: 'FOX Sports', category: 'Sports', sportsContent: true },
  { packageName: 'com.nbc.nbcsports.liveextra', displayName: 'NBC Sports', category: 'Sports', sportsContent: true },
  { packageName: 'com.cbs.ott', displayName: 'Paramount+', category: 'Sports', sportsContent: true },
  { packageName: 'com.hulu.plus', displayName: 'Hulu Live TV', category: 'Sports', sportsContent: true },
  { packageName: 'com.google.android.youtube.tv', displayName: 'YouTube TV', category: 'Sports', sportsContent: true },
  { packageName: 'com.sling', displayName: 'Sling TV', category: 'Sports', sportsContent: true },
  { packageName: 'com.fubo.android', displayName: 'FuboTV', category: 'Sports', sportsContent: true },
  
  // League-Specific Apps
  { packageName: 'com.bamnetworks.mobile.android.gameday.mlb', displayName: 'MLB.TV', category: 'Sports', sportsContent: true },
  { packageName: 'com.nba.game', displayName: 'NBA League Pass', category: 'Sports', sportsContent: true },
  { packageName: 'com.nhl.gc1112.free', displayName: 'NHL.TV', category: 'Sports', sportsContent: true },
  { packageName: 'com.nflmobile.nflnow', displayName: 'NFL+', category: 'Sports', sportsContent: true },
  
  // Premium Entertainment
  { packageName: 'com.netflix.ninja', displayName: 'Netflix', category: 'Entertainment' },
  { packageName: 'com.amazon.avod.thirdpartyclient', displayName: 'Prime Video', category: 'Premium' },
  { packageName: 'com.hbo.hbonow', displayName: 'Max (HBO)', category: 'Premium' },
  { packageName: 'com.disney.disneyplus', displayName: 'Disney+', category: 'Entertainment' },
  
  // News & Information
  { packageName: 'com.cnn.mobile.android.phone', displayName: 'CNN', category: 'News' },
  { packageName: 'com.foxnews.android', displayName: 'FOX News', category: 'News' },
  { packageName: 'com.nbcuni.nbc.liveextra', displayName: 'NBC News', category: 'News' },
  
  // YouTube and Social
  { packageName: 'com.google.android.youtube.tvkids', displayName: 'YouTube', category: 'Entertainment' },
  { packageName: 'com.plexapp.android', displayName: 'Plex', category: 'Entertainment' }
]

// Sports-focused quick access channels
export const SPORTS_QUICK_ACCESS = [
  { name: 'ESPN', command: 'monkey -p com.espn.score_center 1', description: 'Live sports and highlights' },
  { name: 'FOX Sports', command: 'monkey -p com.fox.now 1', description: 'Live games and analysis' },
  { name: 'YouTube TV', command: 'monkey -p com.google.android.youtube.tv 1', description: 'Live TV with sports' },
  { name: 'NFL+', command: 'monkey -p com.nflmobile.nflnow 1', description: 'NFL games and content' },
  { name: 'NBA League Pass', command: 'monkey -p com.nba.game 1', description: 'Live NBA games' },
  { name: 'MLB.TV', command: 'monkey -p com.bamnetworks.mobile.android.gameday.mlb 1', description: 'Live baseball games' }
]

// Utility functions
export function getAppLaunchCommand(packageName: string): string {
  return `monkey -p ${packageName} 1`
}

export function getAppStopCommand(packageName: string): string {
  return `am force-stop ${packageName}`
}

export function getSystemInfoCommand(): string {
  return 'getprop'
}

export function getInstalledAppsCommand(): string {
  return 'pm list packages'
}

// Device discovery helpers
export function generateFireTVDeviceId(): string {
  return `firetv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function validateFireTVDevice(device: Partial<FireTVDevice>): string[] {
  const errors: string[] = []
  
  if (!device.name || device.name.trim().length === 0) {
    errors.push('Device name is required')
  }
  
  if (!device.ipAddress || device.ipAddress.trim().length === 0) {
    errors.push('IP address is required')
  } else if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(device.ipAddress.trim())) {
    errors.push('Invalid IP address format')
  }
  
  if (!device.port || device.port < 1 || device.port > 65535) {
    errors.push('Port must be between 1 and 65535')
  }
  
  return errors
}

// Command validation
export function isValidFireTVCommand(command: string): boolean {
  return command in FIRETV_COMMANDS || 
         command.startsWith('monkey -p ') || 
         command.startsWith('am start ') ||
         command.startsWith('input ') ||
         command.startsWith('getprop')
}

// Sports content helpers
export function getSportsApps(): StreamingApp[] {
  return FIRETV_SPORTS_APPS.filter(app => app.sportsContent)
}

export function getAppByPackageName(packageName: string): StreamingApp | undefined {
  return FIRETV_SPORTS_APPS.find(app => app.packageName === packageName)
}

