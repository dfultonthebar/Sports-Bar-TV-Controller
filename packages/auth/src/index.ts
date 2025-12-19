/**
 * @sports-bar/auth
 *
 * Authentication and authorization for Sports Bar TV Controller
 *
 * Features:
 * - PIN-based authentication for staff/admin access
 * - API key authentication for webhooks and automation
 * - Session management with auto-extension
 * - Role-based access control (STAFF/ADMIN)
 * - Comprehensive audit logging
 */

// Configuration and types
export {
  AUTH_CONFIG,
  AccessLevel,
  REQUIRES_CONFIRMATION,
  PUBLIC_ENDPOINT_PATTERNS,
  WEBHOOK_ENDPOINT_PATTERNS,
  ADMIN_ENDPOINT_PATTERNS,
  matchesEndpointPattern,
  getEndpointAccessLevel,
  requiresConfirmation,
  type UserRole
} from './config'

// PIN authentication
export {
  hashPIN,
  verifyPIN,
  validatePIN,
  createPIN,
  deletePIN,
  deactivatePIN,
  listPINs,
  updatePINDescription
} from './pin'

// Session management
export {
  createSession,
  validateSession,
  extendSession,
  destroySession,
  cleanupExpiredSessions,
  getActiveSessions,
  destroyAllSessions,
  getSessionStats,
  type SessionData
} from './session'

// API key management
export {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  validateApiKey,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  listApiKeys,
  updateApiKeyPermissions,
  getApiKeyStats,
  type ApiKeyData
} from './api-key'

// Audit logging
export {
  logAuditAction,
  getAuditLogs,
  getAuditLogById,
  getAuditLogStats,
  getSessionAuditLogs,
  cleanupOldAuditLogs,
  exportAuditLogs,
  type AuditLogEntry,
  type AuditLogFilters
} from './audit'

// Middleware
export {
  requireAuth,
  checkAuth,
  requireConfirmation,
  getCurrentSession,
  isAdmin,
  isAuthenticated,
  withAudit,
  type AuthResult
} from './middleware'
