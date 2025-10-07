
// API Route: Check subscriptions for a Fire Cube device

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { SubscriptionDetector } from '@/lib/firecube/subscription-detector';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid device ID' });
  }

  if (req.method === 'GET') {
    try {
      const detector = new SubscriptionDetector();
      const apps = await detector.getSubscribedApps(id);

      res.status(200).json({ subscriptions: apps });
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    // Refresh subscriptions
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id }
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const detector = new SubscriptionDetector();
      await detector.checkAllSubscriptions(id);
      const apps = await detector.getSubscribedApps(id);

      res.status(200).json({ subscriptions: apps, count: apps.length });
    } catch (error: any) {
      console.error('Error refreshing subscriptions:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
