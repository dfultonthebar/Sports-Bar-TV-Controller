#!/usr/bin/env node

/**
 * Automated Rate Limiting Application Script
 * Applies rate limiting middleware to all API endpoints based on categorization
 */

const fs = require('fs');
const path = require('path');

// Load the analysis
const analysis = JSON.parse(
  fs.readFileSync('/home/ubuntu/Sports-Bar-TV-Controller/rate-limiting-analysis.json', 'utf8')
);

// Import statement to add
const IMPORT_STATEMENT = `import { withRateLimit } from '@/lib/rate-limiting/middleware'\nimport { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'`;

// Rate limit check code template
function getRateLimitCheck(config) {
  return `  const rateLimit = await withRateLimit(request, RateLimitConfigs.${config})
  if (!rateLimit.allowed) {
    return rateLimit.response
  }
`;
}

function processFile(filePath, config) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ File not found: ${filePath}`);
      return { success: false, reason: 'not_found' };
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Check if already has rate limiting
    if (content.includes('withRateLimit') || content.includes('rateLimitMiddleware')) {
      return { success: false, reason: 'already_protected' };
    }

    // Check if it's a valid route file
    if (!content.includes('export async function')) {
      return { success: false, reason: 'no_handler' };
    }

    let modified = false;

    // Add imports at the top (after existing imports)
    if (!content.includes("from '@/lib/rate-limiting/middleware'")) {
      // Find the last import statement
      const importRegex = /^import\s+.*from\s+['"].*['"];?$/gm;
      const imports = content.match(importRegex);

      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertIndex = lastImportIndex + lastImport.length;

        content =
          content.slice(0, insertIndex) +
          '\n' + IMPORT_STATEMENT +
          content.slice(insertIndex);
        modified = true;
      } else {
        // No imports found, add at the beginning after any comments
        const firstLine = content.split('\n').findIndex(line =>
          line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*')
        );
        if (firstLine >= 0) {
          const lines = content.split('\n');
          lines.splice(firstLine, 0, IMPORT_STATEMENT, '');
          content = lines.join('\n');
          modified = true;
        }
      }
    }

    // Add rate limiting to each handler (GET, POST, PUT, DELETE, PATCH)
    const handlers = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    for (const method of handlers) {
      const handlerRegex = new RegExp(
        `export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*\\{`,
        'g'
      );

      const matches = [...content.matchAll(handlerRegex)];

      if (matches.length > 0) {
        // Process in reverse order to maintain indices
        for (let i = matches.length - 1; i >= 0; i--) {
          const match = matches[i];
          const insertIndex = match.index + match[0].length;

          // Check if rate limiting is already present in this handler
          const handlerStart = insertIndex;
          const nextHandlerMatch = content.slice(insertIndex).search(/export\s+async\s+function/);
          const handlerEnd = nextHandlerMatch > 0 ? insertIndex + nextHandlerMatch : content.length;
          const handlerContent = content.slice(handlerStart, handlerEnd);

          if (!handlerContent.includes('withRateLimit') && !handlerContent.includes('rateLimitMiddleware')) {
            const rateLimitCode = '\n' + getRateLimitCheck(config);
            content = content.slice(0, insertIndex) + rateLimitCode + content.slice(insertIndex);
            modified = true;
          }
        }
      }
    }

    if (modified) {
      // Write the modified content back
      fs.writeFileSync(filePath, content, 'utf8');
      return { success: true, reason: 'applied' };
    }

    return { success: false, reason: 'no_changes' };

  } catch (error) {
    console.log(`  ✗ Error processing ${filePath}: ${error.message}`);
    return { success: false, reason: 'error', error: error.message };
  }
}

function processBatch(endpoints, batchName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Processing ${batchName}: ${endpoints.length} endpoints`);
  console.log('='.repeat(70));

  const results = {
    total: endpoints.length,
    applied: 0,
    already_protected: 0,
    not_found: 0,
    no_handler: 0,
    errors: 0
  };

  endpoints.forEach((ep, index) => {
    const progress = `[${index + 1}/${endpoints.length}]`;
    const result = processFile(ep.path, ep.config);

    if (result.success) {
      console.log(`${progress} ✓ ${ep.endpoint} (${ep.config})`);
      results.applied++;
    } else {
      if (result.reason === 'already_protected') {
        console.log(`${progress} ⊙ ${ep.endpoint} (already protected)`);
        results.already_protected++;
      } else if (result.reason === 'not_found') {
        console.log(`${progress} ⚠ ${ep.endpoint} (file not found)`);
        results.not_found++;
      } else if (result.reason === 'no_handler') {
        console.log(`${progress} ⊘ ${ep.endpoint} (no handler functions)`);
        results.no_handler++;
      } else if (result.reason === 'error') {
        console.log(`${progress} ✗ ${ep.endpoint} (error: ${result.error})`);
        results.errors++;
      } else {
        console.log(`${progress} - ${ep.endpoint} (no changes needed)`);
      }
    }
  });

  console.log(`\nBatch Results:`);
  console.log(`  Total: ${results.total}`);
  console.log(`  ✓ Applied: ${results.applied}`);
  console.log(`  ⊙ Already Protected: ${results.already_protected}`);
  console.log(`  ⚠ Not Found: ${results.not_found}`);
  console.log(`  ⊘ No Handler: ${results.no_handler}`);
  console.log(`  ✗ Errors: ${results.errors}`);

  return results;
}

