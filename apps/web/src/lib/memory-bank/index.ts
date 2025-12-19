/**
 * Memory Bank - Main Service
 * Project context tracking and restoration system
 */

import { logger } from '../logger';
import { FileWatcher, getFileWatcher, stopFileWatcher, type FileChangeEvent } from './file-watcher';
import { ContextGenerator, getContextGenerator } from './context-generator';
import { MemoryBankStorage, getStorage, type ContextSnapshot } from './storage';

export class MemoryBank {
  private fileWatcher: FileWatcher;
  private contextGenerator: ContextGenerator;
  private storage: MemoryBankStorage;
  private projectRoot: string;
  private autoSnapshotEnabled = false;
  private snapshotThreshold = 10; // Number of changes before auto-snapshot

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.fileWatcher = getFileWatcher(projectRoot);
    this.contextGenerator = getContextGenerator(projectRoot);
    this.storage = getStorage(projectRoot);
  }

  /**
   * Create a manual snapshot of current project state
   */
  async createSnapshot(): Promise<ContextSnapshot> {
    logger.info('Creating memory bank snapshot');

    try {
      // Generate context
      const context = await this.contextGenerator.generateContext();

      // Convert to markdown
      const markdown = await this.contextGenerator.contextToMarkdown(context);

      // Save snapshot
      const snapshot = await this.storage.saveSnapshot(context, markdown);

      logger.info('Memory bank snapshot created', {
        data: {
          id: snapshot.id,
          branch: snapshot.branch,
          size: snapshot.size,
        }
      });

      return snapshot;
    } catch (error) {
      logger.error('Failed to create snapshot:', { error });
      throw error;
    }
  }

  /**
   * Start watching files and auto-snapshot on changes
   */
  async startWatching(): Promise<void> {
    if (this.fileWatcher.isActive()) {
      logger.warn('File watcher is already active');
      return;
    }

    logger.info('Starting memory bank file watcher');

    // Set up event handlers
    this.fileWatcher.on('changes', async (changes: FileChangeEvent[]) => {
      await this.handleFileChanges(changes);
    });

    this.fileWatcher.on('error', (error: Error) => {
      logger.error('File watcher error:', { error: error.message });
    });

    // Start watching
    await this.fileWatcher.start();
    this.autoSnapshotEnabled = true;

    // Create initial snapshot
    await this.createSnapshot();
  }

  /**
   * Stop watching files
   */
  async stopWatching(): Promise<void> {
    logger.info('Stopping memory bank file watcher');
    this.autoSnapshotEnabled = false;
    await stopFileWatcher();
  }

  /**
   * Get latest snapshot
   */
  async getLatestSnapshot(): Promise<string | null> {
    return this.storage.getLatestSnapshot();
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshot(id: string): Promise<string | null> {
    return this.storage.getSnapshot(id);
  }

  /**
   * List all snapshots
   */
  async listSnapshots(): Promise<ContextSnapshot[]> {
    return this.storage.listSnapshots();
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalSnapshots: number;
    totalSize: number;
    storageDir: string;
    isWatching: boolean;
  }> {
    const index = await this.storage.getIndex();
    const totalSize = await this.storage.getTotalSize();

    return {
      totalSnapshots: index.totalSnapshots,
      totalSize,
      storageDir: this.storage.getStorageDir(),
      isWatching: this.fileWatcher.isActive(),
    };
  }

  /**
   * Delete snapshot by ID
   */
  async deleteSnapshot(id: string): Promise<boolean> {
    return this.storage.deleteSnapshot(id);
  }

  /**
   * Handle file changes and potentially create auto-snapshot
   */
  private async handleFileChanges(changes: FileChangeEvent[]): Promise<void> {
    if (!this.autoSnapshotEnabled) {
      return;
    }

    logger.info(`Processing ${changes.length} file changes`);

    // Check if we should create an auto-snapshot
    if (changes.length >= this.snapshotThreshold) {
      logger.info('Auto-snapshot threshold reached, creating snapshot');
      try {
        const context = await this.contextGenerator.generateContext(changes);
        const markdown = await this.contextGenerator.contextToMarkdown(context);
        await this.storage.saveSnapshot(context, markdown);
      } catch (error) {
        logger.error('Failed to create auto-snapshot:', { error });
      }
    }
  }
}

// Export singleton instance
let memoryBankInstance: MemoryBank | null = null;

export function getMemoryBank(projectRoot?: string): MemoryBank {
  if (!memoryBankInstance) {
    memoryBankInstance = new MemoryBank(projectRoot);
  }
  return memoryBankInstance;
}

// Re-export types and utilities
export type { FileChangeEvent } from './file-watcher';
export type { ProjectContext } from './context-generator';
export type { ContextSnapshot, MemoryBankIndex } from './storage';
