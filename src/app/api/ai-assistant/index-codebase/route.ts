
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';


// File extensions to include
const INCLUDED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.prisma'];

// Directories to exclude
const EXCLUDED_DIRS = [
  'node_modules',
  '.next',
  '.git',
  'build',
  'dist',
  'out',
  'coverage',
  '.vercel',
  '.turbo',
  'public',
  'prisma/data'
];

// Files to exclude
const EXCLUDED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.env',
  '.env.local',
  '.DS_Store'
];

interface FileInfo {
  path: string;
  name: string;
  type: string;
  content: string;
  size: number;
  lastModified: Date;
  hash: string;
}

function calculateHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

function shouldIncludeFile(filePath: string, fileName: string): boolean {
  // Check if file is in excluded list
  if (EXCLUDED_FILES.includes(fileName)) {
    return false;
  }

  // Check if path contains excluded directories
  for (const excludedDir of EXCLUDED_DIRS) {
    if (filePath.includes(`/${excludedDir}/`) || filePath.includes(`\\${excludedDir}\\`)) {
      return false;
    }
  }

  // Check file extension
  const ext = path.extname(fileName).toLowerCase();
  return INCLUDED_EXTENSIONS.includes(ext);
}

function getFileType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const typeMap: { [key: string]: string } = {
    '.ts': 'typescript',
    '.tsx': 'typescript-react',
    '.js': 'javascript',
    '.jsx': 'javascript-react',
    '.json': 'json',
    '.md': 'markdown',
    '.prisma': 'prisma-schema'
  };
  return typeMap[ext] || 'unknown';
}

async function scanDirectory(dirPath: string, baseDir: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        // Skip excluded directories
        if (!EXCLUDED_DIRS.includes(entry.name)) {
          const subFiles = await scanDirectory(fullPath, baseDir);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        if (shouldIncludeFile(relativePath, entry.name)) {
          try {
            const stats = fs.statSync(fullPath);
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            // Skip very large files (> 1MB)
            if (stats.size > 1024 * 1024) {
              console.log(`Skipping large file: ${relativePath}`);
              continue;
            }
            
            files.push({
              path: relativePath.replace(/\\/g, '/'), // Normalize path separators
              name: entry.name,
              type: getFileType(entry.name),
              content,
              size: stats.size,
              lastModified: stats.mtime,
              hash: calculateHash(content)
            });
          } catch (error) {
            console.error(`Error reading file ${relativePath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return files;
}

export async function POST(request: NextRequest) {
  try {
    const projectRoot = process.cwd();
    
    console.log('Starting codebase indexing...');
    console.log('Project root:', projectRoot);
    
    // Scan the project directory
    const files = await scanDirectory(projectRoot, projectRoot);
    
    console.log(`Found ${files.length} files to index`);
    
    let indexed = 0;
    let updated = 0;
    let skipped = 0;
    
    // Process each file
    for (const file of files) {
      try {
        // Check if file already exists in database
        const existing = await prisma.indexedFile.findUnique({
          where: { filePath: file.path }
        });
        
        if (existing) {
          // Check if file has changed
          if (existing.hash !== file.hash) {
            await prisma.indexedFile.update({
              where: { id: existing.id },
              data: {
                content: file.content,
                fileSize: file.size,
                lastModified: file.lastModified,
                lastIndexed: new Date(),
                hash: file.hash,
                updatedAt: new Date()
              }
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new record
          await prisma.indexedFile.create({
            data: {
              id: crypto.randomUUID(),
              filePath: file.path,
              fileName: file.name,
              fileType: file.type,
              content: file.content,
              fileSize: file.size,
              lastModified: file.lastModified,
              lastIndexed: new Date(),
              hash: file.hash,
              isActive: true,
              metadata: JSON.stringify({
                extension: path.extname(file.name),
                directory: path.dirname(file.path)
              }),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          indexed++;
        }
      } catch (error) {
        console.error(`Error indexing file ${file.path}:`, error);
      }
    }
    
    // Mark files that no longer exist as inactive
    const allIndexedFiles = await prisma.indexedFile.findMany({
      where: { isActive: true }
    });
    
    const currentFilePaths = new Set(files.map(f => f.path));
    let deactivated = 0;
    
    for (const indexedFile of allIndexedFiles) {
      if (!currentFilePaths.has(indexedFile.filePath)) {
        await prisma.indexedFile.update({
          where: { id: indexedFile.id },
          data: { isActive: false, updatedAt: new Date() }
        });
        deactivated++;
      }
    }
    
    console.log('Indexing complete:', { indexed, updated, skipped, deactivated });
    
    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: files.length,
        indexed,
        updated,
        skipped,
        deactivated
      }
    });
    
  } catch (error) {
    console.error('Error indexing codebase:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to index codebase',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
  }
}

export async function GET() {
  try {
    const stats = await prisma.indexedFile.aggregate({
      where: { isActive: true },
      _count: true,
      _sum: {
        fileSize: true
      }
    });
    
    const filesByType = await prisma.indexedFile.groupBy({
      by: ['fileType'],
      where: { isActive: true },
      _count: true
    });
    
    const lastIndexed = await prisma.indexedFile.findFirst({
      where: { isActive: true },
      orderBy: { lastIndexed: 'desc' },
      select: { lastIndexed: true }
    });
    
    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: stats._count,
        totalSize: stats._sum.fileSize || 0,
        filesByType: filesByType.map(ft => ({
          type: ft.fileType,
          count: ft._count
        })),
        lastIndexed: lastIndexed?.lastIndexed
      }
    });
    
  } catch (error) {
    console.error('Error getting index stats:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get index stats'
      },
      { status: 500 }
    );
  } finally {
  }
}
