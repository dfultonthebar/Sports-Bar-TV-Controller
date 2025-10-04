
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
    const scriptPath = '/home/ubuntu/Sports-Bar-TV-Controller/scripts/diagnostics/light-check.js';
    
    const { stdout, stderr } = await execAsync(`node ${scriptPath}`).catch(e => ({
      stdout: e.stdout || '',
      stderr: e.stderr || ''
    }));

    // Parse the output to extract summary
    const summaryMatch = stdout.match(/✅ Healthy: (\d+)[\s\S]*?⚠️\s+Warning: (\d+)[\s\S]*?❌ Critical: (\d+)[\s\S]*?🐛 Issues Found: (\d+)[\s\S]*?⏱️\s+Duration: (\d+)ms/);
    
    let summary = null;
    if (summaryMatch) {
      summary = {
        healthy: parseInt(summaryMatch[1]),
        warning: parseInt(summaryMatch[2]),
        critical: parseInt(summaryMatch[3]),
        issues: parseInt(summaryMatch[4]),
        duration: parseInt(summaryMatch[5])
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
