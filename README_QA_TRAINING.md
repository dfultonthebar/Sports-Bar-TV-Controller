
# Q&A Training System - Quick Start Guide

## Overview

The Q&A Training System is a new feature that allows you to train the AI assistant with domain-specific knowledge about your Sports Bar TV Control System.

## Quick Start

### 1. Access the Q&A Training Page

Navigate to: `http://localhost:3000/ai-hub/qa-training`

Or click: **AI Hub** → **Q&A Training**

### 2. Generate Q&As Automatically

Click one of the generation buttons:
- **Generate from Repository**: Creates Q&As from README and key documentation
- **Generate from Docs**: Analyzes all Markdown files in the docs/ folder

The system will:
- Process files in the background
- Show real-time progress
- Automatically categorize and store Q&As

### 3. Upload Q&A Documents

Prepare a Q&A file in one of these formats:

**Simple Q:/A: Format** (sample-qa-data.txt):
```
Q: What is the Sports Bar TV Controller?
A: It's an AI-powered management system...

Q: How do I configure a TV?
A: To configure a TV: 1) Go to Matrix Configuration...
```

**JSON Format** (sample-qa-data.json):
```json
[
  {
    "question": "What is the system?",
    "answer": "It's an AI-powered...",
    "category": "system",
    "tags": ["overview"]
  }
]
```

Then:
1. Click **Upload Q&A File**
2. Select your file
3. Wait for processing
4. Review the results

### 4. Manage Q&A Entries

- **Filter**: Use category and source type filters
- **Edit**: Click the edit icon to modify any Q&A
- **Delete**: Remove outdated or incorrect entries
- **View Stats**: See usage statistics and popular Q&As

## Sample Files Included

Two sample files are provided:
- `sample-qa-data.txt` - Q:/A: format with 15 Q&As
- `sample-qa-data.json` - JSON format with 8 Q&As

Upload these to quickly populate your training database!

## How It Helps

Once you've added Q&A pairs, the AI assistant will:
- Use them to answer questions more accurately
- Provide more specific, context-aware responses
- Learn about your unique setup and configuration
- Track which Q&As are most useful

## Database Migration

Before using the Q&A system, run the database migration:

```bash
npx prisma migrate deploy
npx prisma generate
```

This creates the necessary database tables for Q&A storage.

## API Endpoints

- `POST /api/ai/qa-generate` - Start Q&A generation
- `GET /api/ai/qa-generate?jobId=xxx` - Check generation status
- `POST /api/ai/qa-upload` - Upload Q&A file
- `GET /api/ai/qa-entries` - List Q&A entries
- `POST /api/ai/qa-entries` - Create Q&A entry
- `PUT /api/ai/qa-entries` - Update Q&A entry
- `DELETE /api/ai/qa-entries?id=xxx` - Delete Q&A entry

## Requirements

- Ollama running locally (for auto-generation)
- Model: llama3.2:3b (default) or compatible model
- Database: SQLite (already configured)

## Troubleshooting

**Generation not working?**
- Ensure Ollama is running: `ollama serve`
- Check the model is available: `ollama list`
- Verify OLLAMA_BASE_URL in .env.local

**Upload parsing errors?**
- Check file format matches examples
- Ensure proper encoding (UTF-8)
- Try the sample files first

**Q&As not appearing in AI responses?**
- Verify Q&As are marked as active
- Check relevance to your queries
- The AI ranks by relevance score

## Next Steps

1. Upload the sample files to get started
2. Generate Q&As from your documentation
3. Review and edit auto-generated Q&As
4. Add custom Q&As for your specific setup
5. Monitor usage statistics to see what's helpful

For detailed documentation, see: `docs/QA_TRAINING_SYSTEM.md`
