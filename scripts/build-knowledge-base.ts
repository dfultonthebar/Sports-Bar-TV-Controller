
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

const PROJECT_ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');
const KNOWLEDGE_BASE_PATH = path.join(PROJECT_ROOT, 'data', 'ai-knowledge-base.json');

interface DocumentChunk {
  source: string;
  type: 'pdf' | 'markdown';
  content: string;
  title?: string;
  section?: string;
}

interface KnowledgeBase {
  documents: DocumentChunk[];
  lastUpdated: string;
  stats: {
    totalDocuments: number;
    totalPDFs: number;
    totalMarkdown: number;
    totalCharacters: number;
  };
}

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error);
    return '';
  }
}

function extractTextFromMarkdown(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading markdown from ${filePath}:`, error);
    return '';
  }
}

function findAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  // Check if directory exists
  if (!fs.existsSync(dir)) {
    console.log(`   ⚠️  Directory not found: ${dir} (skipping)`);
    return files;
  }
  
  function walkDir(currentPath: string) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!item.startsWith('.') && item !== 'node_modules' && item !== '.next') {
          walkDir(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  walkDir(dir);
  return files;
}

function chunkText(text: string, maxLength: number = 4000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  const lines = text.split('\n');
  
  for (const line of lines) {
    if ((currentChunk + line).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // If a single line is too long, split it
      if (line.length > maxLength) {
        const words = line.split(' ');
        for (const word of words) {
          if ((currentChunk + word).length > maxLength) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
          }
          currentChunk += word + ' ';
        }
      } else {
        currentChunk = line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function buildKnowledgeBase(): Promise<void> {
  console.log('🔨 Building AI Knowledge Base...\n');
  
  const documents: DocumentChunk[] = [];
  let totalPDFs = 0;
  let totalMarkdown = 0;
  let totalCharacters = 0;
  
  // Find all PDF files in project and uploads
  console.log('📄 Processing PDF files...');
  const pdfFiles = [
    ...findAllFiles(DOCS_DIR, ['.pdf']),
    ...findAllFiles(UPLOADS_DIR, ['.pdf'])
  ];
  
  for (const pdfFile of pdfFiles) {
    const relativePath = path.relative(PROJECT_ROOT, pdfFile);
    console.log(`  - ${relativePath}`);
    
    const text = await extractTextFromPDF(pdfFile);
    if (text && text.length > 100) {
      const chunks = chunkText(text, 3000);
      chunks.forEach((chunk, index) => {
        documents.push({
          source: relativePath,
          type: 'pdf',
          content: chunk,
          title: path.basename(pdfFile, '.pdf'),
          section: chunks.length > 1 ? `Part ${index + 1} of ${chunks.length}` : undefined
        });
      });
      totalPDFs++;
      totalCharacters += text.length;
    }
  }
  
  // Find all markdown files
  console.log('\n📝 Processing Markdown files...');
  const mdFiles = findAllFiles(DOCS_DIR, ['.md']);
  
  for (const mdFile of mdFiles) {
    const relativePath = path.relative(PROJECT_ROOT, mdFile);
    
    // Skip README files and node_modules
    if (relativePath.includes('node_modules') || relativePath === '../README.md') {
      continue;
    }
    
    console.log(`  - ${relativePath}`);
    
    const text = extractTextFromMarkdown(mdFile);
    if (text && text.length > 100) {
      const chunks = chunkText(text, 3000);
      chunks.forEach((chunk, index) => {
        documents.push({
          source: relativePath,
          type: 'markdown',
          content: chunk,
          title: path.basename(mdFile, '.md'),
          section: chunks.length > 1 ? `Part ${index + 1} of ${chunks.length}` : undefined
        });
      });
      totalMarkdown++;
      totalCharacters += text.length;
    }
  }
  
  // Create knowledge base object
  const knowledgeBase: KnowledgeBase = {
    documents,
    lastUpdated: new Date().toISOString(),
    stats: {
      totalDocuments: documents.length,
      totalPDFs,
      totalMarkdown,
      totalCharacters
    }
  };
  
  // Ensure data directory exists
  const dataDir = path.dirname(KNOWLEDGE_BASE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Write knowledge base to file
  fs.writeFileSync(KNOWLEDGE_BASE_PATH, JSON.stringify(knowledgeBase, null, 2));
  
  console.log('\n✅ Knowledge Base Built Successfully!');
  console.log(`\n📊 Statistics:`);
  console.log(`   - Total Document Chunks: ${documents.length}`);
  console.log(`   - PDF Documents: ${totalPDFs}`);
  console.log(`   - Markdown Documents: ${totalMarkdown}`);
  console.log(`   - Total Characters: ${totalCharacters.toLocaleString()}`);
  console.log(`   - Saved to: ${KNOWLEDGE_BASE_PATH}\n`);
}

// Run the script
buildKnowledgeBase().catch(error => {
  console.error('❌ Error building knowledge base:', error);
  process.exit(1);
});
