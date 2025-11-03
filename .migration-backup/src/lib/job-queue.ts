/**
 * Background Job Queue System
 *
 * A simple, efficient job queue for processing tasks asynchronously
 * without blocking the main application thread.
 *
 * Features:
 * - Non-blocking job execution
 * - Retry logic with exponential backoff
 * - Job status tracking
 * - Priority queue support
 * - Concurrent job processing
 * - Memory-efficient implementation
 * - No external dependencies
 */

import { EventEmitter } from 'events'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
export type JobPriority = 'low' | 'normal' | 'high' | 'critical'

export interface Job<T = any, R = any> {
  id: string
  type: string
  priority: JobPriority
  data: T
  status: JobStatus
  result?: R
  error?: string
  attempts: number
  maxAttempts: number
  createdAt: number
  startedAt?: number
  completedAt?: number
  nextRetryAt?: number
  metadata?: Record<string, any>
}

export interface JobQueueConfig {
  maxConcurrent?: number
  defaultMaxAttempts?: number
  retryDelay?: number // Base delay in ms
  retryBackoff?: number // Exponential backoff multiplier
  jobTimeout?: number // Max time for a job in ms
  cleanupInterval?: number // How often to clean old jobs
  maxCompletedJobs?: number // Max completed jobs to keep
}

export type JobHandler<T = any, R = any> = (data: T, job: Job<T, R>) => Promise<R>

const DEFAULT_CONFIG: Required<JobQueueConfig> = {
  maxConcurrent: 3,
  defaultMaxAttempts: 3,
  retryDelay: 1000,
  retryBackoff: 2,
  jobTimeout: 30000,
  cleanupInterval: 60000,
  maxCompletedJobs: 1000
}

export class JobQueue extends EventEmitter {
  private config: Required<JobQueueConfig>
  private jobs: Map<string, Job> = new Map()
  private handlers: Map<string, JobHandler> = new Map()
  private processingCount = 0
  private cleanupTimer: NodeJS.Timeout | null = null
  private processingTimer: NodeJS.Timeout | null = null

