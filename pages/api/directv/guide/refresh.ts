
// API Route: Refresh channel guide from a DirecTV box

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { ChannelGuideService } from '@/lib/directv/channel-guide';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { boxId, channelRange } = req.body;

    // Get box
    const box = await prisma.direcTVBox.findUnique({
      where: { id: boxId },
    });

    if (!box) {
      return res.status(404).json({ error: 'Box not found' });
    }

    if (!box.shefEnabled) {
      return res.status(400).json({ error: 'SHEF is not enabled on this box' });
    }

    console.log(`Starting channel guide refresh from box ${box.ipAddress}...`);
    const startTime = Date.now();

    const guideService = new ChannelGuideService();
    const channels = await guideService.buildChannelGuide(box.ipAddress, channelRange);

    console.log(`Fetched ${channels.length} channels, saving to database...`);

    let added = 0;
    let updated = 0;

    // Save channels to database
    for (const channel of channels) {
      try {
        const existing = await prisma.direcTVChannel.findUnique({
          where: {
            channelNumber_subChannel: {
              channelNumber: channel.channelNumber,
              subChannel: channel.subChannel || undefined,
            },
          } as any,
        });

        if (existing) {
          await prisma.direcTVChannel.update({
            where: { id: existing.id },
            data: {
              channelName: channel.channelName,
              callsign: channel.callsign,
              network: channel.network,
              stationId: channel.stationId,
              isHD: channel.isHD,
              isOffAir: channel.isOffAir,
              isPPV: channel.isPPV,
              category: channel.category,
              description: channel.description,
              isActive: channel.isActive,
              lastVerified: new Date(),
            },
          });
          updated++;
        } else {
          await prisma.direcTVChannel.create({
            data: {
              channelNumber: channel.channelNumber,
              subChannel: channel.subChannel !== undefined ? channel.subChannel : null,
              channelName: channel.channelName,
              callsign: channel.callsign,
              network: channel.network,
              stationId: channel.stationId,
              isHD: channel.isHD,
              isOffAir: channel.isOffAir,
              isPPV: channel.isPPV,
              category: channel.category,
              description: channel.description,
              isActive: channel.isActive,
              lastVerified: new Date(),
            },
          });
          added++;
        }
      } catch (error: any) {
        console.error(`Error saving channel ${channel.channelNumber}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;

    // Log refresh
    await prisma.direcTVGuideRefresh.create({
      data: {
        boxId: box.id,
        channelsUpdated: updated,
        channelsAdded: added,
        duration,
        status: 'success',
        completedAt: new Date(),
      },
    });

    console.log(`Channel guide refresh completed: ${added} added, ${updated} updated in ${duration}ms`);

    res.status(200).json({
      success: true,
      added,
      updated,
      total: channels.length,
      duration,
    });
  } catch (error: any) {
    console.error('Guide refresh error:', error);

    // Log failed refresh
    await prisma.direcTVGuideRefresh.create({
      data: {
        boxId: req.body.boxId,
        channelsUpdated: 0,
        channelsAdded: 0,
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      },
    });

    res.status(500).json({ error: error.message });
  }
}
