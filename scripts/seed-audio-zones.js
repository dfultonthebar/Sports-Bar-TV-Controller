const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Seeding Audio Zones...')
  
  // Find Atlas processor
  const atlasProcessor = await prisma.audioProcessor.findFirst()
  
  if (!atlasProcessor) {
    console.error('❌ No audio processor found!')
    return
  }
  
  console.log('✅ Found audio processor:', atlasProcessor.name)
  
  // Check existing zones
  const existingZones = await prisma.audioZone.count({
    where: { processorId: atlasProcessor.id }
  })
  
  if (existingZones > 0) {
    console.log(`✅ Audio zones already exist: ${existingZones} zones`)
    return
  }
  
  // Create 4 audio zones
  console.log('Creating audio zones...')
  for (let i = 1; i <= 4; i++) {
    const zone = await prisma.audioZone.create({
      data: {
        processorId: atlasProcessor.id,
        zoneNumber: i,
        name: `Zone ${i}`,
        volume: 50,
        muted: false,
        enabled: true
      }
    })
    console.log(`   ✓ Created ${zone.name}`)
  }
  
  console.log('✅ Created 4 audio zones')
  console.log('\n✅ Audio zones seeding complete!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
