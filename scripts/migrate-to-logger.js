#!/usr/bin/env node

/**
 * Automated Console.* to Logger.* Migration Script
 *
 * This script automatically replaces console.* statements with logger.* equivalents
 * while preserving context and adding necessary imports.
 *
 * Usage:
 *   node scripts/migrate-to-logger.js --dry-run              # Preview changes
 *   node scripts/migrate-to-logger.js --path src/app/api     # Apply to specific path
 *   node scripts/migrate-to-logger.js --all                  # Apply to all files
 *   node scripts/migrate-to-logger.js --file path/to/file.ts # Apply to single file
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  rootDir: path.join(__dirname, '..'),
  srcDir: path.join(__dirname, '..', 'src'),
  backupDir: path.join(__dirname, '..', '.migration-backup'),
  loggerImport: "import { logger } from '@/lib/logger'",
  excludePatterns: [
    /node_modules/,
    /\.next/,
    /\.git/,
    /dist/,
    /build/,
    /coverage/,
    // Exclude the logger file itself
    /src\/lib\/logger\.ts$/,
    /src\/lib\/utils\/logger\.ts$/,
    /src\/lib\/ai-tools\/logger\.ts$/,
  ],
  fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
};

// Statistics
const stats = {
  totalFiles: 0,
  modifiedFiles: 0,
  totalReplacements: 0,
  byLevel: {
    info: 0,
    error: 0,
    warn: 0,
    debug: 0,
  },
  errors: [],
};

// Replacement mappings
const REPLACEMENTS = [
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error(',
    level: 'error',
    description: 'console.error -> logger.error',
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn(',
    level: 'warn',
    description: 'console.warn -> logger.warn',
  },
  {
    pattern: /console\.info\(/g,
    replacement: 'logger.info(',
    level: 'info',
    description: 'console.info -> logger.info',
  },
  {
    pattern: /console\.debug\(/g,
    replacement: 'logger.debug(',
    level: 'debug',
    description: 'console.debug -> logger.debug',
  },
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.info(',
    level: 'info',
    description: 'console.log -> logger.info',
  },
  {
    pattern: /console\.trace\(/g,
    replacement: 'logger.debug(',
    level: 'debug',
    description: 'console.trace -> logger.debug',
  },
];

/**
 * Check if file should be excluded
 */
function shouldExcludeFile(filePath) {
  return CONFIG.excludePatterns.some(pattern => pattern.test(filePath));
}

/**
 * Check if file has valid extension
 */
function hasValidExtension(filePath) {
  return CONFIG.fileExtensions.some(ext => filePath.endsWith(ext));
}

/**
 * Recursively find all files in directory
 */
function findFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldExcludeFile(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      findFiles(fullPath, files);
    } else if (entry.isFile() && hasValidExtension(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if file already has logger import
 */
function hasLoggerImport(content) {
  const importPatterns = [
    /import\s+{\s*logger\s*}\s+from\s+['"]@\/lib\/logger['"]/,
    /import\s+logger\s+from\s+['"]@\/lib\/logger['"]/,
    /import\s+.*logger.*\s+from\s+['"]@\/lib\/logger['"]/,
  ];

  return importPatterns.some(pattern => pattern.test(content));
}

/**
 * Check if file uses logger
 */
function usesLogger(content) {
  return /logger\.(info|error|warn|debug|success)\(/.test(content);
}

/**
 * Check if file has any console.* statements
 */
function hasConsoleStatements(content) {
  return /console\.(log|error|warn|info|debug|trace)\(/.test(content);
}

/**
 * Add logger import to file
 */
function addLoggerImport(content) {
  // Find the last import statement
  const importRegex = /^import\s+.*from\s+['"][^'"]+['"];?\s*$/gm;
  const imports = content.match(importRegex);

  if (imports && imports.length > 0) {
    // Find the position after the last import
    const lastImport = imports[imports.length - 1];
    const lastImportIndex = content.lastIndexOf(lastImport);
    const insertPosition = lastImportIndex + lastImport.length;

    // Insert logger import after last import
    return (
      content.slice(0, insertPosition) +
      '\n' +
      CONFIG.loggerImport +
      content.slice(insertPosition)
    );
  } else {
    // No imports found, add at the beginning
    return CONFIG.loggerImport + '\n\n' + content;
  }
}

/**
 * Process a single file
 */
function processFile(filePath, dryRun = false) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Skip if no console statements
    if (!hasConsoleStatements(content)) {
      return { modified: false, replacements: 0 };
    }

    let replacements = 0;

    // Apply all replacements
    for (const replacement of REPLACEMENTS) {
      const matches = content.match(replacement.pattern);
      if (matches) {
        content = content.replace(replacement.pattern, replacement.replacement);
        const count = matches.length;
        replacements += count;
        stats.byLevel[replacement.level] += count;
      }
    }

    // If replacements were made and logger is not imported, add import
    if (replacements > 0 && !hasLoggerImport(content) && !usesLogger(originalContent)) {
      content = addLoggerImport(content);
    }

    // Write changes if not dry run
    if (!dryRun && content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
    }

    return {
      modified: content !== originalContent,
      replacements,
      content: dryRun ? content : null,
    };
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    return { modified: false, replacements: 0, error: error.message };
  }
}

/**
 * Create backup of file
 */
function createBackup(filePath) {
  const relativePath = path.relative(CONFIG.rootDir, filePath);
  const backupPath = path.join(CONFIG.backupDir, relativePath);
  const backupDir = path.dirname(backupPath);

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Copy file to backup
  fs.copyFileSync(filePath, backupPath);
}

/**
 * Generate diff for file
 */
function generateDiff(filePath, newContent) {
  try {
    const relativePath = path.relative(CONFIG.rootDir, filePath);
    const tempFile = path.join(CONFIG.backupDir, 'temp_' + path.basename(filePath));

    // Write new content to temp file
    fs.writeFileSync(tempFile, newContent, 'utf8');

    // Generate diff using git diff
    const diff = execSync(`git diff --no-index --color=always "${filePath}" "${tempFile}" || true`, {
      encoding: 'utf8',
      cwd: CONFIG.rootDir,
    });

    // Clean up temp file
    fs.unlinkSync(tempFile);

    return diff;
  } catch (error) {
    return `Error generating diff: ${error.message}`;
  }
}

/**
 * Print statistics
 */
function printStats(dryRun = false) {
  console.log('\n' + '='.repeat(70));
  console.log('  MIGRATION STATISTICS');
  console.log('='.repeat(70) + '\n');

  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE (changes applied)'}\n`);

  console.log('Files:');
  console.log(`  Total scanned:   ${stats.totalFiles}`);
  console.log(`  Modified:        ${stats.modifiedFiles}`);
  console.log(`  Unchanged:       ${stats.totalFiles - stats.modifiedFiles}\n`);

  console.log('Replacements:');
  console.log(`  Total:           ${stats.totalReplacements}`);
  console.log(`  logger.info():   ${stats.byLevel.info}  (was console.log/console.info)`);
  console.log(`  logger.error():  ${stats.byLevel.error}  (was console.error)`);
  console.log(`  logger.warn():   ${stats.byLevel.warn}  (was console.warn)`);
  console.log(`  logger.debug():  ${stats.byLevel.debug}  (was console.debug/console.trace)\n`);

  if (stats.errors.length > 0) {
    console.log('Errors:');
    stats.errors.forEach(({ file, error }) => {
      console.log(`  ${path.relative(CONFIG.rootDir, file)}: ${error}`);
    });
    console.log();
  }

  const coverageBefore = 289;
  const totalStatements = 1449;
  const coverageAfter = coverageBefore + stats.totalReplacements;
  const percentageAfter = ((coverageAfter / (totalStatements + stats.totalReplacements)) * 100).toFixed(1);

  console.log('Coverage:');
  console.log(`  Before:          289 / 1,449 statements (20%)`);
  console.log(`  After:           ${coverageAfter} / ${totalStatements + stats.totalReplacements} statements (${percentageAfter}%)`);
  console.log();

  console.log('='.repeat(70) + '\n');
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const showDiff = args.includes('--diff');
  let targetPath = null;
  let singleFile = null;

  // Parse arguments
  if (args.includes('--all')) {
    targetPath = CONFIG.srcDir;
  } else if (args.includes('--path')) {
    const pathIndex = args.indexOf('--path');
    if (pathIndex >= 0 && args[pathIndex + 1]) {
      targetPath = path.resolve(CONFIG.rootDir, args[pathIndex + 1]);
    }
  } else if (args.includes('--file')) {
    const fileIndex = args.indexOf('--file');
    if (fileIndex >= 0 && args[fileIndex + 1]) {
      singleFile = path.resolve(CONFIG.rootDir, args[fileIndex + 1]);
    }
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Console.* to Logger.* Migration Script

Usage:
  node scripts/migrate-to-logger.js --dry-run              # Preview changes
  node scripts/migrate-to-logger.js --path src/app/api     # Apply to specific path
  node scripts/migrate-to-logger.js --all                  # Apply to all src files
  node scripts/migrate-to-logger.js --file path/to/file.ts # Apply to single file
  node scripts/migrate-to-logger.js --diff --dry-run       # Show diffs in dry-run

Options:
  --dry-run    Preview changes without modifying files
  --diff       Show detailed diffs for each file (use with --dry-run)
  --all        Process all files in src directory
  --path       Process files in specific directory
  --file       Process single file
  --help, -h   Show this help message
    `);
    process.exit(0);
  }

  if (!targetPath && !singleFile) {
    console.error('Error: You must specify --all, --path, or --file');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  CONSOLE.* TO LOGGER.* MIGRATION');
  console.log('='.repeat(70) + '\n');

  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (files will be modified)'}`);

  if (singleFile) {
    console.log(`Target: Single file - ${path.relative(CONFIG.rootDir, singleFile)}\n`);
  } else {
    console.log(`Target: ${path.relative(CONFIG.rootDir, targetPath)}\n`);
  }

  // Create backup directory if not dry run
  if (!dryRun && !fs.existsSync(CONFIG.backupDir)) {
    fs.mkdirSync(CONFIG.backupDir, { recursive: true });
    console.log(`Created backup directory: ${CONFIG.backupDir}\n`);
  }

  // Find files to process
  let files = [];
  if (singleFile) {
    if (fs.existsSync(singleFile)) {
      files = [singleFile];
    } else {
      console.error(`Error: File not found: ${singleFile}`);
      process.exit(1);
    }
  } else {
    console.log('Scanning files...\n');
    files = findFiles(targetPath);
  }

  stats.totalFiles = files.length;
  console.log(`Found ${files.length} files to process\n`);

  if (dryRun) {
    console.log('Processing files (dry run)...\n');
  } else {
    console.log('Processing files...\n');
  }

  // Process each file
  for (const file of files) {
    const relativePath = path.relative(CONFIG.rootDir, file);

    // Create backup if not dry run
    if (!dryRun) {
      createBackup(file);
    }

    // Process file
    const result = processFile(file, dryRun);

    if (result.modified) {
      stats.modifiedFiles++;
      stats.totalReplacements += result.replacements;

      console.log(`✓ ${relativePath} (${result.replacements} replacement${result.replacements !== 1 ? 's' : ''})`);

      // Show diff if requested
      if (dryRun && showDiff && result.content) {
        console.log('\n' + generateDiff(file, result.content));
      }
    } else if (result.error) {
      console.log(`✗ ${relativePath} - Error: ${result.error}`);
    }
  }

  // Print statistics
  printStats(dryRun);

  if (dryRun) {
    console.log('NOTE: This was a dry run. No files were modified.');
    console.log('Remove --dry-run flag to apply changes.\n');
  } else {
    console.log('Migration complete! Backups saved to: ' + CONFIG.backupDir);
    console.log('\nNext steps:');
    console.log('  1. Review the changes: git diff');
    console.log('  2. Run tests: npm test');
    console.log('  3. Commit changes: git add . && git commit -m "feat: migrate console.* to logger.*"');
    console.log();
  }
}

// Run main function
main();
