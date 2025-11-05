
/**
 * Change Manager - Orchestrates code changes with safety and approval workflows
 */

import fs from 'fs/promises'
import { CodeChange, RiskAssessment } from '../config/types'
import { riskAssessor } from '../core/risk-engine/riskAssessor'
import { safetySystem } from '../core/safety/safetySystem'
import { logger } from '../utils/logger'
import { v4 as uuidv4 } from 'uuid'

export class ChangeManager {
  private pendingChanges: Map<string, CodeChange> = new Map()
  private appliedChanges: Map<string, CodeChange> = new Map()
  private changeHistory: CodeChange[] = []
  
  /**
   * Initialize change manager
   */
  async initialize(): Promise<void> {
    await safetySystem.initialize()
    logger.info('Change manager initialized')
  }
  
  /**
   * Propose a new code change
   */
  async proposeChange(
    filePath: string,
    type: CodeChange['type'],
    description: string,
    newContent: string,
    aiModel: string,
    reasoning: string
  ): Promise<{ change: CodeChange; assessment: RiskAssessment }> {
    try {
      // Read current content
      const currentContent = await fs.readFile(filePath, 'utf-8')
      
      // Create change object
      const change: CodeChange = {
        id: uuidv4(),
        timestamp: new Date(),
        type,
        filePath,
        description,
        riskScore: 0, // Will be set by risk assessment
        status: 'pending',
        diff: this.generateDiff(currentContent, newContent),
        aiModel,
        reasoning
      }
      
      // Assess risk
      const assessment = riskAssessor.assessRisk(change)
      change.riskScore = assessment.score
      
      // Store as pending
      this.pendingChanges.set(change.id, change)
      
      logger.info('Change proposed', {
        changeId: change.id,
        filePath,
        riskScore: assessment.score,
        recommendation: assessment.recommendation
      })
      
      return { change, assessment }
      
    } catch (error) {
      logger.error('Failed to propose change', { filePath, error })
      throw error
    }
  }
  
  /**
   * Execute a change based on risk assessment
   */
  async executeChange(changeId: string): Promise<void> {
    const change = this.pendingChanges.get(changeId)
    if (!change) {
      throw new Error(`Change not found: ${changeId}`)
    }
    
    const assessment = riskAssessor.assessRisk(change)
    
    try {
      switch (assessment.recommendation) {
        case 'auto-apply':
          await this.autoApplyChange(change)
          break
          
        case 'create-pr':
          await this.createPRForChange(change)
          break
          
        case 'require-approval':
          logger.info('Change requires manual approval', { changeId })
          // Keep in pending state for manual approval
          break
      }
    } catch (error) {
      logger.error('Failed to execute change', { changeId, error })
      throw error
    }
  }
  
  /**
   * Auto-apply a safe change
   */
  private async autoApplyChange(change: CodeChange): Promise<void> {
    try {
      // Get new content from diff
      const currentContent = await fs.readFile(change.filePath, 'utf-8')
      const newContent = this.applyDiff(currentContent, change.diff || '')
      
      // Apply with safety measures
      await safetySystem.applyChange(change, newContent)
      
      // Move to applied changes
      this.pendingChanges.delete(change.id)
      this.appliedChanges.set(change.id, change)
      this.changeHistory.push(change)
      
      logger.info('Change auto-applied', { changeId: change.id })
      
    } catch (error) {
      logger.error('Failed to auto-apply change', { changeId: change.id, error })
      throw error
    }
  }
  
  /**
   * Create PR for medium-risk change
   */
  private async createPRForChange(change: CodeChange): Promise<void> {
    try {
      const branchName = `ai-assistant/${change.type}-${Date.now()}`
      const prTitle = `[AI Assistant] ${change.description}`
      const prDescription = `
## AI-Generated Change

**Type:** ${change.type}
**File:** ${change.filePath}
**Risk Score:** ${change.riskScore}/10
**AI Model:** ${change.aiModel}

### Description
${change.description}

### Reasoning
${change.reasoning}

### Changes
\`\`\`diff
${change.diff}
\`\`\`

---
*This PR was automatically created by the AI Code Assistant*
`
      
      // Get new content
      const currentContent = await fs.readFile(change.filePath, 'utf-8')
      const newContent = this.applyDiff(currentContent, change.diff || '')
      
      // Create PR with safety measures
      const prUrl = await safetySystem.applyChangesWithPR(
        [change],
        branchName,
        prTitle,
        prDescription
      )
      
      change.prUrl = prUrl
      change.status = 'pending' // Waiting for PR approval
      
      logger.info('PR created for change', { changeId: change.id, prUrl })
      
    } catch (error) {
      logger.error('Failed to create PR', { changeId: change.id, error })
      throw error
    }
  }
  
