
import { exec } from 'child_process';
import { promisify } from 'util';

import { logger } from '@/lib/logger'
const execAsync = promisify(exec);

export interface CECDevice {
  address: string;
  name: string;
  vendor: string;
  osdName: string;
  cecVersion: string;
  powerStatus: string;
  language: string;
}

export interface CECCommand {
  device: string;
  command: string;
  params?: string[];
}

export class CECService {
  private static instance: CECService;
  private cecClientPath = 'cec-client';
  private isInitialized = false;
  private deviceCache: CECDevice[] = [];
  private lastScan: number = 0;
  private scanInterval = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): CECService {
    if (!CECService.instance) {
      CECService.instance = new CECService();
    }
    return CECService.instance;
  }

  /**
   * Initialize CEC service and detect adapters
   */
  async initialize(): Promise<{ success: boolean; message: string; adapters: string[] }> {
    try {
      const { stdout, stderr } = await execAsync(`${this.cecClientPath} -l`);
      
      if (stderr && stderr.includes('ERROR')) {
        return {
          success: false,
          message: 'CEC adapter not found. Please connect the Pulse-Eight USB CEC adapter.',
          adapters: [] as any[]
        };
      }

      const adapters: string[] = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('com port:') || line.includes('/dev/')) {
          const match = line.match(/com port:\s*(.+)/);
          if (match) {
            adapters.push(match[1].trim());
          }
        }
      }

      this.isInitialized = adapters.length > 0;
      
      return {
        success: this.isInitialized,
        message: this.isInitialized 
          ? `CEC adapter initialized: ${adapters.join(', ')}` 
          : 'No CEC adapters detected',
        adapters
      };
    } catch (error: any) {
      return {
        success: false,
        message: `CEC initialization error: ${error.message}`,
        adapters: [] as any[]
      };
    }
  }

  /**
   * Scan for CEC devices on the bus
   */
  async scanDevices(forceRefresh = false): Promise<CECDevice[]> {
    const now = Date.now();
    
    // Return cached devices if scan was recent
    if (!forceRefresh && this.deviceCache.length > 0 && (now - this.lastScan) < this.scanInterval) {
      return this.deviceCache;
    }

    try {
      const { stdout } = await execAsync(`echo "scan" | ${this.cecClientPath} -s -d 1`);
      const devices: CECDevice[] = [];
      
      const lines = stdout.split('\n');
      let currentDevice: Partial<CECDevice> = {};
      
      for (const line of lines) {
        if (line.includes('device #')) {
          if (currentDevice.address) {
            devices.push(currentDevice as CECDevice);
          }
          const addressMatch = line.match(/device #(\d+):/);
          if (addressMatch) {
            currentDevice = { address: addressMatch[1] };
          }
        } else if (line.includes('osd name:')) {
          const match = line.match(/osd name:\s*(.+)/);
          if (match) currentDevice.osdName = match[1].trim();
        } else if (line.includes('vendor:')) {
          const match = line.match(/vendor:\s*(.+)/);
          if (match) currentDevice.vendor = match[1].trim();
        } else if (line.includes('CEC version:')) {
          const match = line.match(/CEC version:\s*(.+)/);
          if (match) currentDevice.cecVersion = match[1].trim();
        } else if (line.includes('power status:')) {
          const match = line.match(/power status:\s*(.+)/);
          if (match) currentDevice.powerStatus = match[1].trim();
        } else if (line.includes('language:')) {
          const match = line.match(/language:\s*(.+)/);
          if (match) currentDevice.language = match[1].trim();
        }
      }
      
      if (currentDevice.address) {
        devices.push(currentDevice as CECDevice);
      }
      
      this.deviceCache = devices;
      this.lastScan = now;
      
      return devices;
    } catch (error: any) {
      logger.error('CEC scan error:', error);
      return [];
    }
  }

  /**
   * Send a raw CEC command
   */
  async sendRawCommand(command: string): Promise<{ success: boolean; message: string }> {
    try {
      const { stdout, stderr } = await execAsync(
        `echo "tx ${command}" | ${this.cecClientPath} -s -d 1`,
        { timeout: 5000 }
      );
      
      return {
        success: !stderr.includes('ERROR') && !stderr.includes('FAILED'),
        message: stdout + stderr
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Command failed: ${error.message}`
      };
    }
  }

  /**
   * Power on a TV (address 0 = TV)
   */
  async powerOn(tvAddress = '0'): Promise<{ success: boolean; message: string }> {
    return this.sendRawCommand(`1${tvAddress}:04`); // Image View On
  }

  /**
   * Power off a TV (standby)
   */
  async powerOff(tvAddress = '0'): Promise<{ success: boolean; message: string }> {
    return this.sendRawCommand(`1${tvAddress}:36`); // Standby
  }

  /**
   * Set TV to specific HDMI input
   * @param inputNumber - HDMI input number (1-based)
   */
  async setInput(inputNumber: number, tvAddress = '0'): Promise<{ success: boolean; message: string }> {
    // CEC Active Source command
    const portNumber = (inputNumber - 1).toString(16).padStart(2, '0');
    return this.sendRawCommand(`1${tvAddress}:82:${portNumber}:00`);
  }

  /**
   * Set volume on TV
   * @param volume - Volume level (0-100)
   */
  async setVolume(volume: number, tvAddress = '0'): Promise<{ success: boolean; message: string }> {
    const volumeHex = Math.min(100, Math.max(0, volume)).toString(16).padStart(2, '0');
    return this.sendRawCommand(`1${tvAddress}:7A:${volumeHex}`);
  }

  /**
   * Mute/unmute TV
   */
  async mute(tvAddress = '0'): Promise<{ success: boolean; message: string }> {
    return this.sendRawCommand(`1${tvAddress}:44:43`); // User Control Pressed - Mute
  }

  /**
   * Toggle TV power
   */
  async togglePower(tvAddress = '0'): Promise<{ success: boolean; message: string }> {
    // First check power status
    const devices = await this.scanDevices(true);
    const tv = devices.find(d => d.address === tvAddress);
    
    if (tv && tv.powerStatus.toLowerCase().includes('on')) {
      return this.powerOff(tvAddress);
    } else {
      return this.powerOn(tvAddress);
    }
  }

  /**
   * Get current power status of a device
   */
  async getPowerStatus(tvAddress = '0'): Promise<{ status: string; devices: CECDevice[] }> {
    const devices = await this.scanDevices(false);
    const tv = devices.find(d => d.address === tvAddress);
    
    return {
      status: tv?.powerStatus || 'unknown',
      devices
    };
  }

  /**
   * Send key press to TV (for navigation)
   */
  async sendKey(key: string, tvAddress = '0'): Promise<{ success: boolean; message: string }> {
    const keyCodes: { [key: string]: string } = {
      'up': '01',
      'down': '02',
      'left': '03',
      'right': '04',
      'select': '00',
      'back': '0D',
      'home': '09',
      'menu': '09',
    };

    const keyCode = keyCodes[key.toLowerCase()];
    if (!keyCode) {
      return { success: false, message: `Unknown key: ${key}` };
    }

    return this.sendRawCommand(`1${tvAddress}:44:${keyCode}`);
  }
}

// Export singleton instance
export const cecService = CECService.getInstance();
