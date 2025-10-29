#!/usr/bin/env tsx
/**
 * Generate Q&A pairs using Claude API (via Claude Code)
 * Much faster than local Ollama for bulk Q&A generation
 */

import fs from 'fs';
import path from 'path';
import { db } from '../src/db';
import { schema } from '../src/db';
import { eq } from 'drizzle-orm';

const PROJECT_ROOT = '/home/ubuntu/Sports-Bar-TV-Controller';

interface GeneratedQA {
  question: string;
  answer: string;
  category: string;
  tags: string[];
  confidence: number;
  sourceFile: string;
}

// Collect all markdown files
function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// Generate Q&As from a file using Claude-style prompt
function generateQAsFromContent(content: string, filePath: string): GeneratedQA[] {
  const fileName = path.basename(filePath);
  const category = path.dirname(filePath).split(path.sep).pop() || 'general';

  // Parse the content and create Q&As
  // This is a template - you'll call this script and I'll generate the actual Q&As
  const qas: GeneratedQA[] = [];

  // Split content into chunks if too long
  const chunks = chunkContent(content, 3000);

  for (const chunk of chunks) {
    // For each chunk, generate Q&As
    // Claude API would process this
    console.log(`Processing chunk from ${fileName}...`);
  }

  return qas;
}

function chunkContent(content: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const lines = content.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if ((currentChunk + line).length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function saveQAToDatabase(qa: GeneratedQA) {
  try {
    await db.insert(schema.qaEntries).values({
      id: crypto.randomUUID(),
      question: qa.question,
      answer: qa.answer,
      category: qa.category,
      tags: qa.tags.join(','),
      confidence: qa.confidence,
      sourceFile: qa.sourceFile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving Q&A:', error);
  }
}

async function main() {
  console.log('🚀 Starting Q&A Generation with Claude API\n');

  // Collect all markdown files
  const files = collectMarkdownFiles(PROJECT_ROOT);
  console.log(`Found ${files.length} markdown files\n`);

  // List first 10 files as preview
  console.log('Preview of files to process:');
  files.slice(0, 10).forEach((f, i) => {
    console.log(`  ${i + 1}. ${path.relative(PROJECT_ROOT, f)}`);
  });
  if (files.length > 10) {
    console.log(`  ... and ${files.length - 10} more\n`);
  }

  console.log('\n✅ Ready to generate Q&As!');
  console.log('\nNext step: I (Claude) will read each file and generate Q&As');
  console.log('This will take a few minutes, but much faster than Ollama!\n');
}

main().catch(console.error);
