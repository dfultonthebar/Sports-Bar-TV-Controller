
const { PrismaClient } = require('@prisma/client')

async function checkDocuments() {
  const prisma = new PrismaClient()

  try {
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        originalName: true,
        filename: true,
        mimeType: true,
        uploadedAt: true,
        content: true
      }
    })

    console.log('\n📁 Documents in database:')
    console.log('==========================')
    
    if (documents.length === 0) {
      console.log('❌ No documents found in database')
    } else {
      documents.forEach((doc, index) => {
        console.log(`\n${index + 1}. ${doc.originalName}`)
        console.log(`   ID: ${doc.id}`)
        console.log(`   Filename: ${doc.filename}`)
        console.log(`   Type: ${doc.mimeType}`)
        console.log(`   Uploaded: ${doc.uploadedAt}`)
        console.log(`   Content length: ${doc.content ? doc.content.length + ' characters' : 'No content'}`)
        if (doc.content && doc.originalName.toLowerCase().includes('wolf')) {
          console.log(`   Content preview: ${doc.content.substring(0, 200)}...`)
        }
      })
    }

    // Check for Wolf Pack specifically
    const wolfpackDocs = documents.filter(doc => 
      doc.originalName.toLowerCase().includes('wolf') || 
      doc.content?.toLowerCase().includes('wolf')
    )

    if (wolfpackDocs.length > 0) {
      console.log('\n🐺 Wolf Pack documents found:')
      wolfpackDocs.forEach(doc => {
        console.log(`   - ${doc.originalName}`)
      })
    } else {
      console.log('\n❌ No Wolf Pack documents found')
    }

  } catch (error) {
    console.error('Error checking documents:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDocuments()
