
// SHEF API Client for DirecTV

import axios, { AxiosInstance } from 'axios';
import { DIRECTV_CONFIG } from './constants';
import type { SHEFResponse, SHEFVersionResponse, SHEFTunedResponse, SHEFLocationsResponse } from './types';

import { logger } from '@/lib/logger'
export class SHEFClient {
  private client: AxiosInstance;
  private ipAddress: string;
  private port: number;

  constructor(ipAddress: string, port: number = DIRECTV_CONFIG.SHEF_PORT) {
    this.ipAddress = ipAddress;
    this.port = port;
    this.client = axios.create({
      baseURL: `http://${ipAddress}:${port}`,
      timeout: DIRECTV_CONFIG.REQUEST_TIMEOUT,
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Get SHEF version and system information
   */
  async getVersion(): Promise<SHEFVersionResponse> {
    const response = await this.client.get<SHEFVersionResponse>('/info/getVersion');
    return response.data;
  }

  /**
   * Get available options/commands
   */
  async getOptions(): Promise<SHEFResponse> {
    const response = await this.client.get<SHEFResponse>('/info/getOptions');
    return response.data;
  }

  /**
   * Get current mode (active/standby)
   */
  async getMode(clientAddr: string = '0'): Promise<SHEFResponse> {
    const response = await this.client.get<SHEFResponse>('/info/mode', {
      params: { clientAddr },
    });
    return response.data;
  }

  /**
   * Get locations (Genie systems only)
   */
  async getLocations(): Promise<SHEFLocationsResponse> {
    const response = await this.client.get<SHEFLocationsResponse>('/info/getLocations');
    return response.data;
  }

  /**
   * Get currently tuned program
   */
  async getTuned(clientAddr: string = '0', videoWindow: string = 'primary'): Promise<SHEFTunedResponse> {
    const response = await this.client.get<SHEFTunedResponse>('/tv/getTuned', {
      params: { clientAddr, videoWindow },
    });
    return response.data;
  }

  /**
   * Get program info for a specific channel
   */
  async getProgramInfo(
    major: number,
    minor?: number,
    time?: number,
    clientAddr: string = '0'
  ): Promise<SHEFResponse> {
    const params: any = { major, clientAddr };
    if (minor !== undefined) params.minor = minor;
    if (time !== undefined) params.time = time;

    const response = await this.client.get<SHEFResponse>('/tv/getProgInfo', { params });
    return response.data;
  }

  /**
   * Tune to a specific channel
   */
  async tune(
    major: number,
    minor?: number,
    clientAddr: string = '0',
    videoWindow: string = 'primary'
  ): Promise<SHEFResponse> {
    const params: any = { major, clientAddr, videoWindow };
    if (minor !== undefined) params.minor = minor;

    const response = await this.client.get<SHEFResponse>('/tv/tune', { params });
    return response.data;
  }

  /**
   * Process a remote key press
   */
  async processKey(key: string, clientAddr: string = '0'): Promise<SHEFResponse> {
    const response = await this.client.get<SHEFResponse>('/remote/processKey', {
      params: { key, clientAddr },
    });
    return response.data;
  }

  /**
   * Process a serial command
   */
  async processSerialCommand(cmd: string, clientAddr: string = '0'): Promise<SHEFResponse> {
    const response = await this.client.get<SHEFResponse>('/serial/processCommand', {
      params: { cmd, clientAddr },
    });
    return response.data;
  }

  /**
   * Test connection to the box
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getVersion();
      return response.status.code === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if SHEF is enabled
   */
  async isShefEnabled(): Promise<boolean> {
    try {
      const response = await this.getVersion();
      return response.status.code === 200;
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.error(
          'DirecTV SHEF API returned 403 Forbidden. External Device Access is disabled. ' +
          'To enable: MENU → Settings & Help → Settings → Whole-Home → External Device → Enable "External Access"'
        );
        return false; // SHEF not enabled
      }
      throw error;
    }
  }

  /**
   * Get box capabilities
   */
  async getCapabilities(): Promise<string[]> {
    try {
      const options = await this.getOptions();
      if (options.options && Array.isArray(options.options)) {
        return options.options.map((opt: any) => opt.path);
      }
      return [];
    } catch (error) {
      return [];
    }
  }
}
