/**
 * Job Tracker Service
 *
 * Simple in-memory job tracking system for long-running background tasks
 * Supports progress tracking, status updates, and automatic cleanup
 */

import { logger } from '@sports-bar/logger'

export type JobType = 'cec-discovery' | 'health-check' | 'other'
export type JobStatus = 'running' | 'completed' | 'failed'

export interface JobProgress {
  current: number
  total: number
  message: string
}

export interface Job {
  id: string
  type: JobType
  status: JobStatus
  progress: JobProgress
  result?: any
  error?: string
  startedAt: Date
  completedAt?: Date
}

/**
 * In-memory job tracker
 * Can be upgraded to database-backed storage if persistence is needed
 */
class JobTrackerService {
  private jobs: Map<string, Job> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start cleanup interval (every 10 minutes)
    this.startCleanup()
  }

  /**
   * Create a new job and return its ID
   */
  createJob(type: JobType, total: number, initialMessage = 'Starting...'): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const job: Job = {
      id,
      type,
      status: 'running',
      progress: {
        current: 0,
        total,
        message: initialMessage
      },
      startedAt: new Date()
    }

    this.jobs.set(id, job)

    logger.info(`[JobTracker] Job created: ${id} (type: ${type}, total: ${total})`)

    return id
  }

  /**
   * Update job progress
   */
  updateProgress(id: string, current: number, message: string): void {
    const job = this.jobs.get(id)

    if (!job) {
      logger.warn(`[JobTracker] Attempt to update non-existent job: ${id}`)
      return
    }

    if (job.status !== 'running') {
      logger.warn(`[JobTracker] Attempt to update non-running job: ${id} (status: ${job.status})`)
      return
    }

    job.progress.current = current
    job.progress.message = message

    const percentage = Math.round((current / job.progress.total) * 100)
    logger.debug(`[JobTracker] Job ${id} progress: ${current}/${job.progress.total} (${percentage}%) - ${message}`)
  }

  /**
   * Mark job as completed with result
   */
  completeJob(id: string, result: any): void {
    const job = this.jobs.get(id)

    if (!job) {
      logger.warn(`[JobTracker] Attempt to complete non-existent job: ${id}`)
      return
    }

    job.status = 'completed'
    job.result = result
    job.completedAt = new Date()

    const duration = job.completedAt.getTime() - job.startedAt.getTime()
    logger.info(`[JobTracker] Job completed: ${id} (duration: ${Math.round(duration / 1000)}s)`)
  }

  /**
   * Mark job as failed with error message
   */
  failJob(id: string, error: string): void {
    const job = this.jobs.get(id)

    if (!job) {
      logger.warn(`[JobTracker] Attempt to fail non-existent job: ${id}`)
      return
    }

    job.status = 'failed'
    job.error = error
    job.completedAt = new Date()

    const duration = job.completedAt.getTime() - job.startedAt.getTime()
    logger.error(`[JobTracker] Job failed: ${id} (duration: ${Math.round(duration / 1000)}s) - ${error}`)
  }

  /**
   * Get job by ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  /**
   * Get all jobs (for debugging/monitoring)
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values())
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
  getJobsByType(type: JobType): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.type === type)
  }

  /**
   * Manually delete a job
   */
  deleteJob(id: string): boolean {
    const deleted = this.jobs.delete(id)

    if (deleted) {
      logger.debug(`[JobTracker] Job deleted: ${id}`)
    }

    return deleted
  }

  /**
   * Auto-cleanup old completed/failed jobs after 1 hour
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    let deletedCount = 0

    for (const [id, job] of this.jobs.entries()) {
      if (job.completedAt && job.completedAt.getTime() < oneHourAgo) {
        this.jobs.delete(id)
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      logger.info(`[JobTracker] Cleanup: Removed ${deletedCount} old job(s)`)
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return
    }

    // Cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 10 * 60 * 1000)

    logger.debug('[JobTracker] Automatic cleanup started (every 10 minutes)')
  }

  /**
   * Stop automatic cleanup (for testing or shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      logger.debug('[JobTracker] Automatic cleanup stopped')
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const all = this.getAllJobs()
    const running = all.filter(j => j.status === 'running')
    const completed = all.filter(j => j.status === 'completed')
    const failed = all.filter(j => j.status === 'failed')

    return {
      total: all.length,
      running: running.length,
      completed: completed.length,
      failed: failed.length,
      byType: {
        cecDiscovery: all.filter(j => j.type === 'cec-discovery').length,
        healthCheck: all.filter(j => j.type === 'health-check').length,
        other: all.filter(j => j.type === 'other').length
      }
    }
  }
}

// Singleton instance
export const jobTracker = new JobTrackerService()

// Export class for testing
export { JobTrackerService }
