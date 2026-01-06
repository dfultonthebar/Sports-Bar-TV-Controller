# AI Knowledge Base System - User Guide

**Last Updated**: October 6, 2025  
**Status**: ✅ Fully Operational

## Overview

The Sports Bar Assistant now has a fully functional AI knowledge base system that processes and indexes all documentation files (Markdown and PDF) as well as the codebase. This allows the AI to answer questions about the system with accurate, context-aware responses.

## Current Status

✅ **Knowledge Base Built Successfully**
- **Total Chunks**: 75 document chunks
- **Total Files**: 13 files indexed
- **PDF Documents**: 3 files (16 chunks)
- **Markdown Documents**: 3 files (18 chunks)
- **Code Files**: 7 files (41 chunks)
- **Total Characters**: 136,149 characters
- **Last Built**: October 6, 2025

## Quick Start

### Rebuild Knowledge Base

To rebuild the knowledge base after adding new documentation:

```bash
npm run build-knowledge-base
```

This will:
1. Scan the `docs/` folder for all MD and PDF files
2. Process the `src/` folder for code files
3. Create searchable chunks from all content
4. Save the knowledge base to `data/ai-knowledge-base.json`

### Verify AI System

To check if everything is working correctly:

```bash
npm run verify-ai
```

This will verify:
- ✅ Knowledge base file exists and is valid
- ✅ Data directory is present
- ✅ Documentation files are available
- ✅ API routes are configured
- ✅ Library files are in place

## Using the Knowledge Base

### Through the UI

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the AI Hub**:
   - Open your browser to `http://localhost:3000/ai-hub`
   - Use the chat interface to ask questions about the system

3. **The AI will automatically**:
   - Search the knowledge base for relevant information
   - Build context from documentation and code
   - Provide accurate answers based on your documentation

### Through the API

#### Get Knowledge Base Statistics

```bash
curl http://localhost:3000/api/ai/knowledge-query
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalChunks": 75,
    "totalFiles": 13,
    "pdfCount": 16,
    "markdownCount": 18,
    "codeCount": 41,
    "totalCharacters": 136149,
    "buildDate": "2025-10-06T02:33:11.192Z"
  }
}
```

#### Query the Knowledge Base

```bash
curl -X POST http://localhost:3000/api/ai/knowledge-query \
  -H "Content-Type: application/json" \
  -d '{"query": "How does the AI backend work?", "limit": 5}'
```

Response:
```json
{
  "success": true,
  "query": "How does the AI backend work?",
  "results": [...],
  "context": "Relevant documentation:\n\n...",
  "count": 5
}
```

#### Rebuild Knowledge Base via API

```bash
curl -X POST http://localhost:3000/api/ai/rebuild-knowledge-base
```

Response:
```json
{
  "success": true,
  "message": "Knowledge base rebuilt successfully",
  "output": "..."
}
```

## Adding New Documentation

### Step 1: Add Files to docs/ Folder

Simply place your new documentation files in the `docs/` folder:

```bash
# Add a new markdown file
cp my-new-doc.md docs/

# Add a new PDF
cp my-guide.pdf docs/
```

Supported formats:
- ✅ Markdown files (`.md`)
- ✅ PDF files (`.pdf`)

### Step 2: Rebuild the Knowledge Base

```bash
npm run build-knowledge-base
```

### Step 3: Verify (Optional)

```bash
npm run verify-ai
```

### Step 4: Restart the Application

If running in production:
```bash
pm2 restart sports-bar-tv-controller
```

If running in development:
```bash
# Stop the dev server (Ctrl+C) and restart
npm run dev
```

## How It Works

### Document Processing

1. **Chunking**: Documents are split into 2000-character chunks with 200-character overlap
2. **Indexing**: Each chunk is indexed with metadata (filename, path, type, size, date)
3. **Storage**: All chunks are stored in `data/ai-knowledge-base.json`

### Search Algorithm

1. **Query Processing**: User query is split into terms
2. **Relevance Scoring**:
   - Exact phrase match: +100 points
   - Individual term matches: +10 points per occurrence
   - Documentation boost: 1.5x multiplier for MD/PDF files
3. **Ranking**: Results sorted by relevance score
4. **Context Building**: Top results combined into context for AI

### Caching

- Knowledge base is cached in memory for 5 minutes
- Reduces file I/O for better performance
- Automatically refreshes when cache expires

## File Structure

