/**
 * Path utilities for monorepo compatibility
 *
 * In the turborepo monorepo structure, the data directory is at the
 * repository root, not inside apps/web/. These utilities provide
 * consistent paths regardless of where the process is started from.
 */

import path from 'path';
import fs from 'fs';

/**
 * Find the monorepo root by looking for turbo.json or package.json with workspaces
 */
function findMonorepoRoot(): string {
  let currentDir = process.cwd();

  // If we're already at a directory with data/, use it
  if (fs.existsSync(path.join(currentDir, 'data'))) {
    return currentDir;
  }

  // Walk up to find the monorepo root (has turbo.json or workspaces in package.json)
  const maxDepth = 5;
  for (let i = 0; i < maxDepth; i++) {
    // Check for turbo.json (definitive monorepo indicator)
    if (fs.existsSync(path.join(currentDir, 'turbo.json'))) {
      return currentDir;
    }

    // Check for package.json with workspaces
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (pkg.workspaces) {
          return currentDir;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  // Fallback to process.cwd() for backward compatibility
  return process.cwd();
}

// Cache the root path for performance
let cachedRoot: string | null = null;

/**
 * Get the monorepo root directory
 */
export function getProjectRoot(): string {
  if (cachedRoot === null) {
    cachedRoot = findMonorepoRoot();
  }
  return cachedRoot;
}

/**
 * Get the data directory path
 * This is where JSON config files are stored (firetv-devices.json, etc.)
 */
export function getDataDir(): string {
  return path.join(getProjectRoot(), 'data');
}

/**
 * Get a path to a file in the data directory
 * @param filename - The file name (e.g., 'firetv-devices.json')
 */
export function getDataPath(filename: string): string {
  return path.join(getDataDir(), filename);
}

/**
 * Get the RAG data directory path
 */
export function getRagDataDir(): string {
  return path.join(getProjectRoot(), 'rag-data');
}

/**
 * Get the logs directory path
 */
export function getLogsDir(): string {
  return path.join(getProjectRoot(), 'log');
}

/**
 * Get the memory bank directory path
 */
export function getMemoryBankDir(): string {
  return path.join(getProjectRoot(), 'memory-bank');
}

/**
 * Get the docs directory path
 */
export function getDocsDir(): string {
  return path.join(getProjectRoot(), 'docs');
}

/**
 * Common data file paths
 */
export const DataFiles = {
  get fireTVDevices() { return getDataPath('firetv-devices.json'); },
  get directTVDevices() { return getDataPath('directv-devices.json'); },
  get irDevices() { return getDataPath('ir-devices.json'); },
  get deviceSubscriptions() { return getDataPath('device-subscriptions.json'); },
  get subscribedStreamingApps() { return getDataPath('subscribed-streaming-apps.json'); },
  get streamingCredentials() { return getDataPath('streaming-credentials.json'); },
  get tvLayout() { return getDataPath('tv-layout.json'); },
  get layoutOverrides() { return getDataPath('layout-overrides.json'); },
  get aiKnowledgeBase() { return getDataPath('ai-knowledge-base.json'); },
} as const;

/**
 * Reset the cached root (useful for testing)
 */
export function resetPathCache(): void {
  cachedRoot = null;
}
