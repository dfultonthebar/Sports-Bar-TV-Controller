#!/usr/bin/env node

/**
 * AI-Powered Style Fixer
 * Applies suggested style changes from analysis reports
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  srcDir: path.join(__dirname, '../src'),
  backupDir: path.join(__dirname, '../ai-style-backups')
};

// Ensure backup directory exists
if (!fs.existsSync(CONFIG.backupDir)) {
  fs.mkdirSync(CONFIG.backupDir, { recursive: true });
}

/**
 * Create readline interface for user input
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Ask user a question
 */
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

/**
 * Load analysis report
 */
function loadReport(reportPath) {
  try {
    const reportData = fs.readFileSync(reportPath, 'utf8');
    const report = JSON.parse(reportData);
    console.log('✅ Loaded analysis report');
    return report;
  } catch (error) {
    console.error('❌ Failed to load report:', error.message);
    process.exit(1);
  }
}

/**
 * Create backup of a file
 */
function backupFile(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = path.basename(filePath);
  const backupPath = path.join(CONFIG.backupDir, `${fileName}.${timestamp}.bak`);
  
  fs.copyFileSync(filePath, backupPath);
  console.log(`  💾 Backed up to: ${path.basename(backupPath)}`);
  return backupPath;
}

/**
 * Apply fixes to a single file
 */
async function applyFixes(analysis, interactive = true) {
  const { fullPath, filePath, issues } = analysis;
  
  if (!issues || issues.length === 0) {
    console.log(`  ℹ️  No issues to fix`);
    return { fixed: 0, skipped: 0 };
  }
  
  console.log(`\n📄 File: ${filePath}`);
  console.log(`   ${issues.length} issue(s) found`);
  
  if (interactive) {
    const answer = await ask('   Apply fixes to this file? (y/n/q): ');
    if (answer.toLowerCase() === 'q') {
      console.log('\n🛑 Quitting...');
      process.exit(0);
    }
    if (answer.toLowerCase() !== 'y') {
      console.log('   ⏭️  Skipped');
      return { fixed: 0, skipped: issues.length };
    }
  }
  
  // Backup the file
  backupFile(fullPath);
  
  // Read the file
  let content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  
  let fixCount = 0;
  
  for (const issue of issues) {
    const { current, suggested, reason } = issue;
    
    if (!current || !suggested) {
      continue;
    }
    
    // Try to replace the current class with suggested class
    const regex = new RegExp(current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    
    if (matches) {
      content = content.replace(regex, suggested);
      fixCount++;
      console.log(`   ✅ Fixed: ${current} → ${suggested}`);
    } else {
      console.log(`   ⚠️  Could not find: ${current}`);
    }
  }
  
  // Write the updated content
  if (fixCount > 0) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`   💚 Applied ${fixCount} fix(es)`);
  }
  
  return { fixed: fixCount, skipped: issues.length - fixCount };
}

/**
 * Display file summary
 */
function displayFileSummary(analysis) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`File: ${analysis.filePath}`);
  console.log(`Severity: ${analysis.severity?.toUpperCase() || 'UNKNOWN'}`);
  console.log(`Issues: ${analysis.issues?.length || 0}`);
  console.log(`Summary: ${analysis.summary}`);
  
  if (analysis.issues && analysis.issues.length > 0) {
    console.log(`\nIssue details:`);
    analysis.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.type}: ${issue.reason}`);
      console.log(`     Current:   ${issue.current}`);
      console.log(`     Suggested: ${issue.suggested}`);
    });
  }
  console.log('─'.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 AI-Powered Style Fixer\n');
  
  // Get report file from command line argument
  const reportPath = process.argv[2];
  
  if (!reportPath) {
    console.log('Usage: node ai-style-fixer.js <report-file>');
    console.log('\nAvailable reports:');
    const reports = fs.readdirSync(path.join(__dirname, '../ai-style-reports'))
      .filter(f => f.startsWith('style-analysis-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    reports.forEach((report, i) => {
      console.log(`  ${i + 1}. ${report}`);
    });
    
    if (reports.length > 0) {
      console.log(`\nTo use the latest report, run:`);
      console.log(`node scripts/ai-style-fixer.js ai-style-reports/${reports[0]}`);
    }
    
    process.exit(0);
  }
  
  // Load the report
  const report = loadReport(reportPath);
  
  const filesWithIssues = report.analyses || report.allFiles?.filter(a => a.hasIssues) || [];
  
  if (filesWithIssues.length === 0) {
    console.log('✅ No issues found in the report!');
    rl.close();
    return;
  }
  
  console.log(`Found ${filesWithIssues.length} file(s) with issues\n`);
  
  // Ask for mode
  console.log('Select mode:');
  console.log('  1. Interactive (review each file)');
  console.log('  2. Auto-fix all (apply all fixes automatically)');
  console.log('  3. Review only (show issues without fixing)');
  
  const mode = await ask('\nEnter choice (1-3): ');
  
  const interactive = mode === '1';
  const autoFix = mode === '2';
  const reviewOnly = mode === '3';
  
  let totalFixed = 0;
  let totalSkipped = 0;
  
  for (let i = 0; i < filesWithIssues.length; i++) {
    const analysis = filesWithIssues[i];
    
    console.log(`\n[${i + 1}/${filesWithIssues.length}]`);
    
    if (reviewOnly) {
      displayFileSummary(analysis);
      continue;
    }
    
    const { fixed, skipped } = await applyFixes(analysis, interactive);
    totalFixed += fixed;
    totalSkipped += skipped;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files processed: ${filesWithIssues.length}`);
  console.log(`Fixes applied: ${totalFixed}`);
  console.log(`Fixes skipped: ${totalSkipped}`);
  console.log(`\nBackups saved to: ${CONFIG.backupDir}`);
  console.log('='.repeat(60) + '\n');
  
  if (totalFixed > 0) {
    console.log('✅ Fixes applied successfully!');
    console.log('💡 Test your application to ensure everything works correctly.');
    console.log('💡 If issues occur, restore from backups in ai-style-backups/\n');
  }
  
  rl.close();
}

// Run the fixer
main().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
