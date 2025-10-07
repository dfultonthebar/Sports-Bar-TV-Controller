
// API Route: Test Fire Cube connection

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { ADBClient } from '@/lib/firecube/adb-client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid device ID' });
  }

  try {
    const device = await prisma.fireCubeDevice.findUnique({
      where: { id }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const client = new ADBClient(device.ipAddress, device.port);
    const isOnline = await client.testConnection();

    // Update device status
    await prisma.fireCubeDevice.update({
      where: { id },
      data: {
        status: isOnline ? 'online' : 'offline',
        lastSeen: isOnline ? new Date() : device.lastSeen
      }
    });

    res.status(200).json({
      success: isOnline,
      status: isOnline ? 'online' : 'offline',
      message: isOnline ? 'Device is online and responding' : 'Device is offline or not responding'
    });
  } catch (error: any) {
    console.error('Connection test failed:', error);
    
    // Update device status to error
    await prisma.fireCubeDevice.update({
      where: { id },
      data: { status: 'error' }
    });

    res.status(500).json({
      success: false,
      status: 'error',
      message: error.message
    });
  }
}
