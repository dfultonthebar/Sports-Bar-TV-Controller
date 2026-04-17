/**
 * File System Tools Bridge
 * Re-exports from @sports-bar/ai-tools package
 *
 * This bridge file maintains backward compatibility with existing imports.
 * The actual implementation is in @sports-bar/ai-tools package.
 */

// Re-export all file system tools from the package
export {
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
} from '@sports-bar/ai-tools';

// Re-export types
export type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  FileSystemOperation,
} from '@sports-bar/ai-tools';
