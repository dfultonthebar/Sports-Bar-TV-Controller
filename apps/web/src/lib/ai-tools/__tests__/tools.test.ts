
/**
 * Tool Execution Tests
 * Tests tool functionality and integration
 */

import { executeTool, createDefaultContext } from '../index';
import fs from 'fs/promises';
import path from 'path';

describe('Tool Execution', () => {
  const testDir = path.join(process.cwd(), 'temp', 'test');
  const context = createDefaultContext({
    workingDirectory: testDir,
  });

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('File System Tools', () => {
    test('write_file should create a file', async () => {
      const result = await executeTool(
        'write_file',
        {
          path: path.join(testDir, 'test.txt'),
          content: 'Hello World',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output.bytesWritten).toBeGreaterThan(0);

      // Verify file was created
      const content = await fs.readFile(
        path.join(testDir, 'test.txt'),
        'utf8'
      );
      expect(content).toBe('Hello World');
    });

    test('read_file should read file content', async () => {
      // Create a test file
      const testFile = path.join(testDir, 'read-test.txt');
      await fs.writeFile(testFile, 'Test Content');

      const result = await executeTool(
        'read_file',
        { path: testFile },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output.content).toBe('Test Content');
    });

    test('list_directory should list files', async () => {
      // Create some test files
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');

      const result = await executeTool(
        'list_directory',
        { path: testDir },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output.entries.length).toBeGreaterThanOrEqual(2);
    });

    test('search_files should find matching files', async () => {
      // Create test files
      await fs.writeFile(path.join(testDir, 'search-test.txt'), 'content');
      await fs.writeFile(path.join(testDir, 'other.txt'), 'content');

      const result = await executeTool(
        'search_files',
        {
          path: testDir,
          pattern: 'search',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output.results.length).toBeGreaterThan(0);
      expect(result.output.results[0].name).toContain('search');
    });

    test('get_file_info should return file metadata', async () => {
      const testFile = path.join(testDir, 'info-test.txt');
      await fs.writeFile(testFile, 'content');

      const result = await executeTool(
        'get_file_info',
        { path: testFile },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output.type).toBe('file');
      expect(result.output.size).toBeGreaterThan(0);
    });
  });

  describe('Code Execution Tools', () => {
    test('execute_python should run Python code', async () => {
      const result = await executeTool(
        'execute_python',
        {
          code: 'print("Hello from Python")',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from Python');
    });

    test.skip('execute_javascript should run JS code (SKIPPED - requires isolated-vm)', async () => {
      const result = await executeTool(
        'execute_javascript',
        {
          code: '2 + 2',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe(4);
    });

    test('execute_shell should run safe commands', async () => {
      const result = await executeTool(
        'execute_shell',
        {
          command: 'echo "Hello Shell"',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello Shell');
    });

    test('analyze_code should detect issues', async () => {
      const result = await executeTool(
        'analyze_code',
        {
          code: 'eval("dangerous code")',
          language: 'javascript',
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output.issues.length).toBeGreaterThan(0);
      expect(result.output.issues[0]).toContain('eval');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent tool', async () => {
      const result = await executeTool(
        'non_existent_tool',
        {},
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should handle invalid parameters', async () => {
      const result = await executeTool(
        'read_file',
        { path: '/invalid/path/that/does/not/exist' },
        context
      );

      expect(result.success).toBe(false);
    });

    test('should handle execution timeout', async () => {
      const result = await executeTool(
        'execute_python',
        {
          code: 'import time; time.sleep(100)',
          timeout: 1000,
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
});
