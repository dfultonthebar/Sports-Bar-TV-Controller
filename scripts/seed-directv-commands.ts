
// Seed DirecTV Commands Database

import { PrismaClient } from '@prisma/client';
import { CommandMapper } from '../src/lib/directv/command-mapper';

const prisma = new PrismaClient();

async function seedCommands() {
  console.log('Seeding DirecTV commands...');

  const mapper = new CommandMapper();
  const commands = mapper.getAllCommands();

  let created = 0;
  let skipped = 0;

  for (const command of commands) {
    try {
      await prisma.direcTVCommand.upsert({
        where: {
          model_commandType_commandName: {
            model: command.model,
            commandType: command.commandType,
            commandName: command.commandName,
          },
        },
        update: {
          commandCode: command.commandCode,
          endpoint: command.endpoint,
          parameters: command.parameters ? JSON.stringify(command.parameters) : null,
          description: command.description,
          category: command.category,
        },
        create: {
          model: command.model,
          commandType: command.commandType,
          commandName: command.commandName,
          commandCode: command.commandCode,
          endpoint: command.endpoint,
          parameters: command.parameters ? JSON.stringify(command.parameters) : null,
          description: command.description,
          category: command.category,
        },
      });
      created++;
    } catch (error: any) {
      console.error(`Error seeding command ${command.commandName}:`, error.message);
      skipped++;
    }
  }

  console.log(`✓ Seeded ${created} commands (${skipped} skipped)`);
}

seedCommands()
  .catch((error) => {
    console.error('Error seeding commands:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
