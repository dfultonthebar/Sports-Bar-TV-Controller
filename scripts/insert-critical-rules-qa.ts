#!/usr/bin/env tsx
/**
 * Insert Critical System Rules Q&A directly into database
 * High-priority training data for AI assistant
 */

// Load environment first
import dotenv from 'dotenv';
dotenv.config();

import { db } from '/home/ubuntu/Sports-Bar-TV-Controller/src/db';
import { schema } from '/home/ubuntu/Sports-Bar-TV-Controller/src/db';
import { randomUUID } from 'crypto';

const criticalQAs = [
  {
    question: "What files must NEVER be deleted or modified during troubleshooting?",
    answer: "The following files contain USER DATA and must NEVER be deleted or corrupted:\n- /home/ubuntu/Sports-Bar-TV-Controller/data/firetv-devices.json\n- /home/ubuntu/sports-bar-data/production.db\n- /home/ubuntu/sports-bar-data/backups/*\n\nAlways create backups before risky operations.",
    category: "system-safety",
    tags: ["critical", "data-protection", "user-data", "backups"]
  },
  {
    question: "What must I do before running npm run build, rm -rf .next, pm2 restart, or cache clearing?",
    answer: "Before ANY of these operations, you must:\n1. Create backups of critical data files\n2. Verify data integrity:\n   - curl -s http://localhost:3001/api/firetv-devices | grep -c \"devices\"\n   - sqlite3 /home/ubuntu/sports-bar-data/production.db \"SELECT COUNT(*) FROM matrixConfigs;\"\n3. Only proceed if verification passes\n4. After operation, verify data integrity again",
    category: "system-safety",
    tags: ["critical", "verification", "build", "deployment", "safety-protocols"]
  },
  {
    question: "How do I create backups before risky operations?",
    answer: "Before ANY risky operation, run:\n\n# Backup Fire TV devices\ncp /home/ubuntu/Sports-Bar-TV-Controller/data/firetv-devices.json \\\n   /home/ubuntu/sports-bar-data/backups/firetv-devices-$(date +%Y%m%d-%H%M%S).json\n\n# Backup database\ncp /home/ubuntu/sports-bar-data/production.db \\\n   /home/ubuntu/sports-bar-data/backups/production-$(date +%Y%m%d-%H%M%S).db",
    category: "system-safety",
    tags: ["critical", "backups", "data-protection", "recovery"]
  },
  {
    question: "How do I recover if user data is accidentally deleted?",
    answer: "If user data is lost:\n1. List available backups:\n   ls -lt /home/ubuntu/sports-bar-data/backups/firetv-devices-* | head -1\n2. Restore from latest backup:\n   cp [latest-backup] /home/ubuntu/Sports-Bar-TV-Controller/data/firetv-devices.json\n3. Verify restoration:\n   curl -s http://localhost:3001/api/firetv-devices | grep -c \"devices\"\n4. Check system health with sports-bar-system-guardian agent",
    category: "system-safety",
    tags: ["critical", "recovery", "data-loss", "backups", "troubleshooting"]
  },
  {
    question: "When should I use the sports-bar-system-guardian agent?",
    answer: "Use the sports-bar-system-guardian agent:\n- After code deployments\n- After cache clears\n- After system modifications\n- To verify system health regularly\n\nThe guardian agent will check:\n- All devices are present\n- Database integrity\n- Hardware connections\n- Documentation accuracy",
    category: "system-safety",
    tags: ["critical", "guardian-agent", "verification", "system-health"]
  },
  {
    question: "What are the absolute rules for data safety?",
    answer: "ABSOLUTE RULES:\n1. NEVER run commands that modify /home/ubuntu/Sports-Bar-TV-Controller/data/\n2. NEVER run rm -rf .next without verifying data directory safety\n3. NEVER clear caches without checking data integrity first\n4. ALWAYS create backups before risky operations\n\nThese rules exist because user data was accidentally deleted during troubleshooting on 2025-10-31.",
    category: "system-safety",
    tags: ["critical", "safety-rules", "data-protection", "never-commands"]
  }
];

async function insertCriticalQAs() {
  console.log('[Critical Rules Q&A] Starting insertion...\n');

  let inserted = 0;
  let errors = 0;

  for (const qa of criticalQAs) {
    try {
      const now = new Date().toISOString();
      const qaEntry = await db
        .insert(schema.qaEntries)
        .values({
          id: randomUUID(),
          question: qa.question,
          answer: qa.answer,
          category: qa.category,
          tags: qa.tags.join(','),
          confidence: 1.0, // Maximum confidence for critical rules
          sourceType: 'documentation',
          sourceFile: '/home/ubuntu/Sports-Bar-TV-Controller/CRITICAL_SYSTEM_RULES.md',
          createdAt: now,
          updatedAt: now
        })
        .returning();

      console.log(`✅ [${inserted + 1}/${criticalQAs.length}] Inserted: ${qa.question.substring(0, 60)}...`);
      inserted++;
    } catch (error: any) {
      console.error(`❌ Error inserting Q&A:`, error.message);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted} Q&A pairs`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`\n✅ AI assistant has been trained on critical system safety rules!`);
}

// Run insertion
insertCriticalQAs()
  .then(() => {
    console.log('\n✓ Training complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  });
