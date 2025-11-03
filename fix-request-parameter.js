#!/usr/bin/env node

/**
 * Fix missing request parameter in GET/POST/PUT/DELETE/PATCH handlers
 * that use withRateLimit
 */

const fs = require('fs');
const { execSync } = require('child_process');

// Find all files with rate limiting
const files = execSync(
  'grep -r "withRateLimit" /home/ubuntu/Sports-Bar-TV-Controller/src/app/api --include="*.ts" -l',
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

console.log(`Found ${files.length} files with rate limiting\n`);

let fixedCount = 0;
let alreadyCorrectCount = 0;

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if NextRequest is imported
    if (!content.includes('NextRequest')) {
      // Add NextRequest to imports
      if (content.includes("from 'next/server'")) {
        content = content.replace(
          /import\s+{([^}]*)}\s+from\s+'next\/server'/,
          (match, imports) => {
            if (!imports.includes('NextRequest')) {
              const importsList = imports.split(',').map(s => s.trim()).filter(Boolean);
              importsList.push('NextRequest');
              return `import { ${importsList.join(', ')} } from 'next/server'`;
            }
            return match;
          }
        );
        modified = true;
      }
    }

    // Fix GET handlers
    const getRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(\s*\)\s*{/g;
    const matches = content.match(getRegex);

    if (matches) {
      for (const match of matches) {
        const method = match.match(/(GET|POST|PUT|DELETE|PATCH)/)[0];
        const replacement = `export async function ${method}(request: NextRequest) {`;

        // Only replace if the next few lines contain withRateLimit
        const methodIndex = content.indexOf(match);
        const nextLines = content.slice(methodIndex, methodIndex + 200);

        if (nextLines.includes('withRateLimit')) {
          content = content.replace(match, replacement);
          modified = true;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${filePath.replace('/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/', '')}`);
      fixedCount++;
    } else {
      alreadyCorrectCount++;
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}: ${error.message}`);
  }
});

console.log(`\n✓ Fixed ${fixedCount} files`);
console.log(`⊙ ${alreadyCorrectCount} files already correct`);
