#!/usr/bin/env node

/**
 * Fast Pattern-Based Color Scheme Analyzer
 * Uses regex patterns to analyze components and suggest styling changes
 * Much faster and more reliable than AI-based analysis for CSS class detection
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  srcDir: path.join(__dirname, '../src'),
  styleGuide: path.join(__dirname, '../COLOR_SCHEME_STANDARD.md'),
  outputDir: path.join(__dirname, '../ai-style-reports'),
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

/**
 * Style guide rules - patterns to check
 */
const STYLE_RULES = {
  // Correct patterns (approved colors)
  approved: {
    backgrounds: [
      'bg-slate-800', 'bg-slate-900', 'bg-slate-700', 'bg-slate-750',
      'bg-slate-800/50', 'bg-slate-900/50', 'bg-slate-700/50',
      'bg-transparent'
    ],
    text: [
      'text-slate-100', 'text-slate-200', 'text-slate-300', 'text-slate-400',
      'text-white', 'text-gray-100', 'text-gray-200', 'text-gray-300'
    ],
    borders: [
      'border-slate-700', 'border-slate-600', 'border-slate-800',
      'border-transparent'
    ],
    accents: [
      'text-blue-400', 'text-blue-500', 'text-green-400', 'text-green-500',
      'text-red-400', 'text-red-500', 'text-yellow-400', 'text-yellow-500',
      'text-purple-400', 'text-purple-500', 'text-orange-400', 'text-orange-500',
      'bg-blue-900/50', 'bg-green-900/50', 'bg-red-900/50', 'bg-yellow-900/50',
      'bg-purple-900/50', 'bg-orange-900/50'
    ]
  },
  
  // Problematic patterns (should be replaced)
  problematic: {
    lightBackgrounds: [
      /\bbg-white\b/, /\bbg-gray-50\b/, /\bbg-gray-100\b/, /\bbg-gray-200\b/
    ],
    darkText: [
      /\btext-gray-800\b/, /\btext-gray-900\b/, /\btext-black\b/
    ],
    oldSlateBackgrounds: [
      /\bbg-slate-950\b/, /\bbg-slate-100\b/, /\bbg-slate-200\b/
    ],
    lightBorders: [
      /\bborder-gray-200\b/, /\bborder-gray-300\b/, /\bborder-white\b/
    ]
  }
};

/**
 * Load the style guide
 */
function loadStyleGuide() {
  try {
    const styleGuide = fs.readFileSync(CONFIG.styleGuide, 'utf8');
    console.log('✅ Loaded style guide');
    return styleGuide;
  } catch (error) {
    console.log('⚠️  Style guide not found, using built-in rules');
    return null;
  }
}

/**
 * Find all React component files
 */
function findComponentFiles() {
  const components = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!item.startsWith('.') && item !== 'node_modules') {
          scanDirectory(fullPath);
        }
      } else if (item.endsWith('.tsx') || item.endsWith('.jsx')) {
        components.push(fullPath);
      }
    }
  }
  
  scanDirectory(CONFIG.srcDir);
  console.log(`✅ Found ${components.length} component files`);
  return components;
}

/**
 * Find specific styling issues in code
 */
function findStyleIssues(code, filePath) {
  const issues = [];
  const lines = code.split('\n');
  
  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    
    // Check for light backgrounds (should be dark)
    STYLE_RULES.problematic.lightBackgrounds.forEach(pattern => {
      if (pattern.test(line)) {
        issues.push({
          line: lineNum,
          type: 'background',
          current: line.match(pattern)[0],
          suggested: 'bg-slate-800 or bg-slate-900',
          reason: 'Light background detected - should use dark slate colors for consistency'
        });
      }
    });
    
    // Check for dark text (should be light)
    STYLE_RULES.problematic.darkText.forEach(pattern => {
      if (pattern.test(line)) {
        issues.push({
          line: lineNum,
          type: 'text',
          current: line.match(pattern)[0],
          suggested: 'text-slate-100 or text-slate-200',
          reason: 'Dark text detected - should use light slate colors for readability'
        });
      }
    });
    
    // Check for old slate backgrounds
    STYLE_RULES.problematic.oldSlateBackgrounds.forEach(pattern => {
      if (pattern.test(line)) {
        issues.push({
          line: lineNum,
          type: 'background',
          current: line.match(pattern)[0],
          suggested: 'bg-slate-800 or bg-slate-900',
          reason: 'Non-standard slate color - use approved slate-800 or slate-900'
        });
      }
    });
    
    // Check for light borders
    STYLE_RULES.problematic.lightBorders.forEach(pattern => {
      if (pattern.test(line)) {
        issues.push({
          line: lineNum,
          type: 'border',
          current: line.match(pattern)[0],
          suggested: 'border-slate-700',
          reason: 'Light border detected - should use border-slate-700 for consistency'
        });
      }
    });
  });
  
  return issues;
}

