/**
 * Request Throttling Service for External APIs
 *
 * Implements request queuing and throttling for external API calls
 * Includes exponential backoff for failures
 *
 * Features:
 * - Request queuing when rate limits are reached
 * - Configurable requests per second
 * - Exponential backoff for failed requests
 * - Per-service throttling
 * - Automatic retry with backoff
 */

export interface ThrottleConfig {
  /** Maximum requests per second */
  requestsPerSecond: number
  /** Maximum concurrent requests */
  maxConcurrent: number
  /** Maximum retries for failed requests */
  maxRetries: number
  /** Initial backoff delay in ms */
  initialBackoffMs: number
  /** Maximum backoff delay in ms */
  maxBackoffMs: number
}

interface QueuedRequest<T> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: any) => void
  retries: number
  serviceName: string
}

export class RequestThrottler {
  private queue: QueuedRequest<any>[] = []
  private processing = false
  private lastRequestTime = 0
  private activeRequests = 0

  // Per-service metrics
  private metrics: Map<string, {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    totalRetries: number
    averageResponseTime: number
  }> = new Map()

  constructor(private config: ThrottleConfig) {}

  /**
   * Execute a request with throttling
   */
  async execute<T>(
    fn: () => Promise<T>,
    serviceName: string = 'default'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject,
        retries: 0,
        serviceName
      })

      this.processQueue()
    })
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    if (this.activeRequests >= this.config.maxConcurrent) {
      return
    }

    this.processing = true

    while (this.queue.length > 0 && this.activeRequests < this.config.maxConcurrent) {
      const request = this.queue.shift()
      if (!request) break

      // Calculate delay needed to respect rate limit
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      const minDelay = 1000 / this.config.requestsPerSecond
      const delay = Math.max(0, minDelay - timeSinceLastRequest)

      if (delay > 0) {
        await this.sleep(delay)
      }

      this.lastRequestTime = Date.now()
      this.activeRequests++

      // Execute request
      this.executeRequest(request)
    }

    this.processing = false
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    const startTime = Date.now()

    try {
      // Initialize metrics for this service
      if (!this.metrics.has(request.serviceName)) {
        this.metrics.set(request.serviceName, {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          totalRetries: 0,
          averageResponseTime: 0
        })
      }

      const metrics = this.metrics.get(request.serviceName)!
      metrics.totalRequests++

      const result = await request.fn()

      // Update metrics
      const responseTime = Date.now() - startTime
      metrics.successfulRequests++
      metrics.averageResponseTime =
        (metrics.averageResponseTime * (metrics.successfulRequests - 1) + responseTime) /
        metrics.successfulRequests

      request.resolve(result)
    } catch (error) {
      const metrics = this.metrics.get(request.serviceName)!

      // Check if we should retry
      if (request.retries < this.config.maxRetries) {
        request.retries++
        metrics.totalRetries++

        // Calculate exponential backoff
        const backoffDelay = Math.min(
          this.config.initialBackoffMs * Math.pow(2, request.retries - 1),
          this.config.maxBackoffMs
        )

        console.warn(
          `[RequestThrottler] Request to ${request.serviceName} failed, ` +
          `retrying in ${backoffDelay}ms (attempt ${request.retries + 1}/${this.config.maxRetries + 1})`
        )

        // Wait and retry
        await this.sleep(backoffDelay)
        this.queue.unshift(request) // Add back to front of queue
      } else {
        // Max retries reached
        metrics.failedRequests++
        console.error(
          `[RequestThrottler] Request to ${request.serviceName} failed after ${request.retries} retries:`,
          error
        )
        request.reject(error)
      }
    } finally {
      this.activeRequests--
      this.processQueue() // Continue processing queue
    }
  }

  /**
   * Get metrics for a specific service
   */
  getMetrics(serviceName: string) {
    return this.metrics.get(serviceName) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalRetries: 0,
      averageResponseTime: 0
    }
  }

  /**
   * Get metrics for all services
   */
  getAllMetrics() {
    const metrics: Record<string, any> = {}
    this.metrics.forEach((value, key) => {
      metrics[key] = value
    })
    return metrics
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      processing: this.processing,
      lastRequestTime: this.lastRequestTime
    }
  }

  /**
   * Clear the queue (for testing)
   */
  clearQueue() {
    this.queue = []
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.metrics.clear()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Predefined throttle configurations
 */
export const ThrottleConfigs = {
  // Conservative throttling for ESPN API
  ESPN: {
    requestsPerSecond: 2,
    maxConcurrent: 3,
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 10000
  },

  // Conservative throttling for TheSportsDB
  SPORTS_DB: {
    requestsPerSecond: 1,
    maxConcurrent: 2,
    maxRetries: 3,
    initialBackoffMs: 2000,
    maxBackoffMs: 15000
  },

  // Throttling for Ollama (local AI)
  OLLAMA: {
    requestsPerSecond: 1,
    maxConcurrent: 1, // Only one AI request at a time
    maxRetries: 2,
    initialBackoffMs: 500,
    maxBackoffMs: 5000
  },

  // Default throttling
  DEFAULT: {
    requestsPerSecond: 5,
    maxConcurrent: 5,
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 10000
  }
} as const

// Global throttler instances
export const espnThrottler = new RequestThrottler(ThrottleConfigs.ESPN)
export const sportsDBThrottler = new RequestThrottler(ThrottleConfigs.SPORTS_DB)
export const ollamaThrottler = new RequestThrottler(ThrottleConfigs.OLLAMA)
export const defaultThrottler = new RequestThrottler(ThrottleConfigs.DEFAULT)
