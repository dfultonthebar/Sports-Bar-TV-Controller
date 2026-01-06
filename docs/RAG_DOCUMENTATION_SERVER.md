# RAG Documentation Server

A complete Retrieval Augmented Generation (RAG) system for querying project documentation using local Ollama LLMs.

## Overview

This RAG system provides intelligent documentation search and question-answering capabilities powered by:
- **Local LLM**: Llama 3.1 8B (via Ollama)
- **Embeddings**: nomic-embed-text (via Ollama)
- **Vector Store**: File-based JSON storage with cosine similarity
- **Document Processing**: Intelligent chunking with context preservation

## Features

- **Offline Operation**: Works entirely locally, no external API calls
- **Smart Chunking**: Preserves code blocks, headings, and context
- **Tech Tag Filtering**: Filter results by technology (cec, api, database, etc.)
- **Multiple File Formats**: Supports Markdown, HTML, PDF, and text files
- **Fast Retrieval**: Vector similarity search with configurable relevance scoring
- **REST API**: Query via HTTP endpoints
- **CLI Tools**: Command-line scripts for indexing and testing

## Architecture

```
docs/
  └─ *.md, *.html, *.pdf  → Document Processor
                                ↓
                            Chunking Strategy
                                ↓
                          Generate Embeddings (Ollama)
                                ↓
                          Vector Store (JSON)
                                ↓
User Query → Generate Embedding → Similarity Search → Top-K Chunks
                                                          ↓
                                                    Build Context
                                                          ↓
                                              Query LLM (Ollama)
                                                          ↓
                                                      Answer + Sources
```

## Installation

### 1. Install Ollama

```bash
# Install Ollama (if not already installed)
curl https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve
```

### 2. Pull Required Models

```bash
# Pull Llama 3.1 8B for text generation
ollama pull llama3.1:8b

# Pull nomic-embed-text for embeddings
ollama pull nomic-embed-text
```

### 3. Build Vector Database

```bash
# Scan and index all documentation
npm run rag:scan

# Or clear existing data and rebuild
npm run rag:scan:clear
```

This will:
- Scan the `/docs` directory recursively
- Process all supported file types (`.md`, `.html`, `.pdf`, `.txt`)
- Generate embeddings for each chunk
- Store in `/rag-data/vector-store.json`

## Usage

### Command Line

#### Index Documentation

```bash
# Index new or updated documents
npm run rag:scan

# Clear and rebuild entire index
npm run rag:scan:clear

# Verbose output
npx tsx scripts/scan-docs.ts --verbose
```

#### Test System

```bash
# Run test queries
npm run rag:test
```

### REST API

#### Query Documentation

```bash
POST /api/rag/query
Content-Type: application/json

{
  "query": "How do I configure CEC devices?",
  "tech": "cec",           // optional: filter by tech tag
  "topK": 5,               // optional: number of chunks to retrieve
  "includeContext": false, // optional: include raw context in response
  "temperature": 0.7       // optional: LLM temperature
}
```

Response:

```json
{
  "success": true,
  "data": {
    "answer": "To configure CEC devices, you need to...",
    "sources": [
      {
        "filename": "CEC_INTEGRATION_GUIDE.md",
        "filepath": "/home/user/docs/CEC_INTEGRATION_GUIDE.md",
        "heading": "Setup Instructions",
        "chunkIndex": 2,
        "relevanceScore": 0.87,
        "techTags": ["cec", "hardware"]
      }
    ],
    "metadata": {
      "model": "llama3.1:8b",
      "tokensUsed": 234,
      "duration": 1523,
      "chunksRetrieved": 5,
      "contextLength": 2341
    }
  }
}
```

#### Rebuild Vector Database

```bash
POST /api/rag/rebuild
```

#### Get Statistics

```bash
GET /api/rag/stats
```

Response:

```json
{
  "success": true,
  "data": {
    "vectorStore": {
      "totalChunks": 1247,
      "totalDocuments": 156,
      "lastUpdated": 1699123456789,
      "techTags": {
        "cec": 234,
        "api": 189,
        "database": 145
      },
      "fileTypes": {
        "md": 980,
        "pdf": 145,
        "html": 122
      }
    },
    "ollama": {
      "connected": true,
      "url": "http://localhost:11434",
      "llmModel": "llama3.1:8b",
      "embeddingModel": "nomic-embed-text"
    }
  }
}
```

#### List Indexed Documents

```bash
GET /api/rag/docs
```

### Programmatic Usage

```typescript
import { queryDocs } from '@/lib/rag-server';

// Simple query
const result = await queryDocs({
  query: "How do I set up Pulse-Eight CEC adapters?"
});

console.log(result.answer);
console.log(result.sources);

// With tech filtering
const cecResult = await queryDocs({
  query: "Configure matrix switcher",
  tech: "cec",
  topK: 10
});

// Multiple tech tags
const multiResult = await queryDocs({
  query: "API authentication",
  tech: ["api", "authentication"]
});
```

## Configuration

Edit `/src/lib/rag-server/config.ts`:

```typescript
export const RAGConfig = {
  // Document paths
  docsPath: './docs',
  ragDataPath: './rag-data',

  // Chunking strategy
  chunkSize: 750,        // Target tokens per chunk
  chunkOverlap: 100,     // Overlap between chunks

  // Retrieval settings
  topK: 5,               // Number of chunks to retrieve
  minRelevanceScore: 0.3, // Minimum similarity score

  // Ollama configuration
  ollamaUrl: 'http://localhost:11434',
  embeddingModel: 'nomic-embed-text',
  llmModel: 'llama3.1:8b',

  // Token allocation
  maxTokens: {
    simple: 512,
    medium: 1024,
    complex: 2048,
  },

  // File types
  supportedExtensions: ['.md', '.html', '.pdf', '.txt'],

  // Tech tag patterns (auto-detection from paths)
  techTagPatterns: {
    'cec': ['cec', 'hdmi'],
    'api': ['api', 'route', 'endpoint'],
    'database': ['db', 'schema', 'migration'],
    // ... add custom patterns
  }
};
```

