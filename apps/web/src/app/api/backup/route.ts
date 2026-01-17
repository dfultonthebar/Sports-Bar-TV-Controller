
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth } from '@/lib/auth'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'

const execFileAsync = promisify(execFile);

const BACKUP_DIR = path.join(process.env.HOME || '/home/ubuntu', 'sports-bar-backups');
const PROJECT_DIR = '/home/ubuntu/Sports-Bar-TV-Controller';

// Security: Validate filename format to prevent path traversal
function isValidBackupFilename(filename: string): boolean {
  // Only allow config-backup-YYYYMMDD-HHMMSS.tar.gz or pre-restore-timestamp.tar.gz format
  const validPattern = /^(config-backup-\d{8}-\d{6}|pre-restore-\d+)\.tar\.gz$/;
  return validPattern.test(filename);
}

export async function GET(request: NextRequest) {
  // Authentication required - STAFF can view backups
  const authResult = await requireAuth(request, 'STAFF', { auditAction: 'backup_list' })
  if (!authResult.allowed) {
    return authResult.response || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // List all backups
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('config-backup-') && f.endsWith('.tar.gz'))
      .sort()
      .reverse();

    const backups = await Promise.all(
      backupFiles.slice(0, 6).map(async (file) => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = await fs.stat(filePath);

        // Parse timestamp from filename: config-backup-20250101-123045.tar.gz
        const match = file.match(/config-backup-(\d{8})-(\d{6})\.tar\.gz/);
        const timestamp = match
          ? `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)} ${match[2].slice(0, 2)}:${match[2].slice(2, 4)}:${match[2].slice(4, 6)}`
          : '';

        return {
          filename: file,
          size: stats.size,
          created: stats.mtime.toISOString(),
          timestamp,
        };
      })
    );

    return NextResponse.json({ backups, backupDir: BACKUP_DIR });
  } catch (error: any) {
    logger.error('[BACKUP] Error listing backups', { error: error.message });
    return NextResponse.json(
      { error: 'Failed to list backups', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Authentication required - ADMIN only for backup operations
  const authResult = await requireAuth(request, 'ADMIN', { auditAction: 'backup_operation' })
  if (!authResult.allowed) {
    return authResult.response || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation
  const bodyValidation = await validateRequestBody(request, z.object({
    action: z.enum(['create', 'restore', 'delete']),
    filename: z.string().optional()
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { action, filename } = bodyValidation.data;

    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    if (action === 'create') {
      // Create a new backup
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
      const backupFilename = `config-backup-${timestamp}.tar.gz`;
      const backupFile = path.join(BACKUP_DIR, backupFilename);

      logger.info('[BACKUP] Creating backup', { filename: backupFilename });

      // Create backup with tar using execFile (safe from command injection)
      await execFileAsync('tar', [
        '-czf', backupFile,
        '-C', PROJECT_DIR,
        '--ignore-failed-read',
        'config',
        '.env',
        'prisma/dev.db',
        'data'
      ]).catch(() => {
        // Some files may not exist, that's okay
      });

      // Verify backup was created
      await fs.access(backupFile);

      // Clean up old backups (keep only last 10)
      const files = await fs.readdir(BACKUP_DIR);
      const backupFiles = files
        .filter(f => f.startsWith('config-backup-') && f.endsWith('.tar.gz'))
        .sort()
        .reverse();

      if (backupFiles.length > 10) {
        const filesToDelete = backupFiles.slice(10);
        await Promise.all(
          filesToDelete.map(f => fs.unlink(path.join(BACKUP_DIR, f)).catch(() => {}))
        );
      }

      logger.info('[BACKUP] Backup created successfully', { filename: backupFilename });

      return NextResponse.json({
        success: true,
        message: 'Backup created successfully',
        filename: backupFilename,
      });

    } else if (action === 'restore') {
      if (!filename) {
        return NextResponse.json(
          { error: 'Filename is required for restore' },
          { status: 400 }
        );
      }

      // Security: Validate filename format
      if (!isValidBackupFilename(filename)) {
        logger.warn('[BACKUP] Invalid filename format attempted', { filename });
        return NextResponse.json(
          { error: 'Invalid backup filename format' },
          { status: 400 }
        );
      }

      const backupFile = path.join(BACKUP_DIR, filename);

      // Verify backup file exists
      await fs.access(backupFile);

      // Create a safety backup before restore
      const safetyFilename = `pre-restore-${Date.now()}.tar.gz`;
      const safetyBackupFile = path.join(BACKUP_DIR, safetyFilename);

      logger.info('[BACKUP] Creating safety backup before restore', { safetyFilename });

      await execFileAsync('tar', [
        '-czf', safetyBackupFile,
        '-C', PROJECT_DIR,
        '--ignore-failed-read',
        'config',
        '.env',
        'prisma/dev.db',
        'data'
      ]).catch(() => {});

      // Restore from backup
      logger.info('[BACKUP] Restoring from backup', { filename });
      await execFileAsync('tar', ['-xzf', backupFile, '-C', PROJECT_DIR]);

      logger.info('[BACKUP] Restore completed', { filename, safetyBackup: safetyFilename });

      return NextResponse.json({
        success: true,
        message: 'Backup restored successfully. Please restart the application.',
        safetyBackup: safetyFilename,
      });

    } else if (action === 'delete') {
      if (!filename) {
        return NextResponse.json(
          { error: 'Filename is required for delete' },
          { status: 400 }
        );
      }

      // Security: Validate filename format
      if (!isValidBackupFilename(filename)) {
        logger.warn('[BACKUP] Invalid filename format attempted for delete', { filename });
        return NextResponse.json(
          { error: 'Invalid backup filename format' },
          { status: 400 }
        );
      }

      const backupFile = path.join(BACKUP_DIR, filename);
      await fs.unlink(backupFile);

      logger.info('[BACKUP] Backup deleted', { filename });

      return NextResponse.json({
        success: true,
        message: 'Backup deleted successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    logger.error('[BACKUP] Operation failed', { error: error.message });
    return NextResponse.json(
      { error: 'Backup operation failed', message: error.message },
      { status: 500 }
    );
  }
}
