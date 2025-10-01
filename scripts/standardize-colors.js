
const fs = require('fs');
const path = require('path');

console.log('🎨 Starting color scheme standardization...\n');

// Define the color mappings
const replacements = [
  // Background gradients - replace light gradients with dark sports gradient
  {
    pattern: /bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50/g,
    replacement: 'bg-sports-gradient',
    description: 'Main page background'
  },
  {
    pattern: /bg-gradient-to-br from-\w+-\d+ via-\w+-\d+ to-\w+-\d+/g,
    replacement: 'bg-sports-gradient',
    description: 'Other light gradients'
  },
  
  // Fix incorrect CSS classes (bg-slate-800 or bg-slate-900)
  {
    pattern: /bg-slate-800 or bg-slate-900\/90/g,
    replacement: 'bg-sportsBar-800/90',
    description: 'Header background'
  },
  {
    pattern: /bg-slate-800 or bg-slate-900/g,
    replacement: 'bg-sportsBar-800',
    description: 'Card backgrounds'
  },
  
  // Headers and navigation
  {
    pattern: /bg-white\/\d+ backdrop-blur/g,
    replacement: 'glass backdrop-blur',
    description: 'Header glass effect'
  },
  
  // Text colors for dark theme
  {
    pattern: /text-slate-900/g,
    replacement: 'text-slate-100',
    description: 'Primary text'
  },
  {
    pattern: /text-slate-800/g,
    replacement: 'text-slate-200',
    description: 'Secondary text'
  },
  {
    pattern: /text-slate-700/g,
    replacement: 'text-slate-300',
    description: 'Tertiary text'
  },
  {
    pattern: /text-slate-600/g,
    replacement: 'text-slate-400',
    description: 'Muted text'
  },
  {
    pattern: /text-gray-600/g,
    replacement: 'text-slate-400',
    description: 'Gray text'
  },
  
  // Card backgrounds
  {
    pattern: /bg-white(?!\/)/g,
    replacement: 'bg-sportsBar-800/90',
    description: 'White card backgrounds'
  },
  {
    pattern: /border-slate-200/g,
    replacement: 'border-sportsBar-700',
    description: 'Card borders'
  },
  {
    pattern: /border-slate-300/g,
    replacement: 'border-sportsBar-600',
    description: 'Input borders'
  },
  
  // Form elements - convert to dark variants
  {
    pattern: /className="w-full px-3 py-2 border border-sportsBar-600 rounded-lg/g,
    replacement: 'className="form-select-dark',
    description: 'Select/input styling'
  },
  
  // Button backgrounds
  {
    pattern: /bg-slate-100/g,
    replacement: 'bg-sportsBar-700',
    description: 'Button backgrounds'
  },
  
  // Hover states
  {
    pattern: /hover:bg-slate-50/g,
    replacement: 'hover:bg-sportsBar-700/80',
    description: 'Hover states'
  },
  {
    pattern: /hover:bg-slate-100/g,
    replacement: 'hover:bg-sportsBar-700',
    description: 'Hover states'
  },
  {
    pattern: /hover:text-slate-900/g,
    replacement: 'hover:text-slate-100',
    description: 'Hover text'
  },
  {
    pattern: /hover:text-slate-700/g,
    replacement: 'hover:text-slate-200',
    description: 'Hover text'
  },
];

// Find all page files
const pagesDir = path.join(__dirname, '../src/app');
const files = [];

function findTsxFiles(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findTsxFiles(fullPath);
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
}

findTsxFiles(pagesDir);

console.log(`Found ${files.length} files to process\n`);

let totalReplacements = 0;
const fileStats = [];

// Process each file
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let fileReplacements = 0;
  const originalContent = content;
  
  replacements.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      fileReplacements += matches.length;
      content = content.replace(pattern, replacement);
    }
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplacements += fileReplacements;
    fileStats.push({
      file: path.relative(process.cwd(), file),
      replacements: fileReplacements
    });
  }
});

// Print results
console.log('📊 Standardization Results:\n');
console.log(`Total replacements: ${totalReplacements}`);
console.log(`Files modified: ${fileStats.length}\n`);

if (fileStats.length > 0) {
  console.log('Modified files:');
  fileStats.forEach(({ file, replacements }) => {
    console.log(`  ✓ ${file} (${replacements} changes)`);
  });
}

console.log('\n✅ Color scheme standardization complete!');
