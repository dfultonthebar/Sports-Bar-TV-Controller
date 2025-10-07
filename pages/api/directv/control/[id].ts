
// API Route: Send control commands to a DirecTV box

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { SHEFClient } from '@/lib/directv/shef-client';
import { CommandMapper } from '@/lib/directv/command-mapper';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { commandType, commandName, parameters } = req.body;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid box ID' });
  }

  if (!commandType || !commandName) {
    return res.status(400).json({ error: 'Command type and name are required' });
  }

  try {
    const box = await prisma.direcTVBox.findUnique({
      where: { id },
    });

    if (!box) {
      return res.status(404).json({ error: 'Box not found' });
    }

    if (!box.shefEnabled) {
      return res.status(400).json({ error: 'SHEF is not enabled on this box' });
    }

    const client = new SHEFClient(box.ipAddress);
    const mapper = new CommandMapper();

    // Get command for this model
    const command = mapper.getCommand(box.model || 'all', commandType, commandName);

    if (!command) {
      return res.status(404).json({ error: 'Command not found for this model' });
    }

    let response;

    // Execute command based on type
    switch (commandType) {
      case 'remote_key':
        response = await client.processKey(command.commandCode, parameters?.clientAddr || '0');
        break;

      case 'tune':
        if (!parameters?.major) {
          return res.status(400).json({ error: 'Channel number (major) is required for tune command' });
        }
        response = await client.tune(
          parameters.major,
          parameters.minor,
          parameters.clientAddr || '0',
          parameters.videoWindow || 'primary'
        );
        break;

      case 'serial':
        response = await client.processSerialCommand(command.commandCode, parameters?.clientAddr || '0');
        break;

      case 'info':
        if (commandName === 'get_tuned') {
          response = await client.getTuned(parameters?.clientAddr || '0', parameters?.videoWindow || 'primary');
        } else if (commandName === 'get_version') {
          response = await client.getVersion();
        } else if (commandName === 'get_locations') {
          response = await client.getLocations();
        } else {
          return res.status(400).json({ error: 'Unknown info command' });
        }
        break;

      default:
        return res.status(400).json({ error: 'Unknown command type' });
    }

    // Update last seen
    await prisma.direcTVBox.update({
      where: { id },
      data: { lastSeen: new Date() },
    });

    res.status(200).json({ success: true, response });
  } catch (error: any) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: error.message });
  }
}
