
import { openai } from '@ai-sdk/openai'
import { streamText, generateText, generateObject } from 'ai'
import { z } from 'zod'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ScriptGenerationRequest {
  description: string
  scriptType: 'bash' | 'python' | 'javascript' | 'powershell' | 'config'
  context?: string
  requirements?: string[]
  parameters?: Record<string, any>
}

export interface FeatureDesignRequest {
  featureName: string
  description: string
  requirements: string[]
  technology: string
  complexity: 'simple' | 'medium' | 'complex'
}

export interface AIResponse {
  content: string
  error?: string
}

export class EnhancedAIClient {
  private abacusApiKey: string
  private baseUrl: string

  constructor() {
    this.abacusApiKey = process.env.ABACUSAI_API_KEY || ''
    this.baseUrl = 'https://apps.abacus.ai/v1/chat/completions'
  }

  // Enhanced chat with multiple model support
  async enhancedChat(messages: ChatMessage[], context?: string, modelPreference?: string): Promise<AIResponse> {
    try {
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `You are an enhanced Sports Bar AI Assistant with advanced capabilities in:
        - AV System troubleshooting and management
        - Script generation and automation
        - Feature design and architecture
        - Technical documentation analysis
        - System configuration and optimization
        ${context ? `\n\nRelevant context:\n${context}` : ''}`
      }

      const allMessages = [systemMessage, ...messages]
      const model = modelPreference || 'gpt-4.1-mini'

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.abacusApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: allMessages,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()
      return { content: data.choices[0]?.message?.content || 'No response generated' }
    } catch (error) {
      console.error('Enhanced chat error:', error)
      return { 
        content: 'Sorry, I encountered an error processing your request.', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Streaming chat for real-time responses
  async *streamChat(messages: ChatMessage[], context?: string, modelPreference?: string) {
    try {
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `You are an enhanced Sports Bar AI Assistant with advanced capabilities in:
        - AV System troubleshooting and management
        - Script generation and automation
        - Feature design and architecture
        - Technical documentation analysis
        - System configuration and optimization
        ${context ? `\n\nRelevant context:\n${context}` : ''}`
      }

      const allMessages = [systemMessage, ...messages]
      const model = modelPreference || 'gpt-4.1-mini'

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.abacusApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: allMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response reader available')

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') return

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices[0]?.delta?.content
                if (content) yield content
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      console.error('Stream chat error:', error)
      yield 'Sorry, I encountered an error processing your request.'
    }
  }

  // Advanced script generation
  async generateScript(request: ScriptGenerationRequest): Promise<AIResponse> {
    try {
      const prompt = `Generate a ${request.scriptType} script based on the following requirements:

Description: ${request.description}
${request.requirements ? `Requirements: ${request.requirements.join(', ')}` : ''}
${request.context ? `Context: ${request.context}` : ''}
${request.parameters ? `Parameters: ${JSON.stringify(request.parameters, null, 2)}` : ''}

Please provide:
1. A complete, functional script
2. Clear comments explaining each section
3. Error handling where appropriate
4. Usage instructions
5. Any prerequisites or dependencies

The script should be production-ready and follow best practices for ${request.scriptType} development.`

      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ]

      return await this.enhancedChat(messages, '', 'gpt-4o')
    } catch (error) {
      console.error('Script generation error:', error)
      return { 
        content: 'Failed to generate script', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Feature design and architecture
  async designFeature(request: FeatureDesignRequest): Promise<AIResponse> {
    try {
      const prompt = `Design a software feature with the following specifications:

Feature Name: ${request.featureName}
Description: ${request.description}
Requirements: ${request.requirements.join(', ')}
Technology: ${request.technology}
Complexity: ${request.complexity}

Please provide:
1. Detailed feature architecture
2. Implementation approach
3. Component breakdown
4. Database schema (if applicable)
5. API endpoints (if applicable)
6. User interface mockup description
7. Security considerations
8. Testing strategy
9. Deployment considerations
10. Estimated development timeline

Structure your response as a comprehensive technical specification document.`

      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ]

      return await this.enhancedChat(messages, '', 'gpt-4o')
    } catch (error) {
      console.error('Feature design error:', error)
      return { 
        content: 'Failed to design feature', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Document analysis with AI
  async analyzeDocument(content: string, analysisType: string = 'general'): Promise<AIResponse> {
    try {
      const prompt = `Analyze the following document content for ${analysisType} insights:

${content}

Please provide:
1. Summary of key points
2. Technical specifications identified
3. Configuration parameters
4. Troubleshooting information
5. Implementation recommendations
6. Potential issues or concerns
7. Related equipment or systems mentioned

Focus on information relevant to AV system management and sports bar operations.`

      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ]

      return await this.enhancedChat(messages, '', 'gpt-4o')
    } catch (error) {
      console.error('Document analysis error:', error)
      return { 
        content: 'Failed to analyze document', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // System optimization suggestions
  async optimizeSystem(systemType: string, currentConfig: string, issues?: string[]): Promise<AIResponse> {
    try {
      const prompt = `Provide system optimization recommendations for:

System Type: ${systemType}
Current Configuration: ${currentConfig}
${issues ? `Known Issues: ${issues.join(', ')}` : ''}

Please provide:
1. Performance optimization recommendations
2. Configuration improvements
3. Hardware upgrade suggestions
4. Software updates or patches
5. Maintenance schedule recommendations
6. Monitoring and alerting setup
7. Backup and disaster recovery considerations
8. Security hardening steps
9. Cost-benefit analysis of recommendations
10. Implementation priority order

Focus on practical, actionable recommendations for a sports bar environment.`

      const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
      ]

      return await this.enhancedChat(messages, '', 'gpt-4o')
    } catch (error) {
      console.error('System optimization error:', error)
      return { 
        content: 'Failed to generate optimization recommendations', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}
