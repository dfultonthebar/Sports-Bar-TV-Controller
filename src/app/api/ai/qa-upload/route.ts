
import { NextRequest, NextResponse } from 'next/server';
import { processUploadedFile } from '@/lib/services/qa-uploader';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const format = formData.get('format') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Process the file
    const result = await processUploadedFile(content, file.name, format || undefined);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error uploading Q&A file:', error);
    return NextResponse.json(
      { error: 'Failed to upload Q&A file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
