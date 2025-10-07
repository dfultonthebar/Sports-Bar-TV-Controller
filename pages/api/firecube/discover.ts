
// API Route: Discover Fire Cubes

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { FireCubeDiscovery } from '@/lib/firecube/discovery';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { method = 'both' } = req.body;

    // Validate method
    if (!['adb', 'network_scan', 'both'].includes(method)) {
      return res.status(400).json({ error: 'Invalid discovery method' });
    }

    const discovery = new FireCubeDiscovery();
    
    // Check if ADB is available
    const adbAvailable = await discovery.checkAdbAvailable();
    if (!adbAvailable && (method === 'adb' || method === 'both')) {
      return res.status(400).json({ 
        error: 'ADB is not installed or not available. Please install Android Debug Bridge.' 
      });
    }

    // Perform discovery
    const result = await discovery.discover(method as any);

    // Save discovered devices to database
    const savedDevices = [];
    for (const device of result.devices) {
      try {
        const existing = await prisma.fireCubeDevice.findUnique({
          where: { ipAddress: device.ipAddress }
        });

        if (existing) {
          // Update existing device
          const updated = await prisma.fireCubeDevice.update({
            where: { id: existing.id },
            data: {
              status: 'online',
              lastSeen: new Date(),
              deviceModel: device.deviceModel || existing.deviceModel,
              softwareVersion: device.softwareVersion || existing.softwareVersion,
              serialNumber: device.serialNumber || existing.serialNumber,
              adbEnabled: true
            }
          });
          savedDevices.push(updated);
        } else {
          // Create new device
          const created = await prisma.fireCubeDevice.create({
            data: {
              name: device.name,
              ipAddress: device.ipAddress,
              port: device.port,
              macAddress: device.macAddress,
              serialNumber: device.serialNumber,
              deviceModel: device.deviceModel,
              softwareVersion: device.softwareVersion,
              location: device.location,
              matrixInputChannel: device.matrixInputChannel,
              adbEnabled: true,
              status: 'online',
              lastSeen: new Date(),
              keepAwakeEnabled: false,
              keepAwakeStart: '07:00',
              keepAwakeEnd: '01:00'
            }
          });
          savedDevices.push(created);
        }
      } catch (error: any) {
        console.error(`Failed to save device ${device.ipAddress}:`, error);
        result.errors.push(`Failed to save ${device.ipAddress}: ${error.message}`);
      }
    }

    // Log discovery
    await prisma.fireCubeDiscoveryLog.create({
      data: {
        discoveryMethod: method,
        devicesFound: savedDevices.length,
        duration: result.duration,
        status: result.errors.length === 0 ? 'success' : 'partial',
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        details: JSON.stringify({ method, duration: result.duration })
      }
    });

    res.status(200).json({
      devices: savedDevices,
      duration: result.duration,
      errors: result.errors
    });
  } catch (error: any) {
    console.error('Discovery failed:', error);
    
    // Log failed discovery
    await prisma.fireCubeDiscoveryLog.create({
      data: {
        discoveryMethod: req.body.method || 'unknown',
        devicesFound: 0,
        status: 'failed',
        errorMessage: error.message
      }
    });

    res.status(500).json({ error: error.message });
  }
}
