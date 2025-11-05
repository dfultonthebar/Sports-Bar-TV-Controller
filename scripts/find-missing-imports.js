#!/usr/bin/env node

const fs = require('fs');
const { globSync } = require('glob');

const files = globSync('src/app/api/**/*.ts', {
  cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
  absolute: true
});

const missing = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  if (content.includes('isValidationError(') && !content.includes('import.*isValidationError')) {
    missing.push(file);
  }
}

console.log(`Files using isValidationError without importing it: ${missing.length}\n`);
missing.slice(0, 20).forEach(f => console.log(f));
