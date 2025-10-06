
/**
 * Safety System - Backups, rollbacks, and PR creation
 */

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { CodeChange } from '../../config/types'
import { AI_ASSISTANT_CONFIG } from '../../config/config'
import { logger } from '../../utils/logger'

const execAsync = promisify(exec)

export class SafetySystem {
  private backupDir: string
  
  constructor() {
    this.backupDir = AI_ASSISTANT_CONFIG.backupDir
  }
  
  /**
   * Initialize safety system
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true })
      logger.info('Safety system initialized', { backupDir: this.backupDir })
    } catch (error) {
      logger.error('Failed to initialize safety system', { error })
      throw error
    }
  }
  
  /**
   * Create backup of a file before modification
   */
  async createBackup(filePath: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = path.basename(filePath)
      const backupFileName = `${fileName}.${timestamp}.backup`
      const backupPath = path.join(this.backupDir, backupFileName)
      
      await fs.copyFile(filePath, backupPath)
      logger.info('Backup created', { filePath, backupPath })
      
      return backupPath
    } catch (error) {
      logger.error('Failed to create backup', { filePath, error })
      throw error
    }
  }
  
  /**
   * Restore file from backup
   */
  async restoreFromBackup(backupPath: string, targetPath: string): Promise<void> {
    try {
      await fs.copyFile(backupPath, targetPath)
      logger.info('File restored from backup', { backupPath, targetPath })
    } catch (error) {
      logger.error('Failed to restore from backup', { backupPath, error })
      throw error
    }
  }
  
  /**
   * Apply a code change with safety measures
   */
  async applyChange(change: CodeChange, content: string): Promise<void> {
    try {
      // Create backup first
      if (AI_ASSISTANT_CONFIG.enableAutoBackup) {
        const backupPath = await this.createBackup(change.filePath)
        change.backupPath = backupPath
      }
      
      // Apply the change
      await fs.writeFile(change.filePath, content, 'utf-8')
      logger.info('Change applied', { changeId: change.id, filePath: change.filePath })
      
      // Update change status
      change.status = 'applied'
      
    } catch (error) {
      logger.error('Failed to apply change', { changeId: change.id, error })
      
      // Attempt rollback if backup exists
      if (change.backupPath) {
        await this.rollbackChange(change)
      }
      
      throw error
    }
  }
  
  /**
   * Rollback a change using backup
   */
  async rollbackChange(change: CodeChange): Promise<void> {
    if (!change.backupPath) {
      throw new Error('No backup available for rollback')
    }
    
    try {
      await this.restoreFromBackup(change.backupPath, change.filePath)
      change.status = 'rejected'
      logger.info('Change rolled back', { changeId: change.id })
    } catch (error) {
      logger.error('Failed to rollback change', { changeId: change.id, error })
      throw error
    }
  }
  
  /**
   * Create a Git branch for changes
   */
  async createFeatureBranch(branchName: string): Promise<void> {
    try {
      const { stdout } = await execAsync(`git checkout -b ${branchName}`)
      logger.info('Feature branch created', { branchName, output: stdout })
    } catch (error) {
      logger.error('Failed to create feature branch', { branchName, error })
      throw error
    }
  }
  
  /**
   * Commit changes to Git
   */
  async commitChanges(message: string, files: string[]): Promise<void> {
    try {
      // Stage files
      for (const file of files) {
        await execAsync(`git add ${file}`)
      }
      
      // Commit
      const { stdout } = await execAsync(`git commit -m "${message}"`)
      logger.info('Changes committed', { message, files, output: stdout })
    } catch (error) {
      logger.error('Failed to commit changes', { message, error })
      throw error
    }
  }
  
  /**
   * Push changes to remote
   */
  async pushChanges(branchName: string): Promise<void> {
    try {
      const { stdout } = await execAsync(`git push origin ${branchName}`)
      logger.info('Changes pushed', { branchName, output: stdout })
    } catch (error) {
      logger.error('Failed to push changes', { branchName, error })
      throw error
    }
  }
  
  /**
   * Create a Pull Request (requires GitHub CLI or API)
   */
  async createPullRequest(
    branchName: string,
    title: string,
    description: string
  ): Promise<string> {
    try {
      // Using GitHub CLI (gh)
      const command = `gh pr create --title "${title}" --body "${description}" --head ${branchName}`
      const { stdout } = await execAsync(command)
      
      const prUrl = stdout.trim()
      logger.info('Pull request created', { branchName, prUrl })
      
      return prUrl
    } catch (error) {
      logger.error('Failed to create pull request', { branchName, error })
      throw error
    }
  }
  
  /**
   * Full workflow: backup, apply, commit, and create PR
   */
  async applyChangesWithPR(
    changes: CodeChange[],
    branchName: string,
    prTitle: string,
    prDescription: string
  ): Promise<string> {
    try {
      // Create feature branch
      await this.createFeatureBranch(branchName)
      
      // Apply all changes with backups
      for (const change of changes) {
        const content = await this.getNewContent(change)
        await this.applyChange(change, content)
      }
      
      // Commit changes
      const files = changes.map(c => c.filePath)
      await this.commitChanges(prTitle, files)
      
      // Push to remote
      await this.pushChanges(branchName)
      
      // Create PR
      const prUrl = await this.createPullRequest(branchName, prTitle, prDescription)
      
      // Update changes with PR URL
      for (const change of changes) {
        change.prUrl = prUrl
      }
      
      logger.info('Changes applied with PR', { branchName, prUrl, changeCount: changes.length })
      return prUrl
      
    } catch (error) {
      logger.error('Failed to apply changes with PR', { branchName, error })
      
      // Rollback all changes
      for (const change of changes) {
        if (change.backupPath) {
          await this.rollbackChange(change)
        }
      }
      
      throw error
    }
  }
  
  /**
   * Get new content for a change (placeholder - would integrate with AI)
   */
  private async getNewContent(change: CodeChange): Promise<string> {
    // This would be replaced with actual AI-generated content
    // For now, read the current file and apply the diff
    const currentContent = await fs.readFile(change.filePath, 'utf-8')
    
    if (change.diff) {
      // Apply diff to current content
      return this.applyDiff(currentContent, change.diff)
    }
    
    return currentContent
  }
  
  /**
   * Apply a diff to content
   */
  private applyDiff(content: string, diff: string): string {
    const lines = content.split('\n')
    const diffLines = diff.split('\n')
    
    let result = [...lines]
    let lineIndex = 0
    
    for (const diffLine of diffLines) {
      if (diffLine.startsWith('- ')) {
        // Remove line
        const lineToRemove = diffLine.substring(2)
        const index = result.indexOf(lineToRemove)
        if (index !== -1) {
          result.splice(index, 1)
        }
      } else if (diffLine.startsWith('+ ')) {
        // Add line
        const lineToAdd = diffLine.substring(2)
        result.splice(lineIndex, 0, lineToAdd)
        lineIndex++
      }
    }
    
    return result.join('\n')
  }
  
  /**
   * List all backups
   */
  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.backupDir)
      return files.filter(f => f.endsWith('.backup'))
    } catch (error) {
      logger.error('Failed to list backups', { error })
      return []
    }
  }
  
  /**
   * Clean old backups (older than 30 days)
   */
  async cleanOldBackups(daysToKeep: number = 30): Promise<number> {
    try {
      const files = await this.listBackups()
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      
      let deletedCount = 0
      
      for (const file of files) {
        const filePath = path.join(this.backupDir, file)
        const stats = await fs.stat(filePath)
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath)
          deletedCount++
        }
      }
      
      logger.info('Old backups cleaned', { deletedCount, daysToKeep })
      return deletedCount
      
    } catch (error) {
      logger.error('Failed to clean old backups', { error })
      return 0
    }
  }
}

export const safetySystem = new SafetySystem()
