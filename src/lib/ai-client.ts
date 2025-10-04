
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIResponse {
  content: string
  error?: string
}

// Local Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

export class AIClient {
  constructor() {
    // No API key needed for local Ollama
  }

  async chat(messages: ChatMessage[], context?: string): Promise<AIResponse> {
    try {
      // Add context from documents if provided
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `You are a Sports Bar AI Assistant specializing in AV system troubleshooting and management. 
        You have access to uploaded documentation and can provide specific technical guidance.
        ${context ? `\n\nRelevant documentation context:\n${context}` : ''}`
      }

      const allMessages = [systemMessage, ...messages]
      return await this.chatWithOllama(allMessages)
    } catch (error) {
      console.error('AI Chat error:', error)
      return { 
        content: 'Sorry, I encountered an error processing your request.', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  private async chatWithOllama(messages: ChatMessage[]): Promise<AIResponse> {
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
            num_predict: 1000
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const data = await response.json()
      return { content: data.message?.content || 'No response from local AI' }
    } catch (error) {
      throw new Error(`Failed to connect to Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
