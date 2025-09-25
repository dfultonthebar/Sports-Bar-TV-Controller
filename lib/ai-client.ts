
export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  content: string
  model?: string
  error?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export class AIClient {
  private apiKey: string
  private model: string
  private baseUrl: string

  constructor(apiKey?: string, model: string = 'gpt-3.5-turbo', baseUrl?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || ''
    this.model = model
    this.baseUrl = baseUrl || 'https://api.openai.com/v1'
  }

  async chat(messages: AIMessage[], options?: {
    temperature?: number
    maxTokens?: number
    stream?: boolean
  }): Promise<AIResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('API key not configured')
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 1500,
          stream: options?.stream || false
        })
      })

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        content: data.choices?.[0]?.message?.content || 'No response generated',
        model: data.model,
        usage: data.usage
      }
    } catch (error) {
      console.error('AI Client error:', error)
      return {
        content: 'I apologize, but I\'m experiencing technical difficulties. Please try again later or check your API configuration.',
        model: this.model,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async generateTroubleshootingResponse(
    issue: string,
    context: string = '',
    documents: string[] = []
  ): Promise<AIResponse> {
    const systemMessage: AIMessage = {
      role: 'system',
      content: `You are an AI assistant specialized in sports bar AV system troubleshooting. 
      You help with audio/video equipment, matrix switches, IR controls, and general tech support.
      
      Available context: ${context}
      Available documents: ${documents.join(', ')}
      
      Provide clear, actionable troubleshooting steps. Be specific and practical.`
    }

    const userMessage: AIMessage = {
      role: 'user',
      content: issue
    }

    return this.chat([systemMessage, userMessage], { temperature: 0.3 })
  }
}

// Create default client instance
export const defaultAIClient = new AIClient()
