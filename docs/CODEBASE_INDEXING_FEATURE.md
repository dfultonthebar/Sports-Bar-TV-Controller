# Codebase Indexing Feature

## Overview
This feature enhances the AI Assistant with access to the entire codebase, enabling it to provide accurate, context-aware troubleshooting help by referencing actual code files.

## What's New

### 1. Database Model
- **IndexedFile**: New Prisma model to track indexed source files
- Stores file content, metadata, and change tracking via content hashing
- Supports incremental updates (only re-indexes changed files)

### 2. API Endpoints

#### `/api/ai-assistant/index-codebase`
- **POST**: Indexes the entire codebase
- **GET**: Returns current index statistics

#### `/api/ai-assistant/search-code`
- **POST**: Searches indexed files with relevance scoring

### 3. AI Assistant Page
- New page at `/ai-assistant`
- "Sync Codebase" button to trigger indexing
- Real-time progress display
- Statistics dashboard showing:
  - Total indexed files
  - Total codebase size
  - Files by type breakdown
  - Last sync timestamp

### 4. Enhanced AI Knowledge Base
- New `ai-knowledge-enhanced.ts` library
- Combines documentation and codebase context
- Intelligent search with relevance scoring
- Automatic context building for AI queries

### 5. Updated Chat API
- Enhanced `/api/ai/enhanced-chat` endpoint
- Now uses both documentation and codebase context
- Configurable via `useCodebase` and `useKnowledge` flags

## Files Added/Modified

### New Files
- `src/app/api/ai-assistant/index-codebase/route.ts` - Codebase indexing API
- `src/app/api/ai-assistant/search-code/route.ts` - Code search API
- `src/app/ai-assistant/page.tsx` - AI Assistant UI page
- `src/lib/ai-knowledge-enhanced.ts` - Enhanced knowledge base library
- `docs/codebase-indexing.md` - Detailed documentation
- `prisma/migrations/add_indexed_files.sql` - Database migration

### Modified Files
- `prisma/schema.prisma` - Added IndexedFile model
- `src/app/api/ai/enhanced-chat/route.ts` - Updated to use codebase context

## Setup Instructions

### 1. Apply Database Migration
```bash
npx prisma db push
# or
npx prisma migrate dev --name add_indexed_files
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Index the Codebase
1. Navigate to `/ai-assistant` in your browser
2. Click "Sync Codebase" button
3. Wait for indexing to complete (30-60 seconds for initial sync)

## Usage

### Asking Questions
Once indexed, you can ask the AI questions like:
- "How does the Matrix configuration work?"
- "Show me the audio processor control implementation"
- "Where is the CEC power control logic?"
- "How do I add a new API route?"
- "Explain the Prisma schema structure"

The AI will search both documentation and codebase to provide comprehensive answers with file references.

### Re-syncing
- Click "Sync Codebase" anytime to update the index
- Only changed files are re-indexed (fast incremental updates)
- Deleted files are automatically marked as inactive

## Technical Details

### Supported File Types
- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`
- JSON: `.json`
- Markdown: `.md`
- Prisma: `.prisma`

### Excluded Directories
- `node_modules`
- `.next`
- `.git`
- `build`
- `dist`
- `out`
- `coverage`
- `public`
- `prisma/data`

### Performance
- Files > 1MB are skipped
- Content hashing prevents unnecessary re-indexing
- Relevance scoring prioritizes file names and paths
- Context truncation prevents token limit issues

## Benefits

1. **Accurate Troubleshooting**: AI can reference actual code when helping
2. **Faster Development**: Get instant answers about your codebase
3. **Better Context**: AI understands your specific implementation
4. **Always Up-to-Date**: Easy re-sync keeps index current
5. **Intelligent Search**: Finds relevant files based on your questions

## Future Enhancements
- Automatic background syncing
- Webhook-based updates on file changes
- Vector embeddings for semantic search
- Support for more file types
- Configurable exclusion patterns
- File content preview in search results

## Troubleshooting

### Indexing Fails
- Check file permissions
- Ensure database is accessible
- Review logs for specific errors

### AI Not Using Codebase
- Verify files are indexed (check stats)
- Try re-syncing
- Ensure `useCodebase: true` in API calls

### Missing Files
- Check if in excluded directories
- Verify file extension is supported
- Check if file exceeds 1MB limit
