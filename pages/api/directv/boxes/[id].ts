
// API Route: Get, update, or delete a specific DirecTV box

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { SHEFClient } from '@/lib/directv/shef-client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid box ID' });
  }

  if (req.method === 'GET') {
    try {
      const box = await prisma.direcTVBox.findUnique({
        where: { id },
      });

      if (!box) {
        return res.status(404).json({ error: 'Box not found' });
      }

      // Parse capabilities
      const boxWithParsedCapabilities = {
        ...box,
        capabilities: box.capabilities ? JSON.parse(box.capabilities) : [],
      };

      res.status(200).json({ box: boxWithParsedCapabilities });
    } catch (error: any) {
      console.error('Error fetching box:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { location, status } = req.body;

      const updated = await prisma.direcTVBox.update({
        where: { id },
        data: {
          location,
          status,
          updatedAt: new Date(),
        },
      });

      res.status(200).json({ box: updated });
    } catch (error: any) {
      console.error('Error updating box:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      await prisma.direcTVBox.delete({
        where: { id },
      });

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error deleting box:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
