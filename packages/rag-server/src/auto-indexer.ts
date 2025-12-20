/**
 * RAG Auto-Indexer Service
 * Automatically re-indexes documentation when files change
 */

import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import { logger } from '@sports-bar/logger';
import { processDocuments, scanDocuments } from './doc-processor';
import { addChunks, removeDocument, saveVectorStore, clearVectorStore } from './vector-store';

export interface AutoIndexerOptions {
  /** Directory to watch for changes */
  docsPath: string;
  /** Debounce delay in milliseconds before triggering re-index */
  debounceMs?: number;
  /** Whether to do full rebuild on start */
  initialRebuild?: boolean;
  /** Interval in minutes for periodic full rebuilds (0 to disable) */
  periodicRebuildMinutes?: number;
}

export class RAGAutoIndexer {
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingChanges = new Set<string>();
  private isIndexing = false;
  private periodicRebuildInterval: NodeJS.Timeout | null = null;
  private options: Required<AutoIndexerOptions>;

  constructor(options: AutoIndexerOptions) {
    this.options = {
      docsPath: options.docsPath,
      debounceMs: options.debounceMs ?? 2000, // 2 second debounce
      initialRebuild: options.initialRebuild ?? false,
      periodicRebuildMinutes: options.periodicRebuildMinutes ?? 0, // Disabled by default
    };
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    if (this.watcher) {
      logger.warn('[RAG-AUTO-INDEXER] Already running');
      return;
    }

    logger.info('[RAG-AUTO-INDEXER] Starting auto-indexer', {
      data: {
        docsPath: this.options.docsPath,
        debounceMs: this.options.debounceMs,
        periodicRebuildMinutes: this.options.periodicRebuildMinutes,
      }
    });

    // Perform initial rebuild if requested
    if (this.options.initialRebuild) {
      logger.info('[RAG-AUTO-INDEXER] Performing initial full rebuild');
      await this.performFullRebuild();
    }

    // Start file watcher
    this.watcher = chokidar.watch(this.options.docsPath, {
      persistent: true,
      ignoreInitial: true, // Don't trigger for existing files on startup
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/temp/**',
        '**/*.tmp',
        '**/.DS_Store',
      ],
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    // Set up event handlers
    this.watcher
      .on('add', (filePath) => this.handleFileChange('add', filePath))
      .on('change', (filePath) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
      .on('error', (error) => {
        logger.error('[RAG-AUTO-INDEXER] Watcher error:', error);
      })
      .on('ready', () => {
        logger.info('[RAG-AUTO-INDEXER] Watching for file changes');
      });

    // Set up periodic rebuild if enabled
    if (this.options.periodicRebuildMinutes > 0) {
      const intervalMs = this.options.periodicRebuildMinutes * 60 * 1000;
      this.periodicRebuildInterval = setInterval(() => {
        logger.info('[RAG-AUTO-INDEXER] Starting periodic full rebuild');
        this.performFullRebuild().catch(error => {
          logger.error('[RAG-AUTO-INDEXER] Periodic rebuild failed:', error);
        });
      }, intervalMs);

      logger.info('[RAG-AUTO-INDEXER] Periodic rebuild scheduled', {
        data: { intervalMinutes: this.options.periodicRebuildMinutes }
      });
    }
  }

  /**
   * Stop watching for file changes
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.periodicRebuildInterval) {
      clearInterval(this.periodicRebuildInterval);
      this.periodicRebuildInterval = null;
    }

    logger.info('[RAG-AUTO-INDEXER] Stopped');
  }

  /**
   * Handle file change event
   */
  private handleFileChange(type: 'add' | 'change' | 'unlink', filePath: string): void {
    // Only process supported file types
    const ext = path.extname(filePath).toLowerCase();
    if (!['.md', '.pdf', '.txt', '.html'].includes(ext)) {
      return;
    }

    logger.info('[RAG-AUTO-INDEXER] File change detected', {
      data: { type, file: path.basename(filePath) }
    });

    this.pendingChanges.add(filePath);

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges().catch(error => {
        logger.error('[RAG-AUTO-INDEXER] Error processing changes:', error);
      });
    }, this.options.debounceMs);
  }

