#!/usr/bin/env tsx

import { loadKnowledgeBase } from '../src/lib/ai-knowledge';
import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying AI System Configuration...\n');

// Check 1: Knowledge Base
console.log('1️⃣ Checking Knowledge Base...');
try {
  const kb = loadKnowledgeBase();
  console.log(`   ✅ Knowledge base loaded successfully`);
  console.log(`   📊 Stats:`);
  console.log(`      - Total documents: ${kb.stats.totalDocuments}`);
  console.log(`      - PDF documents: ${kb.stats.totalPDFs}`);
  console.log(`      - Markdown documents: ${kb.stats.totalMarkdown}`);
  console.log(`      - Total characters: ${kb.stats.totalCharacters.toLocaleString()}`);
  console.log(`      - Last updated: ${new Date(kb.lastUpdated).toLocaleString()}`);
} catch (error) {
  console.error('   ❌ Failed to load knowledge base:', error);
  process.exit(1);
}

// Check 2: Data Directory
console.log('\n2️⃣ Checking Data Directory...');
const dataDir = path.join(process.cwd(), 'data');
if (fs.existsSync(dataDir)) {
  const files = fs.readdirSync(dataDir);
  console.log(`   ✅ Data directory exists with ${files.length} files`);
  console.log(`   📁 Files: ${files.join(', ')}`);
} else {
  console.error('   ❌ Data directory not found');
  process.exit(1);
}

// Check 3: Docs Directory
console.log('\n3️⃣ Checking Documentation Directory...');
const docsDir = path.join(process.cwd(), 'docs');
if (fs.existsSync(docsDir)) {
  const files = fs.readdirSync(docsDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));
  console.log(`   ✅ Docs directory exists`);
  console.log(`   📄 Markdown files: ${mdFiles.length}`);
  console.log(`   📕 PDF files: ${pdfFiles.length}`);
} else {
  console.error('   ❌ Docs directory not found');
  process.exit(1);
}

// Check 4: AI API Routes
console.log('\n4️⃣ Checking AI API Routes...');
const apiDir = path.join(process.cwd(), 'src', 'app', 'api', 'ai');
if (fs.existsSync(apiDir)) {
  const routes = fs.readdirSync(apiDir);
  console.log(`   ✅ AI API routes exist`);
  console.log(`   🔌 Available routes: ${routes.join(', ')}`);
} else {
  console.error('   ❌ AI API routes not found');
  process.exit(1);
}

// Check 5: Environment
console.log('\n5️⃣ Checking Environment...');
const envFile = path.join(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  console.log(`   ✅ .env file exists`);
  const envContent = fs.readFileSync(envFile, 'utf-8');
  const hasOllama = envContent.includes('OLLAMA_BASE_URL');
  console.log(`   🤖 Ollama configured: ${hasOllama ? 'Yes' : 'No'}`);
} else {
  console.log(`   ⚠️  .env file not found (using defaults)`);
}

console.log('\n✅ AI System Verification Complete!\n');
console.log('🎉 All checks passed. The AI backend is properly configured.\n');
