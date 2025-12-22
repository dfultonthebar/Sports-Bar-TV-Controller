
/**
 * AI Tools Registry
 * Central registry for all available AI tools
 */

import { ToolRegistry, ToolDefinition, ToolExecutionContext, ToolExecutionResult } from './types';
import {
  readFileTool,
  readFileHandler,
  writeFileTool,
  writeFileHandler,
  listDirectoryTool,
  listDirectoryHandler,
  searchFilesTool,
  searchFilesHandler,
  getFileInfoTool,
  getFileInfoHandler,
} from './file-system-tools';
import {
  executePythonTool,
  executePythonHandler,
  executeJavaScriptTool,
  executeJavaScriptHandler,
  executeShellTool,
  executeShellHandler,
  runNpmCommandTool,
  runNpmCommandHandler,
  analyzeCodeTool,
  analyzeCodeHandler,
} from './code-execution-tools';
import { toolLogger } from './logger';

/**
 * Tool Registry - Maps tool names to their definitions and handlers
 */
export const toolRegistry: ToolRegistry = {
  // File System Tools
  read_file: {
    definition: readFileTool,
    handler: readFileHandler,
  },
  write_file: {
    definition: writeFileTool,
    handler: writeFileHandler,
  },
  list_directory: {
    definition: listDirectoryTool,
    handler: listDirectoryHandler,
  },
  search_files: {
    definition: searchFilesTool,
    handler: searchFilesHandler,
  },
  get_file_info: {
    definition: getFileInfoTool,
    handler: getFileInfoHandler,
  },

  // Code Execution Tools
  execute_python: {
    definition: executePythonTool,
    handler: executePythonHandler,
  },
  execute_javascript: {
    definition: executeJavaScriptTool,
    handler: executeJavaScriptHandler,
  },
  execute_shell: {
    definition: executeShellTool,
    handler: executeShellHandler,
  },
  run_npm_command: {
    definition: runNpmCommandTool,
    handler: runNpmCommandHandler,
  },
  analyze_code: {
    definition: analyzeCodeTool,
    handler: analyzeCodeHandler,
  },
};

/**
 * Get all available tools
 */
export function getAvailableTools(): ToolDefinition[] {
  return Object.values(toolRegistry).map((tool) => tool.definition);
}

/**
 * Get tool by name
 */
export function getTool(toolName: string): ToolDefinition | undefined {
  return toolRegistry[toolName]?.definition;
}

/**
 * Execute a tool
 */
export async function executeTool(
  toolName: string,
  parameters: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool = toolRegistry[toolName];

  if (!tool) {
    return {
      success: false,
      error: `Tool '${toolName}' not found`,
      executionTime: 0,
    };
  }

  // Log tool execution start
  await toolLogger.logToolExecution({
    toolName,
    parameters,
    context,
    timestamp: new Date(),
  });

  try {
    const result = await tool.handler(parameters, context);

    // Log tool execution result
    await toolLogger.logToolResult({
      toolName,
      result,
      timestamp: new Date(),
    });

    return result;
  } catch (error) {
    const errorResult: ToolExecutionResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: 0,
    };

    // Log error
    await toolLogger.logToolError({
      toolName,
      error: error instanceof Error ? error : new Error('Unknown error'),
      timestamp: new Date(),
    });

    return errorResult;
  }
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): ToolDefinition[] {
  return Object.values(toolRegistry)
    .map((tool) => tool.definition)
    .filter((def) => def.category === category);
}

/**
 * Get tools by security level
 */
export function getToolsBySecurityLevel(level: string): ToolDefinition[] {
  return Object.values(toolRegistry)
    .map((tool) => tool.definition)
    .filter((def) => def.securityLevel === level);
}

/**
 * Create default execution context
 */
export function createDefaultContext(overrides?: Partial<ToolExecutionContext>): ToolExecutionContext {
  return {
    workingDirectory: process.cwd(),
    allowedPaths: [process.cwd()],
    maxExecutionTime: 30000,
    maxMemoryMB: 512,
    ...overrides,
  };
}

// Export all tools and utilities
export * from './types';
export * from './file-system-tools';
export * from './code-execution-tools';
export * from './security/config';
export * from './security/validator';
export * from './security/enhanced-validator';
export * from './security/sandbox';
export * from './logger';
export * from './local-ai-analyzer';
