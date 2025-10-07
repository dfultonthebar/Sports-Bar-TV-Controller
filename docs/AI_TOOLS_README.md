# AI Chat Tools - Quick Start Guide

## What's New?

The AI assistant now has **file system access** and **code execution** capabilities! This means the AI can:

- 📁 Read, write, and search files in your project
- 💻 Execute Python, JavaScript, and shell commands
- 🔍 Analyze code and provide insights
- 🛠️ Help with real development tasks

All operations are **sandboxed and secure** with multiple layers of protection.

## Installation

### 1. Install Dependencies

```bash
npm install isolated-vm
```

### 2. Configure Security Settings

Review and customize `ai-tools-config.json` for your environment:

```json
{
  "security": {
    "filesystem": {
      "allowedBasePaths": ["./src", "./public"],
      "blockedPaths": ["./node_modules", "./.git"]
    },
    "codeExecution": {
      "allowedLanguages": ["python", "javascript", "bash"],
      "maxExecutionTimeMs": 30000
    }
  }
}
```

### 3. Ensure Ollama is Running

```bash
ollama serve
```

## Usage

### Using the Chat Interface

1. Navigate to the AI chat page
2. Import the new component:

```tsx
import ToolChatInterface from '@/components/ToolChatInterface'

export default function AIPage() {
  return <ToolChatInterface />
}
```

3. Start chatting! The AI will automatically use tools when needed.

### Example Conversations

#### Reading Files
```
You: "What's in the package.json file?"
AI: "Let me read that for you..."
[AI uses read_file tool]
AI: "Here's what I found in package.json..."
```

#### Writing Code
```
You: "Create a utility function to format dates"
AI: "I'll create that file for you..."
[AI uses write_file tool]
AI: "I've created src/lib/utils/date-formatter.ts with the function."
```

#### Running Scripts
```
You: "Calculate the factorial of 10 using Python"
AI: "I'll run a Python script..."
[AI uses execute_python tool]
AI: "The factorial of 10 is 3,628,800"
```

## Available Tools

### File System
- `read_file` - Read file contents
- `write_file` - Create or modify files
- `list_directory` - List directory contents
- `search_files` - Search for files by pattern
- `get_file_info` - Get file metadata

### Code Execution
- `execute_python` - Run Python code
- `execute_javascript` - Run JavaScript code
- `execute_shell` - Run shell commands (limited)
- `run_npm_command` - Run npm commands
- `analyze_code` - Analyze code quality

## Security

### What's Protected?

✅ **File Access**: Only project directories are accessible
✅ **Commands**: Only whitelisted commands can run
✅ **Resources**: Execution time and memory are limited
✅ **Network**: No network access from sandboxed code
✅ **Logging**: All operations are logged for audit

### What to Watch For?

⚠️ **Review Operations**: Always review what the AI plans to do
⚠️ **Check Paths**: Verify file paths before approval
⚠️ **Monitor Logs**: Check `logs/ai-tools.log` regularly

## Configuration

### Environment Variables

```bash
# .env.local
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

### Security Config

Edit `ai-tools-config.json` to customize:

- Allowed/blocked directories
- Command whitelist/blacklist
- Execution limits
- Logging settings

## Troubleshooting

### "Cannot connect to Ollama"
**Solution**: Start Ollama with `ollama serve`

### "Path is outside allowed directories"
**Solution**: Update `allowedBasePaths` in config

### "Command contains blocked operation"
**Solution**: Use an allowed command or update whitelist

### "Execution timeout exceeded"
**Solution**: Increase timeout in config or optimize code

## Testing

### Manual Testing

Try these prompts to test the tools:

1. "List all TypeScript files in the src directory"
2. "Read the contents of package.json"
3. "Create a new file called test.txt with 'Hello World'"
4. "Run a Python script to calculate 2+2"
5. "Analyze the code in src/lib/utils.ts"

### Automated Testing

```bash
npm test -- ai-tools
```

## Best Practices

### For Users

1. ✅ Be specific in your requests
2. ✅ Review AI's planned actions
3. ✅ Start with read-only operations
4. ✅ Test in development first
5. ✅ Report any issues

### For Developers

1. ✅ Keep security config updated
2. ✅ Monitor audit logs
3. ✅ Review tool usage patterns
4. ✅ Test security boundaries
5. ✅ Document custom tools

## Advanced Usage

### Custom Tools

Add your own tools by extending the registry:

```typescript
// src/lib/ai-tools/custom-tools.ts
export const myCustomTool: ToolDefinition = {
  name: 'my_tool',
  description: 'Does something custom',
  category: 'system',
  securityLevel: 'safe',
  parameters: [...]
}

export async function myCustomHandler(params, context) {
  // Implementation
}
```

Register in `src/lib/ai-tools/index.ts`:

```typescript
import { myCustomTool, myCustomHandler } from './custom-tools'

export const toolRegistry: ToolRegistry = {
  ...existingTools,
  my_tool: {
    definition: myCustomTool,
    handler: myCustomHandler,
  },
}
```

## Documentation

- 📖 [Full Documentation](./AI_TOOLS_DOCUMENTATION.md)
- 🔒 [Security Guide](./AI_TOOLS_SECURITY.md)
- 🐛 [Troubleshooting Guide](./AI_TOOLS_DOCUMENTATION.md#troubleshooting)

## Support

Need help?
1. Check the documentation
2. Review logs in `logs/ai-tools.log`
3. Open a GitHub issue
4. Contact the development team

## Changelog

### v1.0.0 (Initial Release)
- ✨ File system tools (read, write, list, search)
- ✨ Code execution tools (Python, JavaScript, shell)
- ✨ Security framework with sandboxing
- ✨ Audit logging
- ✨ Frontend chat interface
- 📚 Comprehensive documentation

## License

Part of the Sports Bar TV Controller project.
