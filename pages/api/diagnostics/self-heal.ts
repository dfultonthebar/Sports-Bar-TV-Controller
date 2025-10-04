
import { exec } from 'child_process';
import { promisify } from 'util';
import type { NextApiRequest, NextApiResponse } from 'next';

const execAsync = promisify(exec);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const scriptPath = '/home/ubuntu/Sports-Bar-TV-Controller/scripts/diagnostics/self-healing.js';
    
    const { stdout, stderr } = await execAsync(`timeout 60 node ${scriptPath}`).catch(e => ({
      stdout: e.stdout || '',
      stderr: e.stderr || ''
    }));

    // Parse the output to extract summary
    const summaryMatch = stdout.match(/Self-healing completed: (\d+) fixes applied/);
    
    let summary = null;
    if (summaryMatch) {
      summary = {
        fixesApplied: parseInt(summaryMatch[1])
      };
    }

    res.status(200).json({
      success: true,
      output: stdout,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
