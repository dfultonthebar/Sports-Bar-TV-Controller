
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import fs from 'fs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const document = await prisma.document.findUnique({
      where: { id: params.id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete file from filesystem
    try {
      fs.unlinkSync(document.filePath)
    } catch (error) {
      console.error('Error deleting file:', error)
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' }, 
      { status: 500 }
    )
  }
}
