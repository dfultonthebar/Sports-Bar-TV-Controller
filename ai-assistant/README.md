
# AI Code Assistant - Phase 1

Local AI-powered code assistant for the Sports Bar TV Controller project. Uses Ollama with DeepSeek Coder for intelligent code analysis, cleanup, and improvements.

## Features

### ✅ Phase 1 Complete

1. **Local AI Integration**
   - Ollama with DeepSeek Coder 6.7B model
   - Fully local, no external API calls
   - Fast code analysis and generation

2. **Code Indexing**
   - Automatic codebase scanning
   - Import/export tracking
   - Function and class detection
   - Dependency mapping

3. **Risk Assessment Engine**
   - 1-10 risk scoring system
   - Automatic categorization (safe/medium/high)
   - Smart recommendations:
     - Score 10: Auto-apply
     - Score 7-9: Create PR
     - Score 1-6: Require approval

4. **Code Cleanup Operations**
   - Remove unused imports
   - Fix linting errors
   - Add missing documentation
   - Code formatting improvements

5. **Safety System**
   - Automatic backups before changes
   - Git branch creation
   - PR creation for review
   - Rollback capabilities

6. **Web UI**
   - Dashboard with statistics
   - Pending changes review
   - Change history
   - Approval workflow

## Installation

### Prerequisites

- Node.js 18+ and npm
- Git
- Ollama (installed automatically)

### Setup

1. **Install Ollama and Model** (Already done)
   ```bash
   # Ollama is already installed and running
   # DeepSeek Coder model is already pulled
   ollama list  # Verify installation
   ```

2. **Install Dependencies**
   ```bash
   cd ~/Sports-Bar-TV-Controller
   npm install uuid  # Add missing dependency
   ```

3. **Initialize AI Assistant**
   ```bash
   # The AI assistant is integrated into your existing Next.js app
   # No separate initialization needed
   ```

## Usage

### Starting the System

1. **Ensure Ollama is Running**
   ```bash
   # Check if Ollama is running
   pgrep -f "ollama serve"
   
   # If not running, start it
   nohup ollama serve > /tmp/ollama.log 2>&1 &
   ```

2. **Start the Application**
   ```bash
   cd ~/Sports-Bar-TV-Controller
   npm run dev
   ```

3. **Access AI Assistant**
   - Navigate to: `http://localhost:3000/ai-assistant`
   - View dashboard, pending changes, and history

### Using the AI Assistant

#### Automatic Code Cleanup

```typescript
import { cleanupOperations } from './ai-assistant/core/cleanup/cleanupOperations'

// Scan entire codebase for cleanup opportunities
const operations = await cleanupOperations.scanForCleanup('./src')

// Remove unused imports from a file
const change = await cleanupOperations.removeUnusedImports('./src/file.ts')

// Fix linting errors
const lintFix = await cleanupOperations.fixLintErrors('./src/file.ts')

// Add missing documentation
const docs = await cleanupOperations.addMissingDocs('./src/file.ts')
```

#### Code Analysis

```typescript
import { ollamaService } from './ai-assistant/services/ollamaService'

// Analyze code for issues
const analysis = await ollamaService.analyzeCode(code, filePath)

// Get improvement suggestions
const suggestions = await ollamaService.suggestImprovements(code, context)

// Generate documentation
const docs = await ollamaService.generateDocumentation(code, functionName)

// Explain code
const explanation = await ollamaService.explainCode(code)
```

#### Change Management

```typescript
import { changeManager } from './ai-assistant/services/changeManager'

// Initialize
await changeManager.initialize()

// Propose a change
const { change, assessment } = await changeManager.proposeChange(
  filePath,
  'update',
  'Fix type annotation',
  newContent,
  'deepseek-coder',
  'Adding explicit type to prevent inference errors'
)

// Execute based on risk
await changeManager.executeChange(change.id)

// Manual approval
await changeManager.approveChange(change.id)

// Reject change
await changeManager.rejectChange(change.id, 'Not needed')

// Rollback
await changeManager.rollbackChange(change.id)
```

## Risk Scoring System

### Score 10 (Safe - Auto-apply)
- Lint fixes
- Remove unused imports
- Add comments/documentation
- Type annotations
- Formatting changes

### Score 7-9 (Medium - Create PR)
- Code updates
- Small refactoring
- API route changes
- New file creation

### Score 1-6 (High - Require Approval)
- Configuration file changes
- Database schema changes
- Authentication code
- File deletions
- Large refactoring (>100 lines)
- Multiple file changes

## API Endpoints

### Status
```
GET /api/ai-assistant/status
```
Returns Ollama status and available models

### Changes
```
GET /api/ai-assistant/changes?type=pending|applied|history
POST /api/ai-assistant/changes
```
Manage code changes

### Cleanup
```
POST /api/ai-assistant/cleanup
```
Perform cleanup operations

### Analysis
```
POST /api/ai-assistant/analyze
```
Analyze code with AI

### Statistics
```
GET /api/ai-assistant/statistics
```
Get system statistics

## Configuration

Edit `ai-assistant/config/config.ts`:

```typescript
export const AI_ASSISTANT_CONFIG = {
  ollamaUrl: 'http://localhost:11434',
  model: 'deepseek-coder:6.7b',
  maxTokens: 4096,
  temperature: 0.2,
  
  riskThresholds: {
    safe: 10,
    medium: 7,
    high: 1
  },
  
  autoApplyThreshold: 10,
  backupDir: '.ai-assistant/backups',
  enableAutoBackup: true,
  enablePRCreation: true
}
```

## Safety Features

1. **Automatic Backups**
   - Every change creates a timestamped backup
   - Stored in `.ai-assistant/backups/`
   - Easy rollback capability

2. **Git Integration**
   - Creates feature branches for changes
   - Commits with descriptive messages
   - Pushes to remote for PR creation

3. **PR Workflow**
   - Medium-risk changes create PRs automatically
   - Includes full context and reasoning
   - Links to original change request

4. **Rollback System**
   - One-click rollback from backups
   - Preserves change history
   - Safe recovery from errors

## Troubleshooting

### Ollama Not Running
```bash
# Check status
pgrep -f "ollama serve"

# Start Ollama
nohup ollama serve > /tmp/ollama.log 2>&1 &

# Check logs
tail -f /tmp/ollama.log
```

### Model Not Found
```bash
# List models
ollama list

# Pull DeepSeek Coder
ollama pull deepseek-coder:6.7b
```

### API Errors
```bash
# Check Ollama API
curl http://localhost:11434/api/tags

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "deepseek-coder:6.7b",
  "prompt": "Write a hello world function"
}'
```

## Architecture

```
ai-assistant/
├── config/           # Configuration and types
├── core/            # Core functionality
│   ├── indexer/     # Code indexing
│   ├── risk-engine/ # Risk assessment
│   ├── cleanup/     # Cleanup operations
│   └── safety/      # Safety system
├── services/        # External services
│   ├── ollamaService.ts
│   └── changeManager.ts
├── web/             # Web UI
│   ├── components/  # React components
│   ├── pages/       # Page components
│   └── api/         # API routes
└── utils/           # Utilities
```

## Next Steps (Future Phases)

- [ ] Advanced refactoring capabilities
- [ ] Test generation
- [ ] Code review automation
- [ ] Performance optimization suggestions
- [ ] Security vulnerability scanning
- [ ] Integration with CI/CD
- [ ] Multi-model support
- [ ] Custom rule engine

## Contributing

This is an internal tool for the Sports Bar TV Controller project. For issues or suggestions, contact the development team.

## License

Private - Sports Bar TV Controller Project
