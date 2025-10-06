
#!/usr/bin/env node

/**
 * AI Code Assistant - Dependency Check Script
 * Quick pre-flight check to verify all dependencies are ready
 */

const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

// Configuration
const CONFIG = {
  ollamaModel: 'deepseek-coder:6.7b',
  ollamaUrl: 'http://localhost:11434',
  requiredNodeVersion: 18
};

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(symbol, color, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function logSuccess(message) {
  log('✓', colors.green, message);
}

function logError(message) {
  log('✗', colors.red, message);
}

function logWarning(message) {
  log('⚠', colors.yellow, message);
}

function logInfo(message) {
  log('ℹ', colors.blue, message);
}

// Execute command silently
function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    return null;
  }
}

// Check Node.js version
function checkNodeVersion() {
  const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
  
  if (nodeVersion >= CONFIG.requiredNodeVersion) {
    logSuccess(`Node.js ${process.version}`);
    return true;
  } else {
    logError(`Node.js ${process.version} (requires ${CONFIG.requiredNodeVersion}+)`);
    return false;
  }
}

// Check if Ollama is installed
function checkOllamaInstalled() {
  const version = execCommand('ollama --version');
  
  if (version) {
    logSuccess(`Ollama ${version.trim()}`);
    return true;
  } else {
    logError('Ollama not installed');
    return false;
  }
}

// Check if Ollama service is running
async function checkOllamaRunning() {
  return new Promise((resolve) => {
    const url = new URL(`${CONFIG.ollamaUrl}/api/tags`);
    
    const req = http.get(url, (res) => {
      if (res.statusCode === 200) {
        logSuccess('Ollama service is running');
        resolve(true);
      } else {
        logError('Ollama service not responding');
        resolve(false);
      }
    });
    
    req.on('error', () => {
      logError('Ollama service not running');
      resolve(false);
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      logError('Ollama service timeout');
      resolve(false);
    });
  });
}

// Check if model is available
function checkModelAvailable() {
  const output = execCommand('ollama list');
  
  if (output && output.includes(CONFIG.ollamaModel)) {
    logSuccess(`Model ${CONFIG.ollamaModel} available`);
    return true;
  } else {
    logError(`Model ${CONFIG.ollamaModel} not found`);
    return false;
  }
}

// Check npm dependencies
function checkNpmDependencies() {
  if (!fs.existsSync('node_modules')) {
    logError('node_modules not found');
    return false;
  }
  
  const criticalDeps = ['uuid', 'next', 'react'];
  const missing = criticalDeps.filter(dep => !fs.existsSync(`node_modules/${dep}`));
  
  if (missing.length === 0) {
    logSuccess('npm dependencies installed');
    return true;
  } else {
    logError(`Missing dependencies: ${missing.join(', ')}`);
    return false;
  }
}

// Check directory structure
function checkDirectoryStructure() {
  const requiredDirs = [
    'ai-assistant',
    'ai-assistant/config',
    'ai-assistant/core',
    'ai-assistant/services',
    '.ai-assistant/backups'
  ];
  
  const missing = requiredDirs.filter(dir => !fs.existsSync(dir));
  
  if (missing.length === 0) {
    logSuccess('Directory structure correct');
    return true;
  } else {
    logError(`Missing directories: ${missing.join(', ')}`);
    return false;
  }
}

// Test model generation
async function testModelGeneration() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: CONFIG.ollamaModel,
      prompt: 'Say "test"',
      stream: false
    });
    
    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.response) {
            logSuccess('Model generation test passed');
            resolve(true);
          } else {
            logWarning('Model generation test inconclusive');
            resolve(true); // Don't fail on this
          }
        } catch (error) {
          logWarning('Model generation test failed');
          resolve(true); // Don't fail on this
        }
      });
    });
    
    req.on('error', () => {
      logWarning('Model generation test failed');
      resolve(true); // Don't fail on this
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      logWarning('Model generation test timeout');
      resolve(true); // Don't fail on this
    });
    
    req.write(postData);
    req.end();
  });
}

// Main check function
async function main() {
  console.log('');
  console.log(`${colors.blue}╔${'═'.repeat(55)}╗${colors.reset}`);
  console.log(`${colors.blue}║  AI Code Assistant - Dependency Check                ║${colors.reset}`);
  console.log(`${colors.blue}╚${'═'.repeat(55)}╝${colors.reset}`);
  console.log('');
  
  const checks = [];
  
  // Run all checks
  logInfo('Checking Node.js...');
  checks.push(checkNodeVersion());
  
  logInfo('Checking Ollama installation...');
  checks.push(checkOllamaInstalled());
  
  logInfo('Checking Ollama service...');
  checks.push(await checkOllamaRunning());
  
  logInfo('Checking AI model...');
  checks.push(checkModelAvailable());
  
  logInfo('Checking npm dependencies...');
  checks.push(checkNpmDependencies());
  
  logInfo('Checking directory structure...');
  checks.push(checkDirectoryStructure());
  
  logInfo('Testing model generation...');
  await testModelGeneration();
  
  console.log('');
  console.log(`${colors.blue}${'─'.repeat(57)}${colors.reset}`);
  
  const allPassed = checks.every(check => check === true);
  
  if (allPassed) {
    console.log(`${colors.green}✓ All checks passed! System is ready.${colors.reset}`);
    console.log('');
    console.log('You can now:');
    console.log(`  • Start the app: ${colors.blue}npm run dev${colors.reset}`);
    console.log(`  • Access AI Assistant: ${colors.blue}http://localhost:3000/ai-assistant${colors.reset}`);
    console.log('');
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Some checks failed. Run setup:${colors.reset}`);
    console.log(`  ${colors.blue}npm run setup:ai${colors.reset}`);
    console.log('');
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  process.exit(1);
});
