
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.documentUpload)
  if (!bodyValidation.success) return bodyValidation.error


  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Ensure the Uploads directory exists
    const uploadsDir = path.join(process.cwd(), '..', 'Uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const uploadedFiles: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        // Validate file type
        const validExtensions = ['.pdf', '.md', '.txt'];
        const fileExtension = path.extname(file.name).toLowerCase();
        
        if (!validExtensions.includes(fileExtension)) {
          errors.push(`${file.name}: Invalid file type`);
          continue;
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename if file already exists
        let fileName = file.name;
        let filePath = path.join(uploadsDir, fileName);
        let counter = 1;

        while (existsSync(filePath)) {
          const nameWithoutExt = path.parse(file.name).name;
          const ext = path.parse(file.name).ext;
          fileName = `${nameWithoutExt}_${counter}${ext}`;
          filePath = path.join(uploadsDir, fileName);
          counter++;
        }

        // Save the file
        await writeFile(filePath, buffer);
        uploadedFiles.push(fileName);
      } catch (error) {
        logger.error(`Error uploading ${file.name}:`, error);
        errors.push(`${file.name}: Upload failed`);
      }
    }

    return NextResponse.json({
      success: true,
      uploaded: uploadedFiles.length,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`
    });
  } catch (error) {
    logger.error('Error in upload-documents API:', error);
    return NextResponse.json(
      { error: 'Failed to upload documents' },
      { status: 500 }
    );
  }
}
