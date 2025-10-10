/**
 * Atlas Configuration Restoration Script
 * 
 * This script restores the Atlas audio processor configuration from backup
 * and uploads it to the Atlas device at 192.168.5.101
 */

const fs = require('fs');
const path = require('path');

// Atlas configuration from backup
const ATLAS_BACKUP_PATH = '/home/ubuntu/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai0000260a7xuiepjl.json';
const ATLAS_IP = '192.168.5.101';
const ATLAS_PORT = 80;
const ATLAS_USERNAME = 'admin';
const ATLAS_PASSWORD = 'admin';

// Create Basic Auth header
function createAuthHeader(username, password) {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

// Test Atlas connectivity
async function testAtlasConnection() {
  console.log(`\n=== Testing Atlas Connection at ${ATLAS_IP}:${ATLAS_PORT} ===`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`http://${ATLAS_IP}:${ATLAS_PORT}`, {
      method: 'GET',
      headers: {
        'Authorization': createAuthHeader(ATLAS_USERNAME, ATLAS_PASSWORD),
        'User-Agent': 'Sports-Bar-TV-Controller/1.0'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`✅ Atlas is online - Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`❌ Atlas connection failed:`, error.message);
    return false;
  }
}

// Load configuration from backup
function loadBackupConfig() {
  console.log(`\n=== Loading Atlas Configuration from Backup ===`);
  console.log(`Backup file: ${ATLAS_BACKUP_PATH}`);
  
  try {
    const configData = fs.readFileSync(ATLAS_BACKUP_PATH, 'utf-8');
    const config = JSON.parse(configData);
    
    console.log(`✅ Configuration loaded successfully`);
    console.log(`   - Inputs: ${config.inputs?.length || 0}`);
    console.log(`   - Outputs: ${config.outputs?.length || 0}`);
    console.log(`   - Scenes: ${config.scenes?.length || 0}`);
    console.log(`   - Last Updated: ${config.lastUpdated}`);
    
    return config;
  } catch (error) {
    console.error(`❌ Failed to load backup:`, error.message);
    return null;
  }
}

// Upload input configuration to Atlas
async function uploadInputConfig(input) {
  console.log(`   Configuring Input ${input.id}: ${input.name}`);
  
  // Atlas API endpoint for input configuration
  // Note: This is a simulation - actual Atlas API endpoints may vary
  const endpoint = `http://${ATLAS_IP}:${ATLAS_PORT}/api/input/${input.id}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(ATLAS_USERNAME, ATLAS_PASSWORD),
        'Content-Type': 'application/json',
        'User-Agent': 'Sports-Bar-TV-Controller/1.0'
      },
      body: JSON.stringify({
        name: input.name,
        type: input.type,
        gain: input.gainDb,
        phantom: input.phantom,
        lowcut: input.lowcut,
        compressor: input.compressor,
        gate: input.gate,
        eq: input.eq,
        routing: input.routing
      })
    });
    
    if (response.ok) {
      console.log(`      ✅ Input ${input.id} configured`);
      return true;
    } else {
      console.log(`      ⚠️  Input ${input.id} - Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`      ⚠️  Input ${input.id} - ${error.message}`);
    return false;
  }
}

// Upload output configuration to Atlas
async function uploadOutputConfig(output) {
  console.log(`   Configuring Output ${output.id}: ${output.name}`);
  
  const endpoint = `http://${ATLAS_IP}:${ATLAS_PORT}/api/output/${output.id}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(ATLAS_USERNAME, ATLAS_PASSWORD),
        'Content-Type': 'application/json',
        'User-Agent': 'Sports-Bar-TV-Controller/1.0'
      },
      body: JSON.stringify({
        name: output.name,
        type: output.type,
        level: output.levelDb,
        muted: output.muted,
        delay: output.delay,
        eq: output.eq,
        compressor: output.compressor,
        limiter: output.limiter
      })
    });
    
    if (response.ok) {
      console.log(`      ✅ Output ${output.id} configured`);
      return true;
    } else {
      console.log(`      ⚠️  Output ${output.id} - Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`      ⚠️  Output ${output.id} - ${error.message}`);
    return false;
  }
}

// Main restoration function
async function restoreAtlasConfiguration() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Atlas Configuration Restoration Script                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Step 1: Test connection
  const isConnected = await testAtlasConnection();
  if (!isConnected) {
    console.error('\n❌ Cannot proceed - Atlas is not reachable');
    process.exit(1);
  }
  
  // Step 2: Load backup configuration
  const config = loadBackupConfig();
  if (!config) {
    console.error('\n❌ Cannot proceed - Failed to load backup configuration');
    process.exit(1);
  }
  
  // Step 3: Upload input configuration
  console.log(`\n=== Uploading Input Configuration ===`);
  let inputSuccess = 0;
  for (const input of config.inputs || []) {
    const success = await uploadInputConfig(input);
    if (success) inputSuccess++;
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between requests
  }
  console.log(`   Configured ${inputSuccess}/${config.inputs?.length || 0} inputs`);
  
  // Step 4: Upload output configuration
  console.log(`\n=== Uploading Output Configuration ===`);
  let outputSuccess = 0;
  for (const output of config.outputs || []) {
    const success = await uploadOutputConfig(output);
    if (success) outputSuccess++;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log(`   Configured ${outputSuccess}/${config.outputs?.length || 0} outputs`);
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Restoration Summary                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`✅ Atlas Connection: Online`);
  console.log(`✅ Inputs Configured: ${inputSuccess}/${config.inputs?.length || 0}`);
  console.log(`✅ Outputs Configured: ${outputSuccess}/${config.outputs?.length || 0}`);
  console.log(`\nNote: The Atlas processor may need to be accessed directly`);
  console.log(`      via its web interface to verify the configuration.`);
  console.log(`      URL: http://${ATLAS_IP}:${ATLAS_PORT}`);
  console.log(`      Username: ${ATLAS_USERNAME}`);
  console.log(`      Password: ${ATLAS_PASSWORD}`);
}

// Run the restoration
restoreAtlasConfiguration().catch(error => {
  console.error('\n❌ Restoration failed:', error);
  process.exit(1);
});
