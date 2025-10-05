
# AI-Powered Style Standardization Tools

Quick reference guide for using the AI-powered color scheme standardization tools.

## Quick Start

### 1. Run the Analysis
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
node scripts/ai-style-analyzer.js
```

This will:
- Scan all React components
- Identify styling inconsistencies
- Generate a detailed report
- Show statistics in the console

### 2. Review the Report
The report will be saved in `ai-style-reports/` with a timestamp.

It contains:
- List of files with issues
- Severity ratings (high, medium, low)
- Specific class names to change
- Suggested replacements

### 3. Apply Fixes
```bash
node scripts/ai-style-fixer.js ai-style-reports/style-analysis-[timestamp].json
```

Choose your mode:
- **Interactive**: Review each file before fixing
- **Auto-fix**: Apply all changes automatically
- **Review-only**: Just see what would change

### 4. Test Your Changes
```bash
cd app && yarn dev
```

Visit http://localhost:3000 and verify:
- Pages load correctly
- Text is readable
- Dark theme is consistent
- All components work properly

## Using the Helper Script

For an easier experience:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./scripts/run-style-analysis.sh
```

This provides a menu to:
1. Run analysis
2. Apply fixes
3. View reports
4. Read documentation

## Prerequisites

### Local AI Required
The tools use Ollama for AI-powered analysis.

Check if installed:
```bash
ollama list
```

If not installed:
```bash
./install-local-ai.sh
```

Or manually:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2
```

## Files Created

### Documentation
- `COLOR_SCHEME_STANDARD.md` - Complete style guide
- `AI_STYLE_STANDARDIZATION.md` - Detailed tool documentation
- `README_STYLE_TOOLS.md` - This quick reference

### Scripts
- `scripts/ai-style-analyzer.js` - AI-powered component analyzer
- `scripts/ai-style-fixer.js` - Automated fix applicator
- `scripts/run-style-analysis.sh` - Interactive helper script

### Generated Files
- `ai-style-reports/` - Analysis reports (JSON)
- `ai-style-backups/` - File backups before changes

## Common Patterns Fixed

The tools automatically fix:

### Background Colors
- `bg-white` → `bg-slate-800`
- `bg-gray-100` → `bg-slate-700`
- Light cards → Dark themed cards

### Text Colors
- `text-black` → `text-slate-100`
- `text-gray-900` → `text-slate-100`
- `text-gray-700` → `text-slate-200`
- `text-gray-500` → `text-slate-300`

### Borders
- `border-gray-300` → `border-slate-700`
- Light borders → Dark borders

### Component Styles
- Badge colors to dark theme
- Button hover states
- Input field styling
- Card backgrounds

## Safety Features

### Automatic Backups
Every file is backed up before changes:
```
ai-style-backups/ComponentName.tsx.2025-10-01T03-09-45.bak
```

### Restore from Backup
If something breaks:
```bash
cp ai-style-backups/ComponentName.tsx.[timestamp].bak src/components/ComponentName.tsx
```

### Interactive Mode
Review each change before applying:
- See what will change
- Approve or skip files
- Quit at any time

## Example Workflow

### First Time Setup
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Ensure local AI is installed
./install-local-ai.sh

# Run analysis
node scripts/ai-style-analyzer.js
```

### Review Results
```bash
# Check the summary in console
# Look at the report file:
cat ai-style-reports/style-analysis-[latest].json | jq .statistics
```

### Apply Fixes Carefully
```bash
# Start with interactive mode
node scripts/ai-style-fixer.js ai-style-reports/style-analysis-[latest].json
# Choose option 1 (interactive)
# Review a few files
# If they look good, re-run with auto-fix (option 2)
```

### Test Everything
```bash
cd app && yarn dev
# Test all pages
# Check console for errors
# Verify styling looks good
```

### Commit Changes
```bash
git add .
git commit -m "Applied AI-powered color scheme standardization"
git push
```

## Troubleshooting

### "Ollama not found"
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Or use the script
./install-local-ai.sh
```

### "Model not available"
```bash
ollama pull llama3.2
```

### "No issues found" but styling is wrong
- Check that `COLOR_SCHEME_STANDARD.md` is up to date
- The AI might need more context
- Try a different model (edit `ai-style-analyzer.js`)

### "Fixes broke something"
```bash
# Restore from backup
cd ai-style-backups
ls -lt *.bak | head  # Find recent backup
cp ComponentName.tsx.[timestamp].bak ../src/components/ComponentName.tsx
```

### "Analysis is slow"
- Normal for large codebases
- Each file takes 5-10 seconds
- Run overnight for full analysis
- Or analyze specific directories

## Advanced Usage

### Analyze Specific Directory
Edit `ai-style-analyzer.js`:
```javascript
const CONFIG = {
  srcDir: path.join(__dirname, '../src/app'),  // Only app pages
  // ...
};
```

### Change AI Model
Edit `ai-style-analyzer.js`:
```javascript
const CONFIG = {
  ollamaModel: 'codellama',  // Or 'mistral', etc.
  // ...
};
```

### Customize Style Rules
Edit `COLOR_SCHEME_STANDARD.md` to add:
- New color patterns
- Custom component styles
- Project-specific rules

Then re-run the analyzer.

## Tips

1. **Start small**: Test on a few files first
2. **Use interactive mode**: Review changes before applying
3. **Keep backups**: Don't delete backup files too soon
4. **Test incrementally**: Fix, test, fix more
5. **Update style guide**: Document new patterns you create
6. **Run regularly**: After adding new features
7. **Commit often**: Small commits are easier to debug

## Getting Help

- **Style guide**: `COLOR_SCHEME_STANDARD.md`
- **Full documentation**: `AI_STYLE_STANDARDIZATION.md`
- **Example output**: Check `ai-style-reports/`
- **Backup location**: `ai-style-backups/`

## Next Steps

After standardization:
1. Set up pre-commit hooks to check new code
2. Add style checking to CI/CD pipeline
3. Document custom patterns in style guide
4. Train team on the standard
5. Run periodic audits

---

**Version**: 1.0  
**Last Updated**: October 1, 2025
