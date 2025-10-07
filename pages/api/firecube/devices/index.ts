
// API Route: Get all Fire Cube devices

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { FireCubeDiscovery } from '@/lib/firecube/discovery';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const devices = await prisma.fireCubeDevice.findMany({
        orderBy: [
          { status: 'asc' },
          { name: 'asc' }
        ]
      });

      res.status(200).json({ devices });
    } catch (error: any) {
      console.error('Error fetching devices:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    // Manual device addition
    try {
      const { ipAddress, name, location, port = 5555 } = req.body;

      if (!ipAddress) {
        return res.status(400).json({ error: 'IP address is required' });
      }

      // Try to identify the device
      const discovery = new FireCubeDiscovery();
      const deviceInfo = await discovery.discoverSingle(ipAddress);

      if (!deviceInfo) {
        return res.status(404).json({ error: 'No Fire Cube found at this IP address' });
      }

      // Check if device already exists
      const existing = await prisma.fireCubeDevice.findUnique({
        where: { ipAddress }
      });

      if (existing) {
        return res.status(400).json({ error: 'Device already exists' });
      }

      // Save to database
      const device = await prisma.fireCubeDevice.create({
        data: {
          name: name || deviceInfo.deviceModel || 'Fire TV Device',
          ipAddress,
          port,
          macAddress: deviceInfo.macAddress,
          serialNumber: deviceInfo.serialNumber,
          deviceModel: deviceInfo.deviceModel,
          softwareVersion: deviceInfo.softwareVersion,
          location: location || deviceInfo.location,
          adbEnabled: true,
          status: 'online',
          lastSeen: new Date(),
          keepAwakeEnabled: false,
          keepAwakeStart: '07:00',
          keepAwakeEnd: '01:00'
        }
      });

      res.status(201).json({ device });
    } catch (error: any) {
      console.error('Error adding device:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
