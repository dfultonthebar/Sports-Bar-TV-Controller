
// DirecTV Constants and Configuration

export const DIRECTV_CONFIG = {
  SHEF_PORT: 8080,
  SSDP_PORT: 1900,
  SSDP_ADDRESS: '239.255.255.250',
  DISCOVERY_TIMEOUT: 5000,
  REQUEST_TIMEOUT: 3000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
};

export const MODEL_FAMILIES: Record<string, { family: string; isServer: boolean; isClient: boolean }> = {
  // Genie Servers
  HR34: { family: 'genie-server', isServer: true, isClient: false },
  HR44: { family: 'genie-server', isServer: true, isClient: false },
  HR54: { family: 'genie-server', isServer: true, isClient: false },
  HS17: { family: 'genie-server', isServer: true, isClient: false },
  
  // Genie Clients
  C31: { family: 'genie-client', isServer: false, isClient: true },
  C41: { family: 'genie-client', isServer: false, isClient: true },
  C51: { family: 'genie-client', isServer: false, isClient: true },
  C61: { family: 'genie-client', isServer: false, isClient: true },
  
  // HD DVRs
  HR20: { family: 'hd-dvr', isServer: false, isClient: false },
  HR21: { family: 'hd-dvr', isServer: false, isClient: false },
  HR22: { family: 'hd-dvr', isServer: false, isClient: false },
  HR23: { family: 'hd-dvr', isServer: false, isClient: false },
  HR24: { family: 'hd-dvr', isServer: false, isClient: false },
  
  // HD Receivers
  H21: { family: 'hd-receiver', isServer: false, isClient: false },
  H23: { family: 'hd-receiver', isServer: false, isClient: false },
  H24: { family: 'hd-receiver', isServer: false, isClient: false },
  H25: { family: 'hd-receiver', isServer: false, isClient: false },
};

export const REMOTE_KEYS = {
  // Power
  POWER_ON: 'poweron',
  POWER_OFF: 'poweroff',
  POWER: 'power',
  
  // Navigation
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  SELECT: 'select',
  
  // Menu
  MENU: 'menu',
  GUIDE: 'guide',
  INFO: 'info',
  EXIT: 'exit',
  BACK: 'back',
  LIST: 'list',
  
  // Channels
  CHAN_UP: 'chanup',
  CHAN_DOWN: 'chandown',
  PREV: 'prev',
  
  // Numbers
  NUM_0: '0',
  NUM_1: '1',
  NUM_2: '2',
  NUM_3: '3',
  NUM_4: '4',
  NUM_5: '5',
  NUM_6: '6',
  NUM_7: '7',
  NUM_8: '8',
  NUM_9: '9',
  DASH: 'dash',
  ENTER: 'enter',
  
  // Playback
  PLAY: 'play',
  PAUSE: 'pause',
  STOP: 'stop',
  REW: 'rew',
  FFWD: 'ffwd',
  RECORD: 'record',
  REPLAY: 'replay',
  ADVANCE: 'advance',
  
  // Color Buttons
  RED: 'red',
  GREEN: 'green',
  YELLOW: 'yellow',
  BLUE: 'blue',
  
  // Format
  FORMAT: 'format',
  ACTIVE: 'active',
};

export const SERIAL_COMMANDS = {
  REBOOT: '0xf7',
  SIGNAL_STRENGTH: 'FA90',
};

export const COMMON_SPORTS_CHANNELS = [
  { number: 206, name: 'ESPN' },
  { number: 207, name: 'ESPN2' },
  { number: 208, name: 'ESPNEWS' },
  { number: 209, name: 'ESPNU' },
  { number: 219, name: 'Fox Sports 1' },
  { number: 220, name: 'Fox Sports 2' },
  { number: 221, name: 'NBC Sports Network' },
  { number: 212, name: 'NFL Network' },
  { number: 213, name: 'NFL RedZone' },
  { number: 214, name: 'MLB Network' },
  { number: 215, name: 'NBA TV' },
  { number: 216, name: 'NHL Network' },
  { number: 217, name: 'Golf Channel' },
  { number: 218, name: 'Tennis Channel' },
  { number: 610, name: 'Big Ten Network' },
  { number: 611, name: 'SEC Network' },
  { number: 612, name: 'ACC Network' },
  { number: 613, name: 'Pac-12 Network' },
];

export const CHANNEL_CATEGORIES = {
  SPORTS: 'sports',
  NEWS: 'news',
  ENTERTAINMENT: 'entertainment',
  MOVIES: 'movies',
  KIDS: 'kids',
  MUSIC: 'music',
  LIFESTYLE: 'lifestyle',
  SHOPPING: 'shopping',
  RELIGIOUS: 'religious',
  INTERNATIONAL: 'international',
  LOCAL: 'local',
  PREMIUM: 'premium',
};
