
const { PrismaClient } = require('@prisma/client')

async function testSearch() {
  const prisma = new PrismaClient()

  try {
    console.log('🔍 Testing document search...\n')

    const queries = [
      'wolfpack',
      'TCP',
      'UDP', 
      'Wolf Pack',
      'port 5000',
      'port 4000',
      'control commands',
      'matrix',
      'wolfpack TCP UDP'
    ]

    for (const query of queries) {
      console.log(`Testing query: "${query}"`)
      
      const documents = await prisma.document.findMany({
        where: {
          OR: [
            { content: { contains: query } },
            { originalName: { contains: query } },
            { content: { contains: query.toLowerCase() } },
            { originalName: { contains: query.toLowerCase() } },
          ],
        },
        take: 5
      })

      if (documents.length > 0) {
        console.log(`  ✅ Found ${documents.length} document(s):`)
        documents.forEach(doc => {
          console.log(`    - ${doc.originalName}`)
        })
      } else {
        console.log('  ❌ No documents found')
      }
      console.log('')
    }

    // Check the actual content
    console.log('📄 Checking Wolf Pack document content:')
    const wolfDoc = await prisma.document.findFirst({
      where: { originalName: { contains: 'wolfpack' } }
    })

    if (wolfDoc) {
      console.log('Content snippet:')
      console.log(wolfDoc.content?.substring(0, 300) + '...')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSearch()
