# Development Workflow

## Standard Feature/Fix Process

When adding new features or fixes, follow this workflow:

### 1. Implement the Change
- Write the code for the feature/fix
- Test thoroughly
- Update any affected documentation

### 2. Update Documentation
- Add/update markdown files in `/docs` folder
- Document new APIs, features, or configuration
- Include troubleshooting steps if applicable

### 3. **Teach the Local AI** ⭐
After implementing any significant feature or fix, update the AI's knowledge:

#### Method 1: Ask Claude Code (Recommended)
When working with Claude Code, simply say:
```
"We just added [feature name]. Can you generate Q&A entries to teach the local AI about it?"
```

Claude will:
- Read the relevant documentation
- Generate high-quality Q&A pairs
- Save them directly to the database
- Takes 1-2 minutes per document

#### Method 2: Use Ollama (Slow)
If you need to run it without Claude Code:
```bash
# Start the QA worker
pm2 start qa-worker

# Create a new job (will process all .md files)
# This takes 8-15 hours but runs automatically
```

### 4. Commit and Push
```bash
git add .
git commit -m "feat: [your feature]"
git push
```

---

## Q&A Training Tips

### What to Document for AI Training:
- ✅ New features and how to use them
- ✅ Configuration options and settings
- ✅ Troubleshooting steps
- ✅ API endpoints and usage
- ✅ Common error messages and fixes
- ✅ Integration with other systems

### Best Practices:
1. **Write clear markdown docs first** - The AI learns from documentation
2. **Include examples** - Helps the AI give better answers
3. **Document edge cases** - Helps with troubleshooting questions
4. **Update existing docs** - Don't just add new files

### Quick Q&A Generation Examples:
```
# After adding DirecTV feature:
"Generate Q&As about the new DirecTV integration from docs/DIRECTV_INTEGRATION.md"

# After fixing audio bug:
"Create Q&As about troubleshooting Atlas audio from docs/ATLAS_TROUBLESHOOTING.md"

# After new API endpoint:
"Generate Q&As for the new API endpoints in docs/API_REFERENCE.md"
```

---

## Current Q&A Stats

**Total Q&As:** 87
**Categories:**
- Technical: 59
- AI Assistant: 6
- DirecTV: 5
- Troubleshooting: 2
- Other: 15

**Last Updated:** 2025-10-29

Run this to check current stats:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT COUNT(*) FROM QAEntry"
```

---

## Why This Matters

The local AI assistant (`http://192.168.1.25:3001/ai-assistant`) uses these Q&As to answer questions. The more we teach it:
- Better troubleshooting guidance
- More accurate configuration help
- Faster problem resolution
- Less time looking through docs

**Remember:** The AI only knows what we teach it!
