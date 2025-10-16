const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Seeding Atlas Audio Processor Configuration...')
  
  // Check if Atlas processor already exists
  const existing = await prisma.audioProcessor.findFirst({
    where: { model: { contains: 'Atlas' } }
  })
  
  if (existing) {
    console.log('✅ Atlas processor already exists:', existing.name)
    return
  }
  
  // Create Atlas IPS-AD4 Audio Processor
  const atlasProcessor = await prisma.audioProcessor.create({
    data: {
      name: 'Atlas IPS-AD4',
      model: 'IPS-AD4',
      ipAddress: '192.168.1.51',
      port: 80,
      username: 'admin',
      zones: 4,
      description: 'Atlas IPS-AD4 Audio Distribution System',
      status: 'offline'
    }
  })
  
  console.log('✅ Atlas processor created:', atlasProcessor.name)
  console.log('   IP Address:', atlasProcessor.ipAddress)
  console.log('   Model:', atlasProcessor.model)
  console.log('   Zones:', atlasProcessor.zones)
  
  // Create 4 audio zones
  for (let i = 1; i <= 4; i++) {
    await prisma.audioZone.create({
      data: {
        processorId: atlasProcessor.id,
        zoneNumber: i,
        name: `Zone ${i}`,
        volume: 50,
        muted: false,
        source: 1,
        isActive: true,
        status: 'active'
      }
    })
  }
  
  console.log('✅ Created 4 audio zones')
  console.log('\n✅ Atlas processor seeding complete!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
