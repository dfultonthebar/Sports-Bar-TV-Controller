
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    const scriptPath = path.join(process.cwd(), 'build-knowledge-base.sh');
    
    // Execute the knowledge base build script
    const { stdout, stderr } = await execAsync(scriptPath);
    
    console.log('Knowledge base rebuild output:', stdout);
    if (stderr) {
      console.error('Knowledge base rebuild errors:', stderr);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge base rebuilt successfully',
      output: stdout
    });
    
  } catch (error) {
    console.error('Error rebuilding knowledge base:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to rebuild knowledge base',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
