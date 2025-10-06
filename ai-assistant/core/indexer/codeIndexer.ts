
/**
 * Code Indexer - Analyzes and indexes the codebase
 */

import fs from 'fs/promises'
import path from 'path'
import { CodeIndex, FunctionInfo, ClassInfo } from '../../config/types'
import { logger } from '../../utils/logger'

export class CodeIndexer {
  private indexCache: Map<string, CodeIndex> = new Map()
  private excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build', '.ai-assistant']
  private includeExtensions = ['.ts', '.tsx', '.js', '.jsx']
  
  /**
   * Index the entire codebase
   */
  async indexCodebase(rootDir: string): Promise<Map<string, CodeIndex>> {
    logger.info('Starting codebase indexing', { rootDir })
    this.indexCache.clear()
    
    await this.indexDirectory(rootDir)
    
    logger.info('Codebase indexing complete', { filesIndexed: this.indexCache.size })
    return this.indexCache
  }
  
  /**
   * Index a single directory recursively
   */
  private async indexDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          if (!this.excludeDirs.includes(entry.name)) {
            await this.indexDirectory(fullPath)
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)
          if (this.includeExtensions.includes(ext)) {
            await this.indexFile(fullPath)
          }
        }
      }
    } catch (error) {
      logger.error('Error indexing directory', { dirPath, error })
    }
  }
  
  /**
   * Index a single file
   */
  private async indexFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const stats = await fs.stat(filePath)
      
      const index: CodeIndex = {
        filePath,
        language: this.detectLanguage(filePath),
        imports: this.extractImports(content),
        exports: this.extractExports(content),
        functions: this.extractFunctions(content),
        classes: this.extractClasses(content),
        dependencies: this.extractDependencies(content),
        lastModified: stats.mtime
      }
      
      this.indexCache.set(filePath, index)
    } catch (error) {
      logger.error('Error indexing file', { filePath, error })
    }
  }
  
  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath)
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript-react',
      '.js': 'javascript',
      '.jsx': 'javascript-react'
    }
    return langMap[ext] || 'unknown'
  }
  
  /**
   * Extract import statements
   */
  private extractImports(content: string): string[] {
    const imports: string[] = []
    const importRegex = /import\s+(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g
    let match
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1])
    }
    
    return imports
  }
  
  /**
   * Extract export statements
   */
  private extractExports(content: string): string[] {
    const exports: string[] = []
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g
    let match
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1])
    }
    
    return exports
  }
  
  /**
   * Extract function definitions
   */
  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = []
    const lines = content.split('\n')
    
    // Simple regex-based extraction (can be enhanced with AST parsing)
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/
    
    lines.forEach((line, index) => {
      const match = functionRegex.exec(line)
      if (match) {
        functions.push({
          name: match[1],
          lineStart: index + 1,
          lineEnd: index + 1, // Simplified - would need AST for accurate end
          parameters: match[2].split(',').map(p => p.trim()).filter(Boolean),
          isExported: line.includes('export')
        })
      }
    })
    
    return functions
  }
  
  /**
   * Extract class definitions
   */
  private extractClasses(content: string): ClassInfo[] {
    const classes: ClassInfo[] = []
    const lines = content.split('\n')
    
    const classRegex = /(?:export\s+)?class\s+(\w+)/
    
    lines.forEach((line, index) => {
      const match = classRegex.exec(line)
      if (match) {
        classes.push({
          name: match[1],
          lineStart: index + 1,
          lineEnd: index + 1, // Simplified
          methods: [],
          isExported: line.includes('export')
        })
      }
    })
    
    return classes
  }
  
  /**
   * Extract package dependencies
   */
  private extractDependencies(content: string): string[] {
    const deps = new Set<string>()
    const importRegex = /from\s+['"]([^'"]+)['"]/g
    let match
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      // Only include external packages (not relative imports)
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        deps.add(importPath.split('/')[0])
      }
    }
    
    return Array.from(deps)
  }
  
  /**
   * Get index for a specific file
   */
  getFileIndex(filePath: string): CodeIndex | undefined {
    return this.indexCache.get(filePath)
  }
  
  /**
   * Search for files by pattern
   */
  searchFiles(pattern: string): CodeIndex[] {
    const results: CodeIndex[] = []
    const regex = new RegExp(pattern, 'i')
    
    for (const [filePath, index] of this.indexCache) {
      if (regex.test(filePath)) {
        results.push(index)
      }
    }
    
    return results
  }
  
  /**
   * Find files that import a specific module
   */
  findImporters(moduleName: string): CodeIndex[] {
    const results: CodeIndex[] = []
    
    for (const index of this.indexCache.values()) {
      if (index.imports.some(imp => imp.includes(moduleName))) {
        results.push(index)
      }
    }
    
    return results
  }
}

export const codeIndexer = new CodeIndexer()
