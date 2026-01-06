# Security Architecture Documentation

**Sports-Bar-TV-Controller Security Model**

Last Updated: November 6, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication System](#authentication-system)
3. [Authorization Model](#authorization-model)
4. [Input Validation](#input-validation)
5. [Rate Limiting](#rate-limiting)
6. [Data Protection](#data-protection)
7. [Attack Mitigation](#attack-mitigation)
8. [Audit & Compliance](#audit--compliance)

---

## Overview

The Sports-Bar-TV-Controller implements a multi-layered security architecture designed for sports bar environments with multiple staff members and external automation integrations.

### Security Principles

1. **Defense in Depth**: Multiple security layers (auth → rate limit → validation)
2. **Least Privilege**: Role-based access control (STAFF vs ADMIN)
3. **Audit Everything**: Comprehensive logging of administrative actions
4. **Fail Securely**: Errors deny access by default
5. **Zero Trust**: Every request validated, even from authenticated users

### Threat Model

**Protected Against**:
- Brute force PIN attacks (rate limiting)
- SQL injection (ORM parameterization)
- Cross-site scripting (React auto-escaping)
- Command injection (input sanitization)
- Unauthorized access (authentication)
- Privilege escalation (role checks)
- Data tampering (transaction integrity)

**Not Protected Against** (out of scope):
- Physical access to server
- Network layer attacks (DDoS, MITM)
- Social engineering

---

## Authentication System

### PIN-Based Authentication

**Design**: 4-digit numeric PINs (simple, fast for bartenders)

**Flow**:
```
1. User enters 4-digit PIN
2. Rate limit check (5 attempts/min)
3. PIN validation (bcrypt compare)
4. Session creation (24-hour expiry)
5. Cookie set (HttpOnly, SameSite=Strict)
```

**Implementation**:
```typescript
// /src/lib/auth/pin.ts
export async function validatePin(
  pin: string,
  locationId: string
): Promise<PinValidationResult> {
  // 1. Query active PINs for location
  const pins = await db.select()
    .from(schema.authPins)
    .where(
      and(
        eq(schema.authPins.locationId, locationId),
        eq(schema.authPins.isActive, true)
      )
    )

  // 2. Check against each PIN (constant-time comparison)
  for (const pinRecord of pins) {
    const isValid = await bcrypt.compare(pin, pinRecord.pinHash)

    if (isValid) {
      // Check expiration
      if (pinRecord.expiresAt && new Date() > pinRecord.expiresAt) {
        return { valid: false, reason: 'PIN expired' }
      }

      return {
        valid: true,
        role: pinRecord.role,
        pinId: pinRecord.id
      }
    }
  }

  return { valid: false, reason: 'Invalid PIN' }
}
```

**Security Features**:
- bcrypt hashing (12 rounds)
- Constant-time comparison (prevents timing attacks)
- Expiration support
- Active/inactive toggle
- Audit logging

### API Key Authentication

**Purpose**: External integrations (n8n, webhooks, automation)

**Format**: 32-character random string (UUID-based)

**Flow**:
```
1. Client sends API key in Authorization header
2. Rate limit check (100 req/min)
3. Key validation (bcrypt compare)
4. Permission check (endpoint whitelist)
5. Execute request
6. Update usage statistics
```

**Implementation**:
```typescript
// /src/lib/auth/api-key.ts
export async function validateApiKey(
  apiKey: string,
  endpoint: string
): Promise<ApiKeyValidationResult> {
  // 1. Query API key
  const keys = await db.select()
    .from(schema.authApiKeys)
    .where(eq(schema.authApiKeys.isActive, true))

  // 2. Find matching key
  for (const keyRecord of keys) {
    const isValid = await bcrypt.compare(apiKey, keyRecord.keyHash)

    if (!isValid) continue

    // 3. Check expiration
    if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
      return { valid: false, reason: 'API key expired' }
    }

    // 4. Check permissions
    const permissions = JSON.parse(keyRecord.permissions)
    const hasPermission = permissions.some((pattern: string) =>
      matchesPattern(endpoint, pattern)
    )

    if (!hasPermission) {
      return { valid: false, reason: 'Insufficient permissions' }
    }

    // 5. Update usage stats
    await db.update(schema.authApiKeys)
      .set({
        lastUsed: new Date(),
        usageCount: keyRecord.usageCount + 1
      })
      .where(eq(schema.authApiKeys.id, keyRecord.id))

    return {
      valid: true,
      apiKeyId: keyRecord.id,
      locationId: keyRecord.locationId
    }
  }

  return { valid: false, reason: 'Invalid API key' }
}
```

**Permission Patterns**:
```json
{
  "permissions": [
    "/api/firetv/*",      // All Fire TV endpoints
    "/api/matrix/*",      // All matrix endpoints
    "/api/atlas/zones/*", // Zone control only
    "!/api/auth/*"        // Deny auth endpoints
  ]
}
```

### Session Management

**Storage**: Database sessions (not JWT)

**Lifecycle**:
- **Creation**: On successful PIN login
- **Expiration**: 24 hours after creation
- **Extension**: On each request (lastActivity updated)
- **Cleanup**: Cron job removes expired sessions daily

**Implementation**:
```typescript
// /src/lib/auth/session.ts
export async function createSession(
  locationId: string,
  role: string,
  ipAddress: string,
  userAgent: string
): Promise<Session> {
  const sessionId = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

  const session = await db.insert(schema.sessions).values({
    id: sessionId,
    locationId,
    role,
    ipAddress,
    userAgent,
    isActive: true,
    createdAt: now,
    expiresAt,
    lastActivity: now
  }).returning()

  return session[0]
}

export async function validateSession(
  sessionId: string
): Promise<SessionValidationResult> {
  const session = await db.select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, sessionId))
    .limit(1)
    .get()

  if (!session) {
    return { valid: false, reason: 'Session not found' }
  }

  if (!session.isActive) {
    return { valid: false, reason: 'Session deactivated' }
  }

  if (new Date() > session.expiresAt) {
    // Auto-deactivate expired session
    await db.update(schema.sessions)
      .set({ isActive: false })
      .where(eq(schema.sessions.id, sessionId))

    return { valid: false, reason: 'Session expired' }
  }

  // Update last activity
  await db.update(schema.sessions)
    .set({ lastActivity: new Date() })
    .where(eq(schema.sessions.id, sessionId))

  return {
    valid: true,
    session
  }
}
```

**Cookie Configuration**:
```typescript
const sessionCookie = {
  name: 'session_id',
  value: sessionId,
  httpOnly: true,       // Prevent JS access
  secure: false,        // HTTPS not required (local network)
  sameSite: 'strict',   // CSRF protection
  maxAge: 86400,        // 24 hours
  path: '/'
}
```

---

## Authorization Model

### Role-Based Access Control (RBAC)

**Roles**:
- **STAFF**: Bartenders, servers (device control only)
- **ADMIN**: Managers, IT (full system access)

**Permission Matrix**:

| Resource | STAFF | ADMIN |
|----------|-------|-------|
| Fire TV Control | ✅ | ✅ |
| Channel Presets | ✅ | ✅ |
| Matrix Routing | ✅ | ✅ |
| Audio Control | ✅ | ✅ |
| IR Device Control | ✅ | ✅ |
| CEC Control | ✅ | ✅ |
| Device Configuration | ❌ | ✅ |
| PIN Management | ❌ | ✅ |
| API Key Management | ❌ | ✅ |
| System Settings | ❌ | ✅ |
| Audit Logs | ❌ | ✅ |
| Database Backups | ❌ | ✅ |
| System Restart | ❌ | ✅ |

**Implementation**:
```typescript
// /src/lib/auth/middleware.ts
export function requireRole(allowedRoles: string[]) {
  return async (request: NextRequest) => {
    const session = await getSessionFromCookie(request)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.next()
  }
}

// Usage in API route
export async function POST(request: NextRequest) {
  const authCheck = await requireRole(['ADMIN'])(request)
  if (authCheck.status !== 200) return authCheck

  // Admin-only logic here
}
```

### Endpoint Protection

**Public Endpoints** (no auth):
- `GET /api/health`
- `POST /api/auth/login`

**Protected Endpoints** (requires session or API key):
- All other `/api/*` endpoints

**Admin-Only Endpoints**:
- `POST /api/system/restart`
- `POST /api/auth/pins` (PIN management)
- `POST /api/auth/api-keys` (API key management)
- `DELETE /api/devices/*`
- `POST /api/database/backup`

---

## Input Validation

### Zod Schema Validation

**Centralized Schemas** (`/src/lib/validation/schemas.ts`):
```typescript
export const ValidationSchemas = {
  // Fire TV control
  firetvLaunchApp: z.object({
    packageName: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
    activityName: z.string().optional()
  }),

  // Matrix routing
  matrixRoute: z.object({
    inputNum: z.number().int().min(1).max(16),
    outputNum: z.number().int().min(1).max(16)
  }),

  // Audio control
  atlasZoneControl: z.object({
    zoneId: z.string().uuid(),
    volume: z.number().int().min(0).max(100).optional(),
    muted: z.boolean().optional(),
    source: z.string().optional()
  }),

  // Channel preset
  channelPresetCreate: z.object({
    name: z.string().min(1).max(50),
    channelNumber: z.string().regex(/^\d+$/),
    deviceType: z.enum(['cable', 'directv']),
    order: z.number().int().min(0).optional()
  }),

  // Authentication
  pinLogin: z.object({
    pin: z.string().length(4).regex(/^\d{4}$/),
    locationId: z.string().uuid().optional()
  })
}
```

**Validation Middleware** (`/src/lib/validation/index.ts`):
```typescript
export async function validateRequestBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  try {
    // Parse request body
    const body = await request.json()

    // Validate against schema
    const result = schema.safeParse(body)

    if (!result.success) {
      return {
        success: false,
        error: NextResponse.json({
          success: false,
          error: 'Validation failed',
          details: result.error.issues
        }, { status: 400 })
      }
    }

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    return {
      success: false,
      error: NextResponse.json({
        success: false,
        error: 'Invalid JSON'
      }, { status: 400 })
    }
  }
}
```

**CRITICAL**: Never call `request.json()` after validation!
```typescript
// ❌ WRONG - Body already consumed!
const bodyValidation = await validateRequestBody(request, schema)
const body = await request.json() // ERROR!

// ✅ CORRECT - Use validated data
const bodyValidation = await validateRequestBody(request, schema)
if (!bodyValidation.success) return bodyValidation.error
const body = bodyValidation.data
```

### SQL Injection Prevention

**Drizzle ORM Parameterization**:
```typescript
// ✅ SAFE - Parameterized query
const devices = await db.select()
  .from(schema.fireTVDevices)
  .where(eq(schema.fireTVDevices.id, userProvidedId))

// ❌ UNSAFE - Raw SQL (never do this!)
// const devices = await db.raw(`SELECT * FROM FireTVDevice WHERE id = '${userProvidedId}'`)
```

**All database queries use Drizzle ORM** - no raw SQL execution

### Command Injection Prevention

**Shell Command Sanitization**:
```typescript
function sanitizeADBCommand(packageName: string): string {
  // Whitelist: alphanumeric, dots, underscores only
  if (!/^[a-z0-9._]+$/i.test(packageName)) {
    throw new Error('Invalid package name format')
  }

  // Prevent command injection
  const blacklist = ['&', '|', ';', '$', '`', '\\', '\n', '\r']
  for (const char of blacklist) {
    if (packageName.includes(char)) {
      throw new Error('Invalid characters in package name')
    }
  }

  return packageName
}

// Usage
const safePkg = sanitizeADBCommand(userInput)
const command = `adb shell am start -n ${safePkg}/.MainActivity`
```

### Path Traversal Prevention

**File Path Validation**:
```typescript
function validateFilePath(path: string, allowedDir: string): boolean {
  const absolutePath = require('path').resolve(path)
  const absoluteAllowed = require('path').resolve(allowedDir)

  // Ensure path is within allowed directory
  if (!absolutePath.startsWith(absoluteAllowed)) {
    throw new Error('Path traversal detected')
  }

  return true
}
```

---

## Rate Limiting

### In-Memory Sliding Window

**Implementation** (`/src/lib/rate-limiting/rate-limiter.ts`):
```typescript
export class RateLimiter {
  private requests = new Map<string, number[]>()

  async checkLimit(
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const windowStart = now - windowMs

    // Get request timestamps for this identifier
    const timestamps = this.requests.get(identifier) || []

    // Remove expired timestamps
    const validTimestamps = timestamps.filter(t => t > windowStart)

    // Check if over limit
    if (validTimestamps.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(validTimestamps[0] + windowMs)
      }
    }

    // Add current request
    validTimestamps.push(now)
    this.requests.set(identifier, validTimestamps)

    return {
      allowed: true,
      remaining: limit - validTimestamps.length,
      resetAt: new Date(now + windowMs)
    }
  }
}
```

**Rate Limit Configurations**:
```typescript
export const RateLimitConfigs = {
  // Default: 100 req/min
  DEFAULT: {
    limit: 100,
    windowMs: 60 * 1000
  },

  // Strict (auth endpoints): 5 req/min
  STRICT: {
    limit: 5,
    windowMs: 60 * 1000
  },

  // Hardware control: 50 req/min
  HARDWARE: {
    limit: 50,
    windowMs: 60 * 1000
  },

  // Public reads: 1000 req/min
  GENEROUS: {
    limit: 1000,
    windowMs: 60 * 1000
  }
}
```

**Usage in API Routes**:
```typescript
export async function POST(request: NextRequest) {
  // 1. Rate limiting (FIRST!)
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // 2. Validation
  const bodyValidation = await validateRequestBody(request, schema)
  if (!bodyValidation.success) return bodyValidation.error

  // 3. Authentication
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 4. Business logic
  // ...
}
```

### Rate Limit Headers

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```

**429 Too Many Requests Response**:
```json
{
  "error": "Rate limit exceeded",
  "limit": 100,
  "remaining": 0,
  "resetAt": "2025-11-06T12:30:00Z"
}
```

---

## Data Protection

### Password Hashing

**Algorithm**: bcrypt with 12 rounds

```typescript
import bcrypt from 'bcrypt'

// Hash PIN (creation)
const pinHash = await bcrypt.hash(pin, 12)

// Verify PIN (login)
const isValid = await bcrypt.compare(pin, storedHash)
```

**Salt Rounds**: 12 (industry standard, ~300ms to hash)

### Sensitive Data Handling

**Never Logged**:
- PIN codes
- API keys (plain text)
- Passwords
- Session tokens

**Database Storage**:
- PINs: bcrypt hashed
- API Keys: bcrypt hashed
- Credentials: Plain text (encrypted at rest via disk encryption)

**API Responses** (sanitized):
```typescript
// ❌ NEVER return sensitive data
{
  "pin": {
    "id": "123",
    "pinHash": "$2b$12$...",  // EXPOSED!
    "role": "ADMIN"
  }
}

// ✅ CORRECT - Sanitize before returning
{
  "pin": {
    "id": "123",
    "role": "ADMIN",
    "description": "Manager PIN",
    "isActive": true
  }
}
```

### Database Backups

**Encryption**: Backups stored unencrypted (local server only)

**Access Control**: File permissions 600 (owner read/write only)

**Location**: `/home/ubuntu/sports-bar-data/backups/`

**Retention**: 30 days (automatic rotation)

---

## Attack Mitigation

### Cross-Site Scripting (XSS)

**Prevention**:
1. React auto-escapes all output
2. No `dangerouslySetInnerHTML` usage
3. Content Security Policy (future)

**Example**:
```tsx
// ✅ SAFE - React auto-escapes
<div>{userInput}</div>

// ❌ UNSAFE - Never use
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### Cross-Site Request Forgery (CSRF)

**Prevention**:
1. SameSite=Strict cookies
2. No GET requests for state changes
3. API key authentication (external requests)

**Cookie Configuration**:
```typescript
sameSite: 'strict' // Only send on same-site requests
```

### Brute Force Attacks

**PIN Brute Force Protection**:
- Rate limit: 5 attempts/minute
- Account lockout: After 10 failed attempts (future)
- Exponential backoff (future)

**Calculation**:
- PINs: 10,000 combinations (0000-9999)
- Rate limit: 5 attempts/min
- Time to brute force: 33 hours (if no lockout)
- With lockout: Infeasible

### Session Hijacking

**Prevention**:
1. HttpOnly cookies (prevent JS access)
2. Session IP binding (future)
3. User-Agent validation (future)
4. 24-hour expiration

**Current Limitations**:
- No HTTPS (local network)
- No CSRF tokens (SameSite cookies instead)
- No session IP binding

---

## Audit & Compliance

### Audit Logging

**All Administrative Actions Logged**:
- PIN creation/deletion
- API key creation/deletion
- Device configuration changes
- System restarts
- Database operations
- Security events (failed logins, etc.)

**Audit Log Fields**:
```typescript
interface AuditLog {
  locationId: string
  sessionId: string | null
  apiKeyId: string | null
  action: string           // e.g., 'PIN_CREATED', 'DEVICE_DELETED'
  resource: string         // e.g., 'auth_pin', 'firetv_device'
  resourceId: string       // ID of affected resource
  endpoint: string         // API endpoint called
  method: string           // HTTP method
  ipAddress: string
  userAgent: string
  requestData: string      // Sanitized JSON (no secrets)
  responseStatus: number
  success: boolean
  errorMessage: string | null
  metadata: string         // Additional JSON data
  timestamp: Date
}
```

**Query Examples**:
```sql
-- All admin actions by session
SELECT * FROM AuditLog
WHERE sessionId = 'session-123'
ORDER BY timestamp DESC;

-- Failed login attempts
SELECT * FROM AuditLog
WHERE action = 'LOGIN_FAILED'
AND timestamp > datetime('now', '-1 day');

-- Device configuration changes
SELECT * FROM AuditLog
WHERE resource = 'firetv_device'
AND action IN ('DEVICE_CREATED', 'DEVICE_UPDATED', 'DEVICE_DELETED')
ORDER BY timestamp DESC;
```

### Security Event Logging

**Logged Events**:
- Failed login attempts
- Invalid API keys
- Rate limit violations
- Validation failures
- Privilege escalation attempts
- Suspicious patterns

**Security Validation Log**:
```typescript
interface SecurityValidationLog {
  validationType: string   // 'file_system', 'code_execution', etc.
  operationType: string
  allowed: boolean
  blockedReason: string | null
  blockedPatterns: string  // JSON array
  requestPath: string
  severity: 'info' | 'warning' | 'critical'
  ipAddress: string
  userId: string | null
  sessionId: string | null
  timestamp: Date
}
```

### Compliance Considerations

**Data Retention**:
- Session data: 90 days
- Audit logs: 1 year
- Security logs: 1 year
- Operational logs: 30 days

**Privacy**:
- No PII collected (sports bar context)
- IP addresses logged (local network)
- User identification via PIN roles only

---

## Security Checklist

### Deployment Security

- [ ] Change default PINs immediately
- [ ] Create unique API keys for each integration
- [ ] Enable firewall rules (allow only local network)
- [ ] Set up database backups
- [ ] Review audit logs weekly
- [ ] Rotate API keys quarterly
- [ ] Update dependencies monthly
- [ ] Monitor rate limit violations
- [ ] Review session expiration settings

### Code Security

- [ ] All API routes use rate limiting
- [ ] All POST/PUT/DELETE routes validate input
- [ ] All queries use Drizzle ORM (no raw SQL)
- [ ] All shell commands sanitized
- [ ] All file paths validated
- [ ] All errors logged (not exposed to client)
- [ ] All sensitive data hashed
- [ ] All admin actions audited

---

## Related Documentation

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Overall architecture
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Auth tables
- [SERVICE_ARCHITECTURE.md](./SERVICE_ARCHITECTURE.md) - Auth services
- [AUTHENTICATION_GUIDE.md](./authentication/AUTHENTICATION_GUIDE.md) - Setup guide
- [CLAUDE.md](../CLAUDE.md) - Security patterns