  /**
   * Process all pending file changes
   */
  private async processPendingChanges(): Promise<void> {
    if (this.isIndexing) {
      logger.warn('[RAG-AUTO-INDEXER] Already indexing, skipping');
      return;
    }

    if (this.pendingChanges.size === 0) {
      return;
    }

    this.isIndexing = true;
    const changes = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    try {
      logger.info('[RAG-AUTO-INDEXER] Processing file changes', {
        data: { fileCount: changes.length }
      });

      // Group changes by type
      const added: string[] = [];
      const updated: string[] = [];
      const deleted: string[] = [];

      for (const filePath of changes) {
        // Check if file still exists
        if (fs.existsSync(filePath)) {
          // File exists - either added or updated
          // We'll treat all as updates since we're reprocessing
          updated.push(filePath);
        } else {
          // File no longer exists - deleted
          deleted.push(filePath);
        }
      }

      // Remove deleted documents from vector store
      for (const filePath of deleted) {
        await removeDocument(filePath);
        logger.info('[RAG-AUTO-INDEXER] Removed deleted document', {
          data: { file: path.basename(filePath) }
        });
      }

      // Process added/updated documents
      if (updated.length > 0) {
        const processedDocs = await processDocuments(updated);

        // Add chunks to vector store (addChunks handles saving)
        const allChunks = processedDocs.flatMap(doc => doc.chunks);
        if (allChunks.length > 0) {
          await addChunks(allChunks);

          logger.info('[RAG-AUTO-INDEXER] Updated documents', {
            data: {
              documents: processedDocs.length,
              chunks: allChunks.length
            }
          });
        }
      }

      logger.info('[RAG-AUTO-INDEXER] Re-indexing complete', {
        data: {
          updated: updated.length,
          deleted: deleted.length,
        }
      });
    } catch (error) {
      logger.error('[RAG-AUTO-INDEXER] Re-indexing failed:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Perform a full rebuild of the vector store
   */
  private async performFullRebuild(): Promise<void> {
    if (this.isIndexing) {
      logger.warn('[RAG-AUTO-INDEXER] Already indexing, skipping full rebuild');
      return;
    }

    this.isIndexing = true;

    try {
      logger.info('[RAG-AUTO-INDEXER] Starting full rebuild');

      // Scan all documents
      const files = await scanDocuments(this.options.docsPath);

      // Clear existing vector store
      await clearVectorStore();

      // Process all documents
      const processedDocs = await processDocuments(files);

      // Add all chunks (addChunks handles saving)
      const allChunks = processedDocs.flatMap(doc => doc.chunks);
      await addChunks(allChunks);

      logger.info('[RAG-AUTO-INDEXER] Full rebuild complete', {
        data: {
          files: files.length,
          documents: processedDocs.length,
          chunks: allChunks.length,
        }
      });
    } catch (error) {
      logger.error('[RAG-AUTO-INDEXER] Full rebuild failed:', error);
      throw error;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Manually trigger a full rebuild
   */
  async triggerFullRebuild(): Promise<void> {
    logger.info('[RAG-AUTO-INDEXER] Manual full rebuild triggered');
    await this.performFullRebuild();
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.watcher !== null,
      isIndexing: this.isIndexing,
      pendingChanges: this.pendingChanges.size,
      periodicRebuildEnabled: this.options.periodicRebuildMinutes > 0,
    };
  }
}

// Singleton instance
let autoIndexerInstance: RAGAutoIndexer | null = null;

/**
 * Initialize the auto-indexer (call this at app startup)
 */
export function initializeAutoIndexer(options?: Partial<AutoIndexerOptions>): RAGAutoIndexer {
  if (!autoIndexerInstance) {
    const projectRoot = process.cwd();
    const docsPath = path.join(projectRoot, 'docs');

    autoIndexerInstance = new RAGAutoIndexer({
      docsPath,
      debounceMs: 2000,
      initialRebuild: false,
      periodicRebuildMinutes: 0, // Disabled by default
      ...options,
    });
  }

  return autoIndexerInstance;
}

/**
 * Get the auto-indexer instance
 */
export function getAutoIndexer(): RAGAutoIndexer | null {
  return autoIndexerInstance;
}

/**
 * Start the auto-indexer
 */
export async function startAutoIndexer(options?: Partial<AutoIndexerOptions>): Promise<void> {
  const indexer = initializeAutoIndexer(options);
  await indexer.start();
}

/**
 * Stop the auto-indexer
 */
export async function stopAutoIndexer(): Promise<void> {
  if (autoIndexerInstance) {
    await autoIndexerInstance.stop();
  }
}
