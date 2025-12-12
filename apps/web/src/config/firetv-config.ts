/**
 * Fire TV Connection Configuration
 *
 * Centralized configuration for Fire TV ADB connections,
 * health monitoring, and auto-reconnection settings.
 */

export interface FireTVConfig {
  // Connection settings
  connection: {
    defaultPort: number
    connectionTimeout: number // milliseconds
    keepAliveInterval: number // milliseconds
    keepAliveEnabled: boolean
    maxConnectionAttempts: number
  }

  // Health monitoring settings
  healthCheck: {
    enabled: boolean
    interval: number // milliseconds - how often to check device health
    startupDelay: number // milliseconds - delay before starting health checks
    commandTimeout: number // milliseconds - timeout for health check commands
  }

  // Auto-reconnection settings
  reconnection: {
    enabled: boolean
    maxAttempts: number // max reconnection attempts before giving up
    backoffStrategy: 'exponential' | 'linear' | 'fixed'
    initialDelay: number // milliseconds - initial backoff delay
    maxDelay: number // milliseconds - maximum backoff delay
    resetOnSuccess: boolean // reset attempt counter on successful reconnection
  }

  // Connection lifecycle settings
  lifecycle: {
    inactivityTimeout: number // milliseconds - disconnect after this much inactivity
    cleanupInterval: number // milliseconds - how often to check for stale connections
  }

  // Alert settings
  alerts: {
    enabled: boolean
    downTimeThreshold: number // milliseconds - alert when device down longer than this
    consecutiveFailureThreshold: number // alert after this many consecutive failures
  }

  // Logging settings
  logging: {
    verbose: boolean
    logKeepAlive: boolean
    logHealthChecks: boolean
    logReconnections: boolean
  }
}

/**
 * Default configuration optimized for reliability
 */
export const defaultFireTVConfig: FireTVConfig = {
  connection: {
    defaultPort: 5555,
    connectionTimeout: 5000, // 5 seconds
    keepAliveInterval: 30000, // 30 seconds
    keepAliveEnabled: true,
    maxConnectionAttempts: 3
  },

  healthCheck: {
    enabled: true,
    interval: 30000, // 30 seconds (reduced from 60s for faster detection)
    startupDelay: 5000, // 5 seconds
    commandTimeout: 3000 // 3 seconds
  },

  reconnection: {
    enabled: true,
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds (reduced from 60s for faster recovery)
    resetOnSuccess: true
  },

  lifecycle: {
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 60 * 1000 // 1 minute
  },

  alerts: {
    enabled: true,
    downTimeThreshold: 5 * 60 * 1000, // 5 minutes
    consecutiveFailureThreshold: 3
  },

  logging: {
    verbose: false,
    logKeepAlive: false, // Reduce log noise
    logHealthChecks: true,
    logReconnections: true
  }
}

/**
 * Configuration for development/testing environment
 */
export const devFireTVConfig: FireTVConfig = {
  ...defaultFireTVConfig,
  healthCheck: {
    ...defaultFireTVConfig.healthCheck,
    interval: 10000 // Check every 10 seconds in dev
  },
  reconnection: {
    ...defaultFireTVConfig.reconnection,
    initialDelay: 500, // Faster reconnection in dev
    maxDelay: 10000
  },
  logging: {
    verbose: true,
    logKeepAlive: true,
    logHealthChecks: true,
    logReconnections: true
  }
}

/**
 * Configuration for production environment
 */
export const prodFireTVConfig: FireTVConfig = {
  ...defaultFireTVConfig,
  logging: {
    verbose: false,
    logKeepAlive: false, // Disabled to reduce log volume
    logHealthChecks: false, // Disabled to reduce log volume (960 lines/hour → 0)
    logReconnections: true
  }
}

/**
 * Get active configuration based on environment
 */
export function getFireTVConfig(): FireTVConfig {
  const env = process.env.NODE_ENV || 'development'

  switch (env) {
    case 'production':
      return prodFireTVConfig
    case 'development':
      return devFireTVConfig
    default:
      return defaultFireTVConfig
  }
}

/**
 * Calculate backoff delay based on configuration
 */
export function calculateBackoffDelay(
  attempt: number,
  config: FireTVConfig['reconnection']
): number {
  switch (config.backoffStrategy) {
    case 'exponential':
      return Math.min(
        config.initialDelay * Math.pow(2, attempt),
        config.maxDelay
      )

    case 'linear':
      return Math.min(
        config.initialDelay * (attempt + 1),
        config.maxDelay
      )

    case 'fixed':
    default:
      return config.initialDelay
  }
}
