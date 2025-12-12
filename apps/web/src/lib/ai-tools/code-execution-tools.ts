
/**
 * OPTIMIZED Code Execution Tools with Enhanced Security
 * Implements strict command whitelisting and resource limits
 */

import { ToolDefinition, ToolExecutionContext, ToolExecutionResult, CodeExecutionRequest } from './types';
import { sandboxExecutor } from './security/sandbox';
import { enhancedSecurityValidator } from './security/enhanced-validator';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Execute Python code
 */
export const executePythonTool: ToolDefinition = {
  name: 'execute_python',
  description: 'Execute Python code in a sandboxed environment with resource limits',
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
      description: 'Execution timeout in milliseconds (default: 30000, max: 30000)',
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
    timeout: Math.min(params.timeout || context.maxExecutionTime, 30000),
    args: params.args,
  };

  // OPTIMIZED: Validate with enhanced security
  const validation = enhancedSecurityValidator.validateCodeExecution(request);
  if (!validation.allowed) {
    return {
      success: false,
      error: `Security validation failed: ${validation.reason}`,
      executionTime: 0,
    };
  }

  return await sandboxExecutor.executePython(validation.sanitizedInput as CodeExecutionRequest);
}

/**
 * Execute JavaScript code
 */
export const executeJavaScriptTool: ToolDefinition = {
  name: 'execute_javascript',
  description: 'Execute JavaScript code in a sandboxed VM with resource limits',
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
      description: 'Execution timeout in milliseconds (default: 30000, max: 30000)',
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
    timeout: Math.min(params.timeout || context.maxExecutionTime, 30000),
  };

  // OPTIMIZED: Validate with enhanced security
  const validation = enhancedSecurityValidator.validateCodeExecution(request);
  if (!validation.allowed) {
    return {
      success: false,
      error: `Security validation failed: ${validation.reason}`,
      executionTime: 0,
    };
  }

  return await sandboxExecutor.executeJavaScript(validation.sanitizedInput as CodeExecutionRequest);
}

/**
 * OPTIMIZED: Execute shell command with strict whitelist
 */
export const executeShellTool: ToolDefinition = {
  name: 'execute_shell',
  description: 'Execute a whitelisted shell command with strict security controls and resource limits',
  category: 'code_execution',
  securityLevel: 'dangerous',
  requiresApproval: true,
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: 'Shell command to execute (must be whitelisted: ls, cat, echo, pwd, date, grep, find, wc, head, tail)',
      required: true,
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Execution timeout in milliseconds (default: 10000, max: 30000)',
      required: false,
      default: 10000,
    },
  ],
};

export async function executeShellHandler(
  params: { command: string; timeout?: number },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    // OPTIMIZED: Strict validation with whitelist
    const validation = enhancedSecurityValidator.validateBashCommand(params.command);
    if (!validation.allowed) {
      return {
        success: false,
        error: `Security validation failed: ${validation.reason}`,
        executionTime: Date.now() - startTime,
      };
    }

    const timeout = Math.min(params.timeout || 10000, 30000);

    // OPTIMIZED: Execute with resource limits
    const { stdout, stderr } = await execAsync(validation.sanitizedInput as string, {
      timeout,
      maxBuffer: 1024 * 1024, // 1MB max output
      env: {
        ...process.env,
        PATH: '/usr/local/bin:/usr/bin:/bin', // Restricted PATH
      },
    });

    return {
      success: true,
      output: stdout.trim() || stderr.trim(),
      executionTime: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Shell command execution failed',
      output: {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
      },
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Run NPM command
 */
export const runNpmCommandTool: ToolDefinition = {
  name: 'run_npm_command',
  description: 'Run an NPM command (install, list, outdated, etc.) with security restrictions',
  category: 'code_execution',
  securityLevel: 'moderate',
  requiresApproval: true,
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: 'NPM command to run (e.g., "list", "outdated", "view <package>")',
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

export async function runNpmCommandHandler(
  params: { command: string; timeout?: number },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    // OPTIMIZED: Whitelist safe NPM commands
    const safeNpmCommands = ['list', 'ls', 'outdated', 'view', 'info', 'search', 'help'];
    const baseCommand = params.command.split(' ')[0];

    if (!safeNpmCommands.includes(baseCommand)) {
      return {
        success: false,
        error: `NPM command '${baseCommand}' is not allowed. Safe commands: ${safeNpmCommands.join(', ')}`,
        executionTime: Date.now() - startTime,
      };
    }

    const timeout = Math.min(params.timeout || 30000, 60000);
    const fullCommand = `npm ${params.command}`;

    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout,
      maxBuffer: 2 * 1024 * 1024, // 2MB max output
      cwd: process.cwd(),
    });

    return {
      success: true,
      output: {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      },
      executionTime: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'NPM command execution failed',
      output: {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
      },
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Analyze code
 */
export const analyzeCodeTool: ToolDefinition = {
  name: 'analyze_code',
  description: 'Analyze code for patterns, complexity, or issues',
  category: 'code_execution',
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
    },
    {
      name: 'analysisType',
      type: 'string',
      description: 'Type of analysis (complexity, security, style)',
      required: false,
      default: 'general',
    },
  ],
};

export async function analyzeCodeHandler(
  params: { code: string; language: string; analysisType?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    // Basic code analysis
    const lines = params.code.split('\n');
    const issues: string[] = [];

    // Check for dangerous patterns
    if (/eval\s*\(/.test(params.code)) {
      issues.push('Use of eval() detected - security risk');
    }
    if (/exec\s*\(/.test(params.code)) {
      issues.push('Use of exec() detected - security risk');
    }
    if (/system\s*\(/.test(params.code)) {
      issues.push('Use of system() detected - security risk');
    }
    if (/subprocess.*shell=True/i.test(params.code)) {
      issues.push('Subprocess with shell=True detected - security risk');
    }

    const analysis = {
      language: params.language,
      lineCount: lines.length,
      characterCount: params.code.length,
      hasComments: /\/\/|\/\*|\#/.test(params.code),
      hasFunctions: /function|def|const.*=>/.test(params.code),
      hasLoops: /for|while|forEach/.test(params.code),
      hasConditionals: /if|else|switch/.test(params.code),
      issues,
    };

    return {
      success: true,
      output: analysis,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Code analysis failed',
      executionTime: Date.now() - startTime,
    };
  }
}
