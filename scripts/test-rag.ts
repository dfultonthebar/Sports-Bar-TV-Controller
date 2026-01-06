#!/usr/bin/env tsx
/**
 * Test RAG System
 *
 * Tests the RAG documentation system with sample queries
 *
 * Usage:
 *   npx tsx scripts/test-rag.ts
 */

import { queryDocs } from '../src/lib/rag-server/query-engine';
import { getVectorStoreStats } from '../src/lib/rag-server/vector-store';
import { testOllamaConnection } from '../src/lib/rag-server/llm-client';

const TEST_QUERIES = [
  {
    query: 'How do I configure CEC devices?',
    tech: 'cec',
    description: 'CEC configuration',
  },
  {
    query: "What's the database schema for cable boxes?",
    tech: 'database',
    description: 'Database schema query',
  },
  {
    query: 'How does rate limiting work in the API?',
    tech: 'api',
    description: 'Rate limiting information',
  },
  {
    query: 'How do I set up Pulse-Eight CEC adapters?',
    tech: 'cec',
    description: 'Pulse-Eight setup',
  },
  {
    query: 'What authentication methods are available?',
    tech: 'authentication',
    description: 'Authentication methods',
  },
];

async function main() {
  console.log('\n=== RAG System Test ===\n');

  try {
    // Check Ollama
    console.log('1. Checking Ollama connection...');
    const ollamaReady = await testOllamaConnection();
    if (!ollamaReady) {
      console.error('❌ Ollama is not ready. Please ensure models are installed.');
      process.exit(1);
    }
    console.log('✓ Ollama connected\n');

    // Check vector store
    console.log('2. Checking vector store...');
    const stats = await getVectorStoreStats();
    console.log(`✓ Vector store loaded`);
    console.log(`  - Total chunks: ${stats.totalChunks}`);
    console.log(`  - Total documents: ${stats.totalDocuments}`);
    console.log(`  - Last updated: ${new Date(stats.lastUpdated).toLocaleString()}\n`);

    if (stats.totalChunks === 0) {
      console.error('❌ Vector store is empty. Please run: npx tsx scripts/scan-docs.ts');
      process.exit(1);
    }

    // Run test queries
    console.log('3. Testing queries...\n');
    console.log('='.repeat(80));

    for (let i = 0; i < TEST_QUERIES.length; i++) {
      const test = TEST_QUERIES[i];
      console.log(`\nQuery ${i + 1}/${TEST_QUERIES.length}: ${test.description}`);
      console.log(`Question: "${test.query}"`);
      console.log(`Tech filter: ${test.tech || 'none'}`);
      console.log('-'.repeat(80));

      const startTime = Date.now();

      try {
        const result = await queryDocs({
          query: test.query,
          tech: test.tech,
        });

        const duration = Date.now() - startTime;

        console.log(`\nAnswer (${duration}ms):`);
        console.log(result.answer);

        console.log(`\nSources (${result.sources.length}):`);
        result.sources.forEach((source, idx) => {
          console.log(`  ${idx + 1}. ${source.filename} (score: ${(source.relevanceScore * 100).toFixed(1)}%)`);
          if (source.heading) {
            console.log(`     Section: ${source.heading}`);
          }
        });

        console.log(`\nMetadata:`);
        console.log(`  - Model: ${result.metadata.model}`);
        console.log(`  - Tokens used: ${result.metadata.tokensUsed}`);
        console.log(`  - Chunks retrieved: ${result.metadata.chunksRetrieved}`);
        console.log(`  - Context length: ${result.metadata.contextLength} chars`);
        console.log(`  - Total duration: ${result.metadata.duration}ms`);

      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log('='.repeat(80));

      // Add a small delay between queries
      if (i < TEST_QUERIES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n✓ All tests completed!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
