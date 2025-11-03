/**
 * Enhanced AI Client with Ollama Integration
 * ENHANCED: Added health check, caching, and exponential backoff retry logic
 */

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
  cached?: boolean
  healthCheckPassed?: boolean
}

// Local Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2'

// Health check cache configuration
const HEALTH_CHECK_CACHE_DURATION = 30 * 1000 // 30 seconds
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 10000 // 10 seconds

interface HealthCheckCache {
  isHealthy: boolean
  lastChecked: number
  consecutiveFailures: number
}

export class EnhancedAIClient {
  private healthCheckCache: HealthCheckCache = {
    isHealthy: false,
    lastChecked: 0,
    consecutiveFailures: 0,
  }

  /**
   * Check if Ollama service is healthy
   * Implements caching to avoid excessive health checks
   */
  private async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    const now = Date.now()

    // Return cached result if still valid
    if (now - this.healthCheckCache.lastChecked < HEALTH_CHECK_CACHE_DURATION) {
      return {
        healthy: this.healthCheckCache.isHealthy,
        error: this.healthCheckCache.isHealthy ? undefined : 'Ollama service is not available (cached)',
      }
    }

    try {
      // Try to fetch Ollama version/status
      const response = await fetch(`${OLLAMA_BASE_URL}/api/version`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (response.ok) {
        // Health check passed
        this.healthCheckCache = {
          isHealthy: true,
          lastChecked: now,
          consecutiveFailures: 0,
        }
        return { healthy: true }
      } else {
        throw new Error(`Health check failed with status ${response.status}`)
      }
    } catch (error) {
      // Health check failed
      this.healthCheckCache = {
        isHealthy: false,
        lastChecked: now,
        consecutiveFailures: this.healthCheckCache.consecutiveFailures + 1,
      }

      return {
        healthy: false,
        error: `Ollama health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Call Ollama API with retry logic and exponential backoff
   */
  private async callLocalOllama(messages: any[]): Promise<AIResponse> {
    // First, check if Ollama is healthy
    const healthCheck = await this.checkHealth()

    if (!healthCheck.healthy) {
      return {
        error: `Ollama service is unavailable. ${healthCheck.error || 'Please ensure Ollama is running on ' + OLLAMA_BASE_URL}`,
        content: this.getMockResponse(),
        healthCheckPassed: false,
      }
    }

    // Attempt to call Ollama with retries
    let lastError: Error | null = null
    let retryDelay = INITIAL_RETRY_DELAY

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
          }),
          signal: AbortSignal.timeout(60000), // 60 second timeout
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Ollama API error (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        return {
          content: data.message?.content || 'No response from local AI',
          healthCheckPassed: true,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.error(`Ollama API call attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message)

        // If this is not the last attempt, wait before retrying
        if (attempt < MAX_RETRIES) {
          console.log(`Retrying in ${retryDelay}ms...`)
          await this.sleep(retryDelay)

          // Exponential backoff with jitter
          retryDelay = Math.min(
            retryDelay * 2 + Math.random() * 1000,
            MAX_RETRY_DELAY
          )
        }
      }
    }

    // All retries failed
    return {
      error: `Ollama failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`,
      content: this.getMockResponse(),
      healthCheckPassed: false,
    }
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get a mock response when Ollama is unavailable
   * Provides graceful degradation
   */
  private getMockResponse(): string {
    return `[AI Service Unavailable]

The AI service is currently unavailable. This is a fallback response.

To resolve this issue:
1. Ensure Ollama is installed and running: \`ollama serve\`
2. Verify the OLLAMA_BASE_URL environment variable (currently: ${OLLAMA_BASE_URL})
3. Check that the ${OLLAMA_MODEL} model is installed: \`ollama pull ${OLLAMA_MODEL}\`
4. Review Ollama logs for any errors

For immediate assistance, please consult the system documentation or contact support.`
  }

  /**
   * Enhanced chat with system context
   */
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

  /**
   * Generate scripts with enhanced prompting
   */
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

  /**
   * Design features with architectural guidance
   */
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

  /**
   * Get current health status
   * Useful for monitoring and diagnostics
   */
  async getHealthStatus(): Promise<{
    healthy: boolean
    lastChecked: Date | null
    consecutiveFailures: number
    ollamaUrl: string
    ollamaModel: string
  }> {
    const health = await this.checkHealth()

    return {
      healthy: health.healthy,
      lastChecked: this.healthCheckCache.lastChecked > 0
        ? new Date(this.healthCheckCache.lastChecked)
        : null,
      consecutiveFailures: this.healthCheckCache.consecutiveFailures,
      ollamaUrl: OLLAMA_BASE_URL,
      ollamaModel: OLLAMA_MODEL,
    }
  }

  /**
   * Force a health check (bypass cache)
   */
  async forceHealthCheck(): Promise<{ healthy: boolean; error?: string }> {
    this.healthCheckCache.lastChecked = 0 // Invalidate cache
    return await this.checkHealth()
  }
}
