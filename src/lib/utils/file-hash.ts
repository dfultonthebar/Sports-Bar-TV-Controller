import crypto from 'crypto';
import fs from 'fs/promises';

/**
 * Calculate MD5 hash of a file
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    console.error(`Error calculating hash for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Calculate hash of string content
 */
export function calculateContentHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}
