
/**
 * Rename local configuration file based on Matrix Configuration name
 * This ensures each system has a unique config file name
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function renameConfigFile() {
  try {
    console.log('🔍 Fetching active matrix configuration...');
    
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      select: { name: true },
    });

    if (!config) {
      console.log('⚠️  No active matrix configuration found. Using default name.');
      return;
    }

    const matrixName = config.name;
    const configFileName = `${matrixName.toLowerCase().replace(/\s+/g, '-')}.local.json`;
    const configDir = path.join(__dirname, '..', 'config');
    const oldPath = path.join(configDir, 'local.local.json');
    const newPath = path.join(configDir, configFileName);

    console.log(`📝 Matrix Configuration Name: ${matrixName}`);
    console.log(`📄 New config file name: ${configFileName}`);

    // Check if old file exists
    try {
      await fs.access(oldPath);
      
      // Check if new file already exists
      try {
        await fs.access(newPath);
        console.log(`✅ Config file already named correctly: ${configFileName}`);
        return;
      } catch {
        // New file doesn't exist, proceed with rename
        await fs.rename(oldPath, newPath);
        console.log(`✅ Renamed config file to: ${configFileName}`);
        
        // Update .gitignore to include the new pattern
        await updateGitignore(configFileName);
      }
    } catch {
      // Old file doesn't exist, check if new file exists
      try {
        await fs.access(newPath);
        console.log(`✅ Config file already exists: ${configFileName}`);
      } catch {
        console.log(`⚠️  No config file found. Will be created on first use.`);
      }
    }

  } catch (error) {
    console.error('❌ Error renaming config file:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function updateGitignore(configFileName) {
  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  
  try {
    const content = await fs.readFile(gitignorePath, 'utf8');
    
    // Check if the pattern already exists
    if (content.includes('*.local.json')) {
      console.log('✅ .gitignore already configured for local config files');
      return;
    }

    // Add the pattern
    const newContent = content + '\n# Local configuration files\n*.local.json\n';
    await fs.writeFile(gitignorePath, newContent);
    console.log('✅ Updated .gitignore to include local config files');
  } catch (error) {
    console.error('⚠️  Could not update .gitignore:', error.message);
  }
}

// Run the script
if (require.main === module) {
  renameConfigFile()
    .then(() => {
      console.log('✅ Config file rename completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Config file rename failed:', error);
      process.exit(1);
    });
}

module.exports = { renameConfigFile };