/**
 * Analyze a component file using pattern matching
 */
function analyzeComponent(filePath) {
  const componentCode = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(CONFIG.srcDir, filePath);
  
  try {
    console.log(`  Analyzing ${relativePath}...`);
    
    const issues = findStyleIssues(componentCode, filePath);
    
    // Determine severity based on number and type of issues
    let severity = 'low';
    if (issues.length > 10) {
      severity = 'high';
    } else if (issues.length > 5) {
      severity = 'medium';
    }
    
    const hasIssues = issues.length > 0;
    
    return {
      filePath: relativePath,
      fullPath: filePath,
      hasIssues,
      severity: hasIssues ? severity : undefined,
      issues,
      summary: hasIssues 
        ? `Found ${issues.length} styling inconsistencies`
        : 'Component follows style guide'
    };
  } catch (error) {
    console.error(`  ❌ Error analyzing ${relativePath}:`, error.message);
    return {
      filePath: relativePath,
      fullPath: filePath,
      hasIssues: false,
      summary: 'Analysis failed',
      error: error.message
    };
  }
}

/**
 * Generate a summary report
 */
function generateReport(analyses) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(CONFIG.outputDir, `style-analysis-${timestamp}.json`);
  
  // Calculate statistics
  const stats = {
    totalFiles: analyses.length,
    filesWithIssues: analyses.filter(a => a.hasIssues).length,
    severityCounts: {
      high: analyses.filter(a => a.severity === 'high').length,
      medium: analyses.filter(a => a.severity === 'medium').length,
      low: analyses.filter(a => a.severity === 'low').length
    },
    totalIssues: analyses.reduce((sum, a) => sum + (a.issues?.length || 0), 0)
  };
  
  const report = {
    timestamp: new Date().toISOString(),
    statistics: stats,
    analyses: analyses.filter(a => a.hasIssues),
    allFiles: analyses
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Report generated: ${reportPath}`);
  
  return { reportPath, stats };
}

/**
 * Display summary in console
 */
function displaySummary(stats, reportPath) {
  console.log('\n' + '='.repeat(60));
  console.log('COLOR SCHEME ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files analyzed: ${stats.totalFiles}`);
  console.log(`Files with issues: ${stats.filesWithIssues}`);
  console.log(`\nIssues by severity:`);
  console.log(`  🔴 High:   ${stats.severityCounts.high}`);
  console.log(`  🟡 Medium: ${stats.severityCounts.medium}`);
  console.log(`  🟢 Low:    ${stats.severityCounts.low}`);
  console.log(`\nTotal issues found: ${stats.totalIssues}`);
  console.log(`\nDetailed report: ${reportPath}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Main execution
 */
function main() {
  console.log('🎨 Fast Pattern-Based Color Scheme Analyzer\n');
  
  // Load style guide (optional)
  loadStyleGuide();
  
  // Find all components
  const components = findComponentFiles();
  
  if (components.length === 0) {
    console.log('No components found to analyze');
    process.exit(0);
  }
  
  // Analyze components
  console.log(`\n🔍 Analyzing ${components.length} components...\n`);
  const analyses = [];
  
  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    console.log(`[${i + 1}/${components.length}] ${path.relative(CONFIG.srcDir, component)}`);
    
    const analysis = analyzeComponent(component);
    analyses.push(analysis);
  }
  
  // Generate report
  const { reportPath, stats } = generateReport(analyses);
  
  // Display summary
  displaySummary(stats, reportPath);
  
  // Suggest next steps
  if (stats.filesWithIssues > 0) {
    console.log('📝 Next steps:');
    console.log('1. Review the detailed report to see specific issues');
    console.log('2. Run: node scripts/ai-style-fixer.js <report-file> to apply fixes');
    console.log('3. Or manually fix high-priority issues first\n');
  } else {
    console.log('✅ All components follow the style guide! 🎉\n');
  }
}

// Run the analyzer
try {
  main();
} catch (error) {
  console.error('Fatal error:', error);
  process.exit(1);
}