## Document Processing

### Supported Formats

1. **Markdown** (`.md`)
   - Preserves code blocks
   - Maintains heading hierarchy
   - Links and formatting preserved

2. **HTML** (`.html`, `.htm`)
   - Converts to Markdown
   - Extracts meaningful content
   - Removes scripts and styles

3. **PDF** (`.pdf`)
   - Text extraction using pdf-parse
   - Best for text-based PDFs
   - May not work well with scanned documents

4. **Plain Text** (`.txt`)
   - Direct processing
   - Simple paragraph splitting

### Chunking Strategy

The system uses intelligent chunking:

1. **Target Size**: 750 tokens (~3000 characters)
2. **Overlap**: 100 tokens for context preservation
3. **Smart Splitting**:
   - Splits at paragraph boundaries
   - Preserves code blocks intact
   - Keeps headings with their content
4. **Metadata Extraction**:
   - Nearest heading context
   - Tech tags from file path
   - File type and location

### Tech Tag Auto-Detection

Tech tags are automatically extracted from:
- Folder names: `/docs/cec/` → `cec` tag
- File names: `API_REFERENCE.md` → `api` tag
- Content patterns: Configurable in `techTagPatterns`

## Performance

### Benchmarks

On a typical system:
- **Document Scanning**: ~100 docs/minute
- **Embedding Generation**: ~50 chunks/minute
- **Query Retrieval**: <200ms (vector search)
- **LLM Response**: 1-3 seconds (depending on complexity)
- **Total Query Time**: 1.5-3.5 seconds

### Optimization Tips

1. **Chunking**:
   - Smaller chunks = more precise but slower
   - Larger chunks = faster but less precise
   - Default 750 tokens is a good balance

2. **TopK**:
   - Higher topK = more context but slower
   - Lower topK = faster but may miss information
   - Default 5 works well for most queries

3. **Model Selection**:
   - Llama 3.1 8B: Good balance of speed and quality
   - Larger models: Better answers but slower
   - Smaller models: Faster but lower quality

## Troubleshooting

### Ollama Not Available

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Models Not Found

```bash
# List installed models
ollama list

# Install required models
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

### Empty Vector Store

```bash
# Check if documents were indexed
npm run rag:scan -- --verbose

# Rebuild from scratch
npm run rag:scan:clear
```

### Poor Answer Quality

1. **Not enough context**: Increase `topK` in config
2. **Wrong tech filter**: Check tech tags are correct
3. **Missing documents**: Ensure docs are in `/docs` folder
4. **Outdated index**: Rebuild with `npm run rag:scan:clear`

### Slow Performance

1. **Too many chunks**: Decrease `topK`
2. **Large chunk size**: Decrease `chunkSize` in config
3. **Heavy model**: Consider lighter Ollama model
4. **Cold start**: First query after restart is slower

## API Integration Examples

### cURL

```bash
# Simple query
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I configure CEC?"}'

# With tech filter
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Setup guide", "tech": "cec", "topK": 10}'

# Get stats
curl http://localhost:3000/api/rag/stats
```

### JavaScript/TypeScript

```typescript
async function askDocs(question: string) {
  const response = await fetch('/api/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: question })
  });

  const data = await response.json();
  return data.data;
}

const result = await askDocs("How do I set up authentication?");
console.log(result.answer);
```

### Python

```python
import requests

def query_docs(question, tech=None):
    response = requests.post(
        'http://localhost:3000/api/rag/query',
        json={'query': question, 'tech': tech}
    )
    return response.json()['data']

result = query_docs("How does rate limiting work?", tech="api")
print(result['answer'])
```

## File Structure

```
/src/lib/rag-server/
├── config.ts           # Configuration and settings
├── doc-processor.ts    # Document scanning and chunking
├── llm-client.ts       # Ollama API client
├── vector-store.ts     # Vector storage and retrieval
├── query-engine.ts     # Main query interface
└── index.ts           # Exports

/scripts/
├── scan-docs.ts       # CLI tool for indexing
└── test-rag.ts        # CLI tool for testing

/src/app/api/rag/
├── query/route.ts     # Query endpoint
├── rebuild/route.ts   # Rebuild endpoint
├── stats/route.ts     # Stats endpoint
└── docs/route.ts      # List documents endpoint

/rag-data/             # Vector store data (gitignored)
└── vector-store.json  # Vector embeddings and metadata
```

## Best Practices

1. **Keep Documentation Updated**:
   ```bash
   # Re-index after doc changes
   npm run rag:scan
   ```

2. **Use Tech Filters**:
   ```typescript
   // More precise results
   queryDocs({ query: "...", tech: "cec" })
   ```

3. **Monitor Stats**:
   ```bash
   curl http://localhost:3000/api/rag/stats
   ```

4. **Optimize Chunk Size**:
   - Too small: Fragmented context
   - Too large: Irrelevant information
   - Default 750 is recommended

5. **Regular Rebuilds**:
   ```bash
   # Monthly or after major doc updates
   npm run rag:scan:clear
   ```

## Contributing

When adding new documentation:

1. Place files in `/docs` directory
2. Use descriptive filenames
3. Organize by technology in subfolders
4. Run `npm run rag:scan` to index
5. Test with relevant queries

## License

Part of the Sports Bar TV Controller project.
