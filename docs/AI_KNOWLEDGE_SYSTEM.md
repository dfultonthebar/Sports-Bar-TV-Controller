# AI Knowledge System

## Overview

The Sports Bar AI Assistant now includes a powerful knowledge base system that has learned from **all system documentation**. This allows the AI to provide accurate, context-aware assistance for troubleshooting, system understanding, and optimization suggestions.

## Knowledge Base Statistics

- **Total Document Chunks**: 559
- **PDF Documents**: 60 (equipment manuals, configuration guides)
- **Markdown Files**: 65 (system documentation, implementation guides)
- **Total Content**: 1,471,423 characters of technical documentation

## Documentation Included

### Equipment Manuals
- Atlas IED Audio Processor (AZM4/AZM8) Documentation
  - User Manual (ATS006332)
  - Data Sheets
  - 3rd Party Control Guide
  - Atmosphere Signal Processor
- Wolf Pack HDMI Matrix Switcher
- Global Cache iTach IR Control
- DirecTV Control API
- Fire TV Integration

### System Configuration
- Matrix control configuration and setup
- Audio zone management
- TV input/output mapping
- Device discovery and CEC control
- Network configuration

### Implementation Guides
- AI enhancements and device insights
- Sports guide integration
- NFHS streaming setup
- Bartender remote interface
- Smart scheduler system
- Soundtrack integration
- Backup and restore procedures

### Development Documentation
- API reference
- Database schema
- Component architecture
- Styling standards
- GitHub synchronization
- Update procedures

## How It Works

### 1. Document Processing
The system processes all PDFs and Markdown files:
- Extracts text from PDFs using pdf-parse
- Reads and indexes markdown documentation
- Chunks large documents for efficient retrieval
- Maintains metadata (source, title, section)

### 2. Knowledge Search
When you ask a question:
- The system searches for relevant document chunks
- Ranks results by relevance using keyword matching
- Selects the top 5 most relevant sources
- Builds context from the documentation

### 3. AI Response Generation
The AI (Ollama) receives:
- Your question
- Relevant documentation context
- Source citations

This allows the AI to provide:
- Accurate technical information
- Specific configuration details
- Troubleshooting steps based on manuals
- System optimization suggestions

## Using the AI Assistant

### Access
Navigate to: `http://192.168.1.25:3001/ai-assistant`

Or click "AI Assistant" from the main menu.

### Features

#### Knowledge Base Toggle
- **Enabled** (Recommended): Uses documentation for system-specific questions
- **Disabled**: General AI responses without documentation context

#### Question Examples

**Equipment Configuration:**
- "How do I configure the Atlas audio processor for the main bar zone?"
- "What are the IR commands for DirecTV channel control?"
- "Explain the Wolf Pack matrix input/output configuration"

**Troubleshooting:**
- "TV 8 is showing no signal, how do I troubleshoot?"
- "The audio in the pavilion isn't working, what should I check?"
- "DirecTV box on input 5 isn't responding to commands"

**System Understanding:**
- "What devices are connected to the video matrix?"
- "How does the CEC TV power control work?"
- "Explain the bartender remote interface layout"

**Optimization:**
- "How can I improve audio quality in the VIP area?"
- "What are best practices for matrix input management?"
- "Suggest improvements for the sports guide system"

#### Response Features
- **Contextual Answers**: Based on actual system documentation
- **Source Citations**: Shows which documents were referenced
- **Technical Accuracy**: Uses official manuals and guides
- **Real-time**: Powered by local Ollama AI (no cloud dependency)

## Rebuilding the Knowledge Base

### When to Rebuild
- After uploading new equipment manuals
- When documentation is updated
- After system configuration changes
- New features are documented

### How to Rebuild

**From the UI:**
1. Go to AI Assistant page
2. Click the refresh icon next to Knowledge Base stats
3. Wait for rebuild to complete

**From Command Line:**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./build-knowledge-base.sh
```

### Automatic Updates
The knowledge base automatically includes:
- All PDFs in project root and uploads/
- All .md files (excluding node_modules)
- Newly added documentation

## Technical Details

### Architecture

```
┌─────────────────┐
│   User Query    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Knowledge Base  │
│    Search       │
│  (Relevance     │
│   Ranking)      │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Context Builder │
│ (Top 5 sources) │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Ollama AI      │
│  (llama3.2:3b)  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│    Response     │
│ + Citations     │
└─────────────────┘
```

### File Locations

- **Knowledge Base**: `/data/ai-knowledge-base.json`
- **Build Script**: `/scripts/build-knowledge-base.ts`
- **Search Library**: `/src/lib/ai-knowledge.ts`
- **API Endpoints**:
  - `/api/ai/knowledge-query` - KB stats and search
  - `/api/ai/enhanced-chat` - AI chat with knowledge
  - `/api/ai/rebuild-knowledge-base` - Rebuild KB

### Performance

- **Search Speed**: < 100ms for most queries
- **Context Building**: < 50ms
- **AI Response Time**: 2-10 seconds (depends on question complexity)
- **Memory Usage**: ~100MB for knowledge base
- **Cache Duration**: 5 minutes for KB in memory

## Best Practices

### Asking Questions

**Do:**
- Be specific: "Configure Atlas zone 3 for patio"
- Include context: "TV 8 shows no signal when switching to DirecTV"
- Ask about documentation: "What does the Atlas manual say about EQ settings?"

**Don't:**
- Be too vague: "Help with audio"
- Ask non-system questions: "What's the weather?"
- Expect real-time status: "Is TV 8 currently on?" (use remote interface for this)

### Managing Documentation

**Add New Manuals:**
1. Upload PDF to `/uploads/` or project root
2. Rebuild knowledge base
3. AI will now have access to that information

**Update Existing Docs:**
1. Modify .md files as needed
2. Rebuild knowledge base
3. Changes reflected immediately

**Remove Outdated Info:**
1. Delete or archive old PDFs/MD files
2. Rebuild knowledge base
3. AI will no longer reference removed content

## Troubleshooting

### "No relevant documentation found"
- Rebuild the knowledge base
- Check if the topic is covered in uploaded docs
- Try rephrasing your question

### Slow responses
- Check Ollama service status: `systemctl status ollama`
- Verify system resources: `htop`
- Consider using a smaller AI model

### Inaccurate responses
- Enable knowledge base toggle
- Rebuild KB to ensure latest docs are included
- Be more specific in your question

### "Ollama connection error"
- Verify Ollama is running: `systemctl start ollama`
- Check Ollama URL: `http://localhost:11434`
- Review AI configuration in `/ai-config`

## Future Enhancements

### Planned Features
- [ ] Vector embeddings for semantic search
- [ ] Multi-modal support (images from PDFs)
- [ ] Conversation memory/context
- [ ] Export Q&A to documentation
- [ ] Integration with troubleshooting system
- [ ] Automated KB updates on document upload
- [ ] Voice input/output for hands-free use
- [ ] Mobile-optimized interface

### Integration Opportunities
- Link with device monitoring for status-aware responses
- Connect to scheduler for automated suggestions
- Integrate with error logging for proactive help
- Add to bartender interface for quick help

## Support

For issues or questions about the AI Knowledge System:
1. Check this documentation
2. Review log files in `/logs/`
3. Test with simple queries first
4. Verify Ollama service is running
5. Rebuild knowledge base if needed

---

**Version**: 1.0
**Last Updated**: October 1, 2025
**Compatible With**: Ollama, llama3.2:3b (or any compatible model)
