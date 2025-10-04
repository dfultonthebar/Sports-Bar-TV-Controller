
export interface ScriptGenerationRequest {
  description: string
  scriptType: 'bash' | 'python' | 'javascript' | 'powershell' | 'config'
  requirements: string[]
  context?: string
}

export interface FeatureDesignRequest {
  featureName: string
  description: string
  requirements: string[]
  technology: string
  complexity: 'simple' | 'medium' | 'complex'
}

export interface AIResponse {
  content?: string
  error?: string
}

// Local Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

export class EnhancedAIClient {
  private async callLocalOllama(messages: any[]): Promise<AIResponse> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 4000
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Ollama API Error (${response.status}):`, errorText)
        return { 
          error: `Ollama error: ${response.statusText}. Is Ollama running on ${OLLAMA_BASE_URL}?`, 
          content: '' 
        }
      }

      const data = await response.json()
      return { content: data.message?.content || 'No response from local AI' }
    } catch (error) {
      console.error('Local AI call error:', error)
      return { 
        error: error instanceof Error ? error.message : 'Unknown error connecting to local AI', 
        content: '' 
      }
    }
  }

  async enhancedChat(messages: any[], context?: string): Promise<AIResponse> {
    // Add system context if provided
    const systemMessage = {
      role: 'system',
      content: `You are an advanced Sports Bar AI Assistant specializing in AV system management, troubleshooting, and technical support. You have extensive knowledge of:

- Audio/Visual equipment and matrix systems
- Wolf Pack matrix switchers and control
- Network troubleshooting and IR control systems
- Sports bar equipment management
- Technical documentation analysis

${context ? `\nAdditional Context:\n${context}` : ''}

Provide detailed, technical, and actionable responses.`
    }

    const allMessages = [systemMessage, ...messages]
    return await this.callLocalOllama(allMessages)
  }

  async generateScript(request: ScriptGenerationRequest): Promise<AIResponse> {
    const systemMessage = {
      role: 'system',
      content: `You are an expert script generator. Generate clean, well-documented ${request.scriptType} scripts based on user requirements.`
    }

    const userMessage = {
      role: 'user',
      content: `Generate a ${request.scriptType} script for: ${request.description}

Requirements:
${request.requirements.map(r => `- ${r}`).join('\n')}

${request.context ? `Context: ${request.context}` : ''}

Please provide a complete, production-ready script with comments.`
    }

    return await this.callLocalOllama([systemMessage, userMessage])
  }

  async designFeature(request: FeatureDesignRequest): Promise<AIResponse> {
    const systemMessage = {
      role: 'system',
      content: `You are an expert software architect. Design features with clean architecture and best practices.`
    }

    const userMessage = {
      role: 'user',
      content: `Design a ${request.complexity} feature: ${request.featureName}

Description: ${request.description}

Technology: ${request.technology}

Requirements:
${request.requirements.map(r => `- ${r}`).join('\n')}

Please provide a detailed design with architecture, components, and implementation plan.`
    }

    return await this.callLocalOllama([systemMessage, userMessage])
  }
}
