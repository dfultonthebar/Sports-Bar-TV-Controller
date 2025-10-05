# AI Backend Setup and Usage Guide

## Overview

The Sports Bar Assistant AI backend provides intelligent assistance through a comprehensive knowledge base system that learns from all project documentation and codebase.

## Features

✅ **Knowledge Base System**
- Automatically indexes all documentation (PDF and Markdown)
- Provides context-aware responses
- Searches through 500+ document chunks
- Covers 1.2M+ characters of documentation

✅ **Chatbot Interface**
- Enhanced AI chat with context awareness
- Script generation capabilities
- Feature design assistance
- System troubleshooting

✅ **API Endpoints**
- `/api/ai/enhanced-chat` - Main chat interface with knowledge base
- `/api/ai/knowledge-query` - Direct knowledge base queries
- `/api/ai/rebuild-knowledge-base` - Rebuild knowledge base on demand
- `/api/ai/upload-documents` - Upload new documents to knowledge base

## Quick Start

### 1. Build the Knowledge Base

```bash
npm run build-knowledge-base
```

This will:
- Scan the `docs/` folder for all PDF and Markdown files
- Extract and chunk the content
- Create a searchable knowledge base at `data/ai-knowledge-base.json`

### 2. Verify AI System

```bash
npm run verify-ai
```

This checks:
- Knowledge base is loaded correctly
- All required directories exist
- API routes are available
- Environment configuration

### 3. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start

# With PM2 (production)
pm2 start ecosystem.config.js
```

## Knowledge Base Management

### Automatic Updates

The knowledge base automatically caches for 5 minutes. After that, it reloads from disk to pick up any changes.

### Manual Rebuild

Rebuild the knowledge base after adding new documentation:

```bash
npm run build-knowledge-base
```

Or via API:

```bash
curl -X POST http://localhost:3000/api/ai/rebuild-knowledge-base
```

### Adding New Documentation

1. Add PDF or Markdown files to the `docs/` folder
2. Run `npm run build-knowledge-base`
3. The AI will now have access to the new content

## Using the AI Assistant

### Via Web Interface

Navigate to `/ai-hub` in your browser to access:
- **AI Chat** - Interactive chat with knowledge base
- **Script Generator** - Generate automation scripts
- **Feature Designer** - Design new features
- **System Optimizer** - Get optimization recommendations

### Via API

**Enhanced Chat with Knowledge Base:**

```bash
curl -X POST http://localhost:3000/api/ai/enhanced-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I configure the Atlas audio processor?",
    "useKnowledge": true,
    "useCodebase": true
  }'
```

**Direct Knowledge Query:**

```bash
curl -X POST http://localhost:3000/api/ai/knowledge-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CEC TV control setup",
    "maxResults": 5
  }'
```

## Configuration

### Environment Variables

Create a `.env` file with:

```env
# Ollama Configuration (for local AI)
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI Configuration (optional)
OPENAI_API_KEY=your_api_key_here
```

### Knowledge Base Settings

Edit `scripts/build-knowledge-base.ts` to customize:
- `DOCS_DIR` - Documentation directory path
- `UPLOADS_DIR` - User uploads directory path
- Chunk size (default: 3000 characters)
- File type filters

## Architecture

### Knowledge Base Structure

```json
{
  "documents": [
    {
      "source": "docs/INSTALLATION_GUIDE.md",
      "type": "markdown",
      "content": "...",
      "title": "INSTALLATION_GUIDE",
      "section": "Part 1 of 3"
    }
  ],
  "lastUpdated": "2025-10-05T08:15:50.000Z",
  "stats": {
    "totalDocuments": 502,
    "totalPDFs": 73,
    "totalMarkdown": 107,
    "totalCharacters": 1219705
  }
}
```

### AI Knowledge Flow

1. **User Query** → Enhanced Chat API
2. **Search** → Knowledge Base (docs + codebase)
3. **Context Building** → Relevant documents retrieved
4. **AI Processing** → Ollama/OpenAI with context
5. **Response** → User with citations

## Troubleshooting

### Knowledge Base Not Loading

```bash
# Check if file exists
ls -lh data/ai-knowledge-base.json

# Rebuild if missing
npm run build-knowledge-base

# Verify system
npm run verify-ai
```

### PM2 Won't Start

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs sports-bar-tv-controller

# Restart
pm2 restart sports-bar-tv-controller

# Or delete and restart
pm2 delete sports-bar-tv-controller
pm2 start ecosystem.config.js
```

### AI Not Responding

1. Check Ollama is running: `curl http://localhost:11434/api/tags`
2. Check API routes: `curl http://localhost:3000/api/ai/enhanced-chat`
3. Check logs: `pm2 logs` or `npm run dev`

## Performance

- **Knowledge Base Size**: ~1.4 MB
- **Load Time**: < 100ms (cached)
- **Search Time**: < 50ms for 5 results
- **Memory Usage**: ~50 MB for knowledge base

## Maintenance

### Regular Tasks

1. **Weekly**: Rebuild knowledge base after documentation updates
2. **Monthly**: Review and optimize chunk sizes
3. **Quarterly**: Archive old documentation

### Backup

The knowledge base is automatically backed up with the system:

```bash
# Manual backup
cp data/ai-knowledge-base.json data/ai-knowledge-base.backup.json
```

## Advanced Usage

### Custom Search

```typescript
import { searchKnowledgeBase } from '@/lib/ai-knowledge';

const results = searchKnowledgeBase('Atlas configuration', 10);
console.log(results);
```

### Direct Knowledge Access

```typescript
import { loadKnowledgeBase } from '@/lib/ai-knowledge';

const kb = loadKnowledgeBase();
console.log(`Total documents: ${kb.stats.totalDocuments}`);
```

## Support

For issues or questions:
1. Check this documentation
2. Run `npm run verify-ai` for diagnostics
3. Check `/ai-hub` for system status
4. Review logs with `pm2 logs`

## Version History

- **v1.0** (2025-10-05): Initial AI backend implementation
  - Knowledge base system
  - Enhanced chat interface
  - API endpoints
  - Verification tools
