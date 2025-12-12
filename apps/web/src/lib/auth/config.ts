/**
 * Authentication Configuration
 *
 * Central configuration for the authentication system including:
 * - Session duration and cookie settings
 * - PIN requirements
 * - Location identification
 * - Security settings
 */

// Role types
export type UserRole = 'STAFF' | 'ADMIN'

// Auth configuration
export const AUTH_CONFIG = {
  // Session settings
  SESSION_DURATION: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
  SESSION_EXTENSION_THRESHOLD: 30 * 60 * 1000, // Auto-extend if activity within 30 minutes of expiry
  SESSION_CLEANUP_INTERVAL: 60 * 60 * 1000, // Cleanup expired sessions every hour

  // Cookie settings
  COOKIE_NAME: 'sports-bar-session',
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  },

  // PIN settings
  PIN_LENGTH: 4,
  PIN_MIN_VALUE: 1000,
  PIN_MAX_VALUE: 9999,
  PIN_BCRYPT_ROUNDS: 10,

  // API Key settings
  API_KEY_LENGTH: 32, // 32 bytes = 256 bits
  API_KEY_BCRYPT_ROUNDS: 10,

  // Location settings (for multi-location support)
  LOCATION_ID: process.env.LOCATION_ID || 'default-location',
  LOCATION_NAME: process.env.LOCATION_NAME || 'Sports Bar',

  // Rate limiting for auth endpoints
  AUTH_RATE_LIMIT: {
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    LOGIN_LOCKOUT_MS: 30 * 60 * 1000, // 30 minutes lockout after max attempts
  },

  // Audit log settings
  AUDIT_LOG_RETENTION_DAYS: 90, // Keep audit logs for 90 days

  // Security headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  },
} as const

// Endpoint access levels
export enum AccessLevel {
  PUBLIC = 'PUBLIC',     // No authentication required
  STAFF = 'STAFF',       // Staff PIN required
  ADMIN = 'ADMIN',       // Admin PIN required
  WEBHOOK = 'WEBHOOK',   // API key required
}

// Actions that require confirmation
export const REQUIRES_CONFIRMATION = [
  'SYSTEM_REBOOT',
  'SYSTEM_RESTART',
  'SYSTEM_SHUTDOWN',
  'GIT_COMMIT_PUSH',
  'GIT_RESET',
  'FILE_SYSTEM_EXECUTE',
  'DELETE_ALL',
  'DATABASE_RESET',
  'FACTORY_RESET',
] as const

// Public endpoints that don't require authentication
export const PUBLIC_ENDPOINT_PATTERNS = [
  '/api/health',
  '/api/status',
  '/api/sports-guide',
  '/api/streaming/events',
  '/api/streaming/status',
  '/api/home-teams',
  '/api/selected-leagues',
  '/api/tv-provider',
  '/api/logs/preview',
  '/api/logs/stats',
  '/api/logs/analytics',
] as const

// Webhook endpoints that require API key
export const WEBHOOK_ENDPOINT_PATTERNS = [
  '/api/webhooks',
  '/api/n8n',
  '/api/automation',
] as const

// Admin-only endpoints
export const ADMIN_ENDPOINT_PATTERNS = [
  '/api/system/reboot',
  '/api/system/restart',
  '/api/system/shutdown',
  '/api/git',
  '/api/file-system/execute',
  '/api/auth/pins',
  '/api/auth/api-keys',
  '/api/auth/audit-log',
  '/api/config',
] as const

/**
 * Determine if an endpoint pattern matches a given path
 */
export function matchesEndpointPattern(path: string, patterns: readonly string[]): boolean {
  return patterns.some(pattern => {
    // Exact match
    if (path === pattern) return true

    // Prefix match (for endpoints like /api/git/*)
    if (path.startsWith(pattern + '/')) return true

    return false
  })
}

/**
 * Get access level required for an endpoint
 */
export function getEndpointAccessLevel(path: string): AccessLevel {
  // Check public endpoints first
  if (matchesEndpointPattern(path, PUBLIC_ENDPOINT_PATTERNS)) {
    return AccessLevel.PUBLIC
  }

  // Check webhook endpoints
  if (matchesEndpointPattern(path, WEBHOOK_ENDPOINT_PATTERNS)) {
    return AccessLevel.WEBHOOK
  }

  // Check admin endpoints
  if (matchesEndpointPattern(path, ADMIN_ENDPOINT_PATTERNS)) {
    return AccessLevel.ADMIN
  }

  // Default to STAFF level for all other endpoints
  return AccessLevel.STAFF
}

/**
 * Check if an action requires explicit confirmation
 */
export function requiresConfirmation(action: string): boolean {
  return REQUIRES_CONFIRMATION.includes(action as any)
}
