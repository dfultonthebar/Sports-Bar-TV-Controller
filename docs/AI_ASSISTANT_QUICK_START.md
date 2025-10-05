# AI Assistant Quick Start Guide

## What's New?

Your Sports Bar AI Assistant now has **full access to all system documentation**:

- ✅ **60 PDF Manuals** (Atlas, Wolf Pack, DirecTV, Fire TV, Global Cache)
- ✅ **65 Markdown Guides** (Setup, configuration, troubleshooting)
- ✅ **559 Document Chunks** searchable in real-time
- ✅ **1.4 Million+ Characters** of technical knowledge

## Quick Start

### 1. Access the AI Assistant
```
http://192.168.1.25:3001/ai-assistant
```

Or click "AI Assistant" from the main menu.

### 2. Try These Sample Questions

**Equipment Setup:**
```
"How do I configure Atlas zone 1 for the main bar?"
"What are the connection settings for the Wolf Pack matrix?"
"Show me the IR codes for DirecTV channel control"
```

**Troubleshooting:**
```
"TV 7 has no signal, walk me through troubleshooting"
"The audio processor isn't responding, what should I check?"
"How do I reset the DirecTV box on input 5?"
```

**System Understanding:**
```
"Explain how the bartender remote works"
"What inputs are mapped to which outputs?"
"How does CEC TV power control function?"
```

**Optimization:**
```
"How can I improve audio in the pavilion?"
"Suggest best practices for matrix management"
"What are the recommended EQ settings for the main bar?"
```

## Key Features

### 🧠 Smart Context
The AI searches all documentation and provides context-specific answers with source citations.

### 📚 Source Citations
Every answer shows which documents were referenced, so you can verify the information.

### ⚡ Real-time
Powered by local Ollama AI - no internet required, no cloud dependency.

### 🔄 Auto-Update
Upload new manuals, click rebuild, and the AI instantly learns from them.

## Tips for Best Results

1. **Be Specific**: "Configure Atlas input 1 for microphone" vs "help with audio"
2. **Include Context**: "TV 8 on output 3 shows no signal after switching"
3. **Use Technical Terms**: Reference equipment by model (Atlas AZM8, Wolf Pack 4K)
4. **Enable Knowledge Base**: Keep the documentation toggle ON for system questions

## Rebuilding Knowledge Base

If you add new documentation:

**Option 1 - From UI:**
- Go to AI Assistant page
- Click the refresh icon
- Wait for completion message

**Option 2 - Command Line:**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./build-knowledge-base.sh
```

## What the AI Can Help With

### ✅ Excellent For:
- Equipment configuration from manuals
- Troubleshooting with step-by-step guides
- Understanding system architecture
- Finding specific technical details
- Best practices and optimization
- API and integration questions

### ⚠️ Not Designed For:
- Real-time device status (use remote interface)
- Making configuration changes (use config pages)
- Viewing current TV guide (use sports guide)
- Controlling equipment (use bartender remote)

## Example Conversation

**You:** "How do I set up the Atlas processor for zone 3?"

**AI Response:**
Based on the Atlas AZM8 User Manual (ATS006332) and 3rd Party Control Guide:

For Zone 3 configuration:
1. Access the Atlas web interface at 192.168.1.100
2. Navigate to Zone Configuration
3. Set input routing...
[Full detailed response]

**Sources:**
- ATS006332_Atmosphere_User_Manual_RevE.pdf (Part 2 of 8)
- ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf (Part 1 of 3)

---

## Troubleshooting

**Q: AI says "no relevant documentation found"**
- Rebuild the knowledge base
- Try rephrasing your question
- Check if that topic is in your documentation

**Q: Responses are slow**
- This is normal for complex questions
- Ollama is processing ~3000 characters of context
- Wait 5-10 seconds for detailed responses

**Q: "Ollama connection error"**
- Check Ollama status: `systemctl status ollama`
- Restart if needed: `systemctl restart ollama`
- Verify it's running on port 11434

## Next Steps

1. ✅ Try the sample questions above
2. ✅ Upload any additional equipment manuals
3. ✅ Rebuild KB to include new docs
4. ✅ Bookmark the AI Assistant page
5. ✅ Use it for daily troubleshooting!

---

**Need Help?** Refer to the full documentation in `AI_KNOWLEDGE_SYSTEM.md`
