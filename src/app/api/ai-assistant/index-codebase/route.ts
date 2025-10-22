
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { indexedFiles } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
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
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('[AI INDEXING] Starting codebase indexing operation');
  console.log('[AI INDEXING] Timestamp:', new Date().toISOString());
  
  try {
    const projectRoot = process.cwd();
    
    console.log('[AI INDEXING] Project root:', projectRoot);
    console.log('[AI INDEXING] Included extensions:', INCLUDED_EXTENSIONS.join(', '));
    console.log('[AI INDEXING] Excluded directories:', EXCLUDED_DIRS.join(', '));
    
    // Scan the project directory
    console.log('[AI INDEXING] Beginning directory scan...');
    const files = await scanDirectory(projectRoot, projectRoot);
    
    console.log(`[AI INDEXING] ✓ Directory scan complete - Found ${files.length} files to index`);
    
    let indexed = 0;
    let updated = 0;
    let skipped = 0;
    
    // Process each file
    console.log('[AI INDEXING] Processing files in database...');
    let processedCount = 0;
    for (const file of files) {
      try {
        // Check if file already exists in database
        const existing = await db.select()
          .from(indexedFiles)
          .where(eq(indexedFiles.filePath, file.path))
          .limit(1);
        
        if (existing.length > 0) {
          // Check if file has changed
          if (existing[0].hash !== file.hash) {
            await db.update(indexedFiles)
              .set({
                content: file.content,
                fileSize: file.size,
                lastModified: file.lastModified,
                lastIndexed: new Date(),
                hash: file.hash,
                updatedAt: new Date()
              })
              .where(eq(indexedFiles.id, existing[0].id));
            updated++;
            if (updated % 10 === 0) {
              console.log(`[AI INDEXING] Progress: Updated ${updated} files so far...`);
            }
          } else {
            skipped++;
          }
        } else {
          // Create new record
          await db.insert(indexedFiles).values({
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
          });
          indexed++;
          if (indexed % 10 === 0) {
            console.log(`[AI INDEXING] Progress: Indexed ${indexed} new files so far...`);
          }
        }
        processedCount++;
      } catch (error) {
        console.error(`[AI INDEXING] ✗ Error indexing file ${file.path}:`, error);
      }
    }
    console.log(`[AI INDEXING] ✓ File processing complete - ${processedCount}/${files.length} files processed`);
    
    // Mark files that no longer exist as inactive
    console.log('[AI INDEXING] Checking for deleted files...');
    const allIndexedFiles = await db.select()
      .from(indexedFiles)
      .where(eq(indexedFiles.isActive, true));
    
    const currentFilePaths = new Set(files.map(f => f.path));
    let deactivated = 0;
    
    for (const indexedFile of allIndexedFiles) {
      if (!currentFilePaths.has(indexedFile.filePath)) {
        await db.update(indexedFiles)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(indexedFiles.id, indexedFile.id));
        deactivated++;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log('[AI INDEXING] ✓ Indexing complete!');
    console.log('[AI INDEXING] Stats:', { indexed, updated, skipped, deactivated });
    console.log('[AI INDEXING] Duration:', `${(duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(80));
    
    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: files.length,
        indexed,
        updated,
        skipped,
        deactivated,
        duration
      }
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[AI INDEXING] ✗ FATAL ERROR during indexing:', error);
    console.error('[AI INDEXING] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[AI INDEXING] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[AI INDEXING] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[AI INDEXING] Duration before error:', `${(duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(80));
    
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
  console.log('[AI INDEXING] GET request - Fetching index stats');
  try {
    // Get total count and sum of file sizes
    const countResult = await db.select({
      count: sql<number>`count(*)`,
      totalSize: sql<number>`sum(${indexedFiles.fileSize})`
    })
    .from(indexedFiles)
    .where(eq(indexedFiles.isActive, true));
    
    const totalFiles = countResult[0]?.count || 0;
    const totalSize = countResult[0]?.totalSize || 0;
    
    // Get files grouped by type
    const filesByTypeResult = await db.select({
      fileType: indexedFiles.fileType,
      count: sql<number>`count(*)`
    })
    .from(indexedFiles)
    .where(eq(indexedFiles.isActive, true))
    .groupBy(indexedFiles.fileType);
    
    // Get last indexed timestamp
    const lastIndexedResult = await db.select({
      lastIndexed: indexedFiles.lastIndexed
    })
    .from(indexedFiles)
    .where(eq(indexedFiles.isActive, true))
    .orderBy(sql`${indexedFiles.lastIndexed} DESC`)
    .limit(1);
    
    console.log('[AI INDEXING] Stats retrieved:', {
      totalFiles,
      totalSize: `${((totalSize || 0) / 1024).toFixed(2)} KB`,
      typeCount: filesByTypeResult.length,
      lastIndexed: lastIndexedResult[0]?.lastIndexed
    });
    
    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: totalFiles,
        totalSize: totalSize,
        filesByType: filesByTypeResult.map(ft => ({
          type: ft.fileType,
          count: ft.count
        })),
        lastIndexed: lastIndexedResult[0]?.lastIndexed
      }
    });
    
  } catch (error) {
    console.error('[AI INDEXING] ✗ Error getting index stats:', error);
    console.error('[AI INDEXING] Error details:', error instanceof Error ? error.message : String(error));
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
