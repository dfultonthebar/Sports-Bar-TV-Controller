
#!/usr/bin/env node

/**
 * Deep Diagnostics - Runs Sunday 5 AM
 * Comprehensive system analysis and health check
 * NOW WITH MULTI-AI CONSULTATION
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  PROJECT_ROOT: '/home/ubuntu/Sports-Bar-TV-Controller',
  USE_MULTI_AI: process.env.USE_MULTI_AI !== 'false', // Enable by default
  AI_CONSULTATION_THRESHOLD: 'medium' // Consult AI for medium+ severity issues
};

class DeepDiagnostics {
  constructor() {
    this.results = [];
    this.issues = [];
    this.aiConsultations = [];
    this.startTime = Date.now();
  }

  async run() {
    console.log('🔬 Starting Deep Diagnostics...');
    console.log(`⏰ ${new Date().toISOString()}\n`);

    try {
      // Run comprehensive checks
      await this.checkDependencies();
      await this.checkSecurityVulnerabilities();
      await this.checkDatabaseIntegrity();
      await this.checkLogFiles();
      await this.checkExternalIntegrations();
      await this.checkPerformanceMetrics();
      await this.checkDiskHealth();
      await this.checkBackupStatus();

      // Consult AI for critical issues
      if (CONFIG.USE_MULTI_AI) {
        await this.consultAIForIssues();
      }

      // Save results
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
        aiConsultations: this.aiConsultations.length,
        duration: Date.now() - this.startTime
      };
    } catch (error) {
      console.error('❌ Deep diagnostics failed:', error.message);
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

  async consultAIForIssues() {
    console.log('\n🤖 Consulting AI models for critical issues...');

    // Filter issues that need AI consultation
    const criticalIssues = this.issues.filter(issue => {
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      const thresholdLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      return severityLevels[issue.severity] >= thresholdLevels[CONFIG.AI_CONSULTATION_THRESHOLD];
    });

    if (criticalIssues.length === 0) {
      console.log('No critical issues requiring AI consultation');
      return;
    }

    console.log(`Found ${criticalIssues.length} issue(s) requiring AI consultation`);

    for (const issue of criticalIssues) {
      try {
        const query = `
Issue: ${issue.title}
Severity: ${issue.severity}
Component: ${issue.component}
Description: ${issue.description}

What is the recommended action to resolve this issue? Should we apply an automatic fix, or does this require manual intervention?
`;

        console.log(`\nConsulting AI about: ${issue.title}`);

        const response = await axios.post(
          `${CONFIG.API_BASE_URL}/api/chat/diagnostics`,
          { message: query },
          { timeout: 30000 }
        );

        if (response.data.multiAI) {
          const result = response.data.result;
          
          console.log(`✅ Multi-AI consultation completed:`);
          console.log(`   - Providers: ${result.summary.successfulResponses}/${result.summary.totalProviders}`);
          console.log(`   - Agreement: ${result.consensus.agreementLevel}`);
          console.log(`   - Confidence: ${Math.round(result.consensus.confidence * 100)}%`);
          
          if (result.disagreements.length > 0) {
            console.log(`   ⚠️  ${result.disagreements.length} disagreement(s) detected`);
          }

          // Store AI consultation
          this.aiConsultations.push({
            issueId: issue.id,
            issueTitle: issue.title,
            query,
            result,
            timestamp: new Date()
          });

          // Check if majority recommends automatic action
          if (result.voting && result.voting.winnerVotes > result.voting.totalVotes / 2) {
            const winner = result.voting.winner.toLowerCase();
            if (winner.includes('restart') || winner.includes('fix') || winner.includes('repair')) {
              console.log(`   🔧 Majority recommends: ${result.voting.winner}`);
              issue.aiRecommendation = result.voting.winner;
              issue.aiConfidence = result.consensus.confidence;
            } else if (winner.includes('wait') || winner.includes('monitor')) {
              console.log(`   👀 Majority recommends: ${result.voting.winner}`);
              issue.aiRecommendation = 'monitor';
            }
          }
        } else {
          console.log(`   ℹ️  Fallback response (no AI configured)`);
        }

      } catch (error) {
        console.error(`   ❌ AI consultation failed: ${error.message}`);
      }
    }
  }

  async checkDependencies() {
    console.log('📦 Checking dependencies...');
    const checkStart = Date.now();

    try {
      const { stdout } = await execAsync('npm outdated --json', {
        cwd: CONFIG.PROJECT_ROOT,
        timeout: 30000
      });

      const outdated = JSON.parse(stdout || '{}');
      const outdatedCount = Object.keys(outdated).length;

      if (outdatedCount > 0) {
        this.issues.push({
          id: `dep-outdated-${Date.now()}`,
          type: 'dependency',
          severity: outdatedCount > 10 ? 'medium' : 'low',
          component: 'Dependencies',
          title: `${outdatedCount} outdated package(s)`,
          description: `Found ${outdatedCount} outdated npm packages. Consider updating to latest versions.`,
          status: 'open',
          autoFixed: false,
          timestamp: new Date()
        });
      }

      this.results.push({
        check: 'Dependencies',
        status: outdatedCount === 0 ? 'pass' : 'warning',
        duration: Date.now() - checkStart,
        details: { outdatedCount }
      });

      console.log(`   ${outdatedCount === 0 ? '✅' : '⚠️'} ${outdatedCount} outdated package(s)`);
    } catch (error) {
      console.log(`   ⚠️ Could not check dependencies: ${error.message}`);
    }
  }

  async checkSecurityVulnerabilities() {
    console.log('🔒 Checking security vulnerabilities...');
    const checkStart = Date.now();

    try {
      const { stdout } = await execAsync('npm audit --json', {
        cwd: CONFIG.PROJECT_ROOT,
        timeout: 30000
      });

      const audit = JSON.parse(stdout);
      const vulnCount = audit.metadata?.vulnerabilities?.total || 0;
      const critical = audit.metadata?.vulnerabilities?.critical || 0;
      const high = audit.metadata?.vulnerabilities?.high || 0;

      if (vulnCount > 0) {
        const severity = critical > 0 ? 'critical' : high > 0 ? 'high' : 'medium';
        this.issues.push({
          id: `security-vuln-${Date.now()}`,
          type: 'security',
          severity,
          component: 'Dependencies',
          title: `${vulnCount} security vulnerabilit${vulnCount === 1 ? 'y' : 'ies'}`,
          description: `Found ${critical} critical, ${high} high severity vulnerabilities. Run 'npm audit fix' to resolve.`,
          status: 'open',
          autoFixed: false,
          timestamp: new Date()
        });
      }

      this.results.push({
        check: 'Security',
        status: vulnCount === 0 ? 'pass' : 'fail',
        duration: Date.now() - checkStart,
        details: { total: vulnCount, critical, high }
      });

      console.log(`   ${vulnCount === 0 ? '✅' : '❌'} ${vulnCount} vulnerabilit${vulnCount === 1 ? 'y' : 'ies'} (${critical} critical, ${high} high)`);
    } catch (error) {
      console.log(`   ⚠️ Could not check security: ${error.message}`);
    }
  }

  async checkDatabaseIntegrity() {
    console.log('💾 Checking database integrity...');
    const checkStart = Date.now();

    try {
      // Run integrity check
      await prisma.$queryRaw`PRAGMA integrity_check`;
      
      // Check database size
      const dbPath = path.join(CONFIG.PROJECT_ROOT, 'prisma/data/sports_bar.db');
      const stats = await fs.stat(dbPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      this.results.push({
        check: 'Database Integrity',
        status: 'pass',
        duration: Date.now() - checkStart,
        details: { sizeMB }
      });

      console.log(`   ✅ Database integrity OK (${sizeMB} MB)`);
    } catch (error) {
      this.issues.push({
        id: `db-integrity-${Date.now()}`,
        type: 'database',
        severity: 'high',
        component: 'Database',
        title: 'Database integrity check failed',
        description: error.message,
        status: 'open',
        autoFixed: false,
        timestamp: new Date()
      });
      console.log(`   ❌ Database integrity check failed`);
    }
  }

  async checkLogFiles() {
    console.log('📝 Analyzing log files...');
    const checkStart = Date.now();

    try {
      const logDir = path.join(CONFIG.PROJECT_ROOT, 'logs');
      const files = await fs.readdir(logDir);
      
      let totalSize = 0;
      let errorCount = 0;

      for (const file of files) {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        // Check for errors in recent logs
        if (file.includes('error') || file.includes('pm2')) {
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const errors = (content.match(/error|exception|failed/gi) || []).length;
            errorCount += errors;
          } catch (e) {
            // Skip if can't read
          }
        }
      }

      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

      if (totalSize > 100 * 1024 * 1024) { // > 100MB
        this.issues.push({
          id: `logs-size-${Date.now()}`,
          type: 'resource',
          severity: 'low',
          component: 'Logs',
          title: 'Large log files',
          description: `Log files total ${totalSizeMB} MB. Consider cleanup.`,
          status: 'open',
          autoFixed: false,
          timestamp: new Date()
        });
      }

      this.results.push({
        check: 'Log Files',
        status: totalSize > 100 * 1024 * 1024 ? 'warning' : 'pass',
        duration: Date.now() - checkStart,
        details: { totalSizeMB, errorCount, fileCount: files.length }
      });

      console.log(`   ${totalSize > 100 * 1024 * 1024 ? '⚠️' : '✅'} ${files.length} log files (${totalSizeMB} MB, ${errorCount} errors)`);
    } catch (error) {
      console.log(`   ⚠️ Could not analyze logs: ${error.message}`);
    }
  }

  async checkExternalIntegrations() {
    console.log('🔌 Checking external integrations...');
    const checkStart = Date.now();

    const integrations = [
      { name: 'Wolf Pack Matrix', endpoint: '/api/wolfpack/status' },
      { name: 'Atlas Audio', endpoint: '/api/atlas/status' },
      { name: 'CEC Control', endpoint: '/api/cec/status' }
    ];

    let failedCount = 0;

    for (const integration of integrations) {
      try {
        await axios.get(`${CONFIG.API_BASE_URL}${integration.endpoint}`, { timeout: 5000 });
        console.log(`   ✅ ${integration.name}`);
      } catch (error) {
        failedCount++;
        console.log(`   ❌ ${integration.name}`);
        
        this.issues.push({
          id: `integration-${integration.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          type: 'connectivity',
          severity: 'medium',
          component: integration.name,
          title: `${integration.name} unavailable`,
          description: `Could not connect to ${integration.name}. Check configuration and connectivity.`,
          status: 'open',
          autoFixed: false,
          timestamp: new Date()
        });
      }
    }

    this.results.push({
      check: 'External Integrations',
      status: failedCount === 0 ? 'pass' : 'warning',
      duration: Date.now() - checkStart,
      details: { total: integrations.length, failed: failedCount }
    });
  }

  async checkPerformanceMetrics() {
    console.log('⚡ Analyzing performance metrics...');
    const checkStart = Date.now();

    try {
      const recentMetrics = await prisma.systemMetrics.findMany({
        orderBy: { timestamp: 'desc' },
        take: 100
      });

      if (recentMetrics.length > 0) {
        const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length;
        const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
        const avgDisk = recentMetrics.reduce((sum, m) => sum + m.diskUsage, 0) / recentMetrics.length;

        if (avgCpu > 80) {
          this.issues.push({
            id: `perf-cpu-${Date.now()}`,
            type: 'performance',
            severity: 'medium',
            component: 'System Resources',
            title: 'High average CPU usage',
            description: `Average CPU usage is ${avgCpu.toFixed(1)}% over last 100 checks.`,
            status: 'open',
            autoFixed: false,
            timestamp: new Date()
          });
        }

        this.results.push({
          check: 'Performance Metrics',
          status: avgCpu > 80 || avgMemory > 85 ? 'warning' : 'pass',
          duration: Date.now() - checkStart,
          details: { 
            avgCpu: avgCpu.toFixed(1), 
            avgMemory: avgMemory.toFixed(1),
            avgDisk: avgDisk.toFixed(1)
          }
        });

        console.log(`   ${avgCpu > 80 ? '⚠️' : '✅'} Avg CPU: ${avgCpu.toFixed(1)}%, Memory: ${avgMemory.toFixed(1)}%, Disk: ${avgDisk.toFixed(1)}%`);
      }
    } catch (error) {
      console.log(`   ⚠️ Could not analyze performance: ${error.message}`);
    }
  }

  async checkDiskHealth() {
    console.log('💿 Checking disk health...');
    const checkStart = Date.now();

    try {
      const { stdout } = await execAsync('df -h /');
      const lines = stdout.split('\n');
      const dataLine = lines[1];
      const parts = dataLine.split(/\s+/);
      const usagePercent = parseInt(parts[4]);

      this.results.push({
        check: 'Disk Health',
        status: usagePercent > 90 ? 'fail' : usagePercent > 80 ? 'warning' : 'pass',
        duration: Date.now() - checkStart,
        details: { usagePercent }
      });

      console.log(`   ${usagePercent > 90 ? '❌' : usagePercent > 80 ? '⚠️' : '✅'} Disk usage: ${usagePercent}%`);
    } catch (error) {
      console.log(`   ⚠️ Could not check disk: ${error.message}`);
    }
  }

  async checkBackupStatus() {
    console.log('💾 Checking backup status...');
    const checkStart = Date.now();

    try {
      const backupDir = path.join(CONFIG.PROJECT_ROOT, 'backups');
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(f => f.endsWith('.db') || f.endsWith('.sql'));

      if (backupFiles.length === 0) {
        this.issues.push({
          id: `backup-missing-${Date.now()}`,
          type: 'backup',
          severity: 'medium',
          component: 'Backup System',
          title: 'No backups found',
          description: 'No database backups found. Backup system may not be working.',
          status: 'open',
          autoFixed: false,
          timestamp: new Date()
        });
      } else {
        // Check age of latest backup
        const latestBackup = backupFiles[backupFiles.length - 1];
        const backupPath = path.join(backupDir, latestBackup);
        const stats = await fs.stat(backupPath);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

        if (ageHours > 168) { // > 1 week
          this.issues.push({
            id: `backup-old-${Date.now()}`,
            type: 'backup',
            severity: 'low',
            component: 'Backup System',
            title: 'Old backup',
            description: `Latest backup is ${Math.floor(ageHours / 24)} days old.`,
            status: 'open',
            autoFixed: false,
            timestamp: new Date()
          });
        }
      }

      this.results.push({
        check: 'Backup Status',
        status: backupFiles.length === 0 ? 'warning' : 'pass',
        duration: Date.now() - checkStart,
        details: { backupCount: backupFiles.length }
      });

      console.log(`   ${backupFiles.length === 0 ? '⚠️' : '✅'} ${backupFiles.length} backup(s) found`);
    } catch (error) {
      console.log(`   ⚠️ Could not check backups: ${error.message}`);
    }
  }

  async saveResults() {
    try {
      // Save health check
      await prisma.healthCheck.create({
        data: {
          type: 'deep',
          status: this.issues.length === 0 ? 'healthy' : 'issues',
          issuesFound: this.issues.length,
          duration: Date.now() - this.startTime,
          details: JSON.stringify({
            results: this.results,
            aiConsultations: this.aiConsultations.length
          }),
          timestamp: new Date()
        }
      });

      // Save issues
      for (const issue of this.issues) {
        await prisma.issue.create({
          data: issue
        });
      }

      // Save AI consultations
      for (const consultation of this.aiConsultations) {
        await prisma.aiConsultation.create({
          data: {
            issueId: consultation.issueId,
            query: consultation.query,
            result: JSON.stringify(consultation.result),
            timestamp: consultation.timestamp
          }
        }).catch(() => {
          // Table might not exist yet, skip
        });
      }
    } catch (error) {
      console.error('Error saving results:', error.message);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('DEEP DIAGNOSTICS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Duration: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`);
    console.log(`Checks: ${this.results.length}`);
    console.log(`Issues: ${this.issues.length}`);
    console.log(`AI Consultations: ${this.aiConsultations.length}`);
    console.log('='.repeat(60) + '\n');
  }

  async triggerSelfHealing() {
    console.log('🔧 Triggering self-healing for detected issues...');
    try {
      const { exec } = require('child_process');
      exec('node scripts/diagnostics/self-healing.js', (error) => {
        if (error) {
          console.error('Failed to trigger self-healing:', error.message);
        }
      });
    } catch (error) {
      console.error('Error triggering self-healing:', error.message);
    }
  }

  async logError(error) {
    try {
      await prisma.healthCheck.create({
        data: {
          type: 'deep',
          status: 'error',
          issuesFound: 0,
          duration: Date.now() - this.startTime,
          details: JSON.stringify({ error: error.message }),
          timestamp: new Date()
        }
      });
    } catch (e) {
      console.error('Failed to log error:', e.message);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const diagnostics = new DeepDiagnostics();
  diagnostics.run()
    .then(result => {
      console.log('Deep diagnostics completed:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = DeepDiagnostics;
