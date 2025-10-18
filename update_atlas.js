const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Checking for existing Atlas processors...')
  
  const processors = await prisma.audioProcessor.findMany()
  console.log(`Found ${processors.length} audio processors`)
  
  if (processors.length > 0) {
    console.log('\nExisting processors:')
    processors.forEach(p => {
      console.log(`  - ${p.name} (${p.model}) at ${p.ipAddress}:${p.port}, tcpPort: ${p.tcpPort}`)
    })
    
    // Update the first processor to match the actual hardware
    const processor = processors[0]
    console.log(`\n🔄 Updating ${processor.name} to match actual hardware configuration...`)
    
    const updated = await prisma.audioProcessor.update({
      where: { id: processor.id },
      data: {
        name: 'Atlas AZMP8',
        model: 'AZMP8',
        ipAddress: '192.168.5.101',
        port: 80,  // Web interface port
        tcpPort: 23,  // JSON-RPC control port
        zones: 5,
        description: 'Atlas AZMP8 Audio Processor (Real Hardware)',
        status: 'offline'
      }
    })
    
    console.log('✅ Processor updated:', updated.name)
    console.log(`   IP: ${updated.ipAddress}`)
    console.log(`   Web Port: ${updated.port}`)
    console.log(`   TCP Port: ${updated.tcpPort}`)
    console.log(`   Zones: ${updated.zones}`)
  } else {
    console.log('\n➕ Creating new Atlas AZMP8 processor...')
    const processor = await prisma.audioProcessor.create({
      data: {
        name: 'Atlas AZMP8',
        model: 'AZMP8',
        ipAddress: '192.168.5.101',
        port: 80,  // Web interface port
        tcpPort: 23,  // JSON-RPC control port
        zones: 5,
        description: 'Atlas AZMP8 Audio Processor (Real Hardware)',
        status: 'offline'
      }
    })
    
    console.log('✅ Processor created:', processor.name)
    console.log(`   ID: ${processor.id}`)
    console.log(`   IP: ${processor.ipAddress}`)
    console.log(`   Web Port: ${processor.port}`)
    console.log(`   TCP Port: ${processor.tcpPort}`)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
