
// DirecTV utility functions for sports bars

export interface DirecTVChannel {
  number: string
  name: string
  category: 'Sports' | 'News' | 'Entertainment' | 'Premium'
  hd?: boolean
  package?: string
}

export interface SportsFavorite {
  channel: string
  channelNumber: string
  name: string
  category: 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'College' | 'Other'
  description?: string
}

// Popular DirecTV sports channels for sports bars
export const DIRECTV_SPORTS_CHANNELS: DirecTVChannel[] = [
  // NFL
  { number: '212', name: 'NFL RedZone HD', category: 'Sports', hd: true, package: 'Sports Pack' },
  { number: '213', name: 'NFL Network HD', category: 'Sports', hd: true },
  
  // ESPN Family
  { number: '206', name: 'ESPN HD', category: 'Sports', hd: true },
  { number: '207', name: 'ESPN2 HD', category: 'Sports', hd: true },
  { number: '208', name: 'ESPNU HD', category: 'Sports', hd: true },
  { number: '209', name: 'ESPNEWS HD', category: 'Sports', hd: true },
  { number: '570', name: 'ESPN Classic', category: 'Sports' },
  
  // Fox Sports
  { number: '220', name: 'Fox Sports 1 HD', category: 'Sports', hd: true },
  { number: '221', name: 'Fox Sports 2 HD', category: 'Sports', hd: true },
  
  // League Networks
  { number: '215', name: 'NBA TV HD', category: 'Sports', hd: true },
  { number: '217', name: 'MLB Network HD', category: 'Sports', hd: true },
  { number: '219', name: 'NHL Network HD', category: 'Sports', hd: true },
  
  // Premium Sports
  { number: '611', name: 'TNT HD', category: 'Sports', hd: true },
  { number: '620', name: 'TBS HD', category: 'Sports', hd: true },
  
  // Regional Sports Networks (varies by location)
  { number: '640', name: 'Fox Sports Regional', category: 'Sports', hd: true },
  { number: '641', name: 'Fox Sports Regional Alt', category: 'Sports', hd: true },
  
  // College Sports
  { number: '614', name: 'Big Ten Network HD', category: 'Sports', hd: true },
  { number: '607', name: 'SEC Network HD', category: 'Sports', hd: true },
  { number: '608', name: 'ACC Network HD', category: 'Sports', hd: true },
  { number: '613', name: 'Pac-12 Network HD', category: 'Sports', hd: true },
  
  // International/Other
  { number: '623', name: 'beIN Sports HD', category: 'Sports', hd: true },
  { number: '624', name: 'beIN Sports en Español HD', category: 'Sports', hd: true },
  { number: '618', name: 'CBS Sports Network HD', category: 'Sports', hd: true },
  
  // Sunday Ticket (seasonal)
  { number: '701', name: 'NFL Sunday Ticket 1', category: 'Sports', hd: true, package: 'Sunday Ticket' },
  { number: '702', name: 'NFL Sunday Ticket 2', category: 'Sports', hd: true, package: 'Sunday Ticket' },
  { number: '703', name: 'NFL Sunday Ticket 3', category: 'Sports', hd: true, package: 'Sunday Ticket' },
  { number: '704', name: 'NFL Sunday Ticket 4', category: 'Sports', hd: true, package: 'Sunday Ticket' },
  { number: '705', name: 'NFL Sunday Ticket 5', category: 'Sports', hd: true, package: 'Sunday Ticket' },
  { number: '706', name: 'NFL Sunday Ticket 6', category: 'Sports', hd: true, package: 'Sunday Ticket' },
  { number: '707', name: 'NFL Sunday Ticket 7', category: 'Sports', hd: true, package: 'Sunday Ticket' },
  { number: '708', name: 'NFL Sunday Ticket 8', category: 'Sports', hd: true, package: 'Sunday Ticket' }
]

