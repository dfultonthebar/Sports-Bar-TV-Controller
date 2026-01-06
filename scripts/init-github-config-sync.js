
const fs = require('fs').promises
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

const PROJECT_ROOT = '/home/ubuntu/Sports-Bar-TV-Controller'
const CONFIG_DIR = path.join(PROJECT_ROOT, 'config')

async function ensureDirectories() {
  console.log('🔧 Ensuring necessary directories exist...')
  
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.mkdir(path.join(PROJECT_ROOT, 'logs'), { recursive: true })
    console.log('✅ Directories created/verified')
  } catch (error) {
    console.error('❌ Error creating directories:', error.message)
  }
}

async function initializeGitConfig() {
  console.log('🔧 Initializing Git configuration...')
  
  try {
    process.chdir(PROJECT_ROOT)
    
    // Check if git is already initialized
    try {
      await execAsync('git status')
      console.log('✅ Git repository already initialized')
    } catch (error) {
      // Initialize git if not already done
      await execAsync('git init')
      console.log('✅ Git repository initialized')
    }
    
    // Check git config
    try {
      const { stdout: email } = await execAsync('git config user.email')
      const { stdout: name } = await execAsync('git config user.name')
      console.log(`✅ Git configured for: ${name.trim()} <${email.trim()}>`)
    } catch (error) {
      console.log('⚠️  Git user not configured. Please run:')
      console.log('   git config --global user.email "your.email@example.com"')
      console.log('   git config --global user.name "Your Name"')
    }
    
    // Ensure remote is set up (if exists)
    try {
      const { stdout: remotes } = await execAsync('git remote -v')
      if (remotes.trim()) {
        console.log('✅ Git remote configured')
      } else {
        console.log('⚠️  No git remote configured. Add with:')
        console.log('   git remote add origin <your-repository-url>')
      }
    } catch (error) {
      console.log('⚠️  Could not check git remotes')
    }
    
  } catch (error) {
    console.error('❌ Error with git configuration:', error.message)
  }
}

async function createDefaultAutoSyncConfig() {
  console.log('🔧 Creating default auto-sync configuration...')
  
  const defaultConfig = {
    enabled: false,
    syncInterval: 30,
    autoCommitOnConfigChange: false,
    monitoredPaths: [
      'src/data/matrix-config.json',
      'src/data/device-mappings.json',
      'src/data/ir-devices.json',
      'src/data/audio-zones.json',
      'src/data/directv-channels.json',
      'config/',
      '.env.local'
    ],
    lastSync: new Date().toISOString()
  }
  
  const configPath = path.join(CONFIG_DIR, 'auto-sync.json')
  
  try {
    // Check if config already exists
    await fs.access(configPath)
    console.log('✅ Auto-sync configuration already exists')
  } catch (error) {
    // Create new config
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
    console.log('✅ Default auto-sync configuration created')
  }
}

async function createSampleConfigs() {
  console.log('🔧 Creating sample configuration files...')
  
  const configs = {
    'src/data/matrix-config.json': {
      "wolfpack_ip": "192.168.1.100",
      "wolfpack_port": 23,
      "inputs": {
        "1": { "name": "DirecTV Main", "type": "satellite" },
        "2": { "name": "DirecTV Sports", "type": "satellite" },
        "3": { "name": "Cable Box 1", "type": "cable" },
        "4": { "name": "Fire TV Stick", "type": "streaming" }
      },
      "outputs": {
        "1": { "name": "Main Bar TV", "zone": "main" },
        "2": { "name": "Side Bar TV", "zone": "side" },
        "3": { "name": "Patio TV", "zone": "patio" },
        "4": { "name": "Private Booth", "zone": "booth" }
      }
    },
    
    'src/data/device-mappings.json': {
      "tv_mappings": {
        "main_bar": {
          "ip": "192.168.1.101",
          "name": "Samsung Main TV",
          "cec_address": "0.0.0.0"
        },
        "side_bar": {
          "ip": "192.168.1.102", 
          "name": "LG Side TV",
          "cec_address": "0.0.0.0"
        }
      },
      "ir_devices": {
        "directv_main": {
          "ip": "192.168.1.103",
          "device_id": "directv",
          "description": "Main DirecTV Receiver"
        }
      }
    },
    
    'src/data/audio-zones.json': {
      "zones": {
        "main": {
          "name": "Main Bar Area",
          "speakers": ["main_left", "main_right"],
          "processor_ip": "192.168.1.104"
        },
        "patio": {
          "name": "Outdoor Patio",
          "speakers": ["patio_left", "patio_right"],
          "processor_ip": "192.168.1.105"
        }
      }
    }
  }
  
  for (const [filePath, content] of Object.entries(configs)) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      
      // Check if file already exists
      try {
        await fs.access(fullPath)
        console.log(`✅ Configuration file already exists: ${filePath}`)
      } catch (error) {
        // Create new config file
        await fs.writeFile(fullPath, JSON.stringify(content, null, 2))
        console.log(`✅ Sample configuration created: ${filePath}`)
      }
    } catch (error) {
      console.error(`❌ Error creating ${filePath}:`, error.message)
    }
  }
}

async function checkSystemRequirements() {
  console.log('🔧 Checking system requirements...')
  
  const requirements = [
    { command: 'git --version', name: 'Git' },
    { command: 'node --version', name: 'Node.js' },
    { command: 'npm --version', name: 'NPM' }
  ]
  
  for (const req of requirements) {
    try {
      const { stdout } = await execAsync(req.command)
      console.log(`✅ ${req.name}: ${stdout.trim()}`)
    } catch (error) {
      console.error(`❌ ${req.name} not found or not working`)
    }
  }
}

async function main() {
  console.log('🚀 Initializing GitHub Configuration Sync System...')
  console.log('=' .repeat(60))
  
  await checkSystemRequirements()
  await ensureDirectories()
  await initializeGitConfig()
  await createDefaultAutoSyncConfig()
  await createSampleConfigs()
  
  console.log('=' .repeat(60))
  console.log('✅ GitHub Configuration Sync initialization complete!')
  console.log('')
  console.log('📋 Next steps:')
  console.log('1. Configure git user if not already done:')
  console.log('   git config --global user.email "your.email@example.com"')
  console.log('   git config --global user.name "Your Name"')
  console.log('')
  console.log('2. Add GitHub remote if not already done:')
  console.log('   git remote add origin https://github.com/username/repository.git')
  console.log('')
  console.log('3. Start the development server:')
  console.log('   npm run dev')
  console.log('')
  console.log('4. Navigate to Administration > Config Auto-Push to enable auto-sync')
  console.log('')
}

if (require.main === module) {
  main().catch(console.error)
}
