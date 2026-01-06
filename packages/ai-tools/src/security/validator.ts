
/**
 * Security Validator for AI Tools
 * Validates and sanitizes tool inputs before execution
 */

import path from 'path';
import { SecurityConfig, loadSecurityConfig } from './config';
import { SecurityValidation, FileSystemOperation, CodeExecutionRequest } from '../types';

export class SecurityValidator {
  private config: SecurityConfig;

  constructor(config?: SecurityConfig) {
    this.config = config || loadSecurityConfig();
  }

  /**
   * Validate file system operation
   */
  validateFileSystemOperation(operation: FileSystemOperation): SecurityValidation {
    const { operation: op, path: filePath } = operation;

    // Resolve to absolute path
    const absolutePath = path.resolve(filePath);

    // Check if path is within allowed base paths
    const isAllowed = this.config.filesystem.allowedBasePaths.some(basePath =>
      absolutePath.startsWith(path.resolve(basePath))
    );

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Path ${absolutePath} is outside allowed directories`,
      };
    }

    // Check if path is in blocked paths
    const isBlocked = this.config.filesystem.blockedPaths.some(blockedPath =>
      absolutePath.startsWith(path.resolve(blockedPath))
    );

    if (isBlocked) {
      return {
        allowed: false,
        reason: `Path ${absolutePath} is in a blocked directory`,
      };
    }

    // Check file extension
    const ext = path.extname(absolutePath).toLowerCase();

    if (this.config.filesystem.blockedExtensions.includes(ext)) {
      return {
        allowed: false,
        reason: `File extension ${ext} is not allowed`,
      };
    }

    if (op === 'write' || op === 'delete') {
      // Extra validation for write/delete operations
      if (this.config.filesystem.allowedExtensions.length > 0 &&
          !this.config.filesystem.allowedExtensions.includes(ext)) {
        return {
          allowed: false,
          reason: `File extension ${ext} is not in the allowed list for write operations`,
        };
      }
    }

    return {
      allowed: true,
      sanitizedInput: {
        ...operation,
        path: absolutePath,
      },
    };
  }

  /**
   * Validate code execution request
   */
  validateCodeExecution(request: CodeExecutionRequest): SecurityValidation {
    const { language, code, timeout } = request;

    // Check if language is allowed
    if (!this.config.codeExecution.allowedLanguages.includes(language)) {
      return {
        allowed: false,
        reason: `Language ${language} is not allowed`,
      };
    }

    // Check for blocked commands in code
    const codeLines = code.toLowerCase().split('\n');
    for (const blockedCmd of this.config.codeExecution.blockedCommands) {
      if (codeLines.some(line => line.includes(blockedCmd))) {
        return {
          allowed: false,
          reason: `Code contains blocked command: ${blockedCmd}`,
        };
      }
    }

    // Validate timeout
    const maxTimeout = this.config.codeExecution.maxExecutionTime;
    const sanitizedTimeout = timeout && timeout <= maxTimeout ? timeout : maxTimeout;

    // Check for network access attempts if not allowed
    if (!this.config.codeExecution.allowNetworkAccess) {
      const networkPatterns = [
        'fetch(', 'axios', 'http.get', 'http.post',
        'urllib', 'requests.', 'socket.',
        'curl ', 'wget '
      ];

      for (const pattern of networkPatterns) {
        if (code.toLowerCase().includes(pattern)) {
          return {
            allowed: false,
            reason: 'Network access is not allowed in code execution',
          };
        }
      }
    }

    return {
      allowed: true,
      sanitizedInput: {
        ...request,
        timeout: sanitizedTimeout,
      },
    };
  }

  /**
   * Validate bash command
   */
  validateBashCommand(command: string): SecurityValidation {
    const commandLower = command.toLowerCase().trim();

    // Check for dangerous patterns first (chaining, piping, etc.)
    const dangerousPatterns = [
      '&&', '||', ';', '|', '>', '>>', '<',
      '$(', '`', 'eval', 'exec'
    ];

    for (const pattern of dangerousPatterns) {
      if (commandLower.includes(pattern)) {
        return {
          allowed: false,
          reason: `Command contains dangerous pattern: ${pattern}`,
        };
      }
    }

    // Then check for blocked commands
    for (const blockedCmd of this.config.codeExecution.blockedCommands) {
      if (commandLower.includes(blockedCmd)) {
        return {
          allowed: false,
          reason: `Command contains blocked operation: ${blockedCmd}`,
        };
      }
    }

    // Extract base command
    const baseCommand = commandLower.split(' ')[0];

    // Check if base command is in allowed list
    if (this.config.codeExecution.allowedCommands.length > 0 &&
        !this.config.codeExecution.allowedCommands.includes(baseCommand)) {
      return {
        allowed: false,
        reason: `Command ${baseCommand} is not in the allowed list`,
      };
    }

    return {
      allowed: true,
      sanitizedInput: command,
    };
  }

  /**
   * Sanitize file content for safe writing
   */
  sanitizeFileContent(content: string, maxSize?: number): SecurityValidation {
    const size = Buffer.byteLength(content, 'utf8');
    const maxAllowed = maxSize || this.config.filesystem.maxFileSize;

    if (size > maxAllowed) {
      return {
        allowed: false,
        reason: `Content size (${size} bytes) exceeds maximum allowed (${maxAllowed} bytes)`,
      };
    }

    return {
      allowed: true,
      sanitizedInput: content,
    };
  }
}

// Export singleton instance
export const securityValidator = new SecurityValidator();
