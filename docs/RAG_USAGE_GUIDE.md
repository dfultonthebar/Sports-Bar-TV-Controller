# RAG Documentation System Usage Guide

**Version:** 1.0
**Date:** November 6, 2025
**For:** Development Team & System Administrators

## Overview

The RAG (Retrieval-Augmented Generation) system provides intelligent documentation search and Q&A capabilities using local Ollama LLMs. It indexes all documentation in the `/docs` folder and can answer questions about the system architecture, API usage, troubleshooting, and more.

## Quick Start

### Query via CLI

```bash
# Simple query
npm run rag:test "How do I configure Fire TV devices?"

# With output formatting
npm run rag:test "What is the PM2 configuration?" | jq '.'
```

### Query via API

```bash
# Basic query
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I monitor memory usage?"}' | jq '.answer'

# With tech filter
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I fix CEC issues?", "tech": "cec"}' | jq '.'

# Get full response with sources
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What database does the system use?"}' | jq '{answer: .answer, sources: .sources}'
```

## System Architecture

### Components

1. **Document Scanner** (`/src/lib/rag-server/doc-processor.ts`)
   - Scans `/docs` folder recursively
   - Supports: Markdown (.md), PDF (.pdf), HTML (.html)
   - Chunks documents (750 tokens, 100 overlap)
   - Extracts metadata and tech tags

2. **Vector Store** (`/src/lib/rag-server/vector-store.ts`)
   - Stores document embeddings
   - Uses nomic-embed-text model (768 dimensions)
   - Persists to `/rag-vector-store.json`
   - Indexed by tech tags and file types

3. **Query Engine** (`/src/lib/rag-server/query-engine.ts`)
   - Performs similarity search (top-K retrieval)
   - Generates LLM answers using llama3.1:8b
   - Returns answer with source citations
   - Supports tech filtering

4. **Ollama Client** (`/src/lib/rag-server/ollama-client.ts`)
   - Interfaces with local Ollama server (port 11434)
   - Handles embedding generation
   - Manages LLM requests

### Tech Tags

Documents are automatically tagged based on content:

- `ai` - AI/ML features, diagnostics, models
- `api` - API endpoints, routes, validation
- `authentication` - Auth, sessions, security
- `cec` - HDMI-CEC control, cable boxes
- `database` - Drizzle ORM, schema, queries
- `deployment` - PM2, production setup
- `firetv` - Fire TV devices, ADB control
- `hardware` - Physical hardware setup
- `ir` - IR blasters, learning, codes
- `matrix` - HDMI matrix switching
- `testing` - Unit tests, integration tests
- `troubleshooting` - Debugging, fixes

## Common Use Cases

### 1. Architecture Questions

**Question:** "What database does the system use?"

```bash
npm run rag:test "What database does the system use?"
```

**Expected Answer:** Drizzle ORM with SQLite, production database location, schema structure.

### 2. API Usage

**Question:** "How do I control Fire TV devices via API?"

```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I control Fire TV devices via API?", "tech": "api"}' | jq '.answer'
```

**Expected Answer:** API endpoints (/api/firetv/connect, /api/firetv/command), request format, ADB commands.

### 3. Troubleshooting

**Question:** "What do I do when a TV doesn't respond?"

```bash
npm run rag:test "What do I do when a TV doesn't respond?"
```

**Expected Answer:** Check device status, ADB connection, restart procedures, debugging steps.

### 4. Performance Analysis

**Question:** "How do I analyze memory trends?"

```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I analyze memory trends?", "tech": "performance"}' | jq '.'
```

**Expected Answer:** Memory monitoring scripts, analysis commands, threshold interpretation.

### 5. Configuration

**Question:** "How do I configure PM2?"

```bash
npm run rag:test "How do I configure PM2?"
```

**Expected Answer:** ecosystem.config.js, memory limits, restart policies, environment variables.

## Advanced Features

### Tech Filtering

Filter results by technology area:

```bash
# Only search CEC documentation
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How does device control work?", "tech": "cec"}'

# Only search API documentation
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How does validation work?", "tech": "api"}'
```

### Source Citation

Every answer includes source documents:

```json
{
  "success": true,
  "answer": "The system uses Drizzle ORM with SQLite...",
  "sources": [
    {
      "filename": "SYSTEM_ARCHITECTURE.md",
      "chunkIndex": 5,
      "relevanceScore": 0.85
    },
    {
      "filename": "DATABASE_SCHEMA.md",
      "chunkIndex": 0,
      "relevanceScore": 0.78
    }
  ],
  "metadata": {
    "totalChunks": 1905,
    "retrievalTime": 150,
    "generationTime": 3200
  }
}
```

### Custom Top-K

Adjust number of retrieved chunks (default: 5):