// Quick access sports favorites
export const SPORTS_FAVORITES: SportsFavorite[] = [
  { channel: '212', channelNumber: '212', name: 'NFL RedZone', category: 'NFL', description: 'Commercial-free NFL action' },
  { channel: '213', channelNumber: '213', name: 'NFL Network', category: 'NFL', description: 'Official NFL channel' },
  { channel: '206', channelNumber: '206', name: 'ESPN', category: 'Other', description: 'The worldwide leader in sports' },
  { channel: '207', channelNumber: '207', name: 'ESPN2', category: 'Other', description: 'Alternative ESPN programming' },
  { channel: '208', channelNumber: '208', name: 'ESPNU', category: 'College', description: 'College sports coverage' },
  { channel: '209', channelNumber: '209', name: 'ESPNEWS', category: 'Other', description: 'Sports news and highlights' },
  { channel: '220', channelNumber: '220', name: 'Fox Sports 1', category: 'Other', description: 'Fox sports programming' },
  { channel: '221', channelNumber: '221', name: 'Fox Sports 2', category: 'Other', description: 'Additional Fox sports content' },
  { channel: '215', channelNumber: '215', name: 'NBA TV', category: 'NBA', description: 'Official NBA channel' },
  { channel: '217', channelNumber: '217', name: 'MLB Network', category: 'MLB', description: 'Official MLB channel' },
  { channel: '219', channelNumber: '219', name: 'NHL Network', category: 'NHL', description: 'Official NHL channel' },
  { channel: '611', channelNumber: '611', name: 'TNT', category: 'Other', description: 'NBA and other sports' },
  { channel: '620', channelNumber: '620', name: 'TBS', category: 'Other', description: 'MLB playoffs and other sports' },
  { channel: '618', channelNumber: '618', name: 'CBS Sports Network', category: 'Other', description: 'CBS sports programming' }
]

// DirecTV command sequences for common sports bar operations
export const SPORTS_BAR_SEQUENCES = {
  // Quick channel changes with confirmation
  quickChannelChange: (channelNumber: string) => {
    const digits = channelNumber.split('')
    const commands = digits.map(digit => ({ command: digit, delay: 250 }))
    commands.push({ command: 'ENTER', delay: 300 })
    return commands
  },
  
  // Guide navigation for sports
  openSportsGuide: () => [
    { command: 'GUIDE', delay: 1000 },
    { command: 'RED', delay: 500 }, // Often the sports filter button
  ],
  
  // Quick access to recorded games
  accessRecordings: () => [
    { command: 'LIST', delay: 1000 },
    { command: 'DOWN', delay: 300 },
    { command: 'DOWN', delay: 300 },
    { command: 'OK', delay: 500 }
  ],
  
  // Volume control for bar environment
  muteForCommercials: () => [
    { command: 'MUTE', delay: 100 }
  ],
  
  unmuteAfterCommercials: () => [
    { command: 'MUTE', delay: 100 }
  ]
}

// Helper function to validate DirecTV IP address format
export function validateDirecTVIP(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  return ipRegex.test(ip)
}

// Helper function to get channel info by number
export function getChannelInfo(channelNumber: string): DirecTVChannel | undefined {
  return DIRECTV_SPORTS_CHANNELS.find(channel => channel.number === channelNumber)
}

// Helper function to get channels by category
export function getChannelsByCategory(category: string): DirecTVChannel[] {
  return DIRECTV_SPORTS_CHANNELS.filter(channel => channel.category === category)
}

// Helper function to get sports favorites by category
export function getSportsFavoritesByCategory(category: string): SportsFavorite[] {
  if (category === 'All') return SPORTS_FAVORITES
  return SPORTS_FAVORITES.filter(favorite => favorite.category === category)
}

// Common DirecTV receiver models and their capabilities
export const DIRECTV_RECEIVER_TYPES = {
  'Genie HD DVR': {
    model: 'HR54/HR44',
    capabilities: ['HD', 'DVR', 'Whole Home', '4K Ready'],
    maxTuners: 5
  },
  'Genie Mini': {
    model: 'C61K/C51',
    capabilities: ['HD', 'Whole Home Client'],
    maxTuners: 0
  },
  'HR Series DVR': {
    model: 'HR24/HR23/HR22',
    capabilities: ['HD', 'DVR'],
    maxTuners: 2
  },
  'C61K Mini': {
    model: 'C61K',
    capabilities: ['4K', 'HD', 'Whole Home Client'],
    maxTuners: 0
  },
  'HS17 Server': {
    model: 'HS17',
    capabilities: ['4K', 'HD', 'Whole Home Server', '16 Tuners'],
    maxTuners: 16
  }
}

export type DirecTVReceiverType = keyof typeof DIRECTV_RECEIVER_TYPES

// Helper function to get receiver capabilities
export function getReceiverCapabilities(receiverType: DirecTVReceiverType) {
  return DIRECTV_RECEIVER_TYPES[receiverType]
}
