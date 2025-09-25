
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIResponse {
  content: string
  error?: string
}

export class AIClient {
  private apiKey: string
  private provider: string

  constructor(apiKey: string, provider: string = 'grok') {
    this.apiKey = apiKey
    this.provider = provider
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

      if (this.provider === 'grok') {
        return await this.chatWithGrok(allMessages)
      } else if (this.provider === 'claude') {
        return await this.chatWithClaude(allMessages)
      } else if (this.provider === 'openai') {
        return await this.chatWithOpenAI(allMessages)
      } else {
        return { content: 'AI provider not configured', error: 'Invalid provider' }
      }
    } catch (error) {
      console.error('AI Chat error:', error)
      return { 
        content: 'Sorry, I encountered an error processing your request.', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  private async chatWithGrok(messages: ChatMessage[]): Promise<AIResponse> {
    // Grok API implementation
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.statusText}`)
    }

    const data = await response.json()
    return { content: data.choices[0]?.message?.content || 'No response from Grok' }
  }

  private async chatWithClaude(messages: ChatMessage[]): Promise<AIResponse> {
    // Claude API implementation
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: messages.filter(m => m.role !== 'system'),
        system: messages.find(m => m.role === 'system')?.content,
      }),
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`)
    }

    const data = await response.json()
    return { content: data.content[0]?.text || 'No response from Claude' }
  }

  private async chatWithOpenAI(messages: ChatMessage[]): Promise<AIResponse> {
    // For testing, we'll simulate a response since we don't have real API keys
    if (this.apiKey.startsWith('sk-test-')) {
      return { 
        content: `Hello! I'm your Sports Bar AI Assistant. I can help you with AV system troubleshooting, equipment management, and technical support. 

I noticed you're testing the system. Here are some things I can help with:
- Troubleshooting audio/video issues
- Equipment configuration guidance  
- Matrix switching setup
- Document analysis for technical manuals

What specific AV system issue would you like help with?`
      }
    }

    // Real OpenAI API implementation
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    return { content: data.choices[0]?.message?.content || 'No response from OpenAI' }
  }
}
