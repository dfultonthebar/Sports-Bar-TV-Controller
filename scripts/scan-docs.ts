#!/usr/bin/env tsx
/**
 * Document Scanner CLI Tool
 *
 * Scans and indexes documentation into the RAG vector store
 *
 * Usage:
 *   npx tsx scripts/scan-docs.ts
 *   npx tsx scripts/scan-docs.ts --clear (clear existing data first)
 */

import { scanDocuments, processDocuments } from '../src/lib/rag-server/doc-processor';
import { clearVectorStore, addChunks, initializeVectorStore, getVectorStoreStats } from '../src/lib/rag-server/vector-store';
import { testOllamaConnection, getAvailableModels } from '../src/lib/rag-server/llm-client';
import { logger } from '../src/lib/logger';

const CLEAR_FLAG = process.argv.includes('--clear') || process.argv.includes('-c');
const VERBOSE_FLAG = process.argv.includes('--verbose') || process.argv.includes('-v');

interface ScanStats {
  documentsScanned: number;
  documentsProcessed: number;
  chunksCreated: number;
  errors: string[];
  duration: number;
}

async function main() {
  console.log('\n=== RAG Document Scanner ===\n');

  const startTime = Date.now();
  const stats: ScanStats = {
    documentsScanned: 0,
    documentsProcessed: 0,
    chunksCreated: 0,
    errors: [],
    duration: 0,
  };

  try {
    // Step 1: Check Ollama connection
    console.log('1. Checking Ollama connection...');
    const ollamaReady = await testOllamaConnection();

    if (!ollamaReady) {
      console.error('❌ Ollama is not available or required models are missing');
      console.log('\nPlease ensure:');
      console.log('  - Ollama is running (ollama serve)');
      console.log('  - Required models are installed:');
      console.log('    ollama pull llama3.1:8b');
      console.log('    ollama pull nomic-embed-text');
      process.exit(1);
    }

    const availableModels = await getAvailableModels();
    console.log('✓ Ollama connected');
    console.log(`  Available models: ${availableModels.length}`);
    if (VERBOSE_FLAG) {
      availableModels.forEach(model => console.log(`    - ${model}`));
    }

    // Step 2: Initialize vector store
    console.log('\n2. Initializing vector store...');
    await initializeVectorStore();
    console.log('✓ Vector store initialized');

    // Step 3: Clear if requested
    if (CLEAR_FLAG) {
      console.log('\n3. Clearing existing vector store...');
      await clearVectorStore();
      console.log('✓ Vector store cleared');
    } else {
      console.log('\n3. Keeping existing vector store data');
      const existingStats = await getVectorStoreStats();
      console.log(`  Existing chunks: ${existingStats.totalChunks}`);
      console.log(`  Existing documents: ${existingStats.totalDocuments}`);
    }

    // Step 4: Scan documents
    console.log('\n4. Scanning documents...');
    const documentPaths = await scanDocuments();
    stats.documentsScanned = documentPaths.length;
    console.log(`✓ Found ${documentPaths.length} documents`);

    if (documentPaths.length === 0) {
      console.log('\nNo documents to process. Exiting.');
      return;
    }

    // Step 5: Process documents
    console.log('\n5. Processing documents...');
    const batchSize = 5;
    let processedCount = 0;

    for (let i = 0; i < documentPaths.length; i += batchSize) {
      const batch = documentPaths.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documentPaths.length / batchSize);

      console.log(`\n  Batch ${batchNum}/${totalBatches} (${batch.length} documents)`);

      const results = await processDocuments(batch);

      for (const result of results) {
        processedCount++;

        if (result.error) {
          stats.errors.push(`${result.filename}: ${result.error}`);
          console.log(`    ❌ ${result.filename}: ${result.error}`);
          continue;
        }

        if (result.chunks.length === 0) {
          console.log(`    ⚠️  ${result.filename}: No content`);
          continue;
        }

        try {
          await addChunks(result.chunks);
          stats.documentsProcessed++;
          stats.chunksCreated += result.chunks.length;

          const tags = result.techTags.length > 0 ? ` [${result.techTags.join(', ')}]` : '';
          console.log(`    ✓ ${result.filename}: ${result.chunks.length} chunks${tags}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`${result.filename}: ${errorMsg}`);
          console.log(`    ❌ ${result.filename}: Failed to add chunks - ${errorMsg}`);
        }
      }

      // Progress indicator
      const progress = ((processedCount / documentPaths.length) * 100).toFixed(1);
      console.log(`  Progress: ${processedCount}/${documentPaths.length} (${progress}%)`);
    }

    // Step 6: Final statistics
    stats.duration = Date.now() - startTime;

    console.log('\n6. Indexing complete!');
    console.log('\n=== Final Statistics ===');
    console.log(`  Documents scanned:   ${stats.documentsScanned}`);
    console.log(`  Documents processed: ${stats.documentsProcessed}`);
    console.log(`  Chunks created:      ${stats.chunksCreated}`);
    console.log(`  Errors:              ${stats.errors.length}`);
    console.log(`  Duration:            ${(stats.duration / 1000).toFixed(2)}s`);

    if (stats.errors.length > 0 && VERBOSE_FLAG) {
      console.log('\n=== Errors ===');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    // Get final vector store stats
    const finalStats = await getVectorStoreStats();
    console.log('\n=== Vector Store Stats ===');
    console.log(`  Total chunks:   ${finalStats.totalChunks}`);
    console.log(`  Total documents: ${finalStats.totalDocuments}`);
    console.log(`  Last updated:    ${new Date(finalStats.lastUpdated).toLocaleString()}`);

    if (Object.keys(finalStats.techTags).length > 0) {
      console.log('\n  Tech tags:');
      Object.entries(finalStats.techTags)
        .sort(([, a], [, b]) => b - a)
        .forEach(([tag, count]) => {
          console.log(`    - ${tag}: ${count} chunks`);
        });
    }

    if (Object.keys(finalStats.fileTypes).length > 0) {
      console.log('\n  File types:');
      Object.entries(finalStats.fileTypes)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`    - .${type}: ${count} chunks`);
        });
    }

    console.log('\n✓ RAG system is ready to use!');
    console.log('\nTest it with:');
    console.log('  curl -X POST http://localhost:3000/api/rag/query \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"query": "How do I configure CEC?"}\'');
    console.log('');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      if (VERBOSE_FLAG && error.stack) {
        console.error('Stack:', error.stack);
      }
    }
    process.exit(1);
  }
}

// Run the scanner
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