  /**
   * Approve a pending change
   */
  async approveChange(changeId: string): Promise<void> {
    const change = this.pendingChanges.get(changeId)
    if (!change) {
      throw new Error(`Change not found: ${changeId}`)
    }
    
    try {
      await this.autoApplyChange(change)
      logger.info('Change approved and applied', { changeId })
    } catch (error) {
      logger.error('Failed to approve change', { changeId, error })
      throw error
    }
  }
  
  /**
   * Reject a pending change
   */
  async rejectChange(changeId: string, reason?: string): Promise<void> {
    const change = this.pendingChanges.get(changeId)
    if (!change) {
      throw new Error(`Change not found: ${changeId}`)
    }
    
    change.status = 'rejected'
    this.pendingChanges.delete(changeId)
    this.changeHistory.push(change)
    
    logger.info('Change rejected', { changeId, reason })
  }
  
  /**
   * Rollback an applied change
   */
  async rollbackChange(changeId: string): Promise<void> {
    const change = this.appliedChanges.get(changeId)
    if (!change) {
      throw new Error(`Applied change not found: ${changeId}`)
    }
    
    try {
      await safetySystem.rollbackChange(change)
      this.appliedChanges.delete(changeId)
      this.changeHistory.push(change)
      
      logger.info('Change rolled back', { changeId })
    } catch (error) {
      logger.error('Failed to rollback change', { changeId, error })
      throw error
    }
  }
  
  /**
   * Get all pending changes
   */
  getPendingChanges(): CodeChange[] {
    return Array.from(this.pendingChanges.values())
  }
  
  /**
   * Get all applied changes
   */
  getAppliedChanges(): CodeChange[] {
    return Array.from(this.appliedChanges.values())
  }
  
  /**
   * Get change history
   */
  getChangeHistory(): CodeChange[] {
    return [...this.changeHistory]
  }
  
  /**
   * Get change by ID
   */
  getChange(changeId: string): CodeChange | undefined {
    return this.pendingChanges.get(changeId) || this.appliedChanges.get(changeId)
  }
  
  /**
   * Generate diff between old and new content
   */
  private generateDiff(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    
    const diff: string[] = []
    const maxLines = Math.max(oldLines.length, newLines.length)
    
    for (let i = 0; i < maxLines; i++) {
      if (oldLines[i] !== newLines[i]) {
        if (oldLines[i]) diff.push(`- ${oldLines[i]}`)
        if (newLines[i]) diff.push(`+ ${newLines[i]}`)
      }
    }
    
    return diff.join('\n')
  }
  
  /**
   * Apply diff to content
   */
  private applyDiff(content: string, diff: string): string {
    const lines = content.split('\n')
    const diffLines = diff.split('\n')
    
    const result = [...lines]
    
    for (const diffLine of diffLines) {
      if (diffLine.startsWith('- ')) {
        const lineToRemove = diffLine.substring(2)
        const index = result.indexOf(lineToRemove)
        if (index !== -1) {
          result.splice(index, 1)
        }
      } else if (diffLine.startsWith('+ ')) {
        const lineToAdd = diffLine.substring(2)
        result.push(lineToAdd)
      }
    }
    
    return result.join('\n')
  }
  
  /**
   * Get statistics
   */
  getStatistics() {
    return {
      pending: this.pendingChanges.size,
      applied: this.appliedChanges.size,
      total: this.changeHistory.length,
      approved: this.changeHistory.filter(c => c.status === 'applied').length,
      rejected: this.changeHistory.filter(c => c.status === 'rejected').length
    }
  }
}

export const changeManager = new ChangeManager()
