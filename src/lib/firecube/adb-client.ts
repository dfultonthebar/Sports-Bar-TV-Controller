
// ADB Client for Fire Cube Communication

import { exec } from 'child_process';
import { promisify } from 'util';
import { FIRECUBE_CONFIG } from './types';

const execAsync = promisify(exec);

export class ADBClient {
  private ipAddress: string;
  private port: number;

  constructor(ipAddress: string, port: number = FIRECUBE_CONFIG.ADB_PORT) {
    this.ipAddress = ipAddress;
    this.port = port;
  }

  /**
   * Connect to Fire Cube via ADB
   */
  async connect(): Promise<boolean> {
    try {
      console.log(`[ADB CLIENT] Connecting to ${this.ipAddress}:${this.port}...`);
      
      const { stdout, stderr } = await execAsync(
        `adb connect ${this.ipAddress}:${this.port}`,
        { timeout: FIRECUBE_CONFIG.CONNECTION_TIMEOUT }
      );
      
      console.log(`[ADB CLIENT] Connect stdout:`, stdout);
      if (stderr) console.log(`[ADB CLIENT] Connect stderr:`, stderr);
      
      const success = stdout.includes('connected') || stdout.includes('already connected');
      console.log(`[ADB CLIENT] Connection result:`, success ? 'SUCCESS' : 'FAILED');
      
      return success;
    } catch (error: any) {
      // Check if ADB command is not found
      if (error.message && (error.message.includes('adb') && (error.message.includes('not found') || error.message.includes('command not found')))) {
        console.error(`[ADB CLIENT] ❌ ADB command-line tool not found on system`);
        throw new Error('ADB command-line tool not installed. Please install with: sudo apt-get install adb');
      }
      
      console.error(`[ADB CLIENT] ❌ Failed to connect to ${this.ipAddress}:`, error);
      return false;
    }
  }

  /**
   * Disconnect from Fire Cube
   */
  async disconnect(): Promise<void> {
    try {
      await execAsync(`adb disconnect ${this.ipAddress}:${this.port}`);
    } catch (error) {
      console.error(`Failed to disconnect from ${this.ipAddress}:`, error);
    }
  }

  /**
   * Test if device is reachable
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(`[ADB CLIENT] Testing connection to ${this.ipAddress}:${this.port}...`);
      
      const connected = await this.connect();
      if (!connected) {
        console.log(`[ADB CLIENT] Initial connection failed`);
        return false;
      }

      console.log(`[ADB CLIENT] Sending test command...`);
      const { stdout } = await execAsync(
        `adb -s ${this.ipAddress}:${this.port} shell echo "test"`,
        { timeout: FIRECUBE_CONFIG.CONNECTION_TIMEOUT }
      );
      
      const result = stdout.trim() === 'test';
      console.log(`[ADB CLIENT] Test command result:`, result ? 'PASS' : 'FAIL');
      console.log(`[ADB CLIENT] Test output:`, stdout.trim());
      
      return result;
    } catch (error: any) {
      console.error(`[ADB CLIENT] ❌ Test connection error:`, error);
      
      // Rethrow if ADB is not installed
      if (error.message && error.message.includes('ADB command-line tool not installed')) {
        throw error;
      }
      
      return false;
    }
  }

  /**
   * Execute shell command on Fire Cube
   */
  async shell(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `adb -s ${this.ipAddress}:${this.port} shell "${command}"`,
        { timeout: 30000 }
      );
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Shell command failed: ${error.message}`);
    }
  }

  /**
   * Get device properties
   */
  async getDeviceInfo(): Promise<Record<string, string>> {
    try {
      const output = await this.shell('getprop');
      const props: Record<string, string> = {};
      
      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/\[(.*?)\]: \[(.*?)\]/);
        if (match) {
          props[match[1]] = match[2];
        }
      }
      
      return props;
    } catch (error) {
      console.error('Failed to get device info:', error);
      return {};
    }
  }

  /**
   * Get list of installed packages
   */
  async getInstalledPackages(): Promise<string[]> {
    try {
      const output = await this.shell('pm list packages');
      return output
        .split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', '').trim());
    } catch (error) {
      console.error('Failed to get installed packages:', error);
      return [];
    }
  }

  /**
   * Get package information
   */
  async getPackageInfo(packageName: string): Promise<any> {
    try {
      const output = await this.shell(`dumpsys package ${packageName}`);
      
      const info: any = {
        packageName,
        versionName: null,
        versionCode: null,
        firstInstallTime: null,
        lastUpdateTime: null
      };

      // Parse version info
      const versionMatch = output.match(/versionName=([\d.]+)/);
      if (versionMatch) info.versionName = versionMatch[1];

      const versionCodeMatch = output.match(/versionCode=(\d+)/);
      if (versionCodeMatch) info.versionCode = parseInt(versionCodeMatch[1]);

      const firstInstallMatch = output.match(/firstInstallTime=(.*)/);
      if (firstInstallMatch) info.firstInstallTime = firstInstallMatch[1].trim();

      const lastUpdateMatch = output.match(/lastUpdateTime=(.*)/);
      if (lastUpdateMatch) info.lastUpdateTime = lastUpdateMatch[1].trim();

      return info;
    } catch (error) {
      console.error(`Failed to get package info for ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Get app label (display name)
   */
  async getAppLabel(packageName: string): Promise<string> {
    try {
      const output = await this.shell(`pm dump ${packageName} | grep -A 1 "applicationInfo"`);
      const labelMatch = output.match(/labelRes=0x[0-9a-f]+ label=(.*)/);
      if (labelMatch) {
        return labelMatch[1].trim();
      }
      
      // Fallback: try to get from package name
      return packageName.split('.').pop() || packageName;
    } catch (error) {
      return packageName;
    }
  }

