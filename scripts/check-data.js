const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking database contents...\n')
  
  // Check Matrix Configuration
  const matrixConfigs = await prisma.matrixConfiguration.findMany()
  console.log('📡 Matrix Configurations:', matrixConfigs.length)
  matrixConfigs.forEach(c => {
    console.log(`   - ${c.name} (${c.ipAddress}:${c.tcpPort})`)
  })
  
  // Check Audio Processors
  const audioProcessors = await prisma.audioProcessor.findMany()
  console.log('\n🔊 Audio Processors:', audioProcessors.length)
  audioProcessors.forEach(p => {
    console.log(`   - ${p.name} (${p.ipAddress}:${p.port})`)
  })
  
  // Check Audio Zones
  const audioZones = await prisma.audioZone.findMany()
  console.log('\n🎵 Audio Zones:', audioZones.length)
  
  console.log('\n✅ Check complete')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
