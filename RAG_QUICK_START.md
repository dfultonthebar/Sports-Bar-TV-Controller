# RAG Documentation Server - Quick Start Guide

## What is this?

A complete Retrieval Augmented Generation (RAG) system that lets you query your project documentation using natural language, powered by local Ollama LLMs.

## Installation (5 minutes)

### 1. Install Ollama Models

```bash
# First, ensure Ollama is running
ollama serve

# In another terminal, pull the required models (this will take some time to download)
ollama pull llama3.1:8b        # LLM for generating answers (~4.9GB)
ollama pull nomic-embed-text   # Embedding model (~274MB)
```

### 2. Index Your Documentation

```bash
# Scan and index all documentation in /docs folder
npm run rag:scan

# This will:
# - Scan all .md, .html, .pdf, and .txt files
# - Split them into intelligent chunks
# - Generate embeddings
# - Store in /rag-data/vector-store.json
```

Expected output:
```
=== RAG Document Scanner ===

1. Checking Ollama connection...
✓ Ollama connected
  Available models: 8

2. Initializing vector store...
✓ Vector store initialized

...

6. Indexing complete!

=== Final Statistics ===
  Documents scanned:   156
  Documents processed: 154
  Chunks created:      1247
  Errors:              2
  Duration:            145.23s
```

## Usage

### CLI Testing

```bash
# Run test queries
npm run rag:test
```

### HTTP API

```bash
# Query via curl
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I configure CEC devices?"}'

# With tech filter
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Setup guide", "tech": "cec"}'

# Get statistics
curl http://localhost:3000/api/rag/stats
```

### Programmatic

```typescript
import { queryDocs } from '@/lib/rag-server';

const result = await queryDocs({
  query: "How do I set up Pulse-Eight CEC adapters?",
  tech: "cec"
});

console.log(result.answer);
// Detailed answer based on your documentation

console.log(result.sources);
// [
//   {
//     filename: "CEC_INTEGRATION_GUIDE.md",
//     relevanceScore: 0.87,
//     heading: "Setup Instructions"
//   }
// ]
```

## Example Queries

Try these after indexing:

1. **"How do I configure CEC devices?"**
   - Returns: CEC setup instructions with source docs

2. **"What's the database schema for cable boxes?"**
   - Returns: Schema information from DB documentation

3. **"How does rate limiting work in the API?"**
   - Returns: Rate limiting implementation details

4. **"How do I set up Pulse-Eight CEC adapters?"**
   - Returns: Pulse-Eight specific setup guide

5. **"What authentication methods are available?"**
   - Returns: Authentication options and setup

## Maintenance

### Re-index after documentation changes

```bash
# Quick re-scan (keeps existing data)
npm run rag:scan

# Full rebuild (clears and rebuilds)
npm run rag:scan:clear
```

### Check system status

```bash
# Via API
curl http://localhost:3000/api/rag/stats

# Via CLI (verbose)
npx tsx scripts/scan-docs.ts --verbose
```

## File Structure

```
/src/lib/rag-server/     # RAG system source code
/scripts/
  ├── scan-docs.ts       # Indexing CLI tool
  └── test-rag.ts        # Testing CLI tool
/src/app/api/rag/        # HTTP API endpoints
  ├── query/             # Query endpoint
  ├── rebuild/           # Rebuild endpoint
  ├── stats/             # Statistics endpoint
  └── docs/              # List docs endpoint
/rag-data/               # Vector store (gitignored)
  └── vector-store.json  # Embeddings and chunks
```

## Troubleshooting

### "Ollama is not available"

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if not running
ollama serve
```

### "Required models are not installed"

```bash
# Check installed models
ollama list

# Install missing models
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

### "Vector store is empty"

```bash
# Run the indexing
npm run rag:scan

# Or rebuild from scratch
npm run rag:scan:clear
```

### Slow performance

1. The first query after restart is always slower (model loading)
2. Adjust `topK` in config if retrieving too many chunks
3. Consider using a lighter LLM model for faster responses

## Configuration

Edit `/src/lib/rag-server/config.ts` to customize:

```typescript
export const RAGConfig = {
  chunkSize: 750,           // Tokens per chunk
  chunkOverlap: 100,        // Overlap for context
  topK: 5,                  // Chunks to retrieve
  minRelevanceScore: 0.3,   // Minimum similarity
  llmModel: 'llama3.1:8b',  // LLM to use
  // ... more options
};
```

## Features

- Works 100% offline (no external APIs)
- Intelligent document chunking (preserves code blocks and context)
- Tech tag filtering (cec, api, database, etc.)
- Multiple file format support (.md, .html, .pdf, .txt)
- Fast vector similarity search
- Source attribution (shows which docs were used)
- REST API endpoints
- CLI tools for management

## Next Steps

1. Read the full documentation: `/docs/RAG_DOCUMENTATION_SERVER.md`
2. Integrate into your application
3. Add custom tech tags in config
4. Set up automated re-indexing

## Performance Benchmarks

Typical system:
- **Document Indexing**: ~100 docs/minute
- **Query Retrieval**: <200ms
- **LLM Response**: 1-3 seconds
- **Total Query Time**: 1.5-3.5 seconds

## Need Help?

Check:
1. Full documentation: `/docs/RAG_DOCUMENTATION_SERVER.md`
2. Run `npm run rag:test` to verify system is working
3. Check `curl http://localhost:3000/api/rag/stats` for system status
