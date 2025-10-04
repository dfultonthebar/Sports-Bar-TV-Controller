#!/usr/bin/env node

/**
 * Light Health Check - Runs every 5 minutes
 * Quick checks for critical system health
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  PM2_PROCESS_NAME: 'sports-bar-tv-controller',
  DISK_WARNING_THRESHOLD: 80, // percent
  DISK_CRITICAL_THRESHOLD: 90, // percent
  MEMORY_WARNING_THRESHOLD: 85, // percent
  MEMORY_CRITICAL_THRESHOLD: 95, // percent
  API_TIMEOUT: 5000, // ms
  DB_PATH: process.env.DATABASE_URL?.replace('file:', '') || './prisma/data/sports_bar.db'
};

class LightHealthCheck {
  constructor() {
    this.results = [];
    this.issues = [];
    this.startTime = Date.now();
  }

  async run() {
    console.log('🔍 Starting Light Health Check...');
    console.log(`⏰ ${new Date().toISOString()}\n`);

    try {
      // Run all checks
      await this.checkPM2Process();
      await this.checkAPIHealth();
      await this.checkDatabaseConnectivity();
      await this.checkDiskSpace();
      await this.checkMemoryUsage();
      await this.checkSystemLoad();

      // Save results to database
      await this.saveResults();

      // Print summary
      this.printSummary();

      // Trigger self-healing if needed
      if (this.issues.length > 0) {
        await this.triggerSelfHealing();
      }

      return {
        success: true,
        issues: this.issues.length,
        duration: Date.now() - this.startTime
      };
    } catch (error) {
      console.error('❌ Light check failed:', error.message);
      await this.logError(error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - this.startTime
      };
    } finally {
      await prisma.$disconnect();
    }
  }

  async checkPM2Process() {
    const checkStart = Date.now();
    try {
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout);
      const targetProcess = processes.find(p => p.name === CONFIG.PM2_PROCESS_NAME);

      if (!targetProcess) {
        await this.recordCheck('pm2', 'critical', {
          message: 'PM2 process not found',
          processName: CONFIG.PM2_PROCESS_NAME
        }, checkStart);
        
        await this.createIssue('crash', 'critical', 'pm2', 
          'PM2 Process Not Running',
          `The PM2 process "${CONFIG.PM2_PROCESS_NAME}" is not running`
        );
        return;
      }

      const status = targetProcess.pm2_env.status;
      const memory = Math.round(targetProcess.monit.memory / 1024 / 1024);
      const cpu = targetProcess.monit.cpu;
      const uptime = Math.round((Date.now() - targetProcess.pm2_env.pm_uptime) / 1000);
      const restarts = targetProcess.pm2_env.restart_time;

      if (status !== 'online') {
        await this.recordCheck('pm2', 'critical', {
          status,
          memory,
          cpu,
          uptime,
          restarts
        }, checkStart);
        
        await this.createIssue('crash', 'critical', 'pm2',
          'PM2 Process Not Online',
          `Process status is "${status}" instead of "online"`
        );
      } else if (restarts > 5) {
        await this.recordCheck('pm2', 'warning', {
          status,
          memory,
          cpu,
          uptime,
          restarts,
          message: 'High restart count'
        }, checkStart);
        
        await this.createIssue('performance', 'medium', 'pm2',
          'High PM2 Restart Count',
          `Process has restarted ${restarts} times`
        );
      } else {
        await this.recordCheck('pm2', 'healthy', {
          status,
          memory,
          cpu,
          uptime,
          restarts
        }, checkStart);
      }

      console.log(`✅ PM2 Process: ${status} (${memory}MB, ${cpu}% CPU, ${restarts} restarts)`);
    } catch (error) {
      await this.recordCheck('pm2', 'error', {
        error: error.message
      }, checkStart);
      
      await this.createIssue('dependency', 'critical', 'pm2',
        'PM2 Check Failed',
        `Failed to check PM2 status: ${error.message}`
      );
      console.error('❌ PM2 check failed:', error.message);
    }
  }

  async checkAPIHealth() {
    const checkStart = Date.now();
    try {
      const response = await axios.get(`${CONFIG.API_BASE_URL}/api/health`, {
        timeout: CONFIG.API_TIMEOUT
      });

      const responseTime = Date.now() - checkStart;

      if (response.status === 200) {
        await this.recordCheck('api', 'healthy', {
          status: response.status,
          responseTime,
          data: response.data
        }, checkStart);
        console.log(`✅ API Health: OK (${responseTime}ms)`);
      } else {
        await this.recordCheck('api', 'warning', {
          status: response.status,
          responseTime
        }, checkStart);
        console.log(`⚠️  API Health: Unexpected status ${response.status}`);
      }
    } catch (error) {
      const responseTime = Date.now() - checkStart;
      
      if (error.code === 'ECONNREFUSED') {
        await this.recordCheck('api', 'critical', {
          error: 'Connection refused',
          responseTime
        }, checkStart);
        
        await this.createIssue('connectivity', 'critical', 'api',
          'API Not Responding',
          'Cannot connect to API endpoint - service may be down'
        );
      } else if (error.code === 'ETIMEDOUT') {
        await this.recordCheck('api', 'critical', {
          error: 'Timeout',
          responseTime
        }, checkStart);
        
        await this.createIssue('performance', 'high', 'api',
          'API Timeout',
          `API did not respond within ${CONFIG.API_TIMEOUT}ms`
        );
      } else {
        await this.recordCheck('api', 'error', {
          error: error.message,
          responseTime
        }, checkStart);
      }
      
      console.error(`❌ API Health: ${error.message}`);
    }
  }

  async checkDatabaseConnectivity() {
    const checkStart = Date.now();
    try {
      // Check if database file exists
      try {
        await fs.access(CONFIG.DB_PATH);
      } catch {
        await this.recordCheck('database', 'critical', {
          error: 'Database file not found',
          path: CONFIG.DB_PATH
        }, checkStart);
        
        await this.createIssue('dependency', 'critical', 'database',
          'Database File Missing',
          `Database file not found at ${CONFIG.DB_PATH}`
        );
        return;
      }

      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Get database size
      const stats = await fs.stat(CONFIG.DB_PATH);
      const sizeInMB = Math.round(stats.size / 1024 / 1024 * 100) / 100;

      const responseTime = Date.now() - checkStart;

      await this.recordCheck('database', 'healthy', {
        responseTime,
        sizeInMB,
        path: CONFIG.DB_PATH
      }, checkStart);

      console.log(`✅ Database: Connected (${sizeInMB}MB, ${responseTime}ms)`);
    } catch (error) {
      const responseTime = Date.now() - checkStart;
      
      await this.recordCheck('database', 'critical', {
        error: error.message,
        responseTime
      }, checkStart);
      
      await this.createIssue('dependency', 'critical', 'database',
        'Database Connection Failed',
        `Cannot connect to database: ${error.message}`
      );
      
      console.error('❌ Database check failed:', error.message);
    }
  }

  async checkDiskSpace() {
    const checkStart = Date.now();
    try {
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const usedPercent = parseInt(parts[4]);
      const available = parts[3];
      const used = parts[2];
      const total = parts[1];

      let status = 'healthy';
      if (usedPercent >= CONFIG.DISK_CRITICAL_THRESHOLD) {
        status = 'critical';
        await this.createIssue('resource', 'critical', 'disk',
          'Critical Disk Space',
          `Disk usage at ${usedPercent}% (${used}/${total})`
        );
      } else if (usedPercent >= CONFIG.DISK_WARNING_THRESHOLD) {
        status = 'warning';
        await this.createIssue('resource', 'medium', 'disk',
          'Low Disk Space',
          `Disk usage at ${usedPercent}% (${used}/${total})`
        );
      }

      await this.recordCheck('disk', status, {
        usedPercent,
        used,
        available,
        total
      }, checkStart);

      const icon = status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} Disk Space: ${usedPercent}% used (${available} available)`);
    } catch (error) {
      await this.recordCheck('disk', 'error', {
        error: error.message
      }, checkStart);
      console.error('❌ Disk check failed:', error.message);
    }
  }

  async checkMemoryUsage() {
    const checkStart = Date.now();
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const usedPercent = Math.round((usedMem / totalMem) * 100);

      const totalGB = Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10;
      const usedGB = Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10;
      const freeGB = Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10;

      let status = 'healthy';
      if (usedPercent >= CONFIG.MEMORY_CRITICAL_THRESHOLD) {
        status = 'critical';
        await this.createIssue('resource', 'critical', 'memory',
          'Critical Memory Usage',
          `Memory usage at ${usedPercent}% (${usedGB}GB/${totalGB}GB)`
        );
      } else if (usedPercent >= CONFIG.MEMORY_WARNING_THRESHOLD) {
        status = 'warning';
        await this.createIssue('resource', 'medium', 'memory',
          'High Memory Usage',
          `Memory usage at ${usedPercent}% (${usedGB}GB/${totalGB}GB)`
        );
      }

      await this.recordCheck('memory', status, {
        usedPercent,
        usedGB,
        freeGB,
        totalGB
      }, checkStart);

      const icon = status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} Memory: ${usedPercent}% used (${freeGB}GB free of ${totalGB}GB)`);
    } catch (error) {
      await this.recordCheck('memory', 'error', {
        error: error.message
      }, checkStart);
      console.error('❌ Memory check failed:', error.message);
    }
  }

  async checkSystemLoad() {
    const checkStart = Date.now();
    try {
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const load1 = Math.round(loadAvg[0] * 100) / 100;
      const load5 = Math.round(loadAvg[1] * 100) / 100;
      const load15 = Math.round(loadAvg[2] * 100) / 100;

      // Load average per CPU
      const loadPerCPU = Math.round((load1 / cpuCount) * 100);

      let status = 'healthy';
      if (loadPerCPU > 90) {
        status = 'critical';
      } else if (loadPerCPU > 70) {
        status = 'warning';
      }

      await this.recordCheck('system_load', status, {
        load1,
        load5,
        load15,
        cpuCount,
        loadPerCPU
      }, checkStart);

      const icon = status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} System Load: ${load1}, ${load5}, ${load15} (${cpuCount} CPUs)`);
    } catch (error) {
      await this.recordCheck('system_load', 'error', {
        error: error.message
      }, checkStart);
      console.error('❌ System load check failed:', error.message);
    }
  }

  async recordCheck(component, status, metrics, startTime) {
    const responseTime = Date.now() - startTime;
    
    this.results.push({
      component,
      status,
      metrics,
      responseTime
    });

    try {
      await prisma.systemHealthCheck.create({
        data: {
          checkType: 'light',
          component,
          status,
          metrics: JSON.stringify(metrics),
          responseTime
        }
      });
    } catch (error) {
      console.error(`Failed to record check for ${component}:`, error.message);
    }
  }

  async createIssue(type, severity, component, title, description) {
    // Check if similar issue already exists and is open
    const existingIssue = await prisma.issue.findFirst({
      where: {
        component,
        type,
        status: 'open',
        title
      }
    });

    if (existingIssue) {
      // Update existing issue
      await prisma.issue.update({
        where: { id: existingIssue.id },
        data: {
          updatedAt: new Date(),
          description: `${description}\n\nLast seen: ${new Date().toISOString()}`
        }
      });
      
      this.issues.push(existingIssue);
    } else {
      // Create new issue
      const issue = await prisma.issue.create({
        data: {
          type,
          severity,
          component,
          title,
          description,
          status: 'open'
        }
      });
      
      this.issues.push(issue);
    }
  }

  async saveResults() {
    const duration = Date.now() - this.startTime;
    const checksRun = this.results.length;
    const checksPassed = this.results.filter(r => r.status === 'healthy').length;
    const checksFailed = this.results.filter(r => r.status === 'critical' || r.status === 'error').length;
    const checksWarning = this.results.filter(r => r.status === 'warning').length;

    await prisma.diagnosticRun.create({
      data: {
        runType: 'light',
        triggeredBy: 'schedule',
        status: checksFailed > 0 ? 'failed' : checksWarning > 0 ? 'partial' : 'completed',
        duration,
        checksRun,
        checksPassed,
        checksFailed,
        checksWarning,
        issuesFound: this.issues.length,
        summary: `Light check completed: ${checksPassed}/${checksRun} passed`,
        report: JSON.stringify(this.results, null, 2)
      }
    });
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 LIGHT CHECK SUMMARY');
    console.log('='.repeat(60));
    
    const healthy = this.results.filter(r => r.status === 'healthy').length;
    const warning = this.results.filter(r => r.status === 'warning').length;
    const critical = this.results.filter(r => r.status === 'critical' || r.status === 'error').length;
    
    console.log(`✅ Healthy: ${healthy}`);
    console.log(`⚠️  Warning: ${warning}`);
    console.log(`❌ Critical: ${critical}`);
    console.log(`🐛 Issues Found: ${this.issues.length}`);
    console.log(`⏱️  Duration: ${Date.now() - this.startTime}ms`);
    console.log('='.repeat(60) + '\n');
  }

  async triggerSelfHealing() {
    console.log('🔧 Triggering self-healing for detected issues...');
    try {
      const { exec } = require('child_process');
      exec('node /home/ubuntu/Sports-Bar-TV-Controller/scripts/diagnostics/self-healing.js', 
        (error, stdout, stderr) => {
          if (error) {
            console.error('Failed to trigger self-healing:', error.message);
          }
        }
      );
    } catch (error) {
      console.error('Failed to trigger self-healing:', error.message);
    }
  }

  async logError(error) {
    try {
      await prisma.diagnosticRun.create({
        data: {
          runType: 'light',
          triggeredBy: 'schedule',
          status: 'failed',
          duration: Date.now() - this.startTime,
          summary: `Light check failed: ${error.message}`,
          report: JSON.stringify({ error: error.message, stack: error.stack })
        }
      });
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError.message);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new LightHealthCheck();
  checker.run()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = LightHealthCheck;
