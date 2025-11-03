
// Seed DirecTV Commands Database
// NOTE: This script is deprecated. The system has migrated from Prisma to Drizzle ORM.
// Commands are now managed through the IR devices system.

// Legacy imports (no longer functional):
// import { prisma } from '../src/lib/db';
// import { CommandMapper } from '../src/lib/directv/command-mapper';

async function seedCommands() {
  console.log('⚠️  This script is deprecated and no longer functional.');
  console.log('The system has migrated from Prisma to Drizzle ORM.');
  console.log('DirecTV commands are now managed through the IR devices system in the web UI.');
  console.log('');
  console.log('To add DirecTV commands:');
  console.log('1. Navigate to the IR Devices admin page');
  console.log('2. Create or edit a DirecTV device');
  console.log('3. Use the command templates or add commands manually');

  process.exit(0);
}

seedCommands();