```javascript
// In code
import { queryDocs } from '@/lib/rag-server/query-engine'

const result = await queryDocs({
  query: "How does authentication work?",
  tech: "authentication",
  topK: 10 // Retrieve more context
})
```

## Maintenance Tasks

### 1. Rebuild Vector Store

When documentation is significantly updated:

```bash
# Clear and rescan all docs
npm run rag:scan:clear

# Incremental scan (faster)
npm run rag:scan
```

### 2. Check System Status

```bash
# Get statistics
curl -s http://localhost:3001/api/rag/stats | jq '.'

# Check Ollama connectivity
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

### 3. List Indexed Documents

```bash
# Get all indexed docs
curl -s http://localhost:3001/api/rag/docs | jq '.documents[]'

# Filter by tech tag
curl -s http://localhost:3001/api/rag/docs | jq '.documents[] | select(.techTags[] == "api")'
```

### 4. Performance Monitoring

```bash
# Check vector store size
ls -lh /home/ubuntu/Sports-Bar-TV-Controller/rag-vector-store.json

# Monitor query performance
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Test query"}' | jq '.metadata'
```

## Best Practices

### Writing Effective Queries

**Good Queries:**
- "How do I configure Fire TV devices?" (specific, actionable)
- "What causes high memory usage?" (clear problem statement)
- "Where is the production database located?" (specific fact)

**Poor Queries:**
- "How?" (too vague)
- "Tell me everything" (too broad)
- "Is it broken?" (lacks context)

### Query Tips

1. **Be Specific:** Ask about specific features, files, or problems
2. **Use Keywords:** Include technical terms (API, database, PM2, etc.)
3. **Tech Filtering:** Use tech filters for focused searches
4. **Follow-up:** Ask clarifying questions based on initial answers
5. **Verify Sources:** Check cited source documents for complete information

### When to Use RAG vs Reading Docs

**Use RAG for:**
- Quick questions about specific features
- Finding relevant documentation
- Understanding relationships between systems
- Troubleshooting guidance
- API usage examples

**Read Docs Directly for:**
- Learning entire systems from scratch
- Understanding context and history
- Following step-by-step tutorials
- Reviewing all available options
- Official references and specifications

## Configuration

### RAG System Settings

Located in `/src/lib/rag-server/config.ts`:

```typescript
export const RAG_CONFIG = {
  // Chunking
  chunkSize: 750,          // Tokens per chunk
  chunkOverlap: 100,       // Overlap between chunks

  // Retrieval
  topK: 5,                 // Number of chunks to retrieve
  minRelevanceScore: 0.3,  // Minimum similarity threshold

  // Generation
  llmModel: 'llama3.1:8b', // LLM for answer generation
  embeddingModel: 'nomic-embed-text', // Embedding model

  // Storage
  vectorStorePath: './rag-vector-store.json'
}
```

### Ollama Models

Required models (install via `ollama pull`):

```bash
# Embedding model (required)
ollama pull nomic-embed-text

# LLM for generation (required)
ollama pull llama3.1:8b

# Alternative LLMs (optional)
ollama pull mistral
ollama pull phi3:mini
```

## Troubleshooting

### Issue: "Ollama not connected"

**Cause:** Ollama server not running

**Fix:**
```bash
# Check if Ollama is running
curl -s http://localhost:11434/api/tags

# Start Ollama (if needed)
ollama serve
```

### Issue: "No documents found"

**Cause:** Vector store empty or not built

**Fix:**
```bash
# Scan documents
npm run rag:scan

# Verify scan
curl -s http://localhost:3001/api/rag/stats | jq '.data.vectorStore.totalDocuments'
```

### Issue: "Low relevance scores"

**Cause:** Query too vague or topic not in docs

**Fix:**
1. Rephrase query with specific keywords
2. Use tech filtering
3. Check if topic is documented: `curl -s http://localhost:3001/api/rag/docs | jq '.documents[].filename'`

### Issue: "Slow query responses"

**Cause:** LLM generation takes time

**Expected:** 2-5 seconds per query
- Similarity search: ~200ms
- LLM generation: 2-5s

**If slower:**
- Check Ollama server load
- Consider using smaller model (phi3:mini)
- Reduce topK to retrieve fewer chunks

### Issue: "Outdated answers"

**Cause:** Vector store not updated after documentation changes

**Fix:**
```bash
# Rebuild vector store
npm run rag:scan:clear

# Or incremental update
npm run rag:scan
```

## API Reference

### POST /api/rag/query

Query the RAG system with a question.

**Request:**
```json
{
  "query": "How do I configure Fire TV devices?",
  "tech": "firetv",
  "topK": 5
}
```

