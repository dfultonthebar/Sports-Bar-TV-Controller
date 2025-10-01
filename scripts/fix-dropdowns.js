
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing dropdown styling to match Matrix control...\n');

// Target dropdown class - the style we want
const targetStyle = 'w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';

function fixSelectStyling(content) {
  // Match className attributes in select elements (handling multiline)
  // Match: <select ... className="..." ... >
  const classNameRegex = /(<select(?:[^>]|\n)*?)(className=["'])([^"']+)(["'](?:[^>]|\n)*?>)/g;
  
  let result = content;
  let replacements = 0;
  
  result = result.replace(classNameRegex, (match, prefix, classStart, classes, suffix) => {
    // Skip if already has the target style
    if (classes === targetStyle || classes.includes('bg-slate-800 border border-slate-600 rounded-md')) {
      return match;
    }
    
    // Extract utility classes we want to keep
    const classArray = classes.split(/\s+/);
    const keepClasses = classArray.filter(c => 
      c.startsWith('disabled:') || 
      c.startsWith('cursor-') || 
      c.startsWith('appearance-') ||
      c.startsWith('text-xs') ||
      c.startsWith('text-sm')
    );
    
    // Build new class string
    const newClasses = keepClasses.length > 0 
      ? `${targetStyle} ${keepClasses.join(' ')}`
      : targetStyle;
    
    replacements++;
    return `${prefix}${classStart}${newClasses}${suffix}`;
  });
  
  return result;
}

// Find all relevant files
const pagesDir = path.join(__dirname, '../src');
const files = [];

function findFiles(dir) {
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        findFiles(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
}

findFiles(pagesDir);

console.log(`Found ${files.length} files to process\n`);

let totalReplacements = 0;
const fileStats = [];

// Process each file
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  
  // Count select elements before
  const selectMatches = content.match(/<select[\s\S]*?>/g) || [];
  const beforeCount = selectMatches.filter(m => m.includes('className=')).length;
  
  if (beforeCount === 0) return; // Skip files with no select elements
  
  // Apply styling fix
  content = fixSelectStyling(content);
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplacements += beforeCount;
    fileStats.push({
      file: path.relative(process.cwd(), file),
      replacements: beforeCount
    });
    console.log(`  ✓ ${path.basename(file)}: Fixed ${beforeCount} select elements`);
  }
});

// Print results
console.log('\n📊 Dropdown Standardization Results:\n');
console.log(`Total select elements fixed: ${totalReplacements}`);
console.log(`Files modified: ${fileStats.length}\n`);

if (fileStats.length > 0) {
  console.log('Modified files:');
  fileStats.sort((a, b) => b.replacements - a.replacements);
  fileStats.forEach(({ file, replacements }) => {
    console.log(`  ✓ ${file} (${replacements} selects fixed)`);
  });
}

console.log('\n✅ Dropdown styling standardization complete!');
