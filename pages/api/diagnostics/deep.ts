
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
    const scriptPath = '/home/ubuntu/Sports-Bar-TV-Controller/scripts/diagnostics/deep-diagnostics.js';
    
    // Deep diagnostics can take a while, so use a longer timeout
    const { stdout, stderr } = await execAsync(`timeout 120 node ${scriptPath}`).catch(e => ({
      stdout: e.stdout || '',
      stderr: e.stderr || ''
    }));

    // Parse the output to extract key information
    const issuesMatch = stdout.match(/🐛 ISSUES FOUND: (\d+)/);
    const durationMatch = stdout.match(/⏱️\s+DURATION: (\d+)ms/);
    
    let summary = null;
    if (issuesMatch && durationMatch) {
      summary = {
        issuesFound: parseInt(issuesMatch[1]),
        duration: parseInt(durationMatch[1])
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
