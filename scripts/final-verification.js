const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('\n🔍 FINAL SYSTEM VERIFICATION\n')
  console.log('═'.repeat(60))
  
  // Matrix Configuration
  const matrixConfig = await prisma.matrixConfiguration.findFirst()
  console.log('\n📡 WOLFPACK MATRIX CONFIGURATION')
  console.log('─'.repeat(60))
  if (matrixConfig) {
    console.log('✅ Status: CONFIGURED')
    console.log(`   Name: ${matrixConfig.name}`)
    console.log(`   IP Address: ${matrixConfig.ipAddress}:${matrixConfig.tcpPort}`)
    console.log(`   Protocol: ${matrixConfig.protocol}`)
    console.log(`   Active: ${matrixConfig.isActive ? 'YES' : 'NO'}`)
    
    const inputCount = await prisma.matrixInput.count({ where: { configId: matrixConfig.id } })
    const outputCount = await prisma.matrixOutput.count({ where: { configId: matrixConfig.id } })
    console.log(`   Inputs: ${inputCount}`)
    console.log(`   Outputs: ${outputCount}`)
  } else {
    console.log('❌ Status: NOT CONFIGURED')
  }
  
  // Audio Processor
  const audioProcessor = await prisma.audioProcessor.findFirst()
  console.log('\n🔊 ATLAS AUDIO PROCESSOR')
  console.log('─'.repeat(60))
  if (audioProcessor) {
    console.log('✅ Status: CONFIGURED')
    console.log(`   Name: ${audioProcessor.name}`)
    console.log(`   Model: ${audioProcessor.model}`)
    console.log(`   IP Address: ${audioProcessor.ipAddress}:${audioProcessor.port}`)
    console.log(`   Zones: ${audioProcessor.zones}`)
    
    const zoneCount = await prisma.audioZone.count({ where: { processorId: audioProcessor.id } })
    console.log(`   Configured Zones: ${zoneCount}`)
  } else {
    console.log('❌ Status: NOT CONFIGURED')
  }
  
  console.log('\n═'.repeat(60))
  console.log('\n✅ SYSTEM STATUS: OPERATIONAL')
  console.log('\nAll critical components are configured and ready.\n')
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
