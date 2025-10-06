
/**
 * Ollama Service - Interface with local Ollama AI models
 */

import { AI_ASSISTANT_CONFIG } from '../config/config'
import { logger } from '../utils/logger'

interface OllamaRequest {
  model: string
  prompt: string
  stream?: boolean
  options?: {
    temperature?: number
    top_p?: number
    max_tokens?: number
  }
}

interface OllamaResponse {
  model: string
  created_at: string
  response: string
  done: boolean
}

export class OllamaService {
  private baseUrl: string
  private model: string
  
  constructor() {
    this.baseUrl = AI_ASSISTANT_CONFIG.ollamaUrl
    this.model = AI_ASSISTANT_CONFIG.model
  }
  
  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch (error) {
      logger.error('Ollama not available', { error })
      return false
    }
  }
  
  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      const data = await response.json()
      return data.models?.map((m: any) => m.name) || []
    } catch (error) {
      logger.error('Failed to list models', { error })
      return []
    }
  }
  
  /**
   * Generate code completion
   */
  async generateCode(prompt: string): Promise<string> {
    try {
      const request: OllamaRequest = {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: AI_ASSISTANT_CONFIG.temperature,
          max_tokens: AI_ASSISTANT_CONFIG.maxTokens
        }
      }
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`)
      }
      
      const data: OllamaResponse = await response.json()
      return data.response
      
    } catch (error) {
      logger.error('Failed to generate code', { error })
      throw error
    }
  }
  
  /**
   * Analyze code for issues
   */
  async analyzeCode(code: string, filePath: string): Promise<string> {
    const prompt = `Analyze the following TypeScript code from ${filePath} and identify:
1. Potential bugs or errors
2. Code quality issues
3. Performance concerns
4. Security vulnerabilities
5. Suggestions for improvement

Code:
\`\`\`typescript
${code}
\`\`\`

Provide a structured analysis with specific line numbers and recommendations.`
    
    return this.generateCode(prompt)
  }
  
  /**
   * Suggest code improvements
   */
  async suggestImprovements(code: string, context: string): Promise<string> {
    const prompt = `Given the following TypeScript code, suggest improvements:

Context: ${context}

Code:
\`\`\`typescript
${code}
\`\`\`

Provide specific, actionable improvements with code examples. Focus on:
- Code clarity and readability
- Performance optimizations
- Best practices
- Type safety
- Error handling`
    
    return this.generateCode(prompt)
  }
  
  /**
   * Generate documentation
   */
  async generateDocumentation(code: string, functionName: string): Promise<string> {
    const prompt = `Generate JSDoc documentation for the following TypeScript function:

Function name: ${functionName}

Code:
\`\`\`typescript
${code}
\`\`\`

Provide complete JSDoc with:
- Description
- @param tags for all parameters
- @returns tag
- @throws tag if applicable
- @example tag with usage example`
    
    return this.generateCode(prompt)
  }
  
  /**
   * Refactor code
   */
  async refactorCode(code: string, instruction: string): Promise<string> {
    const prompt = `Refactor the following TypeScript code according to this instruction: ${instruction}

Original code:
\`\`\`typescript
${code}
\`\`\`

Provide the refactored code with explanations of changes made.`
    
    return this.generateCode(prompt)
  }
  
  /**
   * Fix code issues
   */
  async fixCode(code: string, issue: string): Promise<string> {
    const prompt = `Fix the following issue in this TypeScript code: ${issue}

Code:
\`\`\`typescript
${code}
\`\`\`

Provide the corrected code with explanation of the fix.`
    
    return this.generateCode(prompt)
  }
  
  /**
   * Explain code
   */
  async explainCode(code: string): Promise<string> {
    const prompt = `Explain what the following TypeScript code does in clear, simple terms:

\`\`\`typescript
${code}
\`\`\`

Include:
- Overall purpose
- Key functionality
- Important details
- Potential use cases`
    
    return this.generateCode(prompt)
  }
}

export const ollamaService = new OllamaService()
