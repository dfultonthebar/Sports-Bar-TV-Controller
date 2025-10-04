#!/usr/bin/env node

/**
 * Self-Healing System
 * Automatically fixes common issues detected by monitoring
 */

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const CONFIG = {
  PROJECT_ROOT: '/home/ubuntu/Sports-Bar-TV-Controller',
  PM2_PROCESS_NAME: 'sports-bar-tv-controller',
  LOG_DIR: '/home/ubuntu/Sports-Bar-TV-Controller/logs',
  TEMP_DIR: '/tmp',
  MAX_RESTART_ATTEMPTS: 3,
  DISK_CLEANUP_THRESHOLD: 90, // percent
  MEMORY_RESTART_THRESHOLD: 95 // percent
};

class SelfHealing {
  constructor() {
    this.fixes = [];
    this.startTime = Date.now();
  }

  async run() {
    console.log('🔧 Starting Self-Healing System...');
    console.log(`⏰ ${new Date().toISOString()}\n`);

    try {
      // Get open issues
      const openIssues = await prisma.issue.findMany({
        where: {
          status: 'open',
          autoFixed: false
        },
        orderBy: [
          { severity: 'desc' },
          { timestamp: 'asc' }
        ]
      });

      console.log(`Found ${openIssues.length} open issues to address\n`);

      for (const issue of openIssues) {
        await this.handleIssue(issue);
      }

      // Proactive maintenance
      await this.proactiveMaintenance();

      // Save results
      await this.saveResults();

      console.log('\n' + '='.repeat(60));
      console.log(`✅ Self-healing completed: ${this.fixes.length} fixes applied`);
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        fixesApplied: this.fixes.length,
        duration: Date.now() - this.startTime
      };
    } catch (error) {
      console.error('❌ Self-healing failed:', error.message);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - this.startTime
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  async handleIssue(issue) {
    console.log(`\n🔍 Handling: ${issue.title} (${issue.severity})`);
    
    // Mark issue as being fixed
    await prisma.issue.update({
      where: { id: issue.id },
      data: { 
        status: 'fixing',
        fixAttempts: issue.fixAttempts + 1
      }
    });

    let fixed = false;
    let fixDetails = null;

    try {
      // Route to appropriate fix handler
      switch (issue.type) {
        case 'crash':
          fixed = await this.fixCrash(issue);
          break;
        case 'resource':
          fixed = await this.fixResourceIssue(issue);
          break;
        case 'connectivity':
          fixed = await this.fixConnectivityIssue(issue);
          break;
        case 'dependency':
          fixed = await this.fixDependencyIssue(issue);
          break;
        case 'performance':
          fixed = await this.fixPerformanceIssue(issue);
          break;
        default:
          console.log(`  ⚠️  No automatic fix available for type: ${issue.type}`);
      }

      if (fixed) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: {
            status: 'fixed',
            autoFixed: true,
            resolvedAt: new Date(),
            resolution: `Automatically fixed by self-healing system`
          }
        });
        console.log(`  ✅ Issue fixed successfully`);
      } else {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { status: 'open' }
        });
        console.log(`  ⚠️  Could not automatically fix issue`);
      }
    } catch (error) {
      console.error(`  ❌ Fix failed: ${error.message}`);
      await prisma.issue.update({
        where: { id: issue.id },
        data: { status: 'open' }
      });
    }
  }

  async fixCrash(issue) {
    if (issue.component === 'pm2') {
      return await this.restartPM2Process();
    }
    return false;
  }

  async fixResourceIssue(issue) {
    if (issue.component === 'disk') {
      return await this.cleanupDiskSpace();
    } else if (issue.component === 'memory') {
      return await this.handleHighMemory();
    }
    return false;
  }

  async fixConnectivityIssue(issue) {
    if (issue.component === 'api') {
      return await this.restartPM2Process();
    }
    return false;
  }

  async fixDependencyIssue(issue) {
    if (issue.component === 'npm') {
      return await this.reinstallDependencies();
    } else if (issue.component === 'database') {
      return await this.repairDatabase();
    }
    return false;
  }

  async fixPerformanceIssue(issue) {
    if (issue.component === 'pm2' || issue.component === 'api') {
      // Restart if performance is degraded
      return await this.restartPM2Process();
    }
    return false;
  }

  async restartPM2Process() {
    const action = 'restart_pm2';
    const startTime = Date.now();
    
    try {
      console.log('  🔄 Restarting PM2 process...');
      
      const { stdout, stderr } = await execAsync(`pm2 restart ${CONFIG.PM2_PROCESS_NAME}`);
      
      // Wait a bit for process to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify process is running
      const { stdout: statusOutput } = await execAsync('pm2 jlist');
      const processes = JSON.parse(statusOutput);
      const targetProcess = processes.find(p => p.name === CONFIG.PM2_PROCESS_NAME);
      
      const success = targetProcess && targetProcess.pm2_env.status === 'online';
      
      await this.recordFix(action, success, {
        stdout,
        stderr,
        processStatus: targetProcess?.pm2_env.status,
        duration: Date.now() - startTime
      });
      
      return success;
    } catch (error) {
      await this.recordFix(action, false, {
        error: error.message,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async cleanupDiskSpace() {
    const action = 'cleanup_disk';
    const startTime = Date.now();
    
    try {
      console.log('  🧹 Cleaning up disk space...');
      
      const cleanupTasks = [];
      
      // Clean npm cache
      cleanupTasks.push(execAsync('npm cache clean --force'));
      
      // Clean old logs
      try {
        const logFiles = await fs.readdir(CONFIG.LOG_DIR);
        for (const file of logFiles) {
          if (file.endsWith('.log')) {
            const filePath = path.join(CONFIG.LOG_DIR, file);
            const stats = await fs.stat(filePath);
            const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
            
            // Delete logs older than 30 days
            if (ageInDays > 30) {
              await fs.unlink(filePath);
              console.log(`    Deleted old log: ${file}`);
            }
          }
        }
      } catch (error) {
        console.log(`    Warning: Could not clean logs: ${error.message}`);
      }
      
      // Clean temp files
      try {
        const { stdout } = await execAsync(`find ${CONFIG.TEMP_DIR} -type f -name "*.tmp" -mtime +7 -delete`);
      } catch (error) {
        console.log(`    Warning: Could not clean temp files: ${error.message}`);
      }
      
      await Promise.all(cleanupTasks);
      
      // Check disk space after cleanup
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const usedPercent = parseInt(parts[4]);
      
      const success = usedPercent < CONFIG.DISK_CLEANUP_THRESHOLD;
      
      await this.recordFix(action, success, {
        diskUsageAfter: usedPercent,
        duration: Date.now() - startTime
      });
      
      return success;
    } catch (error) {
      await this.recordFix(action, false, {
        error: error.message,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async handleHighMemory() {
    const action = 'handle_high_memory';
    const startTime = Date.now();
    
    try {
      console.log('  💾 Handling high memory usage...');
      
      // Restart PM2 process to free memory
      const success = await this.restartPM2Process();
      
      await this.recordFix(action, success, {
        method: 'restart_process',
        duration: Date.now() - startTime
      });
      
      return success;
    } catch (error) {
      await this.recordFix(action, false, {
        error: error.message,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async reinstallDependencies() {
    const action = 'reinstall_dependencies';
    const startTime = Date.now();
    
    try {
      console.log('  📦 Reinstalling dependencies...');
      
      // Run npm install
      const { stdout, stderr } = await execAsync('npm install', {
        cwd: CONFIG.PROJECT_ROOT,
        timeout: 300000 // 5 minutes
      });
      
      const success = !stderr.includes('error') && !stderr.includes('ERR!');
      
      await this.recordFix(action, success, {
        stdout: stdout.substring(0, 500),
        stderr: stderr.substring(0, 500),
        duration: Date.now() - startTime
      });
      
      return success;
    } catch (error) {
      await this.recordFix(action, false, {
        error: error.message,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async repairDatabase() {
    const action = 'repair_database';
    const startTime = Date.now();
    
    try {
      console.log('  🗄️  Repairing database...');
      
      // Create backup first
      const dbPath = CONFIG.PROJECT_ROOT + '/prisma/data/sports_bar.db';
      const backupPath = dbPath + '.backup.' + Date.now();
      
      await fs.copyFile(dbPath, backupPath);
      console.log(`    Created backup: ${backupPath}`);
      
      // Run integrity check
      const integrityCheck = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
      
      if (integrityCheck[0]?.integrity_check === 'ok') {
        console.log('    Database integrity is OK');
        
        await this.recordFix(action, true, {
          method: 'integrity_check',
          result: 'ok',
          backupCreated: backupPath,
          duration: Date.now() - startTime
        });
        
        return true;
      }
      
      // If corrupted, try to recover
      console.log('    Database corrupted, attempting recovery...');
      
      // Run VACUUM to rebuild database
      await prisma.$queryRawUnsafe('VACUUM');
      
      // Check again
      const recheckIntegrity = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
      const success = recheckIntegrity[0]?.integrity_check === 'ok';
      
      await this.recordFix(action, success, {
        method: 'vacuum',
        result: success ? 'recovered' : 'failed',
        backupCreated: backupPath,
        duration: Date.now() - startTime
      });
      
      return success;
    } catch (error) {
      await this.recordFix(action, false, {
        error: error.message,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async proactiveMaintenance() {
    console.log('\n🔮 Running Proactive Maintenance...');
    
    // Rotate logs if needed
    await this.rotateLogs();
    
    // Clean old diagnostic data
    await this.cleanOldDiagnosticData();
  }

  async rotateLogs() {
    try {
      const logFiles = await fs.readdir(CONFIG.LOG_DIR).catch(() => []);
      
      for (const file of logFiles) {
        if (file.endsWith('.log')) {
          const filePath = path.join(CONFIG.LOG_DIR, file);
          const stats = await fs.stat(filePath);
          
          // Rotate if larger than 50MB
          if (stats.size > 50 * 1024 * 1024) {
            const rotatedPath = `${filePath}.${Date.now()}`;
            await fs.rename(filePath, rotatedPath);
            console.log(`  📋 Rotated log: ${file}`);
          }
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Log rotation warning: ${error.message}`);
    }
  }

  async cleanOldDiagnosticData() {
    try {
      // Keep only last 30 days of diagnostic data
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const deleted = await prisma.systemHealthCheck.deleteMany({
        where: {
          timestamp: { lt: thirtyDaysAgo }
        }
      });
      
      if (deleted.count > 0) {
        console.log(`  🗑️  Cleaned ${deleted.count} old health check records`);
      }
    } catch (error) {
      console.log(`  ⚠️  Cleanup warning: ${error.message}`);
    }
  }

  async recordFix(action, success, details) {
    this.fixes.push({
      action,
      success,
      details,
      timestamp: new Date()
    });
    
    // Also save to database if we have an issue context
    // This would be called from handleIssue with issue.id
  }

  async saveResults() {
    // Save summary of self-healing run
    try {
      const successfulFixes = this.fixes.filter(f => f.success).length;
      const failedFixes = this.fixes.filter(f => !f.success).length;
      
      await prisma.diagnosticRun.create({
        data: {
          runType: 'self_healing',
          triggeredBy: 'auto',
          status: failedFixes === 0 ? 'completed' : 'partial',
          duration: Date.now() - this.startTime,
          issuesFixed: successfulFixes,
          summary: `Self-healing: ${successfulFixes} fixes applied, ${failedFixes} failed`,
          report: JSON.stringify(this.fixes, null, 2)
        }
      });
    } catch (error) {
      console.error('Failed to save self-healing results:', error.message);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const healer = new SelfHealing();
  healer.run()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = SelfHealing;
