
// DirecTV Box Discovery Service

import { Client as SSDPClient } from 'node-ssdp';
import { SHEFClient } from './shef-client';
import { DIRECTV_CONFIG, MODEL_FAMILIES } from './constants';
import type { DirecTVBox, DiscoveryResult, ModelInfo } from './types';

import { logger } from '@/lib/logger'
export class DirecTVDiscovery {
  private discoveredBoxes: Map<string, DirecTVBox> = new Map();

  /**
   * Discover DirecTV boxes using SSDP
   */
  async discoverViaSsdp(timeout: number = DIRECTV_CONFIG.DISCOVERY_TIMEOUT): Promise<string[]> {
    return new Promise((resolve) => {
      const client = new SSDPClient();
      const foundIPs = new Set<string>();

      client.on('response', (headers: any, statusCode: number, rinfo: any) => {
        if (headers.ST && headers.ST.includes('urn:schemas-upnp-org:device')) {
          foundIPs.add(rinfo.address);
        }
      });

      client.search('ssdp:all');

      setTimeout(() => {
        client.stop();
        resolve(Array.from(foundIPs));
      }, timeout);
    });
  }

  /**
   * Scan network for DirecTV boxes on port 8080
   */
  async scanNetwork(ipRange: string = '192.168.1'): Promise<string[]> {
    const foundIPs: string[] = [];
    const promises: Promise<void>[] = [];

    // Scan IP range (1-254)
    for (let i = 1; i <= 254; i++) {
      const ip = `${ipRange}.${i}`;
      promises.push(
        this.testPort(ip, DIRECTV_CONFIG.SHEF_PORT)
          .then((isOpen) => {
            if (isOpen) {
              foundIPs.push(ip);
            }
          })
          .catch(() => {
            // Ignore errors
          })
      );
    }

    await Promise.all(promises);
    return foundIPs;
  }

  /**
   * Test if a port is open on an IP address
   */
  private async testPort(ip: string, port: number): Promise<boolean> {
    const client = new SHEFClient(ip, port);
    try {
      return await client.testConnection();
    } catch (error) {
      return false;
    }
  }

  /**
   * Identify a DirecTV box and get its details
   */
  async identifyBox(ipAddress: string): Promise<DirecTVBox | null> {
    const client = new SHEFClient(ipAddress);

    try {
      // Test connection and get version
      const versionResponse = await client.getVersion();
      
      if (versionResponse.status.code !== 200) {
        return null;
      }

      // Get capabilities
      const capabilities = await client.getCapabilities();

      // Try to get locations (Genie systems)
      let locations: any[] = [];
      let isServer = false;
      try {
        const locationsResponse = await client.getLocations();
        if (locationsResponse.locations) {
          locations = locationsResponse.locations;
          isServer = true;
        }
      } catch (error) {
        // Not a Genie server or command not supported
      }

      // Detect model from capabilities and responses
      const modelInfo = this.detectModel(capabilities, isServer);

      // Check if SHEF is enabled
      const shefEnabled = await client.isShefEnabled();

      const box: DirecTVBox = {
        id: '', // Will be set by database
        ipAddress,
        macAddress: undefined,
        model: modelInfo.model,
        modelFamily: modelInfo.family,
        location: undefined,
        shefVersion: versionResponse.version,
        isServer: modelInfo.isServer,
        isClient: modelInfo.isClient,
        serverMacAddress: undefined,
        capabilities: modelInfo.capabilities,
        status: shefEnabled ? 'online' : 'discovered',
        shefEnabled,
        lastSeen: new Date(),
        discoveredAt: new Date(),
      };

      return box;
    } catch (error: any) {
      logger.error(`Error identifying box at ${ipAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Detect model from capabilities
   */
  private detectModel(capabilities: string[], isServer: boolean): ModelInfo {
    const hasLocations = capabilities.includes('/info/getLocations');
    
    if (hasLocations || isServer) {
      // Genie server
      return {
        model: 'HR44', // Default to HR44, could be HR34, HR54, or HS17
        family: 'genie-server',
        isServer: true,
        isClient: false,
        capabilities,
      };
    }

    // Check for other model-specific capabilities
    // This is a simplified detection - in reality, you'd need more sophisticated logic
    return {
      model: 'HR24', // Default to HR24
      family: 'hd-dvr',
      isServer: false,
      isClient: false,
      capabilities,
    };
  }

  /**
   * Full discovery process
   */
  async discover(method: 'ssdp' | 'port_scan' | 'both' = 'both'): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let foundIPs: string[] = [];

    try {
      if (method === 'ssdp' || method === 'both') {
        logger.info('Starting SSDP discovery...');
        const ssdpIPs = await this.discoverViaSsdp();
        foundIPs.push(...ssdpIPs);
        logger.info(`SSDP found ${ssdpIPs.length} potential devices`);
      }

      if (method === 'port_scan' || method === 'both') {
        logger.info('Starting port scan...');
        const scanIPs = await this.scanNetwork();
        foundIPs.push(...scanIPs);
        logger.info(`Port scan found ${scanIPs.length} devices`);
      }

      // Remove duplicates
      foundIPs = Array.from(new Set(foundIPs));
      logger.info(`Total unique IPs found: ${foundIPs.length}`);

      // Identify each box
      const boxes: DirecTVBox[] = [];
      for (const ip of foundIPs) {
        try {
          logger.info(`Identifying box at ${ip}...`);
          const box = await this.identifyBox(ip);
          if (box) {
            boxes.push(box);
            logger.info(`✓ Identified ${box.model || 'Unknown'} at ${ip}`);
          }
        } catch (error: any) {
          errors.push(`Failed to identify ${ip}: ${error.message}`);
          logger.error(`✗ Failed to identify ${ip}:`, error.message);
        }
      }

      const duration = Date.now() - startTime;

      return {
        boxes,
        method: method === 'both' ? 'port_scan' : method,
        duration,
        errors,
      };
    } catch (error: any) {
      errors.push(`Discovery failed: ${error.message}`);
      return {
        boxes: [],
        method: method === 'both' ? 'port_scan' : method,
        duration: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Discover a single box by IP
   */
  async discoverSingle(ipAddress: string): Promise<DirecTVBox | null> {
    return this.identifyBox(ipAddress);
  }
}
