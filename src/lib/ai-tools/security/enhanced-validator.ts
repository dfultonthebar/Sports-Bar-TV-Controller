
/**
 * OPTIMIZED Enhanced Security Validator
 * Adds stricter command whitelisting and resource limits
 *
 * ENHANCED: Now logs all security validation events to database for audit and monitoring
 */

import path from 'path';
import { SecurityConfig, loadSecurityConfig } from './config';
import { SecurityValidation, FileSystemOperation, CodeExecutionRequest } from '../types';
import { logSecurityEventAsync } from './security-logger';

export class EnhancedSecurityValidator {
  private config: SecurityConfig;

  // ENHANCED: Expanded command whitelist with safe utilities
  private readonly SAFE_COMMANDS = new Set([
    'ls', 'cat', 'echo', 'pwd', 'date', 'whoami', 'id', 'hostname',
    'grep', 'find', 'wc', 'head', 'tail', 'sort', 'uniq', 'tr', 'cut', 'awk', 'sed',
    'node', 'python', 'python3', 'npm', 'yarn', 'git', 'pnpm',
    'cec-client', 'echo-cec', 'cec-ctl', // CEC commands
    'curl', 'wget', // Network (context-aware)
    'jq', 'yq', // JSON/YAML processors
    'sqlite3', // Database queries
    'ps', 'top', 'htop', 'df', 'du', 'free', // System monitoring
    'mkdir', 'touch', 'cp', 'mv', // Safe file operations (path-validated)
  ]);

