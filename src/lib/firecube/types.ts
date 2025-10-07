
// Fire Cube Type Definitions

export interface FireCubeDevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  macAddress?: string;
  serialNumber?: string;
  deviceModel?: string;
  softwareVersion?: string;
  location?: string;
  matrixInputChannel?: number;
  adbEnabled: boolean;
  status: 'discovered' | 'online' | 'offline' | 'error';
  lastSeen?: Date;
  keepAwakeEnabled: boolean;
  keepAwakeStart: string;
  keepAwakeEnd: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FireCubeApp {
  id: string;
  deviceId: string;
  packageName: string;
  appName: string;
  version?: string;
  versionCode?: number;
  category?: string;
  iconUrl?: string;
  isSystemApp: boolean;
  isSportsApp: boolean;
  hasSubscription: boolean;
  subscriptionStatus?: string;
  lastChecked?: Date;
  installedAt?: Date;
  updatedAt: Date;
}

export interface FireCubeSportsContent {
  id: string;
  appId: string;
  deviceId: string;
  contentTitle: string;
  contentType: string;
  league?: string;
  teams?: string;
  startTime?: Date;
  endTime?: Date;
  channel?: string;
  isLive: boolean;
  deepLink?: string;
  thumbnailUrl?: string;
  description?: string;
  lastUpdated: Date;
}

export interface FireCubeSideloadOperation {
  id: string;
  sourceDeviceId: string;
  targetDeviceIds: string;
  packageName: string;
  appName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  progress: number;
  totalDevices: number;
  completedDevices: number;
  failedDevices: number;
  errorLog?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface ADBDeviceInfo {
  serialNumber: string;
  model: string;
  device: string;
  product: string;
  transportId: string;
}

export interface InstalledApp {
  packageName: string;
  appName: string;
  version?: string;
  versionCode?: number;
  isSystemApp: boolean;
}

export interface SubscriptionCheckResult {
  packageName: string;
  hasSubscription: boolean;
  subscriptionStatus: 'active' | 'expired' | 'trial' | 'unknown';
  lastChecked: Date;
  method: 'login_check' | 'api_check' | 'heuristic';
}

export interface LiveSportsContent {
  title: string;
  league: string;
  teams: string[];
  startTime: Date;
  channel: string;
  isLive: boolean;
  deepLink?: string;
}

export interface DiscoveryResult {
  devices: FireCubeDevice[];
  duration: number;
  method: 'adb' | 'network_scan' | 'manual';
  errors: string[];
}

export interface KeepAwakeSchedule {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  timezone?: string;
}

export interface SideloadProgress {
  operationId: string;
  currentDevice: string;
  progress: number;
  status: string;
  message: string;
}

// Known sports streaming apps with subscription detection methods
export interface KnownSportsApp {
  packageName: string;
  displayName: string;
  category: string;
  subscriptionCheckMethod: 'login_file' | 'shared_prefs' | 'api' | 'none';
  subscriptionIndicators: string[];
  deepLinkScheme?: string;
  iconUrl?: string;
}

export const KNOWN_SPORTS_APPS: KnownSportsApp[] = [
  {
    packageName: 'com.espn.score_center',
    displayName: 'ESPN',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['espn_plus_subscriber', 'subscription_status'],
    deepLinkScheme: 'sportscenter://',
    iconUrl: '/icons/espn.png'
  },
  {
    packageName: 'com.nfhs.network',
    displayName: 'NFHS Network',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['subscription_active', 'user_token'],
    iconUrl: '/icons/nfhs.png'
  },
  {
    packageName: 'com.nbcuni.nbc.liveextra',
    displayName: 'Peacock',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['premium_subscriber', 'subscription_tier'],
    deepLinkScheme: 'peacock://',
    iconUrl: '/icons/peacock.png'
  },
  {
    packageName: 'com.hulu.plus',
    displayName: 'Hulu Live TV',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['live_tv_subscriber', 'subscription_plan'],
    deepLinkScheme: 'hulu://',
    iconUrl: '/icons/hulu.png'
  },
  {
    packageName: 'com.google.android.youtube.tv',
    displayName: 'YouTube TV',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['subscription_active', 'account_type'],
    deepLinkScheme: 'https://tv.youtube.com',
    iconUrl: '/icons/youtubetv.png'
  },
  {
    packageName: 'com.fubo.android',
    displayName: 'FuboTV',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['subscription_status', 'plan_type'],
    deepLinkScheme: 'fubo://',
    iconUrl: '/icons/fubo.png'
  },
  {
    packageName: 'com.bamnetworks.mobile.android.gameday.mlb',
    displayName: 'MLB.TV',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['mlb_tv_subscriber', 'subscription_valid'],
    deepLinkScheme: 'mlbatbat://',
    iconUrl: '/icons/mlb.png'
  },
  {
    packageName: 'com.nba.game',
    displayName: 'NBA League Pass',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['league_pass_active', 'subscription_type'],
    deepLinkScheme: 'nba://',
    iconUrl: '/icons/nba.png'
  },
  {
    packageName: 'com.nhl.gc1112.free',
    displayName: 'NHL.TV',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['nhl_tv_subscriber', 'subscription_status'],
    iconUrl: '/icons/nhl.png'
  },
  {
    packageName: 'com.fox.now',
    displayName: 'FOX Sports',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['authenticated', 'provider_subscription'],
    deepLinkScheme: 'foxsports://',
    iconUrl: '/icons/foxsports.png'
  },
  {
    packageName: 'com.cbs.ott',
    displayName: 'Paramount+',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['subscription_tier', 'premium_access'],
    deepLinkScheme: 'cbsott://',
    iconUrl: '/icons/paramount.png'
  },
  {
    packageName: 'com.sling',
    displayName: 'Sling TV',
    category: 'Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['subscription_active', 'package_type'],
    deepLinkScheme: 'sling://',
    iconUrl: '/icons/sling.png'
  }
];

export const FIRECUBE_CONFIG = {
  ADB_PORT: 5555,
  CONNECTION_TIMEOUT: 5000,
  DISCOVERY_TIMEOUT: 30000,
  KEEP_ALIVE_INTERVAL: 300000, // 5 minutes
  SUBSCRIPTION_CHECK_INTERVAL: 3600000, // 1 hour
  SPORTS_CONTENT_REFRESH_INTERVAL: 600000, // 10 minutes
  DEFAULT_IP_RANGE: '192.168.1',
  MAX_CONCURRENT_OPERATIONS: 5
};
