
// API Route: Sideload apps between Fire Cubes

import type { NextApiRequest, NextApiResponse } from 'next';
import { SideloadService } from '@/lib/firecube/sideload-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { sourceDeviceId, targetDeviceIds, packageName, action = 'sideload' } = req.body;

      if (!sourceDeviceId || !packageName) {
        return res.status(400).json({ error: 'Source device and package name are required' });
      }

      const sideloadService = new SideloadService();

      let operationId: string;

      switch (action) {
        case 'sideload':
          if (!targetDeviceIds || targetDeviceIds.length === 0) {
            return res.status(400).json({ error: 'Target devices are required' });
          }
          operationId = await sideloadService.sideloadApp(sourceDeviceId, targetDeviceIds, packageName);
          break;

        case 'sync_all':
          operationId = await sideloadService.syncAppToAllDevices(sourceDeviceId, packageName);
          break;

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }

      res.status(202).json({ operationId, message: 'Sideload operation started' });
    } catch (error: any) {
      console.error('Sideload failed:', error);
      res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'GET') {
    // Get sideload operations
    try {
      const { operationId } = req.query;
      const sideloadService = new SideloadService();

      if (operationId && typeof operationId === 'string') {
        const operation = await sideloadService.getOperationStatus(operationId);
        res.status(200).json({ operation });
      } else {
        const operations = await sideloadService.getAllOperations();
        res.status(200).json({ operations });
      }
    } catch (error: any) {
      console.error('Error fetching operations:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