// Main execution
console.log('\n');
console.log('═'.repeat(70));
console.log('COMPREHENSIVE RATE LIMITING ROLLOUT');
console.log('═'.repeat(70));

const allResults = {
  totalEndpoints: 0,
  totalApplied: 0,
  totalAlreadyProtected: 0,
  totalNotFound: 0,
  totalNoHandler: 0,
  totalErrors: 0
};

// Process in priority order
const batches = [
  { name: 'Priority 1: Authentication', endpoints: analysis.implementationPlan.priority1 },
  { name: 'Priority 2: Hardware Control', endpoints: analysis.implementationPlan.priority2 },
  { name: 'Priority 3: AI & External APIs', endpoints: analysis.implementationPlan.priority3 },
  { name: 'Priority 4: Write Operations', endpoints: analysis.implementationPlan.priority4 },
  { name: 'Priority 5: Read Operations & Scheduling', endpoints: analysis.implementationPlan.priority5 },
  { name: 'Priority 6: System & Testing', endpoints: analysis.implementationPlan.priority6 }
];

batches.forEach(batch => {
  if (batch.endpoints && batch.endpoints.length > 0) {
    const results = processBatch(batch.endpoints, batch.name);
    allResults.totalEndpoints += results.total;
    allResults.totalApplied += results.applied;
    allResults.totalAlreadyProtected += results.already_protected;
    allResults.totalNotFound += results.not_found;
    allResults.totalNoHandler += results.no_handler;
    allResults.totalErrors += results.errors;
  }
});

console.log(`\n${'═'.repeat(70)}`);
console.log('OVERALL RESULTS');
console.log('═'.repeat(70));
console.log(`Total Endpoints Processed: ${allResults.totalEndpoints}`);
console.log(`✓ Successfully Applied: ${allResults.totalApplied}`);
console.log(`⊙ Already Protected: ${allResults.totalAlreadyProtected}`);
console.log(`⚠ Files Not Found: ${allResults.totalNotFound}`);
console.log(`⊘ No Handler Functions: ${allResults.totalNoHandler}`);
console.log(`✗ Errors: ${allResults.totalErrors}`);
console.log('');

const successRate = ((allResults.totalApplied / allResults.totalEndpoints) * 100).toFixed(1);
console.log(`Success Rate: ${successRate}%`);
console.log('');
