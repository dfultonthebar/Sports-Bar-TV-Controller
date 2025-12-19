/**
 * Memory Bank Storage Layer
 * Handles saving, retrieving, and managing context snapshots
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logger';
import type { ProjectContext } from './context-generator';

export interface ContextSnapshot {
  id: string;
  timestamp: Date;
  filename: string;
  size: number;
  branch: string;
  commitHash: string;
}

export interface MemoryBankIndex {
  snapshots: ContextSnapshot[];
  lastUpdated: Date;
  totalSnapshots: number;
  oldestSnapshot?: Date;
  newestSnapshot?: Date;
}

export class MemoryBankStorage {
  private storageDir: string;
  private indexPath: string;
  private maxSnapshots: number;

  constructor(projectRoot: string = process.cwd(), maxSnapshots: number = 30) {
    this.storageDir = path.join(projectRoot, 'memory-bank');
    this.indexPath = path.join(this.storageDir, 'INDEX.md');
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      logger.info('Memory bank storage initialized', { data: { storageDir: this.storageDir }
        });
    } catch (error) {
      logger.error('Failed to initialize storage:', { error });
      throw error;
    }
  }

  /**
   * Save context snapshot as markdown file
   */
  async saveSnapshot(context: ProjectContext, markdown: string): Promise<ContextSnapshot> {
    await this.initialize();

    const timestamp = context.timestamp;
    const id = this.generateSnapshotId(timestamp);
    const filename = `context-${id}.md`;
    const filepath = path.join(this.storageDir, filename);

    try {
      await fs.writeFile(filepath, markdown, 'utf-8');
      const stats = await fs.stat(filepath);

      const snapshot: ContextSnapshot = {
        id,
        timestamp,
        filename,
        size: stats.size,
        branch: context.branch,
        commitHash: context.lastCommit.hash.substring(0, 7),
      };

      logger.info('Context snapshot saved', { data: { id, filename, size: stats.size }
        });

      // Update index
      await this.updateIndex(snapshot);

      // Cleanup old snapshots
      await this.cleanupOldSnapshots();

      return snapshot;
    } catch (error) {
      logger.error('Failed to save snapshot:', { error });
      throw error;
    }
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshot(id: string): Promise<string | null> {
    const filename = `context-${id}.md`;
    const filepath = path.join(this.storageDir, filename);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return content;
    } catch (error) {
      logger.warn('Snapshot not found:', { data: { id }
        });
      return null;
    }
  }

  /**
   * Get latest snapshot
   */
  async getLatestSnapshot(): Promise<string | null> {
    const index = await this.getIndex();
    if (index.snapshots.length === 0) {
      return null;
    }

    const latest = index.snapshots[0]; // Snapshots are sorted newest first
    return this.getSnapshot(latest.id);
  }

  /**
   * List all snapshots
   */
  async listSnapshots(): Promise<ContextSnapshot[]> {
    const index = await this.getIndex();
    return index.snapshots;
  }

  /**
   * Get index information
   */
  async getIndex(): Promise<MemoryBankIndex> {
    try {
      await fs.access(this.indexPath);
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return this.parseIndex(content);
    } catch {
      // Index doesn't exist, scan directory
      return this.rebuildIndex();
    }
  }

  /**
   * Delete snapshot by ID
   */
  async deleteSnapshot(id: string): Promise<boolean> {
    const filename = `context-${id}.md`;
    const filepath = path.join(this.storageDir, filename);

    try {
      await fs.unlink(filepath);
      logger.info('Snapshot deleted', { data: { id }
        });

      // Update index
      await this.rebuildIndex();
      return true;
    } catch (error) {
      logger.warn('Failed to delete snapshot:', { data: { id, error }
        });
      return false;
    }
  }

  /**
   * Update index with new snapshot
   */
  private async updateIndex(snapshot: ContextSnapshot): Promise<void> {
    const index = await this.getIndex();
    index.snapshots.unshift(snapshot); // Add to beginning
    index.totalSnapshots = index.snapshots.length;
    index.lastUpdated = new Date();
    index.newestSnapshot = snapshot.timestamp;
    if (index.snapshots.length > 0) {
      index.oldestSnapshot = index.snapshots[index.snapshots.length - 1].timestamp;
    }

    await this.writeIndex(index);
  }

  /**
   * Rebuild index from directory contents
   */
  private async rebuildIndex(): Promise<MemoryBankIndex> {
    logger.info('Rebuilding memory bank index');

    try {
      await this.initialize();
      const files = await fs.readdir(this.storageDir);
      const snapshotFiles = files.filter(f => f.startsWith('context-') && f.endsWith('.md'));

      const snapshots: ContextSnapshot[] = [];

      for (const filename of snapshotFiles) {
        const filepath = path.join(this.storageDir, filename);
        const stats = await fs.stat(filepath);
        const content = await fs.readFile(filepath, 'utf-8');

        // Extract metadata from markdown
        const id = filename.replace('context-', '').replace('.md', '');
        const timestampMatch = content.match(/# Project Context - (.+)/);
        const branchMatch = content.match(/\*\*Branch:\*\* `(.+)`/);
        const commitMatch = content.match(/\*\*Last Commit:\*\* (\w+)/);

        snapshots.push({
          id,
          timestamp: timestampMatch ? new Date(timestampMatch[1]) : stats.mtime,
          filename,
          size: stats.size,
          branch: branchMatch ? branchMatch[1] : 'unknown',
          commitHash: commitMatch ? commitMatch[1] : 'unknown',
        });
      }

      // Sort by timestamp, newest first
      snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const index: MemoryBankIndex = {
        snapshots,
        lastUpdated: new Date(),
        totalSnapshots: snapshots.length,
        oldestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].timestamp : undefined,
        newestSnapshot: snapshots.length > 0 ? snapshots[0].timestamp : undefined,
      };

      await this.writeIndex(index);
      return index;
    } catch (error) {
      logger.error('Failed to rebuild index:', { error });
      return {
        snapshots: [],
        lastUpdated: new Date(),
        totalSnapshots: 0,
      };
    }
  }

  /**
   * Write index to file
   */
  private async writeIndex(index: MemoryBankIndex): Promise<void> {
    const lines: string[] = [];

    lines.push('# Memory Bank Index');
    lines.push('');
    lines.push(`*Last Updated: ${index.lastUpdated.toLocaleString()}*`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Snapshots:** ${index.totalSnapshots}`);
    if (index.newestSnapshot) {
      lines.push(`- **Newest Snapshot:** ${index.newestSnapshot.toLocaleString()}`);
    }
    if (index.oldestSnapshot) {
      lines.push(`- **Oldest Snapshot:** ${index.oldestSnapshot.toLocaleString()}`);
    }
    lines.push('');

    if (index.snapshots.length > 0) {
      lines.push('## Snapshots');
      lines.push('');
      lines.push('| Timestamp | ID | Branch | Commit | Size |');
      lines.push('|-----------|-----|--------|--------|------|');

      for (const snapshot of index.snapshots) {
        const size = (snapshot.size / 1024).toFixed(1);
        const timestamp = snapshot.timestamp.toLocaleString();
        lines.push(
          `| ${timestamp} | \`${snapshot.id}\` | ${snapshot.branch} | ${snapshot.commitHash} | ${size} KB |`
        );
      }
      lines.push('');
    }

    lines.push('## Usage');
    lines.push('');
    lines.push('```bash');
    lines.push('# Create a new snapshot');
    lines.push('npm run memory:snapshot');
    lines.push('');
    lines.push('# View latest snapshot');
    lines.push('npm run memory:restore');
    lines.push('');
    lines.push('# Start file watcher');
    lines.push('npm run memory:watch');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Memory Bank - Project Context Tracking System*');

    await fs.writeFile(this.indexPath, lines.join('\n'), 'utf-8');
  }

  /**
   * Parse index from markdown content
   */
  private parseIndex(content: string): MemoryBankIndex {
    const snapshots: ContextSnapshot[] = [];

    // Extract table rows
    const tableRegex = /\| (.+?) \| `(.+?)` \| (.+?) \| (.+?) \| (.+?) \|/g;
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      const [, timestamp, id, branch, commitHash, size] = match;
      if (timestamp === 'Timestamp') continue; // Skip header

      snapshots.push({
        id: id.trim(),
        timestamp: new Date(timestamp.trim()),
        filename: `context-${id.trim()}.md`,
        size: parseFloat(size) * 1024, // Convert KB to bytes
        branch: branch.trim(),
        commitHash: commitHash.trim(),
      });
    }

    return {
      snapshots,
      lastUpdated: new Date(),
      totalSnapshots: snapshots.length,
      oldestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].timestamp : undefined,
      newestSnapshot: snapshots.length > 0 ? snapshots[0].timestamp : undefined,
    };
  }

  /**
   * Cleanup old snapshots beyond max limit
   */
  private async cleanupOldSnapshots(): Promise<void> {
    const index = await this.getIndex();

    if (index.snapshots.length <= this.maxSnapshots) {
      return;
    }

    const toDelete = index.snapshots.slice(this.maxSnapshots);
    logger.info(`Cleaning up ${toDelete.length} old snapshots`);

    for (const snapshot of toDelete) {
      await this.deleteSnapshot(snapshot.id);
    }
  }

  /**
   * Generate snapshot ID from timestamp
   */
  private generateSnapshotId(timestamp: Date): string {
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const seconds = String(timestamp.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  /**
   * Get storage directory path
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Get total storage size
   */
  async getTotalSize(): Promise<number> {
    try {
      const index = await this.getIndex();
      return index.snapshots.reduce((total, snapshot) => total + snapshot.size, 0);
    } catch {
      return 0;
    }
  }
}

// Export singleton
let storageInstance: MemoryBankStorage | null = null;

export function getStorage(projectRoot?: string, maxSnapshots?: number): MemoryBankStorage {
  if (!storageInstance) {
    storageInstance = new MemoryBankStorage(projectRoot, maxSnapshots);
  }
  return storageInstance;
}
