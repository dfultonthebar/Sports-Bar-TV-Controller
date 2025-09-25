
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

export class EnhancedAIClient {
  private async getAvailableProvider(): Promise<{ provider: string; apiKey: string } | null> {
    try {
      const { prisma } = await import('./db')
      const { decrypt } = await import('./encryption')
      
      const activeKey = await prisma.apiKey.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      })

      if (!activeKey) {
        return null
      }

      const decryptedKey = decrypt(activeKey.keyValue)
      return {
        provider: activeKey.provider,
        apiKey: decryptedKey
      }
    } catch (error) {
      console.error('Error getting available provider:', error)
      return null
    }
  }

  private async makeAPICall(messages: any[], provider: string, apiKey: string): Promise<AIResponse> {
    try {
      let response: Response

      switch (provider) {
        case 'claude':
        case 'anthropic':
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 4000,
              messages: messages.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
              }))
            })
          })
          break

        case 'openai':
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4',
              messages: messages,
              max_tokens: 4000
            })
          })
          break

        case 'grok':
        case 'xai':
          response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'grok-beta',
              messages: messages,
              max_tokens: 4000
            })
          })
          break

        default:
          return { error: 'Unsupported AI provider' }
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API Error (${response.status}):`, errorText)
        return { error: `API error: ${response.statusText}` }
      }

      const data = await response.json()

      switch (provider) {
        case 'claude':
        case 'anthropic':
          return { content: data.content?.[0]?.text || 'No response from Claude' }
        case 'openai':
        case 'grok':
        case 'xai':
          return { content: data.choices?.[0]?.message?.content || 'No response from AI' }
        default:
          return { error: 'Unknown response format' }
      }
    } catch (error) {
      console.error('API call error:', error)
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async enhancedChat(messages: any[], context?: string): Promise<AIResponse> {
    const provider = await this.getAvailableProvider()
    if (!provider) {
      return { error: 'No AI provider configured. Please add an API key.' }
    }

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

Provide detailed, technical, and actionable responses. When discussing AV equipment, reference specific models, connection types, and troubleshooting steps.`
    }

    const fullMessages = [systemMessage, ...messages]
    return this.makeAPICall(fullMessages, provider.provider, provider.apiKey)
  }

  async generateScript(request: ScriptGenerationRequest): Promise<AIResponse> {
    const provider = await this.getAvailableProvider()
    if (!provider) {
      return { error: 'No AI provider configured. Please add an API key.' }
    }

    const systemMessage = {
      role: 'system',
      content: `You are an expert script generator. Generate production-ready ${request.scriptType} scripts based on the user's requirements. Follow these guidelines:

1. Include proper error handling
2. Add clear comments explaining each step
3. Follow best practices for the chosen language
4. Include input validation where appropriate
5. Make the script robust and maintainable
6. Add usage instructions at the top

Only respond with the script code, no additional explanation unless specifically requested.`
    }

    const userMessage = {
      role: 'user',
      content: `Generate a ${request.scriptType} script for: ${request.description}

${request.requirements.length > 0 ? `Requirements:\n${request.requirements.map(req => `- ${req}`).join('\n')}` : ''}

${request.context ? `Additional Context:\n${request.context}` : ''}`
    }

    return this.makeAPICall([systemMessage, userMessage], provider.provider, provider.apiKey)
  }

  async designFeature(request: FeatureDesignRequest): Promise<AIResponse> {
    const provider = await this.getAvailableProvider()
    if (!provider) {
      return { error: 'No AI provider configured. Please add an API key.' }
    }

    const systemMessage = {
      role: 'system',
      content: `You are an expert software architect and feature designer. Create comprehensive feature specifications based on the user's requirements. Your response should include:

1. **Feature Overview** - Brief description and goals
2. **Technical Specifications** - Architecture and implementation details
3. **User Interface Design** - Component structure and user flow
4. **API Design** - Endpoints and data models if applicable
5. **Implementation Plan** - Step-by-step development approach
6. **Testing Strategy** - Unit and integration testing approach
7. **Deployment Considerations** - Infrastructure and deployment requirements

Focus on ${request.technology} implementation with ${request.complexity} complexity level.`
    }

    const userMessage = {
      role: 'user',
      content: `Design a feature called "${request.featureName}" with the following details:

Description: ${request.description}

Requirements:
${request.requirements.map(req => `- ${req}`).join('\n')}

Technology Stack: ${request.technology}
Complexity Level: ${request.complexity}

Please provide a detailed feature specification and implementation guide.`
    }

    return this.makeAPICall([systemMessage, userMessage], provider.provider, provider.apiKey)
  }

  async fileSystemAssistant(query: string, context?: string): Promise<AIResponse & { actions?: string[] }> {
    const provider = await this.getAvailableProvider()
    if (!provider) {
      return { error: 'No AI provider configured. Please add an API key.' }
    }

    const systemMessage = {
      role: 'system',
      content: `You are an advanced Sports Bar AI Assistant with file system management capabilities. You can help with:

**Available File System Operations:**
1. **Script Creation** - Generate and write scripts (bash, python, javascript, etc.)
2. **File Management** - Create, read, modify, and delete files
3. **Directory Operations** - Create directories, list contents, navigate structure
4. **Command Execution** - Run shell commands and scripts
5. **System Administration** - Manage server processes, configurations

**When responding:**
- Provide clear, actionable advice
- Suggest specific commands or file operations when appropriate
- Reference available file system APIs when relevant
- Include safety warnings for destructive operations
- Offer step-by-step instructions

**Safety Guidelines:**
- Always warn before suggesting destructive operations
- Recommend backups before major changes
- Validate file paths and permissions
- Use secure coding practices

${context ? `\nAdditional Context:\n${context}` : ''}

Focus on practical, implementation-ready solutions for sports bar AV system management.`
    }

    const userMessage = {
      role: 'user',
      content: query
    }

    const result = await this.makeAPICall([systemMessage, userMessage], provider.provider, provider.apiKey)
    
    // Parse response for potential actions
    const actions: string[] = []
    if (result.content) {
      // Look for common file system operations mentioned in the response
      if (result.content.toLowerCase().includes('create script') || result.content.toLowerCase().includes('write script')) {
        actions.push('create-script')
      }
      if (result.content.toLowerCase().includes('execute') || result.content.toLowerCase().includes('run command')) {
        actions.push('execute-command')
      }
      if (result.content.toLowerCase().includes('create file') || result.content.toLowerCase().includes('write file')) {
        actions.push('create-file')
      }
      if (result.content.toLowerCase().includes('list directory') || result.content.toLowerCase().includes('browse files')) {
        actions.push('list-directory')
      }
    }

    return { ...result, actions }
  }

  async generateSystemScript(description: string, scriptType: 'bash' | 'python' | 'javascript' = 'bash'): Promise<AIResponse> {
    return this.generateScript({
      description,
      scriptType,
      requirements: [
        'Error handling and logging',
        'Safe execution with validation',
        'Clear documentation and comments',
        'Production-ready code quality'
      ],
      context: 'Sports Bar AI Assistant system management script'
    })
  }
}
