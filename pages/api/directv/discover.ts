
// API Route: Discover DirecTV boxes on the network

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { DirecTVDiscovery } from '@/lib/directv/discovery';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { method = 'both', ipRange } = req.body;

    console.log(`Starting DirecTV discovery using method: ${method}`);
    const startTime = Date.now();

    const discovery = new DirecTVDiscovery();
    const result = await discovery.discover(method);

    console.log(`Discovery completed in ${result.duration}ms, found ${result.boxes.length} boxes`);

    // Save discovered boxes to database
    const savedBoxes: any[] = [];
    for (const box of result.boxes) {
      try {
        const saved = await prisma.direcTVBox.upsert({
          where: { ipAddress: box.ipAddress },
          update: {
            model: box.model,
            modelFamily: box.modelFamily,
            shefVersion: box.shefVersion,
            isServer: box.isServer,
            isClient: box.isClient,
            capabilities: box.capabilities ? JSON.stringify(box.capabilities) : null,
            status: box.status,
            shefEnabled: box.shefEnabled,
            lastSeen: new Date(),
          },
          create: {
            ipAddress: box.ipAddress,
            macAddress: box.macAddress,
            model: box.model,
            modelFamily: box.modelFamily,
            location: box.location,
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
        savedBoxes.push(saved);
      } catch (error: any) {
        console.error(`Error saving box ${box.ipAddress}:`, error.message);
        result.errors.push(`Failed to save ${box.ipAddress}: ${error.message}`);
      }
    }

    // Log discovery
    await prisma.direcTVDiscoveryLog.create({
      data: {
        discoveryMethod: result.method,
        boxesFound: savedBoxes.length,
        duration: result.duration,
        ipRange: ipRange || 'auto',
        status: result.errors.length === 0 ? 'success' : 'partial',
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        details: JSON.stringify(result),
      },
    });

    res.status(200).json({
      success: true,
      boxes: savedBoxes,
      duration: result.duration,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('Discovery error:', error);
    
    // Log failed discovery
    await prisma.direcTVDiscoveryLog.create({
      data: {
        discoveryMethod: req.body.method || 'both',
        boxesFound: 0,
        duration: Date.now() - Date.now(),
        status: 'failed',
        errorMessage: error.message,
      },
    });

    res.status(500).json({ error: error.message });
  }
}
