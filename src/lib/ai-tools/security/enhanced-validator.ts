
/**
 * OPTIMIZED Enhanced Security Validator
 * Adds stricter command whitelisting and resource limits
 */

import path from 'path';
import { SecurityConfig, loadSecurityConfig } from './config';
import { SecurityValidation, FileSystemOperation, CodeExecutionRequest } from '../types';

export class EnhancedSecurityValidator {
  private config: SecurityConfig;

  // OPTIMIZED: Strict command whitelist
  private readonly SAFE_COMMANDS = new Set([
    'ls', 'cat', 'echo', 'pwd', 'date', 'whoami',
    'grep', 'find', 'wc', 'head', 'tail', 'sort', 'uniq',
    'node', 'python', 'python3', 'npm', 'yarn', 'git',
  ]);

  // OPTIMIZED: Dangerous patterns to block
  private readonly DANGEROUS_PATTERNS = [
    /rm\s+-rf/i,
    />\s*\/dev\//i,
    /mkfs/i,
    /dd\s+if=/i,
    /:\(\)\{.*\}/i, // Fork bomb
    /eval\s*\(/i,
    /exec\s*\(/i,
    /system\s*\(/i,
    /popen\s*\(/i,
    /subprocess\./i,
    /os\.system/i,
    /shell=True/i,
  ];

  constructor(config?: SecurityConfig) {
    this.config = config || loadSecurityConfig();
  }

  /**
   * OPTIMIZED: Validate file system operation with enhanced checks
   */
  validateFileSystemOperation(operation: FileSystemOperation): SecurityValidation {
    const { operation: op, path: filePath } = operation;

    // Resolve to absolute path
    const absolutePath = path.resolve(filePath);

    // Check for path traversal attempts
    if (filePath.includes('..') || filePath.includes('~')) {
      return {
        allowed: false,
        reason: 'Path traversal detected',
      };
    }

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
   * OPTIMIZED: Validate code execution with enhanced security
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

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        return {
          allowed: false,
          reason: `Code contains dangerous pattern: ${pattern.source}`,
        };
      }
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
   * OPTIMIZED: Validate bash command with strict whitelist
   */
  validateBashCommand(command: string): SecurityValidation {
    const commandLower = command.toLowerCase().trim();

    // Extract base command
    const baseCommand = commandLower.split(/[\s;|&]/)[0];

    // OPTIMIZED: Check against strict whitelist
    if (!this.SAFE_COMMANDS.has(baseCommand)) {
      return {
        allowed: false,
        reason: `Command '${baseCommand}' is not in the whitelist of safe commands`,
      };
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `Command contains dangerous pattern`,
        };
      }
    }

    // Check for command chaining
    if (/[;&|]/.test(command)) {
      return {
        allowed: false,
        reason: 'Command chaining is not allowed',
      };
    }

    // Check for redirection
    if (/[<>]/.test(command)) {
      return {
        allowed: false,
        reason: 'I/O redirection is not allowed',
      };
    }

    // Check for command substitution
    if (/\$\(|\`/.test(command)) {
      return {
        allowed: false,
        reason: 'Command substitution is not allowed',
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

  /**
   * OPTIMIZED: Validate resource limits
   */
  validateResourceLimits(request: {
    memoryMB?: number;
    timeout?: number;
  }): SecurityValidation {
    const { memoryMB, timeout } = request;

    if (memoryMB && memoryMB > this.config.codeExecution.maxMemoryMB) {
      return {
        allowed: false,
        reason: `Memory limit ${memoryMB}MB exceeds maximum ${this.config.codeExecution.maxMemoryMB}MB`,
      };
    }

    if (timeout && timeout > this.config.codeExecution.maxExecutionTime) {
      return {
        allowed: false,
        reason: `Timeout ${timeout}ms exceeds maximum ${this.config.codeExecution.maxExecutionTime}ms`,
      };
    }

    return {
      allowed: true,
      sanitizedInput: request,
    };
  }
}

// Export singleton instance
export const enhancedSecurityValidator = new EnhancedSecurityValidator();
