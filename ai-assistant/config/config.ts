
/**
 * Configuration for AI Code Assistant
 */

import { AIAssistantConfig } from './types'
import path from 'path'

export const AI_ASSISTANT_CONFIG: AIAssistantConfig = {
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.AI_MODEL || 'deepseek-coder:6.7b',
  maxTokens: 4096,
  temperature: 0.2, // Lower temperature for more deterministic code generation
  
  riskThresholds: {
    safe: 10,      // Score 10: Auto-apply
    medium: 7,     // Score 7-9: Create PR
    high: 1        // Score 1-6: Require approval
  },
  
  autoApplyThreshold: 10,
  
  backupDir: path.join(process.cwd(), '.ai-assistant', 'backups'),
  enableAutoBackup: true,
  enablePRCreation: true
}

export const RISK_FACTORS = {
  // File type risks
  CONFIG_FILE: { weight: 8, description: 'Configuration file changes' },
  PACKAGE_JSON: { weight: 9, description: 'Package.json modifications' },
  ENV_FILE: { weight: 10, description: 'Environment file changes' },
  
  // Code risks
  API_ROUTE: { weight: 7, description: 'API route modifications' },
  DATABASE_SCHEMA: { weight: 9, description: 'Database schema changes' },
  AUTH_CODE: { weight: 9, description: 'Authentication code changes' },
  
  // Operation risks
  DELETE_FILE: { weight: 8, description: 'File deletion' },
  LARGE_REFACTOR: { weight: 7, description: 'Large refactoring (>100 lines)' },
  MULTIPLE_FILES: { weight: 6, description: 'Multiple file changes' },
  
  // Safe operations
  LINT_FIX: { weight: 10, description: 'Linting fixes' },
  UNUSED_IMPORT: { weight: 10, description: 'Remove unused imports' },
  ADD_COMMENTS: { weight: 10, description: 'Add documentation' },
  TYPE_ANNOTATION: { weight: 10, description: 'Add type annotations' }
}
