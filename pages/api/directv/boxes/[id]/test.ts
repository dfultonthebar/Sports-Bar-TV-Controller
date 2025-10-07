
// API Route: Test connection to a DirecTV box

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { SHEFClient } from '@/lib/directv/shef-client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid box ID' });
  }

  try {
    const box = await prisma.direcTVBox.findUnique({
      where: { id },
    });

    if (!box) {
      return res.status(404).json({ error: 'Box not found' });
    }

    const client = new SHEFClient(box.ipAddress);
    
    // Test connection
    const isConnected = await client.testConnection();
    
    if (!isConnected) {
      await prisma.direcTVBox.update({
        where: { id },
        data: { status: 'offline' },
      });
      return res.status(200).json({ connected: false, message: 'Box is offline or unreachable' });
    }

    // Check if SHEF is enabled
    const shefEnabled = await client.isShefEnabled();

    // Get version info
    const versionInfo = await client.getVersion();

    // Update box status
    await prisma.direcTVBox.update({
      where: { id },
      data: {
        status: 'online',
        shefEnabled,
        shefVersion: versionInfo.version,
        lastSeen: new Date(),
      },
    });

    res.status(200).json({
      connected: true,
      shefEnabled,
      version: versionInfo.version,
      systemTime: versionInfo.systemTime,
    });
  } catch (error: any) {
    console.error('Error testing box:', error);
    
    // Update box status to error
    await prisma.direcTVBox.update({
      where: { id },
      data: { status: 'error' },
    });

    res.status(500).json({ error: error.message, connected: false });
  }
}