  /**
   * Check if app is a system app
   */
  async isSystemApp(packageName: string): Promise<boolean> {
    try {
      const output = await this.shell(`pm path ${packageName}`);
      return output.includes('/system/') || output.includes('/vendor/');
    } catch (error) {
      return false;
    }
  }

  /**
   * Launch app by package name
   */
  async launchApp(packageName: string): Promise<boolean> {
    try {
      await this.shell(`monkey -p ${packageName} 1`);
      return true;
    } catch (error) {
      console.error(`Failed to launch ${packageName}:`, error);
      return false;
    }
  }

  /**
   * Stop app
   */
  async stopApp(packageName: string): Promise<boolean> {
    try {
      await this.shell(`am force-stop ${packageName}`);
      return true;
    } catch (error) {
      console.error(`Failed to stop ${packageName}:`, error);
      return false;
    }
  }

  /**
   * Send key event
   */
  async sendKey(keyCode: number | string): Promise<boolean> {
    try {
      await this.shell(`input keyevent ${keyCode}`);
      return true;
    } catch (error) {
      console.error(`Failed to send key ${keyCode}:`, error);
      return false;
    }
  }

  /**
   * Keep device awake (prevent sleep)
   */
  async keepAwake(): Promise<boolean> {
    try {
      // Wake up device
      await this.sendKey(224); // KEYCODE_WAKEUP
      
      // Disable screen timeout temporarily
      await this.shell('settings put system screen_off_timeout 2147483647');
      
      return true;
    } catch (error) {
      console.error('Failed to keep device awake:', error);
      return false;
    }
  }

  /**
   * Allow device to sleep
   */
  async allowSleep(): Promise<boolean> {
    try {
      // Reset screen timeout to default (2 minutes)
      await this.shell('settings put system screen_off_timeout 120000');
      return true;
    } catch (error) {
      console.error('Failed to reset sleep settings:', error);
      return false;
    }
  }

  /**
   * Get current screen state
   */
  async getScreenState(): Promise<'on' | 'off' | 'unknown'> {
    try {
      const output = await this.shell('dumpsys power | grep "Display Power"');
      if (output.includes('state=ON')) return 'on';
      if (output.includes('state=OFF')) return 'off';
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Pull file from device
   */
  async pullFile(remotePath: string, localPath: string): Promise<boolean> {
    try {
      await execAsync(
        `adb -s ${this.ipAddress}:${this.port} pull "${remotePath}" "${localPath}"`,
        { timeout: 60000 }
      );
      return true;
    } catch (error) {
      console.error(`Failed to pull file ${remotePath}:`, error);
      return false;
    }
  }

  /**
   * Push file to device
   */
  async pushFile(localPath: string, remotePath: string): Promise<boolean> {
    try {
      await execAsync(
        `adb -s ${this.ipAddress}:${this.port} push "${localPath}" "${remotePath}"`,
        { timeout: 60000 }
      );
      return true;
    } catch (error) {
      console.error(`Failed to push file to ${remotePath}:`, error);
      return false;
    }
  }

  /**
   * Install APK
   */
  async installApk(apkPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `adb -s ${this.ipAddress}:${this.port} install -r "${apkPath}"`,
        { timeout: 120000 }
      );
      return stdout.includes('Success');
    } catch (error) {
      console.error(`Failed to install APK ${apkPath}:`, error);
      return false;
    }
  }

  /**
   * Backup app APK
   */
  async backupApk(packageName: string, outputPath: string): Promise<boolean> {
    try {
      // Get APK path
      const pathOutput = await this.shell(`pm path ${packageName}`);
      const apkPath = pathOutput.replace('package:', '').trim();
      
      if (!apkPath) {
        throw new Error('APK path not found');
      }

      // Pull APK
      return await this.pullFile(apkPath, outputPath);
    } catch (error) {
      console.error(`Failed to backup APK for ${packageName}:`, error);
      return false;
    }
  }

  /**
   * Check shared preferences for subscription indicators
   */
  async checkSharedPreferences(packageName: string, keys: string[]): Promise<Record<string, any>> {
    try {
      const prefsPath = `/data/data/${packageName}/shared_prefs/`;
      const files = await this.shell(`ls ${prefsPath}`);
      
      const results: Record<string, any> = {};
      
      for (const key of keys) {
        try {
          const grepResult = await this.shell(
            `grep -r "${key}" ${prefsPath} 2>/dev/null || echo ""`
          );
          
          if (grepResult && grepResult.trim()) {
            results[key] = grepResult.trim();
          }
        } catch (error) {
          // Key not found, continue
        }
      }
      
      return results;
    } catch (error) {
      console.error(`Failed to check shared preferences for ${packageName}:`, error);
      return {};
    }
  }

  /**
   * Get device serial number
   */
  async getSerialNumber(): Promise<string | null> {
    try {
      const props = await this.getDeviceInfo();
      return props['ro.serialno'] || props['ro.boot.serialno'] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get device model
   */
  async getModel(): Promise<string | null> {
    try {
      const props = await this.getDeviceInfo();
      return props['ro.product.model'] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get software version
   */
  async getSoftwareVersion(): Promise<string | null> {
    try {
      const props = await this.getDeviceInfo();
      return props['ro.build.version.release'] || null;
    } catch (error) {
      return null;
    }
  }
}
