
/**
 * Tool Execution Logger
 * Logs tool executions, results, and errors for auditing and debugging
 */

import fs from 'fs/promises';
import path from 'path';
import { ToolExecutionContext, ToolExecutionResult } from './types';

interface ToolExecutionLog {
  toolName: string;
  parameters: Record<string, any>;
  context: ToolExecutionContext;
  timestamp: Date;
}

interface ToolResultLog {
  toolName: string;
  result: ToolExecutionResult;
  timestamp: Date;
}

interface ToolErrorLog {
  toolName: string;
  error: Error;
  timestamp: Date;
}

export class ToolLogger {
  private logPath: string;
  private logBuffer: string[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(logPath?: string) {
    this.logPath = logPath || path.join(process.cwd(), 'logs', 'ai-tools.log');
    this.ensureLogDirectory();
    this.startFlushInterval();
  }

  private async ensureLogDirectory() {
    try {
      await fs.mkdir(path.dirname(this.logPath), { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private startFlushInterval() {
    // Flush logs every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000);
  }

  private async flush() {
    if (this.logBuffer.length === 0) return;

    try {
      const logs = this.logBuffer.join('\n') + '\n';
      await fs.appendFile(this.logPath, logs);
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  private addLog(entry: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.logBuffer.push(JSON.stringify(logEntry));
  }

  async logToolExecution(log: ToolExecutionLog) {
    this.addLog({
      type: 'execution',
      toolName: log.toolName,
      parameters: this.sanitizeParameters(log.parameters),
      context: {
        workingDirectory: log.context.workingDirectory,
        userId: log.context.userId,
        sessionId: log.context.sessionId,
      },
    });
  }

  async logToolResult(log: ToolResultLog) {
    this.addLog({
      type: 'result',
      toolName: log.toolName,
      success: log.result.success,
      executionTime: log.result.executionTime,
      hasOutput: !!log.result.output,
      hasError: !!log.result.error,
      warnings: log.result.warnings,
    });
  }

  async logToolError(log: ToolErrorLog) {
    this.addLog({
      type: 'error',
      toolName: log.toolName,
      error: log.error.message,
      stack: log.error.stack,
    });
  }

  private sanitizeParameters(params: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = `${value.substring(0, 100)}... (${value.length} chars)`;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  async getRecentLogs(count: number = 100): Promise<any[]> {
    try {
      const content = await fs.readFile(this.logPath, 'utf8');
      const lines = content.trim().split('\n');
      const recentLines = lines.slice(-count);
      return recentLines.map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async clearLogs() {
    try {
      await fs.writeFile(this.logPath, '');
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// Export singleton instance
export const toolLogger = new ToolLogger();

// Cleanup on process exit
process.on('exit', () => {
  toolLogger.destroy();
});
