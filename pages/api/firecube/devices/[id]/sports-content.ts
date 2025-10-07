
// API Route: Get live sports content for a Fire Cube device

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { SportsContentDetector } from '@/lib/firecube/sports-content-detector';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid device ID' });
  }

  if (req.method === 'GET') {
    try {
      const { type = 'live' } = req.query;
      const detector = new SportsContentDetector();

      let content;
      if (type === 'live') {
        content = await detector.getLiveSportsContent(id);
      } else if (type === 'upcoming') {
        content = await detector.getUpcomingSportsContent(id);
      } else {
        return res.status(400).json({ error: 'Invalid content type' });
      }

      res.status(200).json({ content });
    } catch (error: any) {
      console.error('Error fetching sports content:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    // Refresh sports content
    try {
      const device = await prisma.fireCubeDevice.findUnique({
        where: { id }
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const detector = new SportsContentDetector();
      await detector.syncSportsContent(id);
      const content = await detector.getLiveSportsContent(id);

      res.status(200).json({ content, count: content.length });
    } catch (error: any) {
      console.error('Error refreshing sports content:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
