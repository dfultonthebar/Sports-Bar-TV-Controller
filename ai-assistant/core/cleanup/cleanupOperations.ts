
/**
 * Code Cleanup Operations - Automated code improvements
 */

import fs from 'fs/promises'
import { CodeChange, CleanupOperation } from '../../config/types'
import { logger } from '../../utils/logger'
import { v4 as uuidv4 } from 'uuid'

export class CleanupOperations {
  /**
   * Remove unused imports from a file
   */
  async removeUnusedImports(filePath: string): Promise<CodeChange | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      
      // Find import statements
      const importLines: number[] = []
      const importedItems = new Map<string, number>()
      
      lines.forEach((line, index) => {
        const importMatch = line.match(/import\s+{([^}]+)}\s+from/)
        if (importMatch) {
          importLines.push(index)
          const items = importMatch[1].split(',').map(i => i.trim())
          items.forEach(item => importedItems.set(item, index))
        }
      })
      
      // Check which imports are actually used
      const unusedImports: string[] = []
      for (const [item, lineNum] of importedItems) {
        const usageCount = lines.reduce((count, line, idx) => {
          if (idx !== lineNum && line.includes(item)) {
            return count + 1
          }
          return count
        }, 0)
        
        if (usageCount === 0) {
          unusedImports.push(item)
        }
      }
      
      if (unusedImports.length === 0) {
        logger.info('No unused imports found', { filePath })
        return null
      }
      
      // Remove unused imports
      let newContent = content
      for (const unused of unusedImports) {
        // Remove from import statement
        newContent = newContent.replace(
          new RegExp(`\\b${unused}\\b,?\\s*`, 'g'),
          ''
        )
        // Clean up empty braces
        newContent = newContent.replace(/{\s*,?\s*}/g, '{}')
        // Remove empty import lines
        newContent = newContent.replace(/import\s+{}\s+from[^;]+;?\n/g, '')
      }
      
      const change: CodeChange = {
        id: uuidv4(),
        timestamp: new Date(),
        type: 'update',
        filePath,
        description: `Remove unused imports: ${unusedImports.join(', ')}`,
        riskScore: 10, // Safe operation
        status: 'pending',
        diff: this.generateDiff(content, newContent),
        aiModel: 'cleanup-engine',
        reasoning: 'Automated cleanup: removing unused imports improves code maintainability'
      }
      
      logger.info('Unused imports identified', { filePath, count: unusedImports.length })
      return change
      
    } catch (error) {
      logger.error('Error removing unused imports', { filePath, error })
      return null
    }
  }
  
  /**
   * Fix common linting errors
   */
  async fixLintErrors(filePath: string): Promise<CodeChange | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      let newContent = content
      
      const fixes: string[] = []
      
      // Fix missing semicolons
      const missingSemicolons = content.match(/\n[^;\n]*[^;\s]\n/g)
      if (missingSemicolons) {
        newContent = newContent.replace(/([^;\s])\n/g, '$1;\n')
        fixes.push('Added missing semicolons')
      }
      
      // Fix trailing whitespace
      if (/\s+$/m.test(content)) {
        newContent = newContent.replace(/\s+$/gm, '')
        fixes.push('Removed trailing whitespace')
      }
      
      // Fix multiple empty lines
      if (/\n\n\n+/.test(content)) {
        newContent = newContent.replace(/\n\n\n+/g, '\n\n')
        fixes.push('Removed excessive empty lines')
      }
      
      // Fix inconsistent quotes (prefer single quotes)
      const doubleQuotes = content.match(/"[^"]*"/g)
      if (doubleQuotes && doubleQuotes.length > 0) {
        newContent = newContent.replace(/"([^"]*)"/g, "'$1'")
        fixes.push('Standardized quotes to single quotes')
      }
      
      if (fixes.length === 0) {
        logger.info('No lint errors found', { filePath })
        return null
      }
      
      const change: CodeChange = {
        id: uuidv4(),
        timestamp: new Date(),
        type: 'update',
        filePath,
        description: `Fix lint errors: ${fixes.join(', ')}`,
        riskScore: 10, // Safe operation
        status: 'pending',
        diff: this.generateDiff(content, newContent),
        aiModel: 'cleanup-engine',
        reasoning: 'Automated cleanup: fixing linting errors improves code quality'
      }
      
      logger.info('Lint errors fixed', { filePath, fixes })
      return change
      
    } catch (error) {
      logger.error('Error fixing lint errors', { filePath, error })
      return null
    }
  }
  
  /**
   * Add missing JSDoc comments
   */
  async addMissingDocs(filePath: string): Promise<CodeChange | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      const newLines: string[] = []
      
      let addedDocs = 0
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Check for exported functions without docs
        if (line.match(/export\s+(async\s+)?function\s+\w+/)) {
          // Check if previous line is a comment
          const prevLine = i > 0 ? lines[i - 1].trim() : ''
          if (!prevLine.startsWith('/**') && !prevLine.startsWith('//')) {
            const functionName = line.match(/function\s+(\w+)/)?.[1] || 'function'
            newLines.push('/**')
            newLines.push(` * ${functionName} - TODO: Add description`)
            newLines.push(' */')
            addedDocs++
          }
        }
        
        newLines.push(line)
      }
      
      if (addedDocs === 0) {
        logger.info('No missing documentation found', { filePath })
        return null
      }
      
      const newContent = newLines.join('\n')
      
      const change: CodeChange = {
        id: uuidv4(),
        timestamp: new Date(),
        type: 'update',
        filePath,
        description: `Add missing documentation for ${addedDocs} function(s)`,
        riskScore: 10, // Safe operation
        status: 'pending',
        diff: this.generateDiff(content, newContent),
        aiModel: 'cleanup-engine',
        reasoning: 'Automated cleanup: adding documentation improves code maintainability'
      }
      
      logger.info('Documentation added', { filePath, count: addedDocs })
      return change
      
    } catch (error) {
      logger.error('Error adding documentation', { filePath, error })
      return null
    }
  }
  
  /**
   * Scan directory for cleanup opportunities
   */
  async scanForCleanup(dirPath: string): Promise<CleanupOperation[]> {
    const operations: CleanupOperation[] = []
    
    try {
      const files = await this.getTypeScriptFiles(dirPath)
      
      for (const file of files) {
        // Check for unused imports
        const unusedImportChange = await this.removeUnusedImports(file)
        if (unusedImportChange) {
          operations.push({
            type: 'remove-unused-import',
            filePath: file,
            description: unusedImportChange.description,
            autoApply: true
          })
        }
        
        // Check for lint errors
        const lintChange = await this.fixLintErrors(file)
        if (lintChange) {
          operations.push({
            type: 'fix-lint',
            filePath: file,
            description: lintChange.description,
            autoApply: true
          })
        }
        
        // Check for missing docs
        const docsChange = await this.addMissingDocs(file)
        if (docsChange) {
          operations.push({
            type: 'add-docs',
            filePath: file,
            description: docsChange.description,
            autoApply: true
          })
        }
      }
      
      logger.info('Cleanup scan complete', { operations: operations.length })
      
    } catch (error) {
      logger.error('Error scanning for cleanup', { dirPath, error })
    }
    
    return operations
  }
  
  /**
   * Get all TypeScript files in directory
   */
  private async getTypeScriptFiles(dirPath: string): Promise<string[]> {
    const files: string[] = []
    const excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build']
    
    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`
        
        if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
          await scan(fullPath)
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath)
        }
      }
    }
    
    await scan(dirPath)
    return files
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
}

export const cleanupOperations = new CleanupOperations()
