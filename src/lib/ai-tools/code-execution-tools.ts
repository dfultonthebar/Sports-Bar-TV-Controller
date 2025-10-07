
/**
 * Code Execution Tools for AI Assistant
 * Provides safe code execution with sandboxing and resource limits
 */

import { ToolDefinition, ToolExecutionContext, ToolExecutionResult, CodeExecutionRequest } from './types';
import { sandboxExecutor } from './security/sandbox';

/**
 * Execute Python code
 */
export const executePythonTool: ToolDefinition = {
  name: 'execute_python',
  description: 'Execute Python code in a sandboxed environment',
  category: 'code_execution',
  securityLevel: 'moderate',
  requiresApproval: true,
  parameters: [
    {
      name: 'code',
      type: 'string',
      description: 'Python code to execute',
      required: true,
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Execution timeout in milliseconds (default: 30000)',
      required: false,
      default: 30000,
    },
    {
      name: 'args',
      type: 'array',
      description: 'Command line arguments to pass to the script',
      required: false,
    },
  ],
};

export async function executePythonHandler(
  params: { code: string; timeout?: number; args?: string[] },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const request: CodeExecutionRequest = {
    language: 'python',
    code: params.code,
    timeout: params.timeout || context.maxExecutionTime,
    args: params.args,
  };

  return await sandboxExecutor.executePython(request);
}

/**
 * Execute JavaScript code
 */
export const executeJavaScriptTool: ToolDefinition = {
  name: 'execute_javascript',
  description: 'Execute JavaScript code in a sandboxed VM',
  category: 'code_execution',
  securityLevel: 'moderate',
  requiresApproval: true,
  parameters: [
    {
      name: 'code',
      type: 'string',
      description: 'JavaScript code to execute',
      required: true,
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Execution timeout in milliseconds (default: 30000)',
      required: false,
      default: 30000,
    },
  ],
};

export async function executeJavaScriptHandler(
  params: { code: string; timeout?: number },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const request: CodeExecutionRequest = {
    language: 'javascript',
    code: params.code,
    timeout: params.timeout || context.maxExecutionTime,
  };

  return await sandboxExecutor.executeJavaScript(request);
}

/**
 * Execute shell command
 */
export const executeShellTool: ToolDefinition = {
  name: 'execute_shell',
  description: 'Execute a shell command with restrictions',
  category: 'code_execution',
  securityLevel: 'dangerous',
  requiresApproval: true,
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: 'Shell command to execute',
      required: true,
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Execution timeout in milliseconds (default: 30000)',
      required: false,
      default: 30000,
    },
  ],
};

export async function executeShellHandler(
  params: { command: string; timeout?: number },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const timeout = params.timeout || context.maxExecutionTime;
  return await sandboxExecutor.executeBash(params.command, timeout);
}

/**
 * Run npm command
 */
export const runNpmCommandTool: ToolDefinition = {
  name: 'run_npm_command',
  description: 'Run an npm command in the project directory',
  category: 'code_execution',
  securityLevel: 'moderate',
  requiresApproval: true,
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: 'npm command to run (e.g., "install", "run build")',
      required: true,
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Execution timeout in milliseconds (default: 60000)',
      required: false,
      default: 60000,
    },
  ],
};

export async function runNpmCommandHandler(
  params: { command: string; timeout?: number },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const fullCommand = `npm ${params.command}`;
  const timeout = params.timeout || 60000;
  return await sandboxExecutor.executeBash(fullCommand, timeout);
}

/**
 * Analyze code
 */
export const analyzeCodeTool: ToolDefinition = {
  name: 'analyze_code',
  description: 'Analyze code for syntax errors, complexity, and potential issues',
  category: 'analysis',
  securityLevel: 'safe',
  parameters: [
    {
      name: 'code',
      type: 'string',
      description: 'Code to analyze',
      required: true,
    },
    {
      name: 'language',
      type: 'string',
      description: 'Programming language',
      required: true,
      enum: ['javascript', 'typescript', 'python', 'bash'],
    },
  ],
};

export async function analyzeCodeHandler(
  params: { code: string; language: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const analysis = {
      language: params.language,
      lineCount: params.code.split('\n').length,
      characterCount: params.code.length,
      issues: [] as string[],
      suggestions: [] as string[],
    };

    // Basic syntax checks
    if (params.language === 'javascript' || params.language === 'typescript') {
      // Check for common issues
      if (params.code.includes('eval(')) {
        analysis.issues.push('Use of eval() is dangerous and should be avoided');
      }
      if (params.code.includes('innerHTML')) {
        analysis.issues.push('Direct innerHTML manipulation can lead to XSS vulnerabilities');
      }
      if (!params.code.includes('use strict')) {
        analysis.suggestions.push('Consider using strict mode');
      }
    }

    if (params.language === 'python') {
      if (params.code.includes('exec(')) {
        analysis.issues.push('Use of exec() is dangerous and should be avoided');
      }
      if (params.code.includes('eval(')) {
        analysis.issues.push('Use of eval() is dangerous and should be avoided');
      }
    }

    return {
      success: true,
      output: analysis,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze code',
      executionTime: Date.now() - startTime,
    };
  }
}
