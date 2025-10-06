
import fs from 'fs';
import path from 'path';

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

async function verifyAISystem() {
  console.log('🔍 Verifying AI System...\n');
  
  const results: VerificationResult[] = [];
  const projectRoot = process.cwd();
  
  // Check 1: Knowledge base file exists
  const kbPath = path.join(projectRoot, 'data', 'ai-knowledge-base.json');
  if (fs.existsSync(kbPath)) {
    try {
      const kbData = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
      results.push({
        name: 'Knowledge Base File',
        status: 'pass',
        message: `Found with ${kbData.metadata.totalChunks} chunks`,
      });
      
      // Check knowledge base content
      if (kbData.chunks && kbData.chunks.length > 0) {
        results.push({
          name: 'Knowledge Base Content',
          status: 'pass',
          message: `${kbData.chunks.length} document chunks loaded`,
        });
      } else {
        results.push({
          name: 'Knowledge Base Content',
          status: 'fail',
          message: 'Knowledge base is empty',
        });
      }
    } catch (error) {
      results.push({
        name: 'Knowledge Base File',
        status: 'fail',
        message: `Error reading knowledge base: ${error}`,
      });
    }
  } else {
    results.push({
      name: 'Knowledge Base File',
      status: 'fail',
      message: 'Knowledge base file not found. Run: npm run build-knowledge-base',
    });
  }
  
  // Check 2: Data directory
  const dataDir = path.join(projectRoot, 'data');
  if (fs.existsSync(dataDir)) {
    results.push({
      name: 'Data Directory',
      status: 'pass',
      message: 'Data directory exists',
    });
  } else {
    results.push({
      name: 'Data Directory',
      status: 'fail',
      message: 'Data directory not found',
    });
  }
  
  // Check 3: Documentation directory
  const docsDir = path.join(projectRoot, 'docs');
  if (fs.existsSync(docsDir)) {
    const mdFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
    const pdfFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'));
    results.push({
      name: 'Documentation Directory',
      status: 'pass',
      message: `Found ${mdFiles.length} MD + ${pdfFiles.length} PDF files`,
    });
  } else {
    results.push({
      name: 'Documentation Directory',
      status: 'warning',
      message: 'Docs directory not found',
    });
  }
  
  // Check 4: API routes
  const apiDir = path.join(projectRoot, 'src', 'app', 'api', 'ai');
  if (fs.existsSync(apiDir)) {
    const routes = fs.readdirSync(apiDir);
    results.push({
      name: 'AI API Routes',
      status: 'pass',
      message: `Found ${routes.length} API routes`,
    });
  } else {
    results.push({
      name: 'AI API Routes',
      status: 'warning',
      message: 'AI API routes directory not found',
    });
  }
  
  // Check 5: AI library files
  const libDir = path.join(projectRoot, 'src', 'lib');
  if (fs.existsSync(libDir)) {
    const aiFiles = fs.readdirSync(libDir).filter(f => f.includes('ai') || f.includes('knowledge'));
    if (aiFiles.length > 0) {
      results.push({
        name: 'AI Library Files',
        status: 'pass',
        message: `Found ${aiFiles.length} AI library files`,
      });
    } else {
      results.push({
        name: 'AI Library Files',
        status: 'warning',
        message: 'No AI library files found',
      });
    }
  } else {
    results.push({
      name: 'AI Library Files',
      status: 'warning',
      message: 'Lib directory not found',
    });
  }
  
  // Check 6: Environment configuration
  const envPath = path.join(projectRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    results.push({
      name: 'Environment Configuration',
      status: 'pass',
      message: '.env.local file exists',
    });
  } else {
    results.push({
      name: 'Environment Configuration',
      status: 'warning',
      message: '.env.local not found (optional)',
    });
  }
  
  // Print results
  console.log('📋 Verification Results:\n');
  
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.name}: ${result.message}`);
    
    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') failCount++;
    else warningCount++;
  });
  
  console.log('\n📊 Summary:');
  console.log(`   - Passed: ${passCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log(`   - Warnings: ${warningCount}`);
  
  if (failCount > 0) {
    console.log('\n❌ AI system verification failed. Please address the issues above.');
    process.exit(1);
  } else if (warningCount > 0) {
    console.log('\n⚠️  AI system verification passed with warnings.');
  } else {
    console.log('\n✅ AI system verification passed!');
  }
}

verifyAISystem().catch(console.error);
