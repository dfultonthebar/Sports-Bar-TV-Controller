
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

async function importWolfpackDocument() {
  const prisma = new PrismaClient()

  try {
    const sourceFilePath = '/home/ubuntu/Uploads/wolfpack udp and tcp control.txt'
    
    // Check if file exists
    if (!fs.existsSync(sourceFilePath)) {
      console.log('❌ Wolf Pack document not found at:', sourceFilePath)
      return
    }

    // Read the file content
    const content = fs.readFileSync(sourceFilePath, 'utf8')
    const stats = fs.statSync(sourceFilePath)
    
    console.log('📄 Importing Wolf Pack document...')
    console.log('Content length:', content.length, 'characters')

    // Create uploads directory in the project
    const uploadsDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Copy file to project uploads directory
    const targetFileName = `wolfpack-udp-tcp-control-${Date.now()}.txt`
    const targetFilePath = path.join(uploadsDir, targetFileName)
    fs.copyFileSync(sourceFilePath, targetFilePath)

    // Save to database
    const document = await prisma.document.create({
      data: {
        filename: targetFileName,
        originalName: 'wolfpack udp and tcp control.txt',
        filePath: targetFilePath,
        fileSize: stats.size,
        mimeType: 'text/plain',
        content: content,
      },
    })

    console.log('✅ Wolf Pack document successfully imported!')
    console.log('   Database ID:', document.id)
    console.log('   Filename:', document.filename)
    console.log('   Content length:', document.content?.length || 0, 'characters')
    console.log('   File location:', document.filePath)

    // Test search
    console.log('\n🔍 Testing document search...')
    const searchResults = await prisma.document.findMany({
      where: {
        OR: [
          { content: { contains: 'wolfpack' } },
          { originalName: { contains: 'wolfpack' } },
          { content: { contains: 'TCP' } },
          { content: { contains: 'UDP' } },
        ],
      },
    })

    console.log('Search results:', searchResults.length, 'documents found')
    searchResults.forEach(doc => {
      console.log('   -', doc.originalName)
    })

  } catch (error) {
    console.error('❌ Error importing document:', error)
  } finally {
    await prisma.$disconnect()
  }
}

importWolfpackDocument()