  constructor(config?: JobQueueConfig) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startCleanup()
    this.startProcessing()
  }

  /**
   * Register a job handler for a specific job type
   */
  registerHandler<T = any, R = any>(type: string, handler: JobHandler<T, R>): void {
    this.handlers.set(type, handler as JobHandler)
  }

  /**
   * Add a job to the queue
   */
  addJob<T = any>(
    type: string,
    data: T,
    options?: {
      priority?: JobPriority
      maxAttempts?: number
      metadata?: Record<string, any>
    }
  ): string {
    const jobId = this.generateJobId()

    const job: Job<T> = {
      id: jobId,
      type,
      priority: options?.priority || 'normal',
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts: options?.maxAttempts || this.config.defaultMaxAttempts,
      createdAt: Date.now(),
      metadata: options?.metadata
    }

    this.jobs.set(jobId, job)
    this.emit('job:added', job)

    // Trigger processing
    this.processNext()

    return jobId
  }

  /**
   * Add multiple jobs at once
   */
  addJobs<T = any>(
    type: string,
    dataList: T[],
    options?: {
      priority?: JobPriority
      maxAttempts?: number
    }
  ): string[] {
    return dataList.map(data => this.addJob(type, data, options))
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | null {
    return this.jobs.get(jobId) || null
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status)
  }

  /**
   * Get jobs by type
   */
  getJobsByType(type: string): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.type === type)
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
    retrying: number
    avgProcessingTime: number
    successRate: number
  } {
    const jobs = Array.from(this.jobs.values())
    const completed = jobs.filter(j => j.status === 'completed')
    const failed = jobs.filter(j => j.status === 'failed')

    const processingTimes = completed
      .filter(j => j.startedAt && j.completedAt)
      .map(j => j.completedAt! - j.startedAt!)

    const avgProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
        : 0

    const totalFinished = completed.length + failed.length
    const successRate = totalFinished > 0 ? (completed.length / totalFinished) * 100 : 0

    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: completed.length,
      failed: failed.length,
      retrying: jobs.filter(j => j.status === 'retrying').length,
      avgProcessingTime,
      successRate
    }
  }

  /**
   * Remove a job from the queue
   */
  removeJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status === 'processing') {
      return false // Cannot remove processing jobs
    }

    this.jobs.delete(jobId)
    this.emit('job:removed', job)
    return true
  }

  /**
   * Clear all completed jobs
   */
  clearCompleted(): number {
    let count = 0
    for (const [id, job] of this.jobs) {
      if (job.status === 'completed') {
        this.jobs.delete(id)
        count++
      }
    }
    return count
  }

  /**
   * Clear all failed jobs
   */
  clearFailed(): number {
    let count = 0
    for (const [id, job] of this.jobs) {
      if (job.status === 'failed') {
        this.jobs.delete(id)
        count++
      }
    }
    return count
  }

  /**
   * Process the next job in the queue
   */
  private async processNext(): Promise<void> {
    if (this.processingCount >= this.config.maxConcurrent) {
      return // Already at max concurrent
    }

    const job = this.getNextJob()
    if (!job) {
      return // No jobs to process
    }

    this.processingCount++
    this.processJob(job)
      .finally(() => {
        this.processingCount--
        // Try to process next job
        setImmediate(() => this.processNext())
      })
  }

  /**
   * Get the next job to process (respecting priority)
   */
  private getNextJob(): Job | null {
    const now = Date.now()
    const priorityOrder: JobPriority[] = ['critical', 'high', 'normal', 'low']

    for (const priority of priorityOrder) {
      for (const job of this.jobs.values()) {
        if (job.priority === priority) {
          if (job.status === 'pending') {
            return job
          }
          if (job.status === 'retrying' && job.nextRetryAt && job.nextRetryAt <= now) {
            return job
          }
        }
      }
    }

    return null
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type)
    if (!handler) {
      job.status = 'failed'
      job.error = `No handler registered for job type: ${job.type}`
      this.emit('job:failed', job)
      return
    }

    job.status = 'processing'
    job.startedAt = Date.now()
    job.attempts++
    this.emit('job:processing', job)

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout')), this.config.jobTimeout)
    })

    try {
      const result = await Promise.race([
        handler(job.data, job),
        timeoutPromise
      ])

      job.status = 'completed'
      job.result = result
      job.completedAt = Date.now()
      this.emit('job:completed', job)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      job.error = errorMessage

      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        job.status = 'retrying'
        const delay =
          this.config.retryDelay * Math.pow(this.config.retryBackoff, job.attempts - 1)
        job.nextRetryAt = Date.now() + delay
        this.emit('job:retrying', job)
      } else {
        // Max attempts reached
        job.status = 'failed'
        job.completedAt = Date.now()
        this.emit('job:failed', job)
      }
    }
  }

  /**
   * Start background processing loop
   */
  private startProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
    }

    this.processingTimer = setInterval(() => {
      this.processNext()
    }, 100) // Check every 100ms

    if (this.processingTimer.unref) {
      this.processingTimer.unref()
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  /**
   * Clean up old completed jobs
   */
  private cleanup(): void {
    const completed = Array.from(this.jobs.values())
      .filter(j => j.status === 'completed')
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))

    if (completed.length > this.config.maxCompletedJobs) {
      const toRemove = completed.slice(this.config.maxCompletedJobs)
      toRemove.forEach(job => this.jobs.delete(job.id))
      this.emit('cleanup', toRemove.length)
    }
  }

  /**
   * Stop the job queue
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = null
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Wait for a job to complete
   */
  async waitForJob(jobId: string, timeout: number = 30000): Promise<Job | null> {
    const job = this.jobs.get(jobId)
    if (!job) return null

    if (job.status === 'completed' || job.status === 'failed') {
      return job
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('Job wait timeout'))
      }, timeout)

      const onComplete = (completedJob: Job) => {
        if (completedJob.id === jobId) {
          cleanup()
          resolve(completedJob)
        }
      }

      const onFailed = (failedJob: Job) => {
        if (failedJob.id === jobId) {
          cleanup()
          resolve(failedJob)
        }
      }

      const cleanup = () => {
        clearTimeout(timer)
        this.off('job:completed', onComplete)
        this.off('job:failed', onFailed)
      }

      this.on('job:completed', onComplete)
      this.on('job:failed', onFailed)
    })
  }
}

// Global job queue instance
export const jobQueue = new JobQueue()

// Helper functions for common job types
export const jobHelpers = {
  /**
   * Add AI analysis job
   */
  addAIAnalysisJob: (data: any, priority: JobPriority = 'normal') => {
    return jobQueue.addJob('ai-analysis', data, { priority })
  },

  /**
   * Add log processing job
   */
  addLogProcessingJob: (logs: any[], priority: JobPriority = 'low') => {
    return jobQueue.addJob('log-processing', logs, { priority })
  },

  /**
   * Add document indexing job
   */
  addDocumentIndexingJob: (document: any, priority: JobPriority = 'normal') => {
    return jobQueue.addJob('document-indexing', document, { priority })
  },

  /**
   * Add cache warming job
   */
  addCacheWarmingJob: (type: string, data: any, priority: JobPriority = 'low') => {
    return jobQueue.addJob('cache-warming', { type, data }, { priority })
  }
}
