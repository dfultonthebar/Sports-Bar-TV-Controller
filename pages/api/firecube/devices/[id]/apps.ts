
// API Route: Get apps for a Fire Cube device

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { AppDiscoveryService } from '@/lib/firecube/app-discovery';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid device ID' });
  }

  if (req.method === 'GET') {
    try {
      const appService = new AppDiscoveryService();
      const apps = await appService.getDeviceApps(id);

      res.status(200).json({ apps });
    } catch (error: any) {
      console.error('Error fetching apps:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    // Refresh apps
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id }
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const appService = new AppDiscoveryService();
      const apps = await appService.discoverApps(id, device.ipAddress);
      await appService.syncAppsToDatabase(id, apps);

      res.status(200).json({ apps, count: apps.length });
    } catch (error: any) {
      console.error('Error refreshing apps:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
