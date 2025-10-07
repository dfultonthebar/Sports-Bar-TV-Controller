
// API Route: Fire Cube device operations

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { ADBClient } from '@/lib/firecube/adb-client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid device ID' });
  }

  if (req.method === 'GET') {
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id }
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      res.status(200).json({ device });
    } catch (error: any) {
      console.error('Error fetching device:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { name, location, matrixInputChannel, keepAwakeEnabled, keepAwakeStart, keepAwakeEnd } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (location !== undefined) updateData.location = location;
      if (matrixInputChannel !== undefined) updateData.matrixInputChannel = matrixInputChannel;
      if (keepAwakeEnabled !== undefined) updateData.keepAwakeEnabled = keepAwakeEnabled;
      if (keepAwakeStart !== undefined) updateData.keepAwakeStart = keepAwakeStart;
      if (keepAwakeEnd !== undefined) updateData.keepAwakeEnd = keepAwakeEnd;

      const device = await prisma.fireCubeDevice.update({
        where: { id },
        data: updateData
      });

      // Update keep-awake schedule if needed
      if (keepAwakeEnabled !== undefined || keepAwakeStart !== undefined || keepAwakeEnd !== undefined) {
        const { getKeepAwakeScheduler } = await import('@/lib/firecube/keep-awake-scheduler');
        const scheduler = getKeepAwakeScheduler();
        await scheduler.updateDeviceSchedule(
          id,
          device.keepAwakeEnabled,
          device.keepAwakeStart,
          device.keepAwakeEnd
        );
      }

      res.status(200).json({ device });
    } catch (error: any) {
      console.error('Error updating device:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      await prisma.fireCubeDevice.delete({
        where: { id }
      });

      // Cancel keep-awake schedule
      const { getKeepAwakeScheduler } = await import('@/lib/firecube/keep-awake-scheduler');
      const scheduler = getKeepAwakeScheduler();
      scheduler.cancelSchedule(id);

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error deleting device:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
