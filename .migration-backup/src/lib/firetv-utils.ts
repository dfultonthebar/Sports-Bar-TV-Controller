
// Fire TV Utilities - Device types and app definitions

export interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceType: 'Fire TV Cube' | 'Fire TV Stick' | 'Fire TV' | 'Fire TV Stick 4K Max'
  isOnline: boolean
  adbEnabled?: boolean
  addedAt: string
  updatedAt?: string
  inputChannel?: number
  serialNumber?: string
  deviceModel?: string
  softwareVersion?: string
  lastSeen?: string
  keepAwakeEnabled?: boolean
  keepAwakeStart?: string
  keepAwakeEnd?: string
}

export interface StreamingApp {
  displayName: string
  packageName: string
  category: string
  sportsContent: boolean
}

export const FIRETV_SPORTS_APPS: StreamingApp[] = [
  { displayName: 'YouTube TV', packageName: 'com.google.android.apps.youtube.tvunplugged', category: 'Sports', sportsContent: true },
  { displayName: 'ESPN', packageName: 'com.espn.score_center', category: 'Sports', sportsContent: true },
  { displayName: 'NFL+', packageName: 'com.nfl.plus', category: 'Sports', sportsContent: true },
  { displayName: 'FOX Sports', packageName: 'com.foxsports.android', category: 'Sports', sportsContent: true },
  { displayName: 'NBC Sports', packageName: 'com.nbcsports.liveextra', category: 'Sports', sportsContent: true },
  { displayName: 'CBS Sports', packageName: 'com.handmark.sportcaster', category: 'Sports', sportsContent: true },
  { displayName: 'Paramount+', packageName: 'com.cbs.ott', category: 'Sports', sportsContent: true },
  { displayName: 'Amazon Prime Video', packageName: 'com.amazon.avod', category: 'Entertainment', sportsContent: false },
  { displayName: 'Netflix', packageName: 'com.netflix.ninja', category: 'Entertainment', sportsContent: false },
  { displayName: 'Hulu', packageName: 'com.hulu.plus', category: 'Entertainment', sportsContent: false },
  { displayName: 'Disney+', packageName: 'com.disney.disneyplus', category: 'Entertainment', sportsContent: false },
  { displayName: 'HBO Max', packageName: 'com.hbo.hbonow', category: 'Premium', sportsContent: false },
  { displayName: 'Apple TV+', packageName: 'com.apple.atve.amazon.appletv', category: 'Premium', sportsContent: false }
]

export const SPORTS_QUICK_ACCESS = [
  { name: 'ESPN', description: 'Live Sports', command: 'LAUNCH_APP com.espn.score_center' },
  { name: 'YouTube TV', description: 'Live TV & Sports', command: 'LAUNCH_APP com.google.android.apps.youtube.tvunplugged' },
  { name: 'FOX Sports', description: 'Live Games', command: 'LAUNCH_APP com.foxsports.android' },
  { name: 'NBC Sports', description: 'Live Events', command: 'LAUNCH_APP com.nbcsports.liveextra' }
]

export function generateFireTVDeviceId(): string {
  return `firetv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