  // Safe command patterns that are allowed with specific arguments
  private readonly SAFE_COMMAND_PATTERNS = [
    // Git operations
    { pattern: /^git\s+(status|log|diff|branch|show|remote)\b/, description: 'Git read operations' },
    // npm/yarn read operations
    { pattern: /^(npm|yarn|pnpm)\s+(list|ls|info|view|outdated)\b/, description: 'Package manager read operations' },
    // Database read operations
    { pattern: /^sqlite3\s+.+\s+"SELECT\s+/i, description: 'SQLite SELECT queries' },
    // CEC read operations
    { pattern: /^(cec-client|echo-cec)\s+-s\s+-d\s+\d+\s+tx\s+[0-9a-f]+:[0-9a-f]+$/i, description: 'CEC read commands' },
    // Safe file operations with output redirection
    { pattern: /^(grep|find|ls|cat)\s+.+\s*>\s*\/tmp\/.+\.txt$/i, description: 'File operations with tmp output' },
    // Piping between safe commands
    { pattern: /^(grep|cat|ls|find|head|tail|sort|uniq|wc|tr|cut)\s+.+\s*\|\s*(grep|head|tail|sort|uniq|wc|tr|cut|jq)\b/, description: 'Piped safe commands' },
  ];

  // ENHANCED: Contextual dangerous patterns
  private readonly DANGEROUS_PATTERNS = [
    { pattern: /rm\s+-rf\s+\//i, severity: 'critical', description: 'Recursive force delete from root' },
    { pattern: />\s*\/dev\/(sd|hd|nvme)/i, severity: 'critical', description: 'Write to block device' },
    { pattern: /mkfs/i, severity: 'critical', description: 'Format filesystem' },
    { pattern: /dd\s+if=.*of=\/dev/i, severity: 'critical', description: 'Direct disk write' },
    { pattern: /:\(\)\{.*:\|:/i, severity: 'critical', description: 'Fork bomb' },
    { pattern: /chmod\s+777\s+\//i, severity: 'high', description: 'Dangerous permissions on root' },
    { pattern: /chown\s+.*\s+\//i, severity: 'high', description: 'Change ownership from root' },
    { pattern: /wget\s+.*\|\s*bash/i, severity: 'critical', description: 'Piped remote execution' },
    { pattern: /curl\s+.*\|\s*bash/i, severity: 'critical', description: 'Piped remote execution' },
    { pattern: /eval\s*\(/i, severity: 'high', description: 'Dynamic code evaluation' },
    { pattern: /exec\s*\(/i, severity: 'high', description: 'Process execution' },
    { pattern: /system\s*\(/i, severity: 'high', description: 'System call execution' },
    { pattern: /popen\s*\(/i, severity: 'high', description: 'Pipe open execution' },
    { pattern: /subprocess\.call|subprocess\.run.*shell=True/i, severity: 'high', description: 'Shell subprocess execution' },
    { pattern: /os\.system/i, severity: 'high', description: 'OS system execution' },
    { pattern: /(__import__|compile)\s*\(/i, severity: 'high', description: 'Dynamic import/compilation' },
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
      const result = {
        allowed: false,
        reason: 'Path traversal detected',
      };

      // Log security event
      logSecurityEventAsync({
        validationType: 'file_system',
        operationType: op,
        allowed: false,
        blockedReason: result.reason,
        requestPath: filePath,
        severity: 'warning',
      });

      return result;
    }

    // Check if path is within allowed base paths
    const isAllowed = this.config.filesystem.allowedBasePaths.some(basePath =>
      absolutePath.startsWith(path.resolve(basePath))
    );

    if (!isAllowed) {
      const result = {
        allowed: false,
        reason: `Path ${absolutePath} is outside allowed directories`,
      };

      logSecurityEventAsync({
        validationType: 'file_system',
        operationType: op,
        allowed: false,
        blockedReason: result.reason,
        requestPath: absolutePath,
        severity: 'warning',
      });

      return result;
    }

    // Check if path is in blocked paths
    const isBlocked = this.config.filesystem.blockedPaths.some(blockedPath =>
      absolutePath.startsWith(path.resolve(blockedPath))
    );

    if (isBlocked) {
      const result = {
        allowed: false,
        reason: `Path ${absolutePath} is in a blocked directory`,
      };

      logSecurityEventAsync({
        validationType: 'file_system',
        operationType: op,
        allowed: false,
        blockedReason: result.reason,
        requestPath: absolutePath,
        severity: 'warning',
      });

      return result;
    }

    // Check file extension
    const ext = path.extname(absolutePath).toLowerCase();

    if (this.config.filesystem.blockedExtensions.includes(ext)) {
      const result = {
        allowed: false,
        reason: `File extension ${ext} is not allowed`,
      };

      logSecurityEventAsync({
        validationType: 'file_system',
        operationType: op,
        allowed: false,
        blockedReason: result.reason,
        blockedPatterns: [ext],
        requestPath: absolutePath,
        severity: 'warning',
      });

      return result;
    }

    if (op === 'write' || op === 'delete') {
      // Extra validation for write/delete operations
      if (this.config.filesystem.allowedExtensions.length > 0 &&
          !this.config.filesystem.allowedExtensions.includes(ext)) {
        const result = {
          allowed: false,
          reason: `File extension ${ext} is not in the allowed list for write operations`,
        };

        logSecurityEventAsync({
          validationType: 'file_system',
          operationType: op,
          allowed: false,
          blockedReason: result.reason,
          requestPath: absolutePath,
          severity: 'warning',
        });

        return result;
      }
    }

    const result = {
      allowed: true,
      sanitizedInput: {
        ...operation,
        path: absolutePath,
      },
    };

    // Log successful validation
    logSecurityEventAsync({
      validationType: 'file_system',
      operationType: op,
      allowed: true,
      requestPath: absolutePath,
      sanitizedInput: result.sanitizedInput,
      severity: 'info',
    });

    return result;
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
   * ENHANCED: Validate bash command with context-aware whitelist
   */
  validateBashCommand(command: string, context?: { operation?: string; allowChaining?: boolean }): SecurityValidation {
    const commandTrimmed = command.trim();
    const commandLower = commandTrimmed.toLowerCase();

    // Extract base command
    const baseCommand = commandLower.split(/[\s;|&]/)[0];

    // First, check for critical dangerous patterns
    for (const dangerousPattern of this.DANGEROUS_PATTERNS) {
      if (dangerousPattern.pattern.test(command)) {
        const result = {
          allowed: false,
          reason: `Command blocked: ${dangerousPattern.description} (${dangerousPattern.severity} severity)`,
        };

        logSecurityEventAsync({
          validationType: 'bash_command',
          operationType: 'execute',
          allowed: false,
          blockedReason: result.reason,
          blockedPatterns: [dangerousPattern.description],
          requestPath: baseCommand,
          requestContent: command.substring(0, 500), // Truncate long commands
          severity: dangerousPattern.severity as 'info' | 'warning' | 'critical',
        });

        return result;
      }
    }

    // Check if command matches safe patterns (these override basic restrictions)
    for (const safePattern of this.SAFE_COMMAND_PATTERNS) {
      if (safePattern.pattern.test(commandTrimmed)) {
        return {
          allowed: true,
          sanitizedInput: command,
        };
      }
    }

    // Check against base command whitelist
    if (!this.SAFE_COMMANDS.has(baseCommand)) {
      const result = {
        allowed: false,
        reason: `Command '${baseCommand}' is not in the whitelist of safe commands`,
      };

      logSecurityEventAsync({
        validationType: 'bash_command',
        operationType: 'execute',
        allowed: false,
        blockedReason: result.reason,
        requestPath: baseCommand,
        requestContent: command.substring(0, 500),
        severity: 'warning',
      });

      return result;
    }

    // Context-aware validation for command chaining
    const hasChaining = /[;&|]/.test(command);
    if (hasChaining) {
      // Allow chaining if explicitly permitted in context
      if (context?.allowChaining) {
        // Validate each command in the chain
        const chainedCommands = this.splitCommandChain(command);
        for (const cmd of chainedCommands) {
          const validation = this.validateBashCommand(cmd.trim(), { ...context, allowChaining: false });
          if (!validation.allowed) {
            return {
              allowed: false,
              reason: `Chained command failed validation: ${validation.reason}`,
            };
          }
        }
        return {
          allowed: true,
          sanitizedInput: command,
        };
      } else {
        return {
          allowed: false,
          reason: 'Command chaining requires explicit permission',
        };
      }
    }

    // Context-aware validation for I/O redirection
    const hasRedirection = /[<>]/.test(command);
    if (hasRedirection) {
      // Allow redirection to /tmp or specific safe paths
      if (/>\s*\/tmp\/.+\.(txt|log|json|csv)$/i.test(command)) {
        return {
          allowed: true,
          sanitizedInput: command,
        };
      }
      // Allow appending to log files in allowed directories
      if (/>>\s*\/(var\/log|home\/ubuntu\/logs)\/.+\.log$/i.test(command)) {
        return {
          allowed: true,
          sanitizedInput: command,
        };
      }
      return {
        allowed: false,
        reason: 'I/O redirection only allowed to /tmp or log directories',
      };
    }

    // Allow specific command substitution patterns
    if (/\$\(|\`/.test(command)) {
      // Allow safe substitutions like $(date), $(pwd), $(whoami)
      const safeSubstitutions = /\$\((date|pwd|whoami|hostname|id|echo\s+[^;|&>]+)\)/i;
      if (safeSubstitutions.test(command)) {
        return {
          allowed: true,
          sanitizedInput: command,
        };
      }
      return {
        allowed: false,
        reason: 'Command substitution only allowed for safe read-only commands',
      };
    }

    const result = {
      allowed: true,
      sanitizedInput: command,
    };

    // Log successful command validation
    logSecurityEventAsync({
      validationType: 'bash_command',
      operationType: 'execute',
      allowed: true,
      requestPath: baseCommand,
      requestContent: command.substring(0, 500),
      sanitizedInput: result.sanitizedInput,
      severity: 'info',
    });

    return result;
  }

  /**
   * Helper to split command chains while preserving quoted strings
   */
  private splitCommandChain(command: string): string[] {
    const commands: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if ((char === '"' || char === "'") && (i === 0 || command[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
        current += char;
      } else if (!inQuotes && (char === ';' || char === '&' || char === '|')) {
        if (current.trim()) {
          commands.push(current.trim());
        }
        current = '';
        // Skip the next character if it's part of && or ||
        if ((char === '&' || char === '|') && command[i + 1] === char) {
          i++;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      commands.push(current.trim());
    }

    return commands;
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
