
#!/usr/bin/env node

/**
 * Start the background scheduler service
 * 
 * This script starts the scheduler service that monitors and executes
 * TV control schedules at their specified times.
 */

const http = require('http');

console.log('🕐 Starting Sports Bar Scheduler Service...');

// Start the scheduler
const postData = JSON.stringify({ action: 'start' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/scheduler/status',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('✅ Scheduler service started successfully');
    console.log('📅 Monitoring schedules every minute');
    console.log('');
    console.log('The scheduler is now running in the background.');
    console.log('It will automatically execute schedules at their configured times.');
    console.log('');
    console.log('Manage schedules at: http://localhost:3000/scheduler');
  });
});

req.on('error', (error) => {
  console.error('❌ Failed to start scheduler:', error.message);
  console.log('');
  console.log('Make sure the Next.js server is running:');
  console.log('  cd /home/ubuntu/Sports-Bar-TV-Controller/app');
  console.log('  yarn dev');
});

req.write(postData);
req.end();
