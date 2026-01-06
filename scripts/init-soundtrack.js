const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const apiKey = 'eG5uYUR1U2hhQ0hGWkNpMWQ4Y1c2MXNMTmhja2NsMGg6RXdzWXdmMzRhQUlXVHNlbmgzbG5LcmNVd3JibTJKQktMVmhmbkJZT3U5Unl3c0ZHcWpvMXpWaWRqbFIxZU9WSA=='

async function initializeSoundtrack() {
  try {
    console.log('Initializing Soundtrack Your Brand configuration...')
    
    // Check if config already exists
    const existing = await prisma.soundtrackConfig.findFirst()
    
    if (existing) {
      console.log('Configuration already exists. Updating API key...')
      await prisma.soundtrackConfig.update({
        where: { id: existing.id },
        data: {
          apiKey: apiKey,
          status: 'active',
          lastTested: new Date()
        }
      })
      console.log('✅ API key updated successfully')
    } else {
      console.log('Creating new configuration...')
      await prisma.soundtrackConfig.create({
        data: {
          apiKey: apiKey,
          status: 'active',
          lastTested: new Date()
        }
      })
      console.log('✅ Configuration created successfully')
    }
    
    console.log('\n📝 Next steps:')
    console.log('1. Visit http://localhost:3001/soundtrack to view configuration')
    console.log('2. The system will automatically fetch your players')
    console.log('3. Select which players should be visible to bartenders')
    console.log('4. Bartenders can control music from http://localhost:3001/remote (Music tab)')
    
  } catch (error) {
    console.error('❌ Error initializing Soundtrack:', error)
  } finally {
    await prisma.$disconnect()
  }
}

initializeSoundtrack()
