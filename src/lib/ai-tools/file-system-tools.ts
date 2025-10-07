
/**
 * File System Tools for AI Assistant
 * Provides safe file system operations with security validation
 */

import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition, ToolExecutionContext, ToolExecutionResult, FileSystemOperation } from './types';
import { securityValidator } from './security/validator';

/**
 * Read file content
 */
export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file from the file system',
  category: 'filesystem',
  securityLevel: 'safe',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to read (relative or absolute)',
      required: true,
    },
    {
      name: 'encoding',
      type: 'string',
      description: 'File encoding (default: utf8)',
      required: false,
      default: 'utf8',
      enum: ['utf8', 'ascii', 'base64', 'hex'],
    },
  ],
};

export async function readFileHandler(
  params: { path: string; encoding?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const operation: FileSystemOperation = {
      operation: 'read',
      path: params.path,
    };

    const validation = securityValidator.validateFileSystemOperation(operation);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const filePath = validation.sanitizedInput.path;
    const encoding = (params.encoding || 'utf8') as BufferEncoding;

    const content = await fs.readFile(filePath, encoding);

    return {
      success: true,
      output: {
        path: filePath,
        content,
        size: Buffer.byteLength(content),
      },
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Write file content
 */
export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file (creates or overwrites)',
  category: 'filesystem',
  securityLevel: 'moderate',
  requiresApproval: true,
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to write',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write to the file',
      required: true,
    },
    {
      name: 'encoding',
      type: 'string',
      description: 'File encoding (default: utf8)',
      required: false,
      default: 'utf8',
    },
  ],
};

export async function writeFileHandler(
  params: { path: string; content: string; encoding?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const operation: FileSystemOperation = {
      operation: 'write',
      path: params.path,
      content: params.content,
    };

    const validation = securityValidator.validateFileSystemOperation(operation);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const contentValidation = securityValidator.sanitizeFileContent(params.content);
    if (!contentValidation.allowed) {
      return {
        success: false,
        error: contentValidation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const filePath = validation.sanitizedInput.path;
    const encoding = (params.encoding || 'utf8') as BufferEncoding;

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    await fs.writeFile(filePath, params.content, encoding);

    return {
      success: true,
      output: {
        path: filePath,
        bytesWritten: Buffer.byteLength(params.content),
      },
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to write file',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * List directory contents
 */
export const listDirectoryTool: ToolDefinition = {
  name: 'list_directory',
  description: 'List files and directories in a given path',
  category: 'filesystem',
  securityLevel: 'safe',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the directory to list',
      required: true,
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'List recursively (default: false)',
      required: false,
      default: false,
    },
  ],
};

export async function listDirectoryHandler(
  params: { path: string; recursive?: boolean },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const operation: FileSystemOperation = {
      operation: 'list',
      path: params.path,
    };

    const validation = securityValidator.validateFileSystemOperation(operation);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const dirPath = validation.sanitizedInput.path;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        return {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
        };
      })
    );

    return {
      success: true,
      output: {
        path: dirPath,
        entries: files,
        count: files.length,
      },
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list directory',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Search for files
 */
export const searchFilesTool: ToolDefinition = {
  name: 'search_files',
  description: 'Search for files by name pattern in a directory',
  category: 'filesystem',
  securityLevel: 'safe',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Directory path to search in',
      required: true,
    },
    {
      name: 'pattern',
      type: 'string',
      description: 'File name pattern to search for (supports wildcards)',
      required: true,
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'Search recursively (default: true)',
      required: false,
      default: true,
    },
  ],
};

export async function searchFilesHandler(
  params: { path: string; pattern: string; recursive?: boolean },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const operation: FileSystemOperation = {
      operation: 'search',
      path: params.path,
    };

    const validation = securityValidator.validateFileSystemOperation(operation);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const dirPath = validation.sanitizedInput.path;
    const pattern = params.pattern.toLowerCase();
    const recursive = params.recursive !== false;

    const results: any[] = [];

    async function searchDir(currentPath: string) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory() && recursive) {
          await searchDir(fullPath);
        } else if (entry.isFile()) {
          const fileName = entry.name.toLowerCase();
          if (fileName.includes(pattern) || matchWildcard(fileName, pattern)) {
            const stats = await fs.stat(fullPath);
            results.push({
              name: entry.name,
              path: fullPath,
              size: stats.size,
              modified: stats.mtime,
            });
          }
        }
      }
    }

    await searchDir(dirPath);

    return {
      success: true,
      output: {
        searchPath: dirPath,
        pattern: params.pattern,
        results,
        count: results.length,
      },
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search files',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Simple wildcard matching
 */
function matchWildcard(str: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(str);
}

/**
 * Get file info
 */
export const getFileInfoTool: ToolDefinition = {
  name: 'get_file_info',
  description: 'Get detailed information about a file or directory',
  category: 'filesystem',
  securityLevel: 'safe',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file or directory',
      required: true,
    },
  ],
};

export async function getFileInfoHandler(
  params: { path: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const operation: FileSystemOperation = {
      operation: 'read',
      path: params.path,
    };

    const validation = securityValidator.validateFileSystemOperation(operation);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const filePath = validation.sanitizedInput.path;
    const stats = await fs.stat(filePath);

    return {
      success: true,
      output: {
        path: filePath,
        name: path.basename(filePath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        permissions: stats.mode.toString(8).slice(-3),
      },
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get file info',
      executionTime: Date.now() - startTime,
    };
  }
}
