/**
 * OPTIMIZED File System Tools with Enhanced Security
 * Implements strict path validation and resource limits
 */

import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition, ToolExecutionContext, ToolExecutionResult, FileSystemOperation } from './types';
import { enhancedSecurityValidator } from './security/enhanced-validator';

/**
 * Read file content
 */
export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file from the file system with security validation',
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

    // OPTIMIZED: Use enhanced validator
    const validation = enhancedSecurityValidator.validateFileSystemOperation(operation);
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
  description: 'Write content to a file (creates or overwrites) with security validation',
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
    };

    // OPTIMIZED: Validate file operation
    const validation = enhancedSecurityValidator.validateFileSystemOperation(operation);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    // OPTIMIZED: Validate content size
    const contentValidation = enhancedSecurityValidator.sanitizeFileContent(params.content);
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
        size: Buffer.byteLength(params.content),
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
  description: 'List files and subdirectories in a directory with security validation',
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
      description: 'Whether to list recursively',
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
      operation: 'read',
      path: params.path,
    };

    // OPTIMIZED: Validate directory access
    const validation = enhancedSecurityValidator.validateFileSystemOperation(operation);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const dirPath = validation.sanitizedInput.path;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const files = [];
    const directories = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        directories.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
        });

        if (params.recursive) {
          const subResult = await listDirectoryHandler(
            { path: fullPath, recursive: true },
            context
          );
          if (subResult.success && subResult.output) {
            files.push(...(subResult.output.files || []));
            directories.push(...(subResult.output.directories || []));
          }
        }
      } else {
        const stats = await fs.stat(fullPath);
        files.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
          size: stats.size,
          modified: stats.mtime,
        });
      }
    }

    const allEntries = [...files, ...directories];

    return {
      success: true,
      output: {
        path: dirPath,
        files,
        directories,
        entries: allEntries,
        totalFiles: files.length,
        totalDirectories: directories.length,
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
  description: 'Search for files by name pattern in a directory with security validation',
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
      description: 'File name pattern (supports wildcards)',
      required: true,
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'Whether to search recursively',
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
      operation: 'read',
      path: params.path,
    };

    // OPTIMIZED: Validate search path
    const validation = enhancedSecurityValidator.validateFileSystemOperation(operation);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const searchPath = validation.sanitizedInput.path;
    const pattern = new RegExp(
      params.pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
      'i'
    );

    const results: any[] = [];

    async function searchDir(dirPath: string) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && params.recursive) {
          await searchDir(fullPath);
        } else if (entry.isFile() && pattern.test(entry.name)) {
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

    await searchDir(searchPath);

    return {
      success: true,
      output: {
        searchPath,
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
 * Get file information
 */
export const getFileInfoTool: ToolDefinition = {
  name: 'get_file_info',
  description: 'Get detailed information about a file with security validation',
  category: 'filesystem',
  securityLevel: 'safe',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file',
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

    // OPTIMIZED: Validate file access
    const validation = enhancedSecurityValidator.validateFileSystemOperation(operation);
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
        extension: path.extname(filePath),
        type: stats.isFile() ? 'file' : stats.isDirectory() ? 'directory' : 'unknown',
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        permissions: stats.mode.toString(8),
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
