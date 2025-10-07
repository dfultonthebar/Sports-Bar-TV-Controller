
/**
 * Sandbox Executor for Code Execution
 * Provides isolated execution environment with resource limits
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import ivm from 'isolated-vm';
import { ToolExecutionResult, CodeExecutionRequest } from '../types';
import { securityValidator } from './validator';

const execAsync = promisify(exec);

export class SandboxExecutor {
  /**
   * Execute Python code in a sandboxed environment
   */
  async executePython(request: CodeExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const validation = securityValidator.validateCodeExecution(request);

    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const { code, timeout = 30000, args = [], env = {} } = validation.sanitizedInput;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        pythonProcess.kill();
        resolve({
          success: false,
          error: 'Execution timeout exceeded',
          executionTime: Date.now() - startTime,
        });
      }, timeout);

      let stdout = '';
      let stderr = '';

      const pythonProcess = spawn('python3', ['-c', code, ...args], {
        env: { ...process.env, ...env },
        timeout,
      });

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined,
          executionTime: Date.now() - startTime,
        });
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Execute JavaScript code in a sandboxed VM using isolated-vm
   */
  async executeJavaScript(request: CodeExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const validation = securityValidator.validateCodeExecution(request);

    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    const { code, timeout = 30000 } = validation.sanitizedInput;

    try {
      // Create a new isolate with memory limit
      const isolate = new ivm.Isolate({ memoryLimit: 128 });
      
      // Create a new context within the isolate
      const context = await isolate.createContext();
      
      // Create a jail object for the sandbox
      const jail = context.global;
      
      // Set up console logging
      await jail.set('log', new ivm.Reference((msg: string) => {
        console.log('[Sandbox]', msg);
      }));
      
      // Wrap code to capture result
      const wrappedCode = `
        const console = { log: (...args) => log(args.join(' ')) };
        (function() {
          ${code}
        })();
      `;
      
      // Compile and run the script with timeout
      const script = await isolate.compileScript(wrappedCode);
      const result = await script.run(context, { timeout: timeout });

      // Dispose of the isolate
      isolate.dispose();

      return {
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute bash command with restrictions
   */
  async executeBash(command: string, timeout: number = 30000): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const validation = securityValidator.validateBashCommand(command);

    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
      });

      return {
        success: true,
        output: stdout,
        error: stderr || undefined,
        executionTime: Date.now() - startTime,
        warnings: stderr ? ['Command produced stderr output'] : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }
}

// Export singleton instance
export const sandboxExecutor = new SandboxExecutor();
