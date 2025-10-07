
// API Route: Get all DirecTV boxes

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const boxes = await prisma.direcTVBox.findMany({
        orderBy: [
          { isServer: 'desc' },
          { model: 'asc' },
          { ipAddress: 'asc' },
        ],
      });

      // Parse capabilities JSON
      const boxesWithParsedCapabilities = boxes.map(box => ({
        ...box,
        capabilities: box.capabilities ? JSON.parse(box.capabilities) : [],
      }));

      res.status(200).json({ boxes: boxesWithParsedCapabilities });
    } catch (error: any) {
      console.error('Error fetching boxes:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    // Manual box addition
    try {
      const { ipAddress, location } = req.body;

      if (!ipAddress) {
        return res.status(400).json({ error: 'IP address is required' });
      }

      // Try to identify the box
      const { DirecTVDiscovery } = await import('@/lib/directv/discovery');
      const discovery = new DirecTVDiscovery();
      const box = await discovery.discoverSingle(ipAddress);

      if (!box) {
        return res.status(404).json({ error: 'No DirecTV box found at this IP address' });
      }

      // Save to database
      const saved = await prisma.direcTVBox.create({
        data: {
          ipAddress: box.ipAddress,
          macAddress: box.macAddress,
          model: box.model,
          modelFamily: box.modelFamily,
          location: location || box.location,
          shefVersion: box.shefVersion,
          isServer: box.isServer,
          isClient: box.isClient,
          serverMacAddress: box.serverMacAddress,
          capabilities: box.capabilities ? JSON.stringify(box.capabilities) : null,
          status: box.status,
          shefEnabled: box.shefEnabled,
          lastSeen: new Date(),
          discoveredAt: new Date(),
        },
      });

      res.status(201).json({ box: saved });
    } catch (error: any) {
      console.error('Error adding box:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
