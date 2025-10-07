// API Route: Get keep-awake logs for a device

import type { NextApiRequest, NextApiResponse } from 'next';
import { getKeepAwakeScheduler } from '@/lib/firecube/keep-awake-scheduler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid device ID' });
  }

  try {
    const scheduler = getKeepAwakeScheduler();
    const logs = await scheduler.getDeviceLogs(id, 50);

    res.status(200).json({ logs });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: error.message });
  }
}
