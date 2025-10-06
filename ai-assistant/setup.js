#!/usr/bin/env node

/**
 * AI Code Assistant - Automated Setup Script (Node.js version)
 * Cross-platform setup for Windows, Linux, and macOS
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  ollamaModel: 'deepseek-coder:6.7b',
  ollamaUrl: 'http://localhost:11434',
  requiredNodeVersion: 18,
  backupDir: '.ai-assistant/backups',
  logsDir: '.ai-assistant/logs'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Logging functions
function logInfo(message) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function logSection(message) {
  console.log('');
  console.log(`${colors.blue}${'═'.repeat(55)}${colors.reset}`);
  console.log(`${colors.blue}  ${message}${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(55)}${colors.reset}`);
  console.log('');
}

// Detect operating system
function detectOS() {
  logSection('Detecting Operating System');
  
  const platform = process.platform;
  let os;
  
  if (platform === 'linux') {
    os = 'linux';
    logSuccess('Detected: Linux');
  } else if (platform === 'darwin') {
    os = 'macos';
    logSuccess('Detected: macOS');
  } else if (platform === 'win32') {
    os = 'windows';
    logSuccess('Detected: Windows');
  } else {
    logError(`Unsupported operating system: ${platform}`);
    process.exit(1);
  }
  
  return os;
}

// Check Node.js version
function checkNodeVersion() {
  logSection('Checking Node.js Version');
  
  const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
  
  if (nodeVersion < CONFIG.requiredNodeVersion) {
    logError(`Node.js version ${nodeVersion} is too old`);
    logInfo(`Required: Node.js ${CONFIG.requiredNodeVersion}+`);
    logInfo(`Current: Node.js ${nodeVersion}`);
    process.exit(1);
  }
  
  logSuccess(`Node.js ${process.version} is installed`);
}

// Execute command and return output
function execCommand(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

// Check if Ollama is installed
function checkOllamaInstalled() {
  logSection('Checking Ollama Installation');
  
  try {
    const version = execCommand('ollama --version', { silent: true, ignoreError: true });
    if (version) {
      logSuccess(`Ollama is installed: ${version.trim()}`);
      return true;
    }
  } catch (error) {
    // Ollama not found
  }
  
  logWarning('Ollama is not installed');
  return false;
}

// Install Ollama
function installOllama(os) {
  logSection('Installing Ollama');
  
  if (os === 'linux') {
    logInfo('Downloading and installing Ollama...');
    execCommand('curl -fsSL https://ollama.com/install.sh | sh');
    logSuccess('Ollama installed successfully');
  } else if (os === 'macos') {
    logInfo('Please install Ollama manually from: https://ollama.com/download');
    logInfo('Or use Homebrew: brew install ollama');
    logWarning('After installation, run this script again');
    process.exit(1);
  } else if (os === 'windows') {
    logInfo('Please install Ollama manually from: https://ollama.com/download');
    logWarning('After installation, run this script again');
    process.exit(1);
  }
}

// Check if Ollama service is running
async function checkOllamaRunning() {
  logSection('Checking Ollama Service');
  
  return new Promise((resolve) => {
    const url = new URL(`${CONFIG.ollamaUrl}/api/tags`);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, (res) => {
      if (res.statusCode === 200) {
        logSuccess('Ollama service is running');
        resolve(true);
      } else {
        logWarning('Ollama service is not responding correctly');
        resolve(false);
      }
    });
    
    req.on('error', () => {
      logWarning('Ollama service is not running');
      resolve(false);
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      logWarning('Ollama service connection timeout');
      resolve(false);
    });
  });
}

// Start Ollama service
function startOllama(os) {
  logSection('Starting Ollama Service');
  
  logInfo('Starting Ollama in background...');
  
  if (os === 'windows') {
    // On Windows, Ollama typically runs as a service
    spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  } else {
    // On Linux/macOS
    const logFile = fs.openSync('/tmp/ollama.log', 'a');
    spawn('ollama', ['serve'], {
      detached: true,
      stdio: ['ignore', logFile, logFile]
    }).unref();
  }
  
  // Wait for service to start
  logInfo('Waiting for service to start...');
  return new Promise(resolve => setTimeout(resolve, 3000));
}

// Check if model is available
function checkModelAvailable() {
  logSection('Checking AI Model');
  
  logInfo(`Checking for model: ${CONFIG.ollamaModel}`);
  
  try {
    const output = execCommand('ollama list', { silent: true });
    if (output && output.includes(CONFIG.ollamaModel)) {
      logSuccess(`Model ${CONFIG.ollamaModel} is available`);
      return true;
    }
  } catch (error) {
    // Model not found
  }
  
  logWarning(`Model ${CONFIG.ollamaModel} is not available`);
  return false;
}

// Pull AI model
function pullModel() {
  logSection('Pulling AI Model');
  
  logInfo(`Pulling model: ${CONFIG.ollamaModel}`);
  logInfo('This may take several minutes (model size: ~3.8GB)...');
  
  try {
    execCommand(`ollama pull ${CONFIG.ollamaModel}`);
    logSuccess(`Model ${CONFIG.ollamaModel} pulled successfully`);
  } catch (error) {
    logError(`Failed to pull model ${CONFIG.ollamaModel}`);
    process.exit(1);
  }
}

// Check npm dependencies
function checkNpmDependencies() {
  logSection('Checking npm Dependencies');
  
  if (!fs.existsSync('node_modules')) {
    logWarning('node_modules not found');
    return false;
  }
  
  const missingDeps = [];
  
  if (!fs.existsSync('node_modules/uuid')) {
    missingDeps.push('uuid');
  }
  
  if (missingDeps.length === 0) {
    logSuccess('All npm dependencies are installed');
    return true;
  } else {
    logWarning(`Missing dependencies: ${missingDeps.join(', ')}`);
    return false;
  }
}

// Install npm dependencies
function installNpmDependencies() {
  logSection('Installing npm Dependencies');
  
  logInfo('Running npm install...');
  
  try {
    execCommand('npm install');
    logSuccess('npm dependencies installed successfully');
  } catch (error) {
    logError('Failed to install npm dependencies');
    process.exit(1);
  }
}

// Create required directories
function createDirectories() {
  logSection('Creating Required Directories');
  
  const dirs = [CONFIG.backupDir, CONFIG.logsDir];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  logSuccess('Required directories created');
}

// Run system readiness checks
async function runReadinessChecks() {
  logSection('Running System Readiness Checks');
  
  let allChecksPassed = true;
  
  // Check 1: Ollama API
  logInfo('Testing Ollama API...');
  const ollamaRunning = await checkOllamaRunning();
  if (ollamaRunning) {
    logSuccess('Ollama API is accessible');
  } else {
    logError('Ollama API is not accessible');
    allChecksPassed = false;
  }
  
  // Check 2: Model availability
  logInfo('Verifying model availability...');
  if (checkModelAvailable()) {
    logSuccess(`Model ${CONFIG.ollamaModel} is ready`);
  } else {
    logError(`Model ${CONFIG.ollamaModel} is not available`);
    allChecksPassed = false;
  }
  
  // Check 3: Directory structure
  logInfo('Verifying directory structure...');
  if (fs.existsSync('ai-assistant') && fs.existsSync(CONFIG.backupDir)) {
    logSuccess('Directory structure is correct');
  } else {
    logError('Directory structure is incomplete');
    allChecksPassed = false;
  }
  
  // Check 4: npm dependencies
  logInfo('Verifying npm dependencies...');
  if (fs.existsSync('node_modules/uuid')) {
    logSuccess('Critical npm dependencies are present');
  } else {
    logError('Some npm dependencies are missing');
    allChecksPassed = false;
  }
  
  if (allChecksPassed) {
    logSuccess('All readiness checks passed!');
    return true;
  } else {
    logError('Some readiness checks failed');
    return false;
  }
}

// Display final status
function displayFinalStatus() {
  logSection('Setup Complete!');
  
  console.log('');
  console.log(`${colors.green}✓ AI Code Assistant is ready to use!${colors.reset}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Start the application: ${colors.blue}npm run dev${colors.reset}`);
  console.log(`  2. Access the AI Assistant: ${colors.blue}http://localhost:3000/ai-assistant${colors.reset}`);
  console.log(`  3. Check system status: ${colors.blue}npm run check:ai${colors.reset}`);
  console.log('');
  console.log('Useful commands:');
  console.log(`  • Check Ollama status: ${colors.blue}ollama list${colors.reset}`);
  console.log(`  • Test AI generation: ${colors.blue}ollama run ${CONFIG.ollamaModel}${colors.reset}`);
  console.log('');
  console.log('Documentation:');
  console.log(`  • README: ${colors.blue}ai-assistant/README.md${colors.reset}`);
  console.log(`  • Deployment: ${colors.blue}ai-assistant/DEPLOYMENT.md${colors.reset}`);
  console.log(`  • Examples: ${colors.blue}ai-assistant/EXAMPLES.md${colors.reset}`);
  console.log('');
}

// Main setup flow
async function main() {
  console.log('');
  console.log(`${colors.blue}╔${'═'.repeat(55)}╗${colors.reset}`);
  console.log(`${colors.blue}║${' '.repeat(55)}║${colors.reset}`);
  console.log(`${colors.blue}║       AI Code Assistant - Automated Setup             ║${colors.reset}`);
  console.log(`${colors.blue}║${' '.repeat(55)}║${colors.reset}`);
  console.log(`${colors.blue}╚${'═'.repeat(55)}╝${colors.reset}`);
  console.log('');
  
  try {
    // Detect OS
    const os = detectOS();
    
    // Check Node.js
    checkNodeVersion();
    
    // Check and install Ollama
    if (!checkOllamaInstalled()) {
      installOllama(os);
    }
    
    // Check and start Ollama service
    if (!(await checkOllamaRunning())) {
      await startOllama(os);
      
      // Verify it started
      if (!(await checkOllamaRunning())) {
        logError('Failed to start Ollama service');
        logInfo('Please start Ollama manually and run this script again');
        process.exit(1);
      }
    }
    
    // Check and pull model
    if (!checkModelAvailable()) {
      pullModel();
    }
    
    // Check and install npm dependencies
    if (!checkNpmDependencies()) {
      installNpmDependencies();
    }
    
    // Create required directories
    createDirectories();
    
    // Run readiness checks
    if (await runReadinessChecks()) {
      displayFinalStatus();
      process.exit(0);
    } else {
      logError('Setup completed with warnings');
      logInfo('Please review the errors above and try again');
      process.exit(1);
    }
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run main function
main();
