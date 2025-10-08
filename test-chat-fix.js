#!/usr/bin/env node

/**
 * Quick test script to verify the chat API fix
 * Run this after starting the dev server with: npm run dev
 */

const http = require('http');

function testChatAPI() {
  console.log('Testing /api/chat endpoint...\n');
  
  const data = JSON.stringify({
    message: "Hello, test message",
    stream: false
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    },
    timeout: 10000 // 10 second timeout
  };

  const startTime = Date.now();
  
  const req = http.request(options, (res) => {
    const responseTime = Date.now() - startTime;
    console.log(`✅ Response received in ${responseTime}ms`);
    console.log(`Status Code: ${res.statusCode}`);
    
    let body = '';
    
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(body);
        console.log('\n📝 Response:', JSON.stringify(response, null, 2));
        
        if (response.error) {
          console.log('\n⚠️  API returned an error:', response.error);
        } else if (response.response) {
          console.log('\n✅ SUCCESS! Chat API is working correctly.');
          console.log(`Response length: ${response.response.length} characters`);
        }
      } catch (e) {
        console.log('\n❌ Failed to parse response:', body);
      }
    });
  });

  req.on('error', (error) => {
    const responseTime = Date.now() - startTime;
    console.log(`\n❌ Request failed after ${responseTime}ms`);
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the dev server is running: npm run dev');
    }
  });

  req.on('timeout', () => {
    console.log('\n❌ Request timed out after 10 seconds');
    console.log('This indicates the API is still hanging!');
    req.destroy();
  });

  req.write(data);
  req.end();
}

// Run the test
console.log('🧪 Chat API Fix Verification Test\n');
console.log('Make sure the dev server is running before running this test.');
console.log('Start server with: npm run dev\n');
console.log('---\n');

testChatAPI();
