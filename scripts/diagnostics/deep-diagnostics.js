#!/usr/bin/env node

/**
 * Deep Diagnostics - Runs Sunday 5 AM
 * Comprehensive system analysis and optimization recommendations
 */

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const CONFIG = {
  PROJECT_ROOT: '/home/ubuntu/Sports-Bar-TV-Controller',
  LOG_DIR: '/home/ubuntu/Sports-Bar-TV-Controller/logs',
  MAX_LOG_SIZE: 100 * 1024 * 1024, // 100MB
  DAYS_TO_ANALYZE: 7
};

class DeepDiagnostics {
  constructor() {
    this.results = {
      dependencies: null,
      security: null,
      performance: null,
      logs: null,
      database: null,
      integrations: null,
      configuration: null,
      optimization: []
    };
    this.issues = [];
    this.startTime = Date.now();
  }

  async run() {
    console.log('🔬 Starting Deep Diagnostics...');
    console.log(`⏰ ${new Date().toISOString()}\n`);

    try {
      // Run all deep checks
      await this.checkDependencies();
      await this.checkSecurity();
      await this.analyzePerformance();
      await this.analyzeLogs();
      await this.checkDatabaseIntegrity();
      await this.testExternalIntegrations();
      await this.validateConfiguration();
      await this.generateOptimizationRecommendations();

      // Save results
      await this.saveResults();

      // Print comprehensive report
      this.printReport();

      return {
        success: true,
        issues: this.issues.length,
        recommendations: this.results.optimization.length,
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

  async checkDependencies() {
    console.log('📦 Checking Dependencies...');
    try {
      // Check npm dependencies
      const { stdout: npmList } = await execAsync('npm list --depth=0 --json', {
        cwd: CONFIG.PROJECT_ROOT
      });
      
      const dependencies = JSON.parse(npmList);
      const depCount = Object.keys(dependencies.dependencies || {}).length;

      // Check for outdated packages
      const { stdout: outdated } = await execAsync('npm outdated --json', {
        cwd: CONFIG.PROJECT_ROOT
      }).catch(() => ({ stdout: '{}' }));
      
      const outdatedPackages = Object.keys(JSON.parse(outdated || '{}'));

      // Check for missing dependencies
      const missingDeps = dependencies.problems || [];

      this.results.dependencies = {
        total: depCount,
        outdated: outdatedPackages.length,
        outdatedList: outdatedPackages,
        missing: missingDeps.length,
        missingList: missingDeps
      };

      if (outdatedPackages.length > 10) {
        await this.createIssue('dependency', 'medium', 'npm',
          'Many Outdated Packages',
          `${outdatedPackages.length} packages are outdated`
        );
      }

      if (missingDeps.length > 0) {
        await this.createIssue('dependency', 'high', 'npm',
          'Missing Dependencies',
          `${missingDeps.length} dependencies are missing or have issues`
        );
      }

      console.log(`  ✅ Total: ${depCount}, Outdated: ${outdatedPackages.length}, Missing: ${missingDeps.length}`);
    } catch (error) {
      console.error('  ❌ Dependency check failed:', error.message);
      this.results.dependencies = { error: error.message };
    }
  }

  async checkSecurity() {
    console.log('🔒 Running Security Audit...');
    try {
      const { stdout } = await execAsync('npm audit --json', {
        cwd: CONFIG.PROJECT_ROOT
      }).catch(e => ({ stdout: e.stdout }));

      const audit = JSON.parse(stdout);
      const vulnerabilities = audit.metadata?.vulnerabilities || {};
      
      const total = Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);
      const critical = vulnerabilities.critical || 0;
      const high = vulnerabilities.high || 0;
      const moderate = vulnerabilities.moderate || 0;
      const low = vulnerabilities.low || 0;

      this.results.security = {
        total,
        critical,
        high,
        moderate,
        low,
        details: audit.vulnerabilities || {}
      };

      if (critical > 0) {
        await this.createIssue('security', 'critical', 'npm',
          'Critical Security Vulnerabilities',
          `${critical} critical vulnerabilities found`
        );
      }

      if (high > 0) {
        await this.createIssue('security', 'high', 'npm',
          'High Security Vulnerabilities',
          `${high} high-severity vulnerabilities found`
        );
      }

      const icon = total === 0 ? '✅' : critical > 0 ? '❌' : '⚠️';
      console.log(`  ${icon} Vulnerabilities: ${total} (Critical: ${critical}, High: ${high})`);
    } catch (error) {
      console.error('  ❌ Security audit failed:', error.message);
      this.results.security = { error: error.message };
    }
  }

  async analyzePerformance() {
    console.log('⚡ Analyzing Performance...');
    try {
      // Get metrics from last 7 days
      const weekAgo = new Date(Date.now() - CONFIG.DAYS_TO_ANALYZE * 24 * 60 * 60 * 1000);
      
      const metrics = await prisma.systemMetric.findMany({
        where: {
          timestamp: { gte: weekAgo }
        },
        orderBy: { timestamp: 'desc' }
      });

      // Analyze response times
      const responseTimes = metrics
        .filter(m => m.metricType === 'response_time')
        .map(m => m.value);

      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      const maxResponseTime = responseTimes.length > 0
        ? Math.max(...responseTimes)
        : 0;

      // Analyze CPU usage
      const cpuMetrics = metrics.filter(m => m.metricType === 'cpu');
      const avgCPU = cpuMetrics.length > 0
        ? Math.round(cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length)
        : 0;

      // Analyze memory usage
      const memMetrics = metrics.filter(m => m.metricType === 'memory');
      const avgMemory = memMetrics.length > 0
        ? Math.round(memMetrics.reduce((sum, m) => sum + m.value, 0) / memMetrics.length)
        : 0;

      this.results.performance = {
        avgResponseTime,
        maxResponseTime,
        avgCPU,
        avgMemory,
        metricsAnalyzed: metrics.length,
        period: `${CONFIG.DAYS_TO_ANALYZE} days`
      };

      if (avgResponseTime > 1000) {
        await this.createIssue('performance', 'medium', 'api',
          'Slow Average Response Time',
          `Average response time is ${avgResponseTime}ms over the last ${CONFIG.DAYS_TO_ANALYZE} days`
        );
      }

      if (maxResponseTime > 5000) {
        await this.createIssue('performance', 'high', 'api',
          'Very Slow Peak Response Time',
          `Peak response time reached ${maxResponseTime}ms`
        );
      }

      console.log(`  ✅ Avg Response: ${avgResponseTime}ms, Max: ${maxResponseTime}ms`);
      console.log(`  ✅ Avg CPU: ${avgCPU}%, Avg Memory: ${avgMemory}%`);
    } catch (error) {
      console.error('  ❌ Performance analysis failed:', error.message);
      this.results.performance = { error: error.message };
    }
  }

  async analyzeLogs() {
    console.log('📋 Analyzing Logs...');
    try {
      const logFiles = [];
      
      // Check if log directory exists
      try {
        const files = await fs.readdir(CONFIG.LOG_DIR);
        for (const file of files) {
          if (file.endsWith('.log')) {
            const filePath = path.join(CONFIG.LOG_DIR, file);
            const stats = await fs.stat(filePath);
            logFiles.push({
              name: file,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      } catch (error) {
        // Log directory might not exist
      }

      // Analyze PM2 logs
      const pm2LogPath = path.join(os.homedir(), '.pm2/logs');
      try {
        const pm2Files = await fs.readdir(pm2LogPath);
        for (const file of pm2Files) {
          if (file.includes('sports-bar-tv-controller')) {
            const filePath = path.join(pm2LogPath, file);
            const stats = await fs.stat(filePath);
            logFiles.push({
              name: file,
              size: stats.size,
              modified: stats.mtime,
              type: 'pm2'
            });
          }
        }
      } catch (error) {
        // PM2 logs might not exist
      }

      const totalSize = logFiles.reduce((sum, f) => sum + f.size, 0);
      const largeFiles = logFiles.filter(f => f.size > CONFIG.MAX_LOG_SIZE);

      // Count errors in recent logs
      let errorCount = 0;
      let warningCount = 0;

      for (const logFile of logFiles.slice(0, 5)) { // Check last 5 log files
        try {
          const content = await fs.readFile(
            logFile.type === 'pm2' 
              ? path.join(pm2LogPath, logFile.name)
              : path.join(CONFIG.LOG_DIR, logFile.name),
            'utf-8'
          );
          
          errorCount += (content.match(/ERROR|Error|error/g) || []).length;
          warningCount += (content.match(/WARN|Warning|warning/g) || []).length;
        } catch (error) {
          // Skip if can't read file
        }
      }

      this.results.logs = {
        totalFiles: logFiles.length,
        totalSize: Math.round(totalSize / 1024 / 1024 * 100) / 100, // MB
        largeFiles: largeFiles.length,
        errorCount,
        warningCount
      };

      if (largeFiles.length > 0) {
        await this.createIssue('resource', 'medium', 'logs',
          'Large Log Files',
          `${largeFiles.length} log files exceed ${CONFIG.MAX_LOG_SIZE / 1024 / 1024}MB`
        );
        
        this.results.optimization.push({
          category: 'logs',
          priority: 'medium',
          recommendation: 'Rotate or compress large log files',
          details: `Files: ${largeFiles.map(f => f.name).join(', ')}`
        });
      }

      if (errorCount > 100) {
        await this.createIssue('performance', 'medium', 'logs',
          'High Error Count in Logs',
          `Found ${errorCount} errors in recent logs`
        );
      }

      console.log(`  ✅ Files: ${logFiles.length}, Size: ${this.results.logs.totalSize}MB`);
      console.log(`  ✅ Errors: ${errorCount}, Warnings: ${warningCount}`);
    } catch (error) {
      console.error('  ❌ Log analysis failed:', error.message);
      this.results.logs = { error: error.message };
    }
  }

  async checkDatabaseIntegrity() {
    console.log('🗄️  Checking Database Integrity...');
    try {
      // Run PRAGMA integrity_check
      const integrityCheck = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
      const isHealthy = integrityCheck[0]?.integrity_check === 'ok';

      // Get database statistics
      const stats = await prisma.$queryRawUnsafe(`
        SELECT 
          (SELECT COUNT(*) FROM sqlite_master WHERE type='table') as table_count,
          (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as db_size
      `);

      // Count records in major tables
      const userCount = await prisma.user.count();
      const equipmentCount = await prisma.equipment.count();
      const matrixInputCount = await prisma.matrixInput.count();
      const matrixOutputCount = await prisma.matrixOutput.count();

      this.results.database = {
        integrity: isHealthy ? 'ok' : 'corrupted',
        tableCount: stats[0]?.table_count || 0,
        sizeBytes: stats[0]?.db_size || 0,
        sizeMB: Math.round((stats[0]?.db_size || 0) / 1024 / 1024 * 100) / 100,
        recordCounts: {
          users: userCount,
          equipment: equipmentCount,
          matrixInputs: matrixInputCount,
          matrixOutputs: matrixOutputCount
        }
      };

      if (!isHealthy) {
        await this.createIssue('dependency', 'critical', 'database',
          'Database Integrity Check Failed',
          'Database may be corrupted - immediate backup and repair recommended'
        );
      }

      const icon = isHealthy ? '✅' : '❌';
      console.log(`  ${icon} Integrity: ${this.results.database.integrity}`);
      console.log(`  ✅ Size: ${this.results.database.sizeMB}MB, Tables: ${this.results.database.tableCount}`);
    } catch (error) {
      console.error('  ❌ Database check failed:', error.message);
      this.results.database = { error: error.message };
    }
  }

  async testExternalIntegrations() {
    console.log('🔌 Testing External Integrations...');
    try {
      const integrations = {
        wolfpack: { status: 'unknown', tested: false },
        atlasied: { status: 'unknown', tested: false },
        cec: { status: 'unknown', tested: false },
        soundtrack: { status: 'unknown', tested: false },
        nfhs: { status: 'unknown', tested: false }
      };

      // Test Wolf Pack Matrix
      try {
        const matrixConfig = await prisma.matrixConfiguration.findFirst({
          where: { isActive: true }
        });
        
        if (matrixConfig) {
          integrations.wolfpack.tested = true;
          integrations.wolfpack.status = matrixConfig.connectionStatus;
          integrations.wolfpack.details = {
            ip: matrixConfig.ipAddress,
            port: matrixConfig.port
          };
        }
      } catch (error) {
        integrations.wolfpack.error = error.message;
      }

      // Test Atlas Audio Processors
      try {
        const processors = await prisma.audioProcessor.findMany({
          where: { status: 'online' }
        });
        
        integrations.atlasied.tested = true;
        integrations.atlasied.status = processors.length > 0 ? 'online' : 'offline';
        integrations.atlasied.details = {
          onlineCount: processors.length,
          processors: processors.map(p => ({ name: p.name, ip: p.ipAddress }))
        };
      } catch (error) {
        integrations.atlasied.error = error.message;
      }

      // Test CEC Configuration
      try {
        const cecConfig = await prisma.cECConfiguration.findFirst();
        integrations.cec.tested = true;
        integrations.cec.status = cecConfig?.isEnabled ? 'enabled' : 'disabled';
        integrations.cec.details = cecConfig;
      } catch (error) {
        integrations.cec.error = error.message;
      }

      // Test Soundtrack
      try {
        const soundtrackConfig = await prisma.soundtrackConfig.findFirst();
        integrations.soundtrack.tested = true;
        integrations.soundtrack.status = soundtrackConfig?.status || 'not_configured';
        integrations.soundtrack.details = {
          accountName: soundtrackConfig?.accountName
        };
      } catch (error) {
        integrations.soundtrack.error = error.message;
      }

      // Test NFHS
      try {
        const schoolCount = await prisma.nFHSSchool.count();
        const gameCount = await prisma.nFHSGame.count();
        integrations.nfhs.tested = true;
        integrations.nfhs.status = schoolCount > 0 ? 'configured' : 'not_configured';
        integrations.nfhs.details = {
          schools: schoolCount,
          games: gameCount
        };
      } catch (error) {
        integrations.nfhs.error = error.message;
      }

      this.results.integrations = integrations;

      // Check for offline integrations
      const offlineIntegrations = Object.entries(integrations)
        .filter(([_, config]) => config.status === 'offline' || config.status === 'error')
        .map(([name]) => name);

      if (offlineIntegrations.length > 0) {
        await this.createIssue('connectivity', 'medium', 'integrations',
          'Offline External Integrations',
          `The following integrations are offline: ${offlineIntegrations.join(', ')}`
        );
      }

      console.log('  Integration Status:');
      for (const [name, config] of Object.entries(integrations)) {
        const icon = config.status === 'online' || config.status === 'enabled' || config.status === 'configured' ? '✅' : '⚠️';
        console.log(`    ${icon} ${name}: ${config.status}`);
      }
    } catch (error) {
      console.error('  ❌ Integration testing failed:', error.message);
      this.results.integrations = { error: error.message };
    }
  }

  async validateConfiguration() {
    console.log('⚙️  Validating Configuration...');
    try {
      const config = {
        env: {},
        files: {},
        issues: []
      };

      // Check environment variables
      const requiredEnvVars = ['DATABASE_URL', 'NODE_ENV'];
      for (const envVar of requiredEnvVars) {
        config.env[envVar] = process.env[envVar] ? 'set' : 'missing';
        if (!process.env[envVar]) {
          config.issues.push(`Missing environment variable: ${envVar}`);
        }
      }

      // Check critical files
      const criticalFiles = [
        'package.json',
        'prisma/schema.prisma',
        '.env',
        'next.config.js'
      ];

      for (const file of criticalFiles) {
        const filePath = path.join(CONFIG.PROJECT_ROOT, file);
        try {
          await fs.access(filePath);
          config.files[file] = 'exists';
        } catch {
          config.files[file] = 'missing';
          config.issues.push(`Missing critical file: ${file}`);
        }
      }

      this.results.configuration = config;

      if (config.issues.length > 0) {
        await this.createIssue('dependency', 'high', 'configuration',
          'Configuration Issues',
          config.issues.join('; ')
        );
      }

      const icon = config.issues.length === 0 ? '✅' : '⚠️';
      console.log(`  ${icon} Configuration: ${config.issues.length} issues found`);
    } catch (error) {
      console.error('  ❌ Configuration validation failed:', error.message);
      this.results.configuration = { error: error.message };
    }
  }

  async generateOptimizationRecommendations() {
    console.log('💡 Generating Optimization Recommendations...');

    // Based on all checks, generate recommendations
    const recommendations = [];

    // Dependency recommendations
    if (this.results.dependencies?.outdated > 5) {
      recommendations.push({
        category: 'dependencies',
        priority: 'medium',
        recommendation: 'Update outdated npm packages',
        command: 'npm update',
        details: `${this.results.dependencies.outdated} packages are outdated`
      });
    }

    // Security recommendations
    if (this.results.security?.critical > 0) {
      recommendations.push({
        category: 'security',
        priority: 'critical',
        recommendation: 'Fix critical security vulnerabilities immediately',
        command: 'npm audit fix --force',
        details: `${this.results.security.critical} critical vulnerabilities found`
      });
    }

    // Performance recommendations
    if (this.results.performance?.avgResponseTime > 500) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        recommendation: 'Optimize API response times',
        details: `Average response time is ${this.results.performance.avgResponseTime}ms`
      });
    }

    // Database recommendations
    if (this.results.database?.sizeMB > 500) {
      recommendations.push({
        category: 'database',
        priority: 'low',
        recommendation: 'Consider database cleanup or archiving old data',
        details: `Database size is ${this.results.database.sizeMB}MB`
      });
    }

    // Log recommendations
    if (this.results.logs?.totalSize > 100) {
      recommendations.push({
        category: 'logs',
        priority: 'medium',
        recommendation: 'Implement log rotation and cleanup',
        command: 'node scripts/cleanup-logs.sh',
        details: `Total log size is ${this.results.logs.totalSize}MB`
      });
    }

    this.results.optimization = recommendations;

    console.log(`  ✅ Generated ${recommendations.length} recommendations`);
  }

  async createIssue(type, severity, component, title, description) {
    const existingIssue = await prisma.issue.findFirst({
      where: {
        component,
        type,
        status: 'open',
        title
      }
    });

    if (existingIssue) {
      await prisma.issue.update({
        where: { id: existingIssue.id },
        data: {
          updatedAt: new Date(),
          description: `${description}\n\nLast seen: ${new Date().toISOString()}`
        }
      });
      
      this.issues.push(existingIssue);
    } else {
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

    await prisma.diagnosticRun.create({
      data: {
        runType: 'deep',
        triggeredBy: 'schedule',
        status: this.issues.length > 0 ? 'partial' : 'completed',
        duration,
        issuesFound: this.issues.length,
        summary: `Deep diagnostics completed: ${this.issues.length} issues found, ${this.results.optimization.length} recommendations`,
        report: JSON.stringify(this.results, null, 2),
        recommendations: JSON.stringify(this.results.optimization, null, 2)
      }
    });
  }

  printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 DEEP DIAGNOSTICS REPORT');
    console.log('='.repeat(80));
    
    console.log('\n📦 DEPENDENCIES:');
    if (this.results.dependencies?.error) {
      console.log(`  ❌ Error: ${this.results.dependencies.error}`);
    } else {
      console.log(`  Total: ${this.results.dependencies?.total || 0}`);
      console.log(`  Outdated: ${this.results.dependencies?.outdated || 0}`);
      console.log(`  Missing: ${this.results.dependencies?.missing || 0}`);
    }

    console.log('\n🔒 SECURITY:');
    if (this.results.security?.error) {
      console.log(`  ❌ Error: ${this.results.security.error}`);
    } else {
      console.log(`  Total Vulnerabilities: ${this.results.security?.total || 0}`);
      console.log(`  Critical: ${this.results.security?.critical || 0}`);
      console.log(`  High: ${this.results.security?.high || 0}`);
    }

    console.log('\n⚡ PERFORMANCE:');
    if (this.results.performance?.error) {
      console.log(`  ❌ Error: ${this.results.performance.error}`);
    } else {
      console.log(`  Avg Response Time: ${this.results.performance?.avgResponseTime || 0}ms`);
      console.log(`  Max Response Time: ${this.results.performance?.maxResponseTime || 0}ms`);
      console.log(`  Avg CPU: ${this.results.performance?.avgCPU || 0}%`);
      console.log(`  Avg Memory: ${this.results.performance?.avgMemory || 0}%`);
    }

    console.log('\n🗄️  DATABASE:');
    if (this.results.database?.error) {
      console.log(`  ❌ Error: ${this.results.database.error}`);
    } else {
      console.log(`  Integrity: ${this.results.database?.integrity || 'unknown'}`);
      console.log(`  Size: ${this.results.database?.sizeMB || 0}MB`);
      console.log(`  Tables: ${this.results.database?.tableCount || 0}`);
    }

    console.log('\n💡 OPTIMIZATION RECOMMENDATIONS:');
    if (this.results.optimization.length === 0) {
      console.log('  ✅ No recommendations - system is well optimized!');
    } else {
      this.results.optimization.forEach((rec, i) => {
        console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
        if (rec.command) {
          console.log(`     Command: ${rec.command}`);
        }
        if (rec.details) {
          console.log(`     Details: ${rec.details}`);
        }
      });
    }

    console.log('\n🐛 ISSUES FOUND: ' + this.issues.length);
    console.log('⏱️  DURATION: ' + (Date.now() - this.startTime) + 'ms');
    console.log('='.repeat(80) + '\n');
  }

  async logError(error) {
    try {
      await prisma.diagnosticRun.create({
        data: {
          runType: 'deep',
          triggeredBy: 'schedule',
          status: 'failed',
          duration: Date.now() - this.startTime,
          summary: `Deep diagnostics failed: ${error.message}`,
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
  const diagnostics = new DeepDiagnostics();
  diagnostics.run()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = DeepDiagnostics;
