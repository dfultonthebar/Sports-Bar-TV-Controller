#!/usr/bin/env node

/**
 * Diagnostics Scheduler
 * Manages scheduled execution of monitoring and diagnostics
 */

const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname);

console.log('🚀 Starting Diagnostics Scheduler...');
console.log(`⏰ ${new Date().toISOString()}\n`);

// Light check every 5 minutes
const lightCheckJob = cron.schedule('*/5 * * * *', () => {
  console.log(`\n[${new Date().toISOString()}] Running light health check...`);
  
  exec(`node ${SCRIPTS_DIR}/light-check.js`, (error, stdout, stderr) => {
    if (error) {
      console.error('Light check error:', error.message);
      return;
    }
    if (stderr) {
      console.error('Light check stderr:', stderr);
    }
    console.log(stdout);
  });
}, {
  scheduled: true,
  timezone: "America/New_York"
});

// Deep diagnostics every Sunday at 5:00 AM
const deepDiagnosticsJob = cron.schedule('0 5 * * 0', () => {
  console.log(`\n[${new Date().toISOString()}] Running deep diagnostics...`);
  
  exec(`node ${SCRIPTS_DIR}/deep-diagnostics.js`, (error, stdout, stderr) => {
    if (error) {
      console.error('Deep diagnostics error:', error.message);
      return;
    }
    if (stderr) {
      console.error('Deep diagnostics stderr:', stderr);
    }
    console.log(stdout);
  });
}, {
  scheduled: true,
  timezone: "America/New_York"
});

console.log('✅ Scheduler started successfully');
console.log('📅 Light checks: Every 5 minutes');
console.log('📅 Deep diagnostics: Sunday 5:00 AM EST');
console.log('\nPress Ctrl+C to stop\n');

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping scheduler...');
  lightCheckJob.stop();
  deepDiagnosticsJob.stop();
  console.log('✅ Scheduler stopped');
  process.exit(0);
});

// Run light check immediately on startup
console.log('Running initial light check...\n');
exec(`node ${SCRIPTS_DIR}/light-check.js`, (error, stdout, stderr) => {
  if (error) {
    console.error('Initial light check error:', error.message);
    return;
  }
  console.log(stdout);
});
