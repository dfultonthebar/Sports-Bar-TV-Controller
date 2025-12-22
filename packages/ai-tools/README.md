# @sports-bar/ai-tools

AI tool framework with security validation and sandboxed execution for the Sports Bar TV Controller.

## Features

- **File System Tools**: Read, write, list, search files with strict path validation
- **Code Execution Tools**: Execute Python, JavaScript, bash with sandboxing and resource limits
- **Security Validation**: Enhanced security validator with command whitelisting
- **Sandboxed Execution**: Isolated VM for JavaScript execution (optional)
- **Logging**: Comprehensive tool execution logging

## Installation

```bash
npm install @sports-bar/ai-tools
```

### Optional Dependencies

For JavaScript sandboxing support:

```bash
npm install isolated-vm
npm rebuild isolated-vm
```

## Usage

```typescript
import { executeTool, createDefaultContext } from '@sports-bar/ai-tools';

// Create execution context
const context = createDefaultContext({
  workingDirectory: '/home/ubuntu/project',
  allowedPaths: ['/home/ubuntu/project'],
  maxExecutionTime: 30000,
  maxMemoryMB: 512,
});

// Execute a tool
const result = await executeTool('read_file', {
  path: '/home/ubuntu/project/README.md'
}, context);

if (result.success) {
  console.log(result.output);
} else {
  console.error(result.error);
}
```

## Security

This package implements strict security controls:

- Path validation and sandboxing for file operations
- Command whitelisting for shell execution
- Resource limits (memory, timeout)
- Network access restrictions
- Dangerous pattern detection

## API

### Tools

- `read_file` - Read file contents
- `write_file` - Write file contents
- `list_directory` - List directory contents
- `search_files` - Search for files by pattern
- `get_file_info` - Get file metadata
- `execute_python` - Execute Python code
- `execute_javascript` - Execute JavaScript code
- `execute_shell` - Execute shell command
- `run_npm_command` - Run NPM command
- `analyze_code` - Analyze code for issues

### Functions

- `executeTool(toolName, parameters, context)` - Execute a tool
- `getAvailableTools()` - Get all available tools
- `getTool(toolName)` - Get tool definition
- `getToolsByCategory(category)` - Get tools by category
- `getToolsBySecurityLevel(level)` - Get tools by security level
- `createDefaultContext(overrides)` - Create execution context

## License

MIT
