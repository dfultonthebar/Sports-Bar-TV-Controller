
/**
 * Risk Assessment Engine - Evaluates risk of code changes
 */

import path from 'path'
import { RiskAssessment, RiskFactor, CodeChange } from '../../config/types'
import { RISK_FACTORS } from '../../config/config'
import { logger } from '../../utils/logger'

export class RiskAssessor {
  /**
   * Assess risk of a code change
   */
  assessRisk(change: CodeChange): RiskAssessment {
    logger.info('Assessing risk for change', { changeId: change.id, filePath: change.filePath })
    
    const factors: RiskFactor[] = []
    let totalScore = 10 // Start with maximum safety score
    
    // Analyze file type
    const fileTypeFactors = this.analyzeFileType(change.filePath)
    factors.push(...fileTypeFactors)
    
    // Analyze change type
    const changeTypeFactors = this.analyzeChangeType(change)
    factors.push(...changeTypeFactors)
    
    // Analyze change size
    const sizeFactors = this.analyzeChangeSize(change)
    factors.push(...sizeFactors)
    
    // Calculate final score (minimum of all factor scores)
    if (factors.length > 0) {
      totalScore = Math.min(...factors.map(f => f.impact))
    }
    
    // Determine category and recommendation
    const category = this.categorizeRisk(totalScore)
    const recommendation = this.getRecommendation(totalScore)
    
    logger.info('Risk assessment complete', { 
      changeId: change.id, 
      score: totalScore, 
      category, 
      recommendation 
    })
    
    return {
      score: totalScore,
      category,
      factors,
      recommendation
    }
  }
  
  /**
   * Analyze risk based on file type
   */
  private analyzeFileType(filePath: string): RiskFactor[] {
    const factors: RiskFactor[] = []
    const fileName = path.basename(filePath)
    const dirName = path.dirname(filePath)
    
    // Configuration files
    if (fileName === 'package.json') {
      factors.push({
        name: 'Package Configuration',
        impact: RISK_FACTORS.PACKAGE_JSON.weight,
        description: RISK_FACTORS.PACKAGE_JSON.description
      })
    }
    
    if (fileName.includes('.env') || fileName.includes('.config')) {
      factors.push({
        name: 'Configuration File',
        impact: RISK_FACTORS.CONFIG_FILE.weight,
        description: RISK_FACTORS.CONFIG_FILE.description
      })
    }
    
    // API routes
    if (dirName.includes('/api/') || dirName.includes('/routes/')) {
      factors.push({
        name: 'API Route',
        impact: RISK_FACTORS.API_ROUTE.weight,
        description: RISK_FACTORS.API_ROUTE.description
      })
    }
    
    // Database files
    if (filePath.includes('schema') || filePath.includes('migration')) {
      factors.push({
        name: 'Database Schema',
        impact: RISK_FACTORS.DATABASE_SCHEMA.weight,
        description: RISK_FACTORS.DATABASE_SCHEMA.description
      })
    }
    
    // Authentication files
    if (filePath.includes('auth') || filePath.includes('login')) {
      factors.push({
        name: 'Authentication Code',
        impact: RISK_FACTORS.AUTH_CODE.weight,
        description: RISK_FACTORS.AUTH_CODE.description
      })
    }
    
    return factors
  }
  
  /**
   * Analyze risk based on change type
   */
  private analyzeChangeType(change: CodeChange): RiskFactor[] {
    const factors: RiskFactor[] = []
    
    switch (change.type) {
      case 'delete':
        factors.push({
          name: 'File Deletion',
          impact: RISK_FACTORS.DELETE_FILE.weight,
          description: RISK_FACTORS.DELETE_FILE.description
        })
        break
        
      case 'refactor':
        factors.push({
          name: 'Code Refactoring',
          impact: RISK_FACTORS.LARGE_REFACTOR.weight,
          description: RISK_FACTORS.LARGE_REFACTOR.description
        })
        break
        
      case 'create':
        // New files are generally safer
        factors.push({
          name: 'New File Creation',
          impact: 9,
          description: 'Creating new file (low risk)'
        })
        break
        
      case 'update':
        // Check if it's a safe update type
        if (this.isSafeUpdate(change)) {
          factors.push({
            name: 'Safe Update',
            impact: 10,
            description: 'Low-risk code improvement'
          })
        } else {
          factors.push({
            name: 'Code Update',
            impact: 8,
            description: 'Modifying existing code'
          })
        }
        break
    }
    
    return factors
  }
  
  /**
   * Check if update is a safe operation
   */
  private isSafeUpdate(change: CodeChange): boolean {
    const safePatterns = [
      'lint fix',
      'remove unused',
      'add comment',
      'add documentation',
      'type annotation',
      'formatting'
    ]
    
    const description = change.description.toLowerCase()
    return safePatterns.some(pattern => description.includes(pattern))
  }
  
  /**
   * Analyze risk based on change size
   */
  private analyzeChangeSize(change: CodeChange): RiskFactor[] {
    const factors: RiskFactor[] = []
    
    if (change.diff) {
      const lines = change.diff.split('\n')
      const changedLines = lines.filter(l => l.startsWith('+') || l.startsWith('-')).length
      
      if (changedLines > 100) {
        factors.push({
          name: 'Large Change',
          impact: RISK_FACTORS.LARGE_REFACTOR.weight,
          description: `Large change affecting ${changedLines} lines`
        })
      } else if (changedLines > 50) {
        factors.push({
          name: 'Medium Change',
          impact: 8,
          description: `Medium change affecting ${changedLines} lines`
        })
      } else {
        factors.push({
          name: 'Small Change',
          impact: 9,
          description: `Small change affecting ${changedLines} lines`
        })
      }
    }
    
    return factors
  }
  
  /**
   * Categorize risk level
   */
  private categorizeRisk(score: number): 'safe' | 'medium' | 'high' {
    if (score === 10) return 'safe'
    if (score >= 7) return 'medium'
    return 'high'
  }
  
  /**
   * Get recommendation based on risk score
   */
  private getRecommendation(score: number): 'auto-apply' | 'create-pr' | 'require-approval' {
    if (score === 10) return 'auto-apply'
    if (score >= 7) return 'create-pr'
    return 'require-approval'
  }
  
  /**
   * Batch assess multiple changes
   */
  assessMultipleChanges(changes: CodeChange[]): Map<string, RiskAssessment> {
    const assessments = new Map<string, RiskAssessment>()
    
    for (const change of changes) {
      const assessment = this.assessRisk(change)
      assessments.set(change.id, assessment)
    }
    
    // If multiple files are being changed, increase risk
    if (changes.length > 3) {
      logger.warn('Multiple file changes detected', { count: changes.length })
      for (const [id, assessment] of assessments) {
        if (assessment.score > 6) {
          assessment.score = Math.max(6, assessment.score - 1)
          assessment.factors.push({
            name: 'Multiple Files',
            impact: RISK_FACTORS.MULTIPLE_FILES.weight,
            description: RISK_FACTORS.MULTIPLE_FILES.description
          })
        }
      }
    }
    
    return assessments
  }
}

export const riskAssessor = new RiskAssessor()
