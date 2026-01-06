
/**
 * Get the current config filename based on Matrix Configuration
 * Returns the filename or 'local.local.json' if no matrix config exists
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getConfigFilename() {
  try {
    const config = await prisma.matrixConfiguration.findFirst({
      where: { isActive: true },
      select: { name: true },
    });

    if (!config) {
      return 'local.local.json';
    }

    return `${config.name.toLowerCase().replace(/\s+/g, '-')}.local.json`;
  } catch (error) {
    return 'local.local.json';
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  getConfigFilename()
    .then((filename) => {
      console.log(filename);
      process.exit(0);
    })
    .catch(() => {
      console.log('local.local.json');
      process.exit(1);
    });
}

module.exports = { getConfigFilename };
