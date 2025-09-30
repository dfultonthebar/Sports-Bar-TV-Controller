

import { getApiKey } from './api-keys'

interface GrokResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export class GrokService {
  private apiKey: string | null = null

  private async getApiKey(): Promise<string> {
    if (!this.apiKey) {
      // Try database first, then environment variable
      this.apiKey = await getApiKey('xai') || process.env.GROK_API_KEY || null
    }
    
    if (!this.apiKey) {
      throw new Error('Grok API key not configured. Add it via the Sports Guide Config page or environment variable.')
    }
    
    return this.apiKey
  }

  async generateSportsAnalysis(prompt: string): Promise<string> {
    const apiKey = await this.getApiKey()
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable sports analyst for a professional sports bar. Provide insightful, engaging analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`)
    }

    const data: GrokResponse = await response.json()
    return data.choices[0]?.message?.content || 'No response from Grok'
  }

  async analyzeTVGuideData(guideData: any): Promise<string> {
    const prompt = `Analyze this TV guide data for a sports bar and provide insights on upcoming games, scheduling conflicts, and viewing recommendations: ${JSON.stringify(guideData).substring(0, 2000)}`
    
    return this.generateSportsAnalysis(prompt)
  }
}

export const grokService = new GrokService()

