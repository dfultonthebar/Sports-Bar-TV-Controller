
/**
 * AI Tool Framework Types
 * Defines interfaces for tool execution, security, and responses
 */

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'filesystem' | 'code_execution' | 'system' | 'analysis';
  parameters: ToolParameter[];
  requiresApproval?: boolean;
  securityLevel: 'safe' | 'moderate' | 'dangerous';
}

export interface ToolExecutionContext {
  workingDirectory: string;
  allowedPaths: string[];
  maxExecutionTime: number;
  maxMemoryMB: number;
  userId?: string;
  sessionId?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
  resourceUsage?: {
    memoryMB: number;
    cpuPercent: number;
  };
  warnings?: string[];
}

export interface SecurityValidation {
  allowed: boolean;
  reason?: string;
  sanitizedInput?: any;
}

export interface FileSystemOperation {
  operation: 'read' | 'write' | 'list' | 'search' | 'delete' | 'move';
  path: string;
  content?: string;
  options?: Record<string, any>;
}

export interface CodeExecutionRequest {
  language: 'python' | 'javascript' | 'bash';
  code: string;
  timeout?: number;
  args?: string[];
  env?: Record<string, string>;
}

export interface ToolCallRequest {
  toolName: string;
  parameters: Record<string, any>;
  context: ToolExecutionContext;
}

export interface ToolRegistry {
  [toolName: string]: {
    definition: ToolDefinition;
    handler: (params: any, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
  };
}
