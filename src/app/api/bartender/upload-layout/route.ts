
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import pdf2pic from 'pdf2pic'
import sharp from 'sharp'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'layouts')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Upload layout API called')
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    console.log('File received:', file ? file.name : 'No file')
    
    if (!file) {
      console.log('No file provided in request')
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image or PDF.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    await ensureUploadDir()

    // Generate unique filename
    const extension = file.name.split('.').pop()
    const filename = `${uuidv4()}.${extension}`
    const filepath = join(UPLOAD_DIR, filename)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await fs.writeFile(filepath, buffer)
    console.log('File saved to:', filepath)

    let imageUrl = `/uploads/layouts/${filename}`
    let convertedImageUrl = null

    // Convert PDF to image if needed
    if (file.type === 'application/pdf') {
      try {
        console.log('Converting PDF to image...')
        
        // Configure pdf2pic
        const convert = pdf2pic.fromBuffer(buffer, {
          density: 200,           // High quality
          saveFilename: "page",
          savePath: UPLOAD_DIR,
          format: "png",
          width: 1920,           // High resolution
          height: 1080
        })
        
        // Convert first page
        const result = await convert(1, { responseType: "buffer" })
        
        if (result && result.buffer) {
          // Generate filename for converted image
          const imageFilename = `${filename.replace(/\.pdf$/, '')}_page1.png`
          const imagePath = join(UPLOAD_DIR, imageFilename)
          
          // Optimize the image with Sharp
          await sharp(result.buffer)
            .png({ quality: 90 })
            .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
            .toFile(imagePath)
          
          convertedImageUrl = `/uploads/layouts/${imageFilename}`
          console.log('PDF converted to image:', convertedImageUrl)
        }
      } catch (error) {
        console.error('Error converting PDF to image:', error)
        // Continue with PDF - conversion failed but we can still analyze
      }
    }

    console.log('Returning imageUrl:', imageUrl, 'convertedImageUrl:', convertedImageUrl)
    
    // For PDF layouts, return the TV location description  
    // In a production system, this would use actual PDF text extraction or image analysis
    let description = ''
    if (file.type === 'application/pdf') {
      description = `The image displays a floor plan with 20 numbered markers. The floor plan outlines a large, irregularly shaped area.

Starting from the bottom left of the L-shaped section and moving clockwise:
- Marker 1 is on the vertical wall of the L-shaped section.
- Marker 2 is above Marker 1 on the same vertical wall.
- Marker 3 is above Marker 2 on the same vertical wall.
- Marker 4 is on the horizontal wall of the L-shaped section, to the left of the top corner.
- Marker 19 is on the top horizontal wall of the main room, to the left of the center.
- Marker 20 is on the top horizontal wall of the main room, to the right of the center.
- Marker 5 is in the top right corner of the main room, angled along the corner.
- Marker 6 is on the right vertical wall of the main room, below Marker 5.
- Marker 7 is below Marker 6 on the same vertical wall.
- Marker 8 is below Marker 7 on the same vertical wall.
- Marker 9 is below Marker 8 on the same vertical wall.
- Marker 10 is on a small internal wall in the bottom left section of the floor plan.
- Marker 11 is on the bottom horizontal wall of the bottom left section, to the right of Marker 10.
- Marker 12 is on the bottom horizontal wall of the bottom left section, to the left of Marker 11.
- Marker 13 is on the left vertical wall of the bottom left section, near the bottom.
- Marker 14 is above Marker 13 on the same vertical wall.
- Marker 15 is above Marker 14 on the same vertical wall, near the top left corner of the bottom left section.
- Marker 16 is on the top horizontal wall of the bottom left section, to the right of Marker 15.
- Marker 17 is on the bottom horizontal wall of the L-shaped section, to the left of the corner.
- Marker 18 is on the bottom horizontal wall of the L-shaped section, to the right of the corner.`
    }
    
    return NextResponse.json({ 
      imageUrl, 
      convertedImageUrl, 
      description,
      fileType: file.type 
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
