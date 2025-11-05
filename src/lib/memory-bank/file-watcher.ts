/**
 * Memory Bank File Watcher Service
 * Monitors project files for changes and triggers context snapshots
 */

import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';
import { logger } from '../logger';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: Date;
}

export interface WatcherOptions {
  debounceMs?: number;
  excludePatterns?: string[];
  includePatterns?: string[];
}

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingChanges: FileChangeEvent[] = [];
  private options: Required<WatcherOptions>;
  private isWatching = false;
  private projectRoot: string;

  constructor(projectRoot: string, options: WatcherOptions = {}) {
    super();
    this.projectRoot = projectRoot;
    this.options = {
      debounceMs: options.debounceMs || 500,
      excludePatterns: options.excludePatterns || [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/memory-bank/**',
        '**/coverage/**',
        '**/*.log',
        '**/.DS_Store',
        '**/tsconfig.tsbuildinfo',
        '**/*.pdf',
        '**/temp/**',
      ],
      includePatterns: options.includePatterns || [
        'src/**/*.{ts,tsx,js,jsx}',
        'docs/**/*.md',
        'package.json',
        'package-lock.json',
        'tsconfig.json',
        'next.config.js',
        'ecosystem.config.js',
        'drizzle.config.ts',
        'scripts/**/*.{ts,js}',
        '.env.example',
      ],
    };
  }

  /**
   * Start watching project files
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      logger.warn('File watcher is already running');
      return;
    }

    try {
      // Watch specific directories only (not glob patterns) to avoid ENOSPC
      // Chokidar will expand glob patterns in the watch path BEFORE applying ignore rules,
      // which causes it to try watching node_modules, .next, etc.
      // Instead, watch specific directories and filter files internally
      const watchDirs = [
        path.join(this.projectRoot, 'src'),
        path.join(this.projectRoot, 'docs'),
        path.join(this.projectRoot, 'scripts'),
        path.join(this.projectRoot, 'package.json'),
        path.join(this.projectRoot, 'package-lock.json'),
        path.join(this.projectRoot, 'tsconfig.json'),
        path.join(this.projectRoot, 'next.config.js'),
        path.join(this.projectRoot, 'ecosystem.config.js'),
        path.join(this.projectRoot, 'drizzle.config.ts'),
        path.join(this.projectRoot, '.env.example'),
      ];

      this.watcher = chokidar.watch(watchDirs, {
        // Use function for more control over what gets ignored
        ignored: (testPath: string) => {
          // Check if path contains any exclude pattern
          return this.options.excludePatterns.some(pattern => {
            // Convert pattern to regex for matching
            const regexPattern = pattern
              .replace(/\*\*/g, '.*')
              .replace(/\*/g, '[^/]*')
              .replace(/\./g, '\\.');
            const regex = new RegExp(regexPattern);
            return regex.test(testPath);
          });
        },
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
        depth: 10,
        ignorePermissionErrors: true,
        // Additional safeguards
        usePolling: false, // Disable polling (we want inotify)
        alwaysStat: false, // Don't stat files unnecessarily
      });

      this.watcher
        .on('add', (filePath) => this.handleFileChange('add', filePath))
        .on('change', (filePath) => this.handleFileChange('change', filePath))
        .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
        .on('error', (error) => {
          // Handle ENOSPC errors specifically
          if (error.message.includes('ENOSPC')) {
            logger.error('File watcher ENOSPC error: System limit for file watchers reached', {
              error: error.message,
              hint: 'Increase fs.inotify.max_user_watches or reduce watch patterns',
              currentLimit: '/proc/sys/fs/inotify/max_user_watches',
            });
          } else {
            logger.error('File watcher error:', { error: error.message });
          }
          this.emit('error', error);
        })
        .on('ready', () => {
          this.isWatching = true;
          logger.info('File watcher started', {
            projectRoot: this.projectRoot,
            watchPaths: this.options.includePatterns,
            debounceMs: this.options.debounceMs,
          });
          this.emit('ready');
        });
    } catch (error) {
      logger.error('Failed to start file watcher:', { error });
      throw error;
    }
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.isWatching = false;
    this.pendingChanges = [];
    logger.info('File watcher stopped');
    this.emit('stopped');
  }

  /**
   * Check if watcher is currently running
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get current pending changes count
   */
  getPendingChangesCount(): number {
    return this.pendingChanges.length;
  }

  /**
   * Handle individual file change event
   */
  private handleFileChange(type: FileChangeEvent['type'], filePath: string): void {
    // Check if file matches include patterns
    if (!this.shouldIncludeFile(filePath)) {
      return;
    }

    const relativePath = path.relative(this.projectRoot, filePath);
    const event: FileChangeEvent = {
      type,
      path: relativePath,
      timestamp: new Date(),
    };

    this.pendingChanges.push(event);
    logger.debug(`File ${type}: ${relativePath}`);

    // Debounce: reset timer on each change
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushChanges();
    }, this.options.debounceMs);
  }

  /**
   * Check if file should be included based on patterns
   */
  private shouldIncludeFile(filePath: string): boolean {
    const relativePath = path.relative(this.projectRoot, filePath);

    // Check if matches any include pattern
    return this.options.includePatterns.some((pattern) => {
      return this.matchPattern(relativePath, pattern);
    });
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\{([^}]+)\}/g, (_, group) => `(${group.replace(/,/g, '|')})`)
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Flush pending changes and emit event
   */
  private flushChanges(): void {
    if (this.pendingChanges.length === 0) {
      return;
    }

    const changes = [...this.pendingChanges];
    this.pendingChanges = [];
    this.debounceTimer = null;

    logger.info(`Flushing ${changes.length} file changes`);
    this.emit('changes', changes);
  }
}

// Singleton instance
let watcherInstance: FileWatcher | null = null;

/**
 * Get or create file watcher instance
 */
export function getFileWatcher(projectRoot?: string): FileWatcher {
  if (!watcherInstance) {
    const root = projectRoot || process.cwd();
    watcherInstance = new FileWatcher(root);
  }
  return watcherInstance;
}

/**
 * Stop and cleanup file watcher instance
 */
export async function stopFileWatcher(): Promise<void> {
  if (watcherInstance) {
    await watcherInstance.stop();
    watcherInstance = null;
  }
}