```
Sports-Bar-TV-Controller/
├── docs/                          # Documentation files
│   ├── *.md                       # Markdown documentation
│   └── *.pdf                      # PDF documentation
├── data/                          # Generated data
│   └── ai-knowledge-base.json     # Knowledge base file
├── scripts/                       # Build scripts
│   ├── build-knowledge-base.ts    # KB builder
│   └── verify-ai-system.ts        # Verification tool
├── src/
│   ├── lib/
│   │   └── ai-knowledge.ts        # KB library
│   └── app/api/ai/
│       ├── knowledge-query/       # Query endpoint
│       │   └── route.ts
│       └── rebuild-knowledge-base/ # Rebuild endpoint
│           └── route.ts
└── package.json                   # npm scripts
```

## Troubleshooting

### Knowledge Base Not Found

**Error**: `Knowledge base not found. Please run: npm run build-knowledge-base`

**Solution**:
```bash
npm run build-knowledge-base
```

### Empty Knowledge Base

**Error**: `Knowledge base is empty`

**Solution**:
1. Check that `docs/` folder has files
2. Rebuild: `npm run build-knowledge-base`
3. Verify: `npm run verify-ai`

### PDF Processing Errors

**Error**: `Error reading PDF`

**Solution**:
1. Ensure PDF is not corrupted
2. Check file permissions
3. Try re-downloading the PDF

### API Endpoint Not Found

**Error**: `404 Not Found` when calling API

**Solution**:
1. Ensure Next.js server is running: `npm run dev`
2. Check the correct port (default: 3000)
3. Verify API routes exist in `src/app/api/ai/`

### Out of Memory

**Error**: `JavaScript heap out of memory`

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build-knowledge-base
```

## Performance Tips

1. **Limit Query Results**: Use the `limit` parameter to control result count
2. **Cache Utilization**: Knowledge base is cached for 5 minutes
3. **Chunk Size**: Default 2000 characters balances context and performance
4. **Regular Rebuilds**: Rebuild only when documentation changes

## Maintenance

### Regular Tasks

**Weekly**:
- Review and update documentation
- Rebuild knowledge base if docs changed

**Monthly**:
- Verify AI system health: `npm run verify-ai`
- Check knowledge base statistics
- Review and optimize chunk sizes if needed

**As Needed**:
- Add new documentation files
- Rebuild after major updates
- Clear cache if experiencing issues

### Monitoring

Check knowledge base health:
```bash
# Get current stats
curl http://localhost:3000/api/ai/knowledge-query

# Verify system
npm run verify-ai
```

## Advanced Configuration

### Customize Chunk Size

Edit `scripts/build-knowledge-base.ts`:

```typescript
const CHUNK_SIZE = 2000;      // Characters per chunk
const CHUNK_OVERLAP = 200;    // Overlap between chunks
```

### Customize Cache TTL

Edit `src/lib/ai-knowledge.ts`:

```typescript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
```

### Add Custom File Types

Edit `scripts/build-knowledge-base.ts` to add support for additional file types:

```typescript
} else if (file.endsWith('.txt')) {
  console.log(`Processing Text: ${file}`);
  const text = extractTextFromMarkdown(filePath);
  const fileChunks = chunkText(text, file, filePath, 'markdown');
  chunks.push(...fileChunks);
}
```

## Integration with AI Chat

The knowledge base automatically integrates with:

1. **Enhanced AI Chat** (`src/components/EnhancedAIChat.tsx`)
   - Searches knowledge base for relevant context
   - Includes documentation in AI responses

2. **Troubleshooting Chat** (`src/components/TroubleshootingChat.tsx`)
   - Uses knowledge base for technical support
   - Provides accurate troubleshooting steps

3. **AI Hub** (`src/app/ai-hub/page.tsx`)
   - Central interface for all AI features
   - Direct access to knowledge base queries

## Future Enhancements

Potential improvements:
- [ ] Vector embeddings for semantic search
- [ ] Support for more file types (DOCX, TXT, etc.)
- [ ] Incremental updates (only process changed files)
- [ ] Web scraping for external documentation
- [ ] Multi-language support
- [ ] Knowledge base versioning

## Support

For issues or questions:
1. Run verification: `npm run verify-ai`
2. Check logs in `logs/` directory
3. Review this guide
4. Check API documentation at `/api/ai/*`

## Summary

✅ **Knowledge Base System is Fully Operational**

- 75 document chunks indexed
- 13 files processed (docs + code)
- Fast search with relevance scoring
- Automatic caching for performance
- Easy to rebuild and maintain
- Full API access for integration

The AI can now answer questions about your system using accurate information from your documentation! 🎉
