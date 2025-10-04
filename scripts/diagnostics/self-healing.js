
#!/usr/bin/env node

/**
 * Self-Healing System
 * Automatically fixes common issues detected by monitoring
 * NOW WITH MULTI-AI CONSULTATION FOR CRITICAL DECISIONS
 */

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const CONFIG = {
  PROJECT_ROOT: '/home/ubuntu/Sports-Bar-TV-Controller',
  PM2_PROCESS_NAME: 'sports-bar-tv-controller',
  LOG_DIR: '/home/ubuntu/Sports-Bar-TV-Controller/logs',
  TEMP_DIR: '/tmp',
  MAX_RESTART_ATTEMPTS: 3,
  DISK_CLEANUP_THRESHOLD: 90,
  MEMORY_RESTART_THRESHOLD: 95,
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  USE_MULTI_AI: process.env.USE_MULTI_AI !== 'false',
  REQUIRE_AI_CONSENSUS: process.env.REQUIRE_AI_CONSENSUS === 'true', // Require majority vote
  MIN_AI_CONFIDENCE: parseFloat(process.env.MIN_AI_CONFIDENCE || '0.6') // Minimum confidence threshold
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

    // Check if AI consultation is needed for this issue
    const needsAIConsultation = this.shouldConsultAI(issue);

    if (needsAIConsultation && CONFIG.USE_MULTI_AI) {
      const aiDecision = await this.consultAIForAction(issue);
      
      if (aiDecision) {
        if (aiDecision.shouldProceed) {
          console.log(`   🤖 AI recommends: ${aiDecision.action} (confidence: ${Math.round(aiDecision.confidence * 100)}%)`);
          
          // Check if confidence meets threshold
          if (aiDecision.confidence < CONFIG.MIN_AI_CONFIDENCE) {
            console.log(`   ⚠️  Confidence below threshold (${CONFIG.MIN_AI_CONFIDENCE}), skipping automatic fix`);
            await this.markIssueForManualReview(issue, aiDecision);
            return;
          }

          // Proceed with AI-recommended action
          await this.executeAction(issue, aiDecision.action, aiDecision);
        } else {
          console.log(`   👀 AI recommends manual review`);
          await this.markIssueForManualReview(issue, aiDecision);
        }
        return;
      }
    }

    // Fallback to rule-based handling
    await this.executeRuleBasedFix(issue);
  }

  shouldConsultAI(issue) {
    // Consult AI for high/critical severity issues
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityLevels[issue.severity] >= 3;
  }

  async consultAIForAction(issue) {
    console.log(`   🤖 Consulting AI models...`);

    try {
      const query = `
CRITICAL DECISION REQUIRED:

Issue: ${issue.title}
Severity: ${issue.severity}
Component: ${issue.component}
Description: ${issue.description}
Type: ${issue.type}

Should we automatically apply a fix for this issue, or does it require manual intervention?

If automatic fix is recommended, what specific action should be taken?
Options: restart_pm2, clear_disk, reinstall_deps, repair_db, optimize_db, clear_cache, or manual_review

Consider:
1. Risk of automatic action
2. Potential impact on running system
3. Likelihood of success
4. Whether manual review is safer

Provide a clear recommendation with reasoning.
`;

      const response = await axios.post(
        `${CONFIG.API_BASE_URL}/api/chat/diagnostics`,
        { message: query },
        { timeout: 30000 }
      );

      if (!response.data.multiAI) {
        console.log(`   ℹ️  Multi-AI not available, using rule-based approach`);
        return null;
      }

      const result = response.data.result;
      
      console.log(`   ✅ Multi-AI consultation completed:`);
      console.log(`      - Providers: ${result.summary.successfulResponses}/${result.summary.totalProviders}`);
      console.log(`      - Agreement: ${result.consensus.agreementLevel}`);
      console.log(`      - Confidence: ${Math.round(result.consensus.confidence * 100)}%`);

      // Analyze voting results
      if (result.voting) {
        const winner = result.voting.winner;
        const winnerVotes = result.voting.winnerVotes;
        const totalVotes = result.voting.totalVotes;
        const winnerPercentage = (winnerVotes / totalVotes) * 100;

        console.log(`      - Voting: ${winner} (${winnerVotes}/${totalVotes} = ${Math.round(winnerPercentage)}%)`);

        // Check if we require consensus
        if (CONFIG.REQUIRE_AI_CONSENSUS && winnerVotes <= totalVotes / 2) {
          console.log(`      ⚠️  No majority consensus, manual review required`);
          return {
            shouldProceed: false,
            action: 'manual_review',
            confidence: result.consensus.confidence,
            reason: 'No majority consensus among AI models',
            fullResult: result
          };
        }

        // Determine action from winner
        const action = this.parseActionFromVoting(winner);
        
        return {
          shouldProceed: action !== 'manual_review' && action !== 'monitor',
          action,
          confidence: result.consensus.confidence,
          reason: result.consensus.consensus,
          fullResult: result
        };
      }

      // Fallback: parse from consensus
      const action = this.parseActionFromText(result.consensus.consensus);
      
      return {
        shouldProceed: action !== 'manual_review' && action !== 'monitor',
        action,
        confidence: result.consensus.confidence,
        reason: result.consensus.consensus,
        fullResult: result
      };

    } catch (error) {
      console.error(`   ❌ AI consultation failed: ${error.message}`);
      return null;
    }
  }

  parseActionFromVoting(votingWinner) {
    const lower = votingWinner.toLowerCase();
    if (lower.includes('restart')) return 'restart_pm2';
    if (lower.includes('clear') && lower.includes('disk')) return 'clear_disk';
    if (lower.includes('reinstall') || lower.includes('dependencies')) return 'reinstall_deps';
    if (lower.includes('repair') && lower.includes('database')) return 'repair_db';
    if (lower.includes('optimize')) return 'optimize_db';
    if (lower.includes('cache')) return 'clear_cache';
    if (lower.includes('monitor') || lower.includes('wait')) return 'monitor';
    return 'manual_review';
  }

  parseActionFromText(text) {
    const lower = text.toLowerCase();
    if (lower.includes('restart') && lower.includes('pm2')) return 'restart_pm2';
    if (lower.includes('clear disk') || lower.includes('cleanup')) return 'clear_disk';
    if (lower.includes('reinstall') && lower.includes('dep')) return 'reinstall_deps';
    if (lower.includes('repair') && lower.includes('database')) return 'repair_db';
    if (lower.includes('optimize') && lower.includes('database')) return 'optimize_db';
    if (lower.includes('clear cache')) return 'clear_cache';
    if (lower.includes('manual') || lower.includes('review')) return 'manual_review';
    return 'monitor';
  }

  async executeAction(issue, action, aiDecision) {
    console.log(`   🔧 Executing action: ${action}`);

    let success = false;
    let description = '';

    try {
      switch (action) {
        case 'restart_pm2':
          success = await this.restartPM2();
          description = 'Restarted PM2 processes';
          break;
        case 'clear_disk':
          success = await this.clearDisk();
          description = 'Cleared disk space';
          break;
        case 'reinstall_deps':
          success = await this.reinstallDependencies();
          description = 'Reinstalled dependencies';
          break;
        case 'repair_db':
          success = await this.repairDatabase();
          description = 'Repaired database';
          break;
        case 'optimize_db':
          success = await this.optimizeDatabase();
          description = 'Optimized database';
          break;
        case 'clear_cache':
          success = await this.clearCache();
          description = 'Cleared caches';
          break;
        default:
          console.log(`   ⚠️  Unknown action: ${action}`);
          return;
      }

      if (success) {
        console.log(`   ✅ ${description}`);
        await this.markIssueFixed(issue, action, aiDecision);
      } else {
        console.log(`   ❌ Failed to ${description.toLowerCase()}`);
      }

      this.fixes.push({
        issueId: issue.id,
        action,
        success,
        description,
        aiRecommended: true,
        aiConfidence: aiDecision.confidence,
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`   ❌ Error executing ${action}: ${error.message}`);
      this.fixes.push({
        issueId: issue.id,
        action,
        success: false,
        description: `Failed: ${error.message}`,
        aiRecommended: true,
        aiConfidence: aiDecision.confidence,
        timestamp: new Date()
      });
    }
  }

  async executeRuleBasedFix(issue) {
    // Original rule-based logic
    let action = null;
    let success = false;
    let description = '';

    try {
      // Determine action based on issue type
      if (issue.type === 'crash' || issue.component === 'PM2') {
        action = 'restart_pm2';
        success = await this.restartPM2();
        description = 'Restarted PM2 processes';
      } else if (issue.type === 'resource' && issue.title.includes('disk')) {
        action = 'clear_disk';
        success = await this.clearDisk();
        description = 'Cleared disk space';
      } else if (issue.type === 'dependency') {
        action = 'reinstall_deps';
        success = await this.reinstallDependencies();
        description = 'Reinstalled dependencies';
      } else if (issue.type === 'database') {
        action = 'repair_db';
        success = await this.repairDatabase();
        description = 'Repaired database';
      } else {
        console.log(`   ⚠️  No automatic fix available for ${issue.type}`);
        return;
      }

      if (success) {
        console.log(`   ✅ ${description}`);
        await this.markIssueFixed(issue, action, null);
      } else {
        console.log(`   ❌ Failed to ${description.toLowerCase()}`);
      }

      this.fixes.push({
        issueId: issue.id,
        action,
        success,
        description,
        aiRecommended: false,
        timestamp: new Date()
      });

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  async markIssueFixed(issue, action, aiDecision) {
    await prisma.issue.update({
      where: { id: issue.id },
      data: {
        status: 'resolved',
        autoFixed: true,
        fixAction: action,
        fixedAt: new Date()
      }
    });
  }

  async markIssueForManualReview(issue, aiDecision) {
    await prisma.issue.update({
      where: { id: issue.id },
      data: {
        status: 'needs_review',
        aiRecommendation: aiDecision ? JSON.stringify(aiDecision) : null
      }
    }).catch(() => {
      // Column might not exist, skip
    });
  }

  async restartPM2() {
    try {
      await execAsync(`pm2 restart ${CONFIG.PM2_PROCESS_NAME}`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return true;
    } catch (error) {
      console.error('PM2 restart failed:', error.message);
      return false;
    }
  }

  async clearDisk() {
    try {
      // Clear temp files
      await execAsync(`find ${CONFIG.TEMP_DIR} -type f -atime +7 -delete`);
      
      // Clear old logs
      await execAsync(`find ${CONFIG.LOG_DIR} -name "*.log" -mtime +30 -delete`);
      
      // Clear npm cache
      await execAsync('npm cache clean --force');
      
      return true;
    } catch (error) {
      console.error('Disk cleanup failed:', error.message);
      return false;
    }
  }

  async reinstallDependencies() {
    try {
      await execAsync('npm ci', { cwd: CONFIG.PROJECT_ROOT });
      return true;
    } catch (error) {
      console.error('Dependency reinstall failed:', error.message);
      return false;
    }
  }

  async repairDatabase() {
    try {
      await prisma.$executeRaw`PRAGMA integrity_check`;
      return true;
    } catch (error) {
      console.error('Database repair failed:', error.message);
      return false;
    }
  }

  async optimizeDatabase() {
    try {
      await prisma.$executeRaw`VACUUM`;
      await prisma.$executeRaw`ANALYZE`;
      return true;
    } catch (error) {
      console.error('Database optimization failed:', error.message);
      return false;
    }
  }

  async clearCache() {
    try {
      const nextCacheDir = path.join(CONFIG.PROJECT_ROOT, '.next/cache');
      await execAsync(`rm -rf ${nextCacheDir}`);
      return true;
    } catch (error) {
      console.error('Cache clear failed:', error.message);
      return false;
    }
  }

  async proactiveMaintenance() {
    console.log('\n🔄 Running proactive maintenance...');
    
    // Optimize database weekly
    const lastOptimize = await this.getLastMaintenanceTime('optimize_db');
    if (!lastOptimize || Date.now() - lastOptimize > 7 * 24 * 60 * 60 * 1000) {
      console.log('   Running database optimization...');
      const success = await this.optimizeDatabase();
      if (success) {
        this.fixes.push({
          action: 'optimize_db',
          success: true,
          description: 'Proactive database optimization',
          aiRecommended: false,
          timestamp: new Date()
        });
      }
    }
  }

  async getLastMaintenanceTime(action) {
    try {
      const lastFix = await prisma.selfHealingLog.findFirst({
        where: { action },
        orderBy: { timestamp: 'desc' }
      });
      return lastFix ? lastFix.timestamp.getTime() : null;
    } catch (error) {
      return null;
    }
  }

  async saveResults() {
    try {
      for (const fix of this.fixes) {
        await prisma.selfHealingLog.create({
          data: fix
        });
      }
    } catch (error) {
      console.error('Error saving results:', error.message);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const healing = new SelfHealing();
  healing.run()
    .then(result => {
      console.log('Self-healing completed:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = SelfHealing;
