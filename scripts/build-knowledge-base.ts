
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

interface DocumentChunk {
  id: string;
  content: string;
  source: string;
  type: 'pdf' | 'markdown' | 'code';
  metadata: {
    filename: string;
    path: string;
    size: number;
    lastModified: string;
  };
}

interface KnowledgeBase {
  chunks: DocumentChunk[];
  metadata: {
    totalChunks: number;
    totalFiles: number;
    pdfCount: number;
    markdownCount: number;
    codeCount: number;
    totalCharacters: number;
    buildDate: string;
  };
}

const CHUNK_SIZE = 2000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error reading PDF ${filePath}:`, error);
    return '';
  }
}

function extractTextFromMarkdown(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading Markdown ${filePath}:`, error);
    return '';
  }
}

function chunkText(text: string, filename: string, filepath: string, type: 'pdf' | 'markdown' | 'code'): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const stats = fs.statSync(filepath);
  
  for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = text.slice(i, i + CHUNK_SIZE);
    if (chunk.trim().length > 0) {
      chunks.push({
        id: `${filename}-${chunks.length}`,
        content: chunk,
        source: filepath,
        type,
        metadata: {
          filename,
          path: filepath,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        },
      });
    }
  }
  
  return chunks;
}

async function processDirectory(dirPath: string, baseDir: string): Promise<DocumentChunk[]> {
  const chunks: DocumentChunk[] = [];
  
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory ${dirPath} does not exist, skipping...`);
    return chunks;
  }
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      const subChunks = await processDirectory(filePath, baseDir);
      chunks.push(...subChunks);
    } else if (file.endsWith('.pdf')) {
      console.log(`Processing PDF: ${file}`);
      const text = await extractTextFromPDF(filePath);
      const fileChunks = chunkText(text, file, filePath, 'pdf');
      chunks.push(...fileChunks);
    } else if (file.endsWith('.md')) {
      console.log(`Processing Markdown: ${file}`);
      const text = extractTextFromMarkdown(filePath);
      const fileChunks = chunkText(text, file, filePath, 'markdown');
      chunks.push(...fileChunks);
    }
  }
  
  return chunks;
}

async function processCodebase(srcDir: string): Promise<DocumentChunk[]> {
  const chunks: DocumentChunk[] = [];
  
  if (!fs.existsSync(srcDir)) {
    console.log(`Source directory ${srcDir} does not exist, skipping...`);
    return chunks;
  }
  
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        console.log(`Processing code file: ${file}`);
        const text = fs.readFileSync(filePath, 'utf-8');
        const fileChunks = chunkText(text, file, filePath, 'code');
        chunks.push(...fileChunks);
      }
    }
  }
  
  walkDir(srcDir);
  return chunks;
}

async function buildKnowledgeBase() {
  console.log('🔨 Building AI Knowledge Base...\n');
  
  const projectRoot = process.cwd();
  const docsDir = path.join(projectRoot, 'docs');
  const uploadsDir = path.join(projectRoot, 'uploads');
  const srcDir = path.join(projectRoot, 'src');
  const dataDir = path.join(projectRoot, 'data');
  const outputPath = path.join(dataDir, 'ai-knowledge-base.json');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  let allChunks: DocumentChunk[] = [];
  
  // Process docs directory
  console.log('📚 Processing documentation...');
  const docChunks = await processDirectory(docsDir, projectRoot);
  allChunks.push(...docChunks);
  
  // Process uploads directory (if exists)
  if (fs.existsSync(uploadsDir)) {
    console.log('📁 Processing uploads...');
    const uploadChunks = await processDirectory(uploadsDir, projectRoot);
    allChunks.push(...uploadChunks);
  }
  
  // Process codebase
  console.log('💻 Processing codebase...');
  const codeChunks = await processCodebase(srcDir);
  allChunks.push(...codeChunks);
  
  // Calculate statistics
  const pdfCount = allChunks.filter(c => c.type === 'pdf').length;
  const markdownCount = allChunks.filter(c => c.type === 'markdown').length;
  const codeCount = allChunks.filter(c => c.type === 'code').length;
  const totalCharacters = allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
  
  const knowledgeBase: KnowledgeBase = {
    chunks: allChunks,
    metadata: {
      totalChunks: allChunks.length,
      totalFiles: new Set(allChunks.map(c => c.source)).size,
      pdfCount,
      markdownCount,
      codeCount,
      totalCharacters,
      buildDate: new Date().toISOString(),
    },
  };
  
  // Save to file
  fs.writeFileSync(outputPath, JSON.stringify(knowledgeBase, null, 2));
  
  console.log('\n✅ Knowledge Base Built Successfully!\n');
  console.log('📊 Statistics:');
  console.log(`   - Total Document Chunks: ${knowledgeBase.metadata.totalChunks}`);
  console.log(`   - Total Files: ${knowledgeBase.metadata.totalFiles}`);
  console.log(`   - PDF Chunks: ${pdfCount}`);
  console.log(`   - Markdown Chunks: ${markdownCount}`);
  console.log(`   - Code Chunks: ${codeCount}`);
  console.log(`   - Total Characters: ${totalCharacters.toLocaleString()}`);
  console.log(`   - Saved to: ${outputPath}\n`);
}

buildKnowledgeBase().catch(console.error);
