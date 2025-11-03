
import { NextResponse, NextRequest } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

interface ServiceStatus {
  name: string
  endpoint: string
  status: 'active' | 'inactive' | 'error'
  model?: string
  responseTime?: number
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const services: ServiceStatus[] = []
  
  // Test local services
  const localServices = [
    { name: 'Custom Local AI', endpoint: 'http://localhost:8000/v1/models', port: 8000 },
    { name: 'Ollama', endpoint: 'http://localhost:11434/api/tags', port: 11434 },
    { name: 'LocalAI', endpoint: 'http://localhost:8080/v1/models', port: 8080 },
    { name: 'LM Studio', endpoint: 'http://localhost:1234/v1/models', port: 1234 },
    { name: 'Text Generation WebUI', endpoint: 'http://localhost:5000/v1/models', port: 5000 },
    { name: 'Tabby', endpoint: 'http://localhost:8080/v1/models', port: 8080 }
  ]

  for (const service of localServices) {
    const startTime = Date.now()
    try {
      const response = await fetch(service.endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      
      const responseTime = Date.now() - startTime
      
      if (response.ok) {
        let model = 'default'
        try {
          const data = await response.json()
          // Try to extract model names from different API formats
          if (data.models && Array.isArray(data.models)) {
            model = data.models[0]?.id || data.models[0]?.name || 'default'
          } else if (data.data && Array.isArray(data.data)) {
            model = data.data[0]?.id || data.data[0]?.name || 'default'
          } else if (Array.isArray(data)) {
            model = data[0]?.name || 'default'
          }
        } catch (e) {
          // If we can't parse the response, just use default
        }
        
        services.push({
          name: service.name,
          endpoint: service.endpoint,
          status: 'active',
          model,
          responseTime
        })
      } else {
        services.push({
          name: service.name,
          endpoint: service.endpoint,
          status: 'inactive'
        })
      }
    } catch (error: any) {
      services.push({
        name: service.name,
        endpoint: service.endpoint,
        status: error.name === 'AbortError' ? 'inactive' : 'error'
      })
    }
  }

  // Also test cloud services if API keys are available
  const cloudServices = [
    { name: 'Abacus AI', hasKey: !!process.env.ABACUSAI_API_KEY },
    { name: 'OpenAI', hasKey: !!process.env.OPENAI_API_KEY },
    { name: 'Anthropic Claude', hasKey: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) },
    { name: 'X.AI Grok', hasKey: !!(process.env.GROK_API_KEY || process.env.XAI_API_KEY) }
  ]

  return NextResponse.json({
    success: true,
    localServices: services,
    cloudServices,
    total: services.length,
    active: services.filter(s => s.status === 'active').length
  })
}
