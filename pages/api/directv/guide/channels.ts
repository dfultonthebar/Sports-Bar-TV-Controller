
// API Route: Get channel guide data

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, search, limit = '100', offset = '0' } = req.query;

    const where: any = { isActive: true };

    if (category && typeof category === 'string') {
      where.category = category;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { channelName: { contains: search, mode: 'insensitive' } },
        { callsign: { contains: search, mode: 'insensitive' } },
        { network: { contains: search, mode: 'insensitive' } },
      ];
    }

    const channels = await prisma.direcTVChannel.findMany({
      where,
      orderBy: { channelNumber: 'asc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.direcTVChannel.count({ where });

    res.status(200).json({
      channels,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: error.message });
  }
}
