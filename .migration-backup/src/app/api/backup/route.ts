
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
const execAsync = promisify(exec);

const BACKUP_DIR = path.join(process.env.HOME || '/home/ubuntu', 'sports-bar-backups');

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
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
    logger.error('Error listing backups:', error);
    return NextResponse.json(
      { error: 'Failed to list backups', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { action, filename } = await request.json();

    if (action === 'create') {
      // Create a new backup
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
      const backupFile = path.join(BACKUP_DIR, `config-backup-${timestamp}.tar.gz`);

      await execAsync(`mkdir -p ${BACKUP_DIR}`);

      const projectDir = '/home/ubuntu/Sports-Bar-TV-Controller';
      
      // Create backup with all configuration files
      const backupCmd = `cd ${projectDir} && tar -czf ${backupFile} \
        config/*.json \
        .env \
        prisma/dev.db \
        data/*.json \
        data/scene-logs/ \
        data/atlas-configs/ \
        2>/dev/null || true`;

      await execAsync(backupCmd);

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

      return NextResponse.json({
        success: true,
        message: 'Backup created successfully',
        filename: path.basename(backupFile),
      });
    } else if (action === 'restore') {
      if (!filename) {
        return NextResponse.json(
          { error: 'Filename is required for restore' },
          { status: 400 }
        );
      }

      const backupFile = path.join(BACKUP_DIR, filename);
      
      // Verify backup file exists
      await fs.access(backupFile);

      // Create a safety backup before restore
      const safetyBackupFile = path.join(
        BACKUP_DIR,
        `pre-restore-${Date.now()}.tar.gz`
      );

      const projectDir = '/home/ubuntu/Sports-Bar-TV-Controller';

      await execAsync(`cd ${projectDir} && tar -czf ${safetyBackupFile} \
        config/*.json \
        .env \
        prisma/dev.db \
        data/*.json \
        data/scene-logs/ \
        data/atlas-configs/ \
        2>/dev/null || true`);

      // Restore from backup
      await execAsync(`cd ${projectDir} && tar -xzf ${backupFile}`);

      return NextResponse.json({
        success: true,
        message: 'Backup restored successfully. Please restart the application.',
        safetyBackup: path.basename(safetyBackupFile),
      });
    } else if (action === 'delete') {
      if (!filename) {
        return NextResponse.json(
          { error: 'Filename is required for delete' },
          { status: 400 }
        );
      }

      const backupFile = path.join(BACKUP_DIR, filename);
      await fs.unlink(backupFile);

      return NextResponse.json({
        success: true,
        message: 'Backup deleted successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    logger.error('Error processing backup:', error);
    return NextResponse.json(
      { error: 'Backup operation failed', message: error.message },
      { status: 500 }
    );
  }
}
