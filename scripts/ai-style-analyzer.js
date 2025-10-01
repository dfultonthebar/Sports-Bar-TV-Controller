#!/usr/bin/env node

/**
 * AI-Powered Color Scheme Analyzer
 * Uses local Ollama AI to analyze components and suggest styling changes
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration
const CONFIG = {
  srcDir: path.join(__dirname, '../src'),
  styleGuide: path.join(__dirname, '../COLOR_SCHEME_STANDARD.md'),
  outputDir: path.join(__dirname, '../ai-style-reports'),
  ollamaModel: 'llama3.2',
  maxFilesPerBatch: 5
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

/**
 * Check if Ollama is installed and running
 */
async function checkOllama() {
  try {
    const { stdout } = await execPromise('ollama list');
    console.log('✅ Ollama is installed and running');
    
    // Check if our preferred model is available
    if (stdout.includes(CONFIG.ollamaModel)) {
      console.log(`✅ Model ${CONFIG.ollamaModel} is available`);
      return true;
    } else {
      console.log(`⚠️  Model ${CONFIG.ollamaModel} not found. Available models:`);
      console.log(stdout);
      console.log(`\nPulling ${CONFIG.ollamaModel}...`);
      await execPromise(`ollama pull ${CONFIG.ollamaModel}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Ollama is not installed or not running');
    console.error('Please install Ollama: https://ollama.ai');
    return false;
  }
}

/**
 * Load the style guide
 */
function loadStyleGuide() {
  try {
    const styleGuide = fs.readFileSync(CONFIG.styleGuide, 'utf8');
    console.log('✅ Loaded style guide');
    return styleGuide;
  } catch (error) {
    console.error('❌ Failed to load style guide:', error.message);
    process.exit(1);
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
 * Analyze a component file using AI
 */
async function analyzeComponent(filePath, styleGuide) {
  const componentCode = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(CONFIG.srcDir, filePath);
  
  const prompt = `You are a React/TypeScript code analyzer specializing in UI styling consistency.

STYLE GUIDE:
${styleGuide}

COMPONENT TO ANALYZE:
File: ${relativePath}
\`\`\`tsx
${componentCode}
\`\`\`

TASK:
Analyze this component and identify any styling inconsistencies compared to the style guide.
Focus on:
1. Background colors (should use bg-slate-800, bg-slate-700, etc.)
2. Text colors (should use text-slate-100, text-slate-200, etc.)
3. Border colors (should use border-slate-700)
4. Badge styles (should follow the pattern bg-{color}-900/50)
5. Button styles (should have proper hover states)
6. Icon colors (should use accent colors like text-blue-400)
7. Card styles (should use bg-slate-800 with border-slate-700)

OUTPUT FORMAT:
Provide your analysis in JSON format:
{
  "hasIssues": true/false,
  "severity": "high" | "medium" | "low",
  "issues": [
    {
      "line": <line number or "unknown">,
      "type": "background" | "text" | "border" | "component",
      "current": "current class names",
      "suggested": "suggested class names",
      "reason": "explanation"
    }
  ],
  "summary": "Brief summary of findings"
}

If no issues are found, return {"hasIssues": false, "summary": "Component follows style guide"}.

Respond ONLY with valid JSON, no additional text.`;

  try {
    // Create a temporary file for the prompt
    const promptFile = path.join(CONFIG.outputDir, 'temp_prompt.txt');
    fs.writeFileSync(promptFile, prompt);
    
    console.log(`  Analyzing ${relativePath}...`);
    
    // Call Ollama with the prompt
    const command = `ollama run ${CONFIG.ollamaModel} "$(cat ${promptFile})"`;
    const { stdout, stderr } = await execPromise(command, { 
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000 
    });
    
    // Clean up temp file
    fs.unlinkSync(promptFile);
    
    // Try to parse JSON from response
    let result;
    try {
      // Find JSON in the response (sometimes AI adds explanatory text)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error(`  ⚠️  Failed to parse AI response for ${relativePath}`);
      result = {
        hasIssues: false,
        summary: 'Unable to parse AI response',
        error: stdout.substring(0, 500)
      };
    }
    
    return {
      filePath: relativePath,
      fullPath: filePath,
      ...result
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
async function main() {
  console.log('🎨 AI-Powered Color Scheme Analyzer\n');
  
  // Check prerequisites
  const ollamaReady = await checkOllama();
  if (!ollamaReady) {
    process.exit(1);
  }
  
  // Load style guide
  const styleGuide = loadStyleGuide();
  
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
    
    const analysis = await analyzeComponent(component, styleGuide);
    analyses.push(analysis);
    
    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 500));
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
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
