
/**
 * Security Configuration for AI Tools
 * Defines allowed operations, paths, and execution limits
 */

import path from 'path';

export interface SecurityConfig {
  filesystem: {
    allowedBasePaths: string[];
    blockedPaths: string[];
    maxFileSize: number; // in bytes
    allowedExtensions: string[];
    blockedExtensions: string[];
  };
  codeExecution: {
    allowedLanguages: string[];
    maxExecutionTime: number; // in milliseconds
    maxMemoryMB: number;
    allowedCommands: string[];
    blockedCommands: string[];
    allowNetworkAccess: boolean;
  };
  general: {
    enableLogging: boolean;
    logPath: string;
    requireApprovalForDangerous: boolean;
  };
}

// Get the project root directory
const PROJECT_ROOT = process.cwd();

export const defaultSecurityConfig: SecurityConfig = {
  filesystem: {
    // Only allow access within project directory
    allowedBasePaths: [
      PROJECT_ROOT,
      path.join(PROJECT_ROOT, 'src'),
      path.join(PROJECT_ROOT, 'public'),
      path.join(PROJECT_ROOT, 'logs'),
      path.join(PROJECT_ROOT, 'temp'),
    ],
    // Block sensitive directories
    blockedPaths: [
      path.join(PROJECT_ROOT, 'node_modules'),
      path.join(PROJECT_ROOT, '.git'),
      path.join(PROJECT_ROOT, '.env'),
      path.join(PROJECT_ROOT, '.env.local'),
      path.join(PROJECT_ROOT, 'prisma'),
      '/etc',
      '/var',
      '/usr',
      '/bin',
      '/sbin',
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: [
      '.txt', '.md', '.json', '.yaml', '.yml',
      '.js', '.ts', '.jsx', '.tsx',
      '.py', '.sh', '.bash',
      '.css', '.scss', '.html',
      '.log', '.csv'
    ],
    blockedExtensions: [
      '.exe', '.dll', '.so', '.dylib',
      '.bin', '.dat', '.db', '.sqlite'
    ],
  },
  codeExecution: {
    allowedLanguages: ['python', 'javascript', 'bash'],
    maxExecutionTime: 30000, // 30 seconds
    maxMemoryMB: 512,
    // Whitelist of safe commands
    allowedCommands: [
      'ls', 'cat', 'echo', 'pwd', 'date',
      'grep', 'find', 'wc', 'head', 'tail',
      'node', 'python', 'python3',
      'npm', 'yarn', 'git'
    ],
    // Blacklist of dangerous commands
    blockedCommands: [
      'rm', 'rmdir', 'del', 'format',
      'dd', 'mkfs', 'fdisk',
      'shutdown', 'reboot', 'halt',
      'kill', 'killall', 'pkill',
      'chmod', 'chown', 'chgrp',
      'sudo', 'su', 'passwd',
      'curl', 'wget', 'nc', 'netcat',
      'iptables', 'ufw', 'firewall-cmd'
    ],
    allowNetworkAccess: false,
  },
  general: {
    enableLogging: true,
    logPath: path.join(PROJECT_ROOT, 'logs', 'ai-tools.log'),
    requireApprovalForDangerous: true,
  },
};

/**
 * Load security configuration from environment or use defaults
 */
export function loadSecurityConfig(): SecurityConfig {
  // In production, you might load this from a database or config file
  // For now, we use the default configuration
  return defaultSecurityConfig;
}