**Response:**
```json
{
  "success": true,
  "answer": "To configure Fire TV devices...",
  "sources": [...],
  "metadata": {
    "totalChunks": 1905,
    "retrievalTime": 150,
    "generationTime": 3200
  }
}
```

### GET /api/rag/stats

Get system statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "vectorStore": {
      "totalChunks": 1905,
      "totalDocuments": 426,
      "techTags": {...},
      "fileTypes": {...}
    },
    "ollama": {
      "connected": true,
      "llmModel": "llama3.1:8b",
      "embeddingModel": "nomic-embed-text"
    }
  }
}
```

### POST /api/rag/rebuild

Rebuild the vector store.

**Request:**
```json
{
  "clearExisting": true
}
```

**Response:**
```json
{
  "success": true,
  "documentsProcessed": 439,
  "chunksCreated": 1905
}
```

### GET /api/rag/docs

List indexed documents.

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "filename": "SYSTEM_ARCHITECTURE.md",
      "chunks": 12,
      "techTags": ["architecture", "database"]
    }
  ]
}
```

## Integration Examples

### Node.js/TypeScript

```typescript
import { queryDocs } from '@/lib/rag-server/query-engine'

async function askQuestion(question: string) {
  try {
    const result = await queryDocs({
      query: question,
      tech: undefined,  // Optional tech filter
      topK: 5           // Optional
    })

    console.log('Answer:', result.answer)
    console.log('Sources:', result.sources.map(s => s.filename))

    return result.answer
  } catch (error) {
    console.error('RAG query failed:', error)
    throw error
  }
}

// Usage
const answer = await askQuestion("How do I monitor memory?")
```

### cURL Script

```bash
#!/bin/bash

# query-rag.sh
QUERY="$1"
TECH_FILTER="${2:-}"

if [ -z "$QUERY" ]; then
  echo "Usage: ./query-rag.sh 'your question' [tech-filter]"
  exit 1
fi

JSON_PAYLOAD=$(jq -n \
  --arg query "$QUERY" \
  --arg tech "$TECH_FILTER" \
  '{query: $query, tech: ($tech // null)}')

curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" | jq '.answer'
```

### Python

```python
import requests

def query_rag(question: str, tech_filter: str = None):
    """Query the RAG documentation system."""
    url = "http://localhost:3001/api/rag/query"
    payload = {"query": question}

    if tech_filter:
        payload["tech"] = tech_filter

    response = requests.post(url, json=payload)
    response.raise_for_status()

    data = response.json()
    return {
        "answer": data["answer"],
        "sources": [s["filename"] for s in data["sources"]]
    }

# Usage
result = query_rag("How do I configure Fire TV devices?", tech_filter="firetv")
print(result["answer"])
print("Sources:", result["sources"])
```

## Performance Expectations

### Query Performance

- **Similarity Search:** 100-300ms
- **LLM Generation:** 2-5 seconds
- **Total Response Time:** 2-6 seconds

### Resource Usage

- **Vector Store Size:** ~5-10MB for 400+ documents
- **Memory Usage:** ~500MB during indexing
- **Disk I/O:** Minimal (single JSON file)

### Scalability

- **Current:** 439 documents, 1905 chunks
- **Tested:** Up to 1000 documents
- **Recommended:** Keep under 500 documents for optimal performance

## FAQ

**Q: How often should I rebuild the vector store?**
A: After significant documentation changes (5+ new files or major rewrites). For minor changes, incremental scan is sufficient.

**Q: Can I use a different LLM?**
A: Yes, modify RAG_CONFIG.llmModel. Options: mistral, phi3:mini, llama3.2

**Q: Why are some answers not accurate?**
A: The RAG system is only as good as the documentation. Check if the topic is well-documented.

**Q: Can I query from external servers?**
A: Yes, but ensure proper authentication and rate limiting are configured.

**Q: How do I add custom tech tags?**
A: Tech tags are auto-detected. To add manual tags, modify doc-processor.ts detectTechTags function.

**Q: What if Ollama is slow?**
A: Use a smaller/faster model (phi3:mini), reduce topK, or upgrade hardware.

## Support & Resources

- **RAG Implementation Report:** `/RAG_IMPLEMENTATION_REPORT.md`
- **RAG Quick Start:** `/RAG_QUICK_START.md`
- **Test Plan:** `/docs/RAG_TEST_PLAN.md`
- **System Architecture:** `/docs/SYSTEM_ARCHITECTURE.md`
- **Ollama Documentation:** https://ollama.ai/docs

## Changelog

### Version 1.0 (November 6, 2025)
- Initial RAG usage guide
- Comprehensive API documentation
- Integration examples
- Troubleshooting guide
- Best practices

---

**Last Updated:** November 6, 2025
**Maintained By:** Development Team
**Questions:** See RAG_TEST_PLAN.md for testing procedures
