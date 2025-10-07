
// DirecTV Type Definitions

export interface DirecTVBox {
  id: string;
  ipAddress: string;
  macAddress?: string;
  model?: string;
  modelFamily?: string;
  location?: string;
  shefVersion?: string;
  isServer: boolean;
  isClient: boolean;
  serverMacAddress?: string;
  capabilities?: string[];
  status: 'discovered' | 'online' | 'offline' | 'error';
  shefEnabled: boolean;
  lastSeen?: Date;
  discoveredAt: Date;
}

export interface DirecTVChannel {
  id: string;
  channelNumber: number;
  subChannel?: number;
  channelName: string;
  callsign?: string;
  network?: string;
  stationId?: string;
  isHD: boolean;
  isOffAir: boolean;
  isPPV: boolean;
  category?: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
}

export interface DirecTVCommand {
  id: string;
  model: string;
  commandType: string;
  commandName: string;
  commandCode: string;
  endpoint?: string;
  parameters?: Record<string, any>;
  description?: string;
  category?: string;
}

export interface SHEFResponse {
  status: {
    query: string;
    code: number;
    commandResult: number;
    msg: string;
  };
  [key: string]: any;
}

export interface SHEFVersionResponse extends SHEFResponse {
  version: string;
  systemTime: number;
}

export interface SHEFTunedResponse extends SHEFResponse {
  stationId: string;
  programId: string;
  startTime: number;
  duration: number;
  major: number;
  minor: number;
  callsign: string;
  title: string;
  episodeTitle?: string;
  isOffAir: boolean;
  isVod: boolean;
  isPpv: boolean;
  isRecording: boolean;
  rating: string;
}

export interface SHEFLocationsResponse extends SHEFResponse {
  locations: Array<{
    locationName: string;
    clientAddr: string;
  }>;
}

export interface DiscoveryResult {
  boxes: DirecTVBox[];
  method: 'ssdp' | 'port_scan' | 'manual';
  duration: number;
  errors: string[];
}

export interface ModelInfo {
  model: string;
  family: 'genie-server' | 'genie-client' | 'hd-dvr' | 'hd-receiver' | 'unknown';
  isServer: boolean;
  isClient: boolean;
  capabilities: string[];
}
