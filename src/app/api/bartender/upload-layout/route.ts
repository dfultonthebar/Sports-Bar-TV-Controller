

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { promisify } from 'util'
import sharp from 'sharp'

const execAsync = promisify(exec)

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'layouts')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

/**
 * NEW: Validate that a file is actually an image
 */
async function validateImage(filepath: string): Promise<boolean> {
  try {
    const metadata = await sharp(filepath).metadata();
    // Check if we got valid image metadata
    return !!(metadata.width && metadata.height && metadata.format);
  } catch (error) {
    console.error('Image validation failed:', error);
    return false;
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

    // Validate file size (25MB max for higher quality layouts)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
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
    let convertedImageUrl: string | null = null

    // Convert PDF to image if needed
    if (file.type === 'application/pdf') {
      try {
        console.log('Converting PDF to image...')
        
        // Create a temporary PDF file for pdftoppm
        const tempPdfPath = join(UPLOAD_DIR, `temp_${filename}`)
        await fs.writeFile(tempPdfPath, buffer)
        
        // Use pdftoppm to convert PDF to PNG (first page only)
        // Higher DPI (300) for better AI text/marker recognition
        const outputPrefix = join(UPLOAD_DIR, `${filename.replace(/\.pdf$/, '')}_page`)
        const command = `pdftoppm -png -f 1 -l 1 -r 300 "${tempPdfPath}" "${outputPrefix}"`
        
        console.log('Running command:', command)
        await execAsync(command)
        
        // Clean up temp PDF file
        await fs.unlink(tempPdfPath).catch(err => console.log('Cleanup error:', err))
        
        // Find the generated PNG file
        const generatedFiles = await fs.readdir(UPLOAD_DIR)
        const imageFile = generatedFiles.find(f => 
          f.startsWith(`${filename.replace(/\.pdf$/, '')}_page`) && f.endsWith('.png')
        )
        
        if (imageFile) {
          const imagePath = join(UPLOAD_DIR, imageFile)
          const optimizedFilename = `${filename.replace(/\.pdf$/, '')}_converted.png`
          const optimizedPath = join(UPLOAD_DIR, optimizedFilename)
          
          // Optimize the image with Sharp - preserve quality for AI analysis
          await sharp(imagePath)
            .png({ 
              quality: 95, // Higher quality for better text/number recognition
              compressionLevel: 6 // Balanced compression
            })
            .resize(2400, 1800, { // Larger size for better AI detail recognition
              fit: 'inside', 
              withoutEnlargement: true,
              kernel: sharp.kernel.lanczos3 // Better quality scaling
            })
            .toFile(optimizedPath)
          
          // NEW: Validate the converted image
          const isValidImage = await validateImage(optimizedPath);
          if (!isValidImage) {
            console.error('Converted image validation failed');
            // Clean up invalid file
            await fs.unlink(optimizedPath).catch(err => console.log('Cleanup error:', err));
            throw new Error('PDF conversion produced invalid image');
          }
          
          // Clean up the original generated file
          await fs.unlink(imagePath).catch(err => console.log('Cleanup error:', err))
          
          convertedImageUrl = `/uploads/layouts/${optimizedFilename}`
          console.log('PDF converted to image:', convertedImageUrl)
        } else {
          console.warn('No PNG file generated from PDF conversion');
        }
      } catch (error: any) {
        console.error('Error converting PDF to image:', error)
        console.error('Command output:', error.stdout || 'No stdout')
        console.error('Command stderr:', error.stderr || 'No stderr')
        // Continue with PDF - conversion failed but we can still analyze
      }
    } else {
      // NEW: For direct image uploads, validate the image
      const isValidImage = await validateImage(filepath);
      if (!isValidImage) {
        console.error('Uploaded image validation failed');
        // Clean up invalid file
        await fs.unlink(filepath).catch(err => console.log('Cleanup error:', err));
        return NextResponse.json(
          { error: 'Invalid image file. The file may be corrupted or not a valid image format.' },
          { status: 400 }
        )
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
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
