
/**
 * Type definitions for AI Code Assistant
 */

export interface CodeChange {
  id: string
  timestamp: Date
  type: 'create' | 'update' | 'delete' | 'refactor'
  filePath: string
  description: string
  riskScore: number
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  diff?: string
  backupPath?: string
  prUrl?: string
  aiModel: string
  reasoning: string
}

export interface RiskAssessment {
  score: number // 1-10
  category: 'safe' | 'medium' | 'high'
  factors: RiskFactor[]
  recommendation: 'auto-apply' | 'create-pr' | 'require-approval'
}

export interface RiskFactor {
  name: string
  impact: number // 1-10
  description: string
}

export interface CodeIndex {
  filePath: string
  language: string
  imports: string[]
  exports: string[]
  functions: FunctionInfo[]
  classes: ClassInfo[]
  dependencies: string[]
  lastModified: Date
}

export interface FunctionInfo {
  name: string
  lineStart: number
  lineEnd: number
  parameters: string[]
  isExported: boolean
}

export interface ClassInfo {
  name: string
  lineStart: number
  lineEnd: number
  methods: string[]
  isExported: boolean
}

export interface CleanupOperation {
  type: 'remove-unused-import' | 'fix-lint' | 'add-docs' | 'refactor'
  filePath: string
  description: string
  autoApply: boolean
}

export interface AIAssistantConfig {
  ollamaUrl: string
  model: string
  maxTokens: number
  temperature: number
  riskThresholds: {
    safe: number // 10
    medium: number // 7-9
    high: number // 1-6
  }
  autoApplyThreshold: number // 10
  backupDir: string
  enableAutoBackup: boolean
  enablePRCreation: boolean
}
