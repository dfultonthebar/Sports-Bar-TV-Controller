# Authentication Implementation Guide

## Overview

The Sports-Bar-TV-Controller now features a minimal PIN-based authentication system with multi-location architecture support. This document describes the implementation, architecture, and usage.

## Architecture

### Database Schema

The authentication system uses 5 core tables:

1. **Location** - Multi-location support (single location for now)
   - id, name, address, timezone, etc.

2. **AuthPin** - PIN-based authentication
   - Stores bcrypt-hashed 4-digit PINs
   - Supports STAFF and ADMIN roles
   - Can have descriptions and expiration dates

3. **Session** - Active user sessions
   - 8-hour session duration
   - Auto-extends when close to expiry
   - Tracks IP address and user agent

4. **AuthApiKey** - API keys for webhooks/automation
   - Bcrypt-hashed API keys
   - Permission-based access control
   - Usage tracking

5. **AuditLog** - Comprehensive audit trail
   - Tracks all administrative actions
   - Links to sessions or API keys
   - Records request data, results, errors

### Access Levels

#### PUBLIC (23 endpoints)
No authentication required. Suitable for read-only status/health checks.

Examples:
- `/api/health`
- `/api/status`
- `/api/sports-guide`
- `/api/home-teams`

#### STAFF (229 endpoints)
Requires STAFF or ADMIN PIN. For daily operations by bartenders/staff.

Examples:
- `/api/firetv-devices`
- `/api/matrix/route`
- `/api/channel-presets`
- `/api/schedules`

#### ADMIN (11 endpoints)
Requires ADMIN PIN. For system configuration and dangerous operations.

Examples:
- `/api/system/reboot`
- `/api/system/restart`
- `/api/git/*`
- `/api/auth/pins`
- `/api/auth/api-keys`

#### WEBHOOK (1 endpoint)
Requires API key in header. For automated systems and webhooks.

Examples:
- `/api/n8n/webhook`
- `/api/webhooks/*`
- `/api/automation/*`

## Core Libraries

### /src/lib/auth/config.ts
Central configuration for authentication system:
- Session duration (8 hours)
- PIN requirements (4 digits, 1000-9999)
- Location settings
- Endpoint access level patterns
- Actions requiring confirmation

### /src/lib/auth/pin.ts
PIN management:
- `hashPIN(pin)` - Bcrypt hashing
- `validatePIN(pin)` - Verify PIN and return role
- `createPIN(pin, role, description)` - Create new PIN
- `deletePIN(id)` - Remove PIN
- `listPINs(locationId)` - List PINs (hashes hidden)

### /src/lib/auth/session.ts
Session management:
- `createSession(role, ipAddress, userAgent)` - Create new session
- `validateSession(sessionId)` - Validate and auto-extend
- `extendSession(sessionId)` - Manually extend
- `destroySession(sessionId)` - Logout
- `cleanupExpiredSessions()` - Maintenance task

### /src/lib/auth/api-key.ts
API key authentication:
- `generateApiKey()` - Secure random key generation
- `validateApiKey(key, endpoint)` - Verify and check permissions
- `createApiKey(name, permissions)` - Generate new key
- `revokeApiKey(id)` - Disable key
- `listApiKeys(locationId)` - List keys (hashes hidden)

### /src/lib/auth/middleware.ts
Authentication middleware:
- `requireAuth(request, role, options)` - Main auth check
- `requireConfirmation(request, action)` - Confirmation prompt
- `checkAuth(request)` - Auto-determine access level
- `isAuthenticated(request)` - Quick auth check
- `isAdmin(request)` - Check admin role

### /src/lib/auth/audit.ts
Audit logging:
- `logAuditAction(action, resource, ...)` - Log an action
- `getAuditLog(locationId, filters)` - Query audit logs
- Auto-cleanup old logs (90 days retention)

## Authentication API Endpoints

### POST /api/auth/login
Login with PIN and create session.

**Request:**
```json
{
  "pin": "1234"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "session": {
    "role": "STAFF",
    "expiresAt": "2025-11-04T20:30:00.000Z"
  }
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Invalid PIN"
}
```

### POST /api/auth/logout
Logout and destroy session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/auth/session
Check current session status.

**Response:**
```json
{
  "authenticated": true,
  "role": "STAFF",
  "expiresAt": "2025-11-04T20:30:00.000Z",
  "lastActivity": "2025-11-04T18:15:00.000Z"
}
```

### GET /api/auth/pins
**(ADMIN only)** List all PINs (hashes hidden).

**Response:**
```json
{
  "success": true,
  "pins": [
    {
      "id": "uuid",
      "role": "STAFF",
      "description": "Default bartender PIN",
      "isActive": true,
      "createdAt": "2025-11-04T12:00:00.000Z",
      "expiresAt": null
    }
  ]
}
```

### POST /api/auth/pins
**(ADMIN only)** Create a new PIN.

**Request:**
```json
{
  "pin": "5678",
  "role": "STAFF",
  "description": "Evening bartender"
}
```

### DELETE /api/auth/pins/:id
**(ADMIN only)** Delete a PIN.

### GET /api/auth/api-keys
**(ADMIN only)** List all API keys.

### POST /api/auth/api-keys
**(ADMIN only)** Generate new API key.

**Request:**
```json
{
  "name": "N8N Automation",
  "permissions": ["/api/webhooks/*", "/api/n8n/*"]
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": "64_character_hex_string",
  "keyId": "uuid",
  "message": "SAVE THIS KEY - it will not be shown again!"
}
```

### DELETE /api/auth/api-keys/:id
**(ADMIN only)** Revoke an API key.

### GET /api/auth/audit-log
**(ADMIN only)** Query audit logs.

**Query Parameters:**
- `action` - Filter by action type
- `resource` - Filter by resource
- `success` - Filter by success/failure
- `startDate` - Start date
- `endDate` - End date
- `limit` - Results limit (default 100)
- `offset` - Pagination offset

## Applying Authentication to Endpoints

### Example: Add STAFF-level auth

```typescript
import { requireAuth } from '@/lib/auth/middleware'

export async function POST(request: NextRequest) {
  // Authentication check (STAFF level required)
  const authResult = await requireAuth(request, 'STAFF')
  if (!authResult.allowed) return authResult.response!

  // Your existing code...
}
```

### Example: Add ADMIN-level auth

```typescript
import { requireAuth } from '@/lib/auth/middleware'

export async function POST(request: NextRequest) {
  // Authentication check (ADMIN level required)
  const authResult = await requireAuth(request, 'ADMIN')
  if (!authResult.allowed) return authResult.response!

  // Your existing code...
}
```

### Example: Add ADMIN auth with audit logging

```typescript
import { requireAuth } from '@/lib/auth/middleware'

export async function POST(request: NextRequest) {
  // Authentication check with audit logging
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'SYSTEM_REBOOT',
    auditResource: 'system',
  })
  if (!authResult.allowed) return authResult.response!

  // Your existing code...
}
```

### Example: Add confirmation prompt for dangerous operations

```typescript
import { requireAuth } from '@/lib/auth/middleware'
import { z } from 'zod'
import { validateRequestBody } from '@/lib/validation'

export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'SYSTEM_REBOOT',
    auditResource: 'system',
  })
  if (!authResult.allowed) return authResult.response!

  // Confirmation required (already exists via validation)
  const bodyValidation = await validateRequestBody(
    request,
    z.object({ confirm: z.literal(true) })
  )
  if (!bodyValidation.success) return bodyValidation.error

  // Your existing code...
}
```

### Example: Add API key auth for webhooks

```typescript
import { requireAuth } from '@/lib/auth/middleware'

export async function POST(request: NextRequest) {
  // API key authentication
  const authResult = await requireAuth(request, 'STAFF', {
    allowApiKey: true,
    auditAction: 'WEBHOOK_TRIGGER',
    auditResource: 'webhook',
  })
  if (!authResult.allowed) return authResult.response!

  // Your existing code...
}
```

## Login UI

Located at `/src/app/login/page.tsx`

Features:
- Numeric keypad for PIN entry
- Visual feedback (dots)
- Error messages
- Auto-redirect after successful login
- Mobile-friendly responsive design

## Default Credentials

**⚠️ CHANGE THESE IN PRODUCTION!**

- **STAFF PIN**: 1234
- **ADMIN PIN**: 9999
- **Default API Key**: See seed script output (generated randomly)

## Security Features

### PIN Security
- 4-digit numeric PINs
- Bcrypt hashing with 10 rounds
- No PIN stored in plaintext
- Optional expiration dates

### Session Security
- HttpOnly cookies (prevents XSS access)
- 8-hour expiration
- Auto-extends on activity
- IP address and user agent tracking
- Secure flag in production (HTTPS only)

### API Key Security
- 256-bit random keys (64 hex characters)
- Bcrypt hashing
- Permission-based access control
- Usage tracking and monitoring
- Optional expiration dates

### Audit Logging
- All administrative actions logged
- Request data sanitization
- IP address tracking
- Success/failure tracking
- 90-day retention policy

## Multi-Location Architecture

### Current State
- Single location: "default-location"
- Location ID in all auth data
- Ready for multi-location expansion

### Future Multi-Location Support

The database schema is designed to support multiple locations:

1. Each location has its own PINs and API keys
2. Sessions are location-specific
3. Audit logs track location ID
4. Future: Central management dashboard

#### Planned Architecture

```
┌─────────────────────────────────────┐
│  Central Management Server          │
│  - Master admin dashboard           │
│  - Cross-location reporting         │
│  - PIN/API key management           │
│  - Audit log aggregation            │
└─────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼──────┐      ┌──────▼──────┐
│ Location 1 │      │ Location 2  │
│ Main St    │      │ Downtown    │
│ - Local DB │      │ - Local DB  │
│ - Local    │      │ - Local     │
│   auth     │      │   auth      │
└────────────┘      └─────────────┘
```

#### Migration Path
1. Deploy system to each location
2. Configure unique LOCATION_ID and LOCATION_NAME
3. Create location-specific PINs
4. Future: Connect to central server via API

## Environment Variables

Add to `.env.local`:

```bash
# Location identification (for multi-location future)
LOCATION_ID=main-street-bar-001
LOCATION_NAME="Main Street Bar"

# Optional: Override session duration (in milliseconds)
# SESSION_DURATION=28800000  # 8 hours
```

## Session Cleanup

Sessions are automatically cleaned up:
1. When validated after expiry (lazy cleanup)
2. Via periodic cleanup job (recommended to run hourly)

To manually cleanup expired sessions:

```typescript
import { cleanupExpiredSessions } from '@/lib/auth/session'

// In a cron job or startup script
await cleanupExpiredSessions()
```

## Testing Authentication

### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin": "1234"}'
```

### Test Protected Endpoint (without auth)
```bash
curl http://localhost:3001/api/firetv-devices
# Should return 401 Unauthorized
```

### Test Protected Endpoint (with session cookie)
```bash
# Save session cookie from login
SESSION_COOKIE="..."

curl http://localhost:3001/api/firetv-devices \
  -H "Cookie: sports-bar-session=$SESSION_COOKIE"
# Should succeed
```

### Test API Key Authentication
```bash
API_KEY="your_64_char_hex_api_key"

curl -X POST http://localhost:3001/api/webhooks/example \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```

### Test ADMIN Endpoint (with STAFF session)
```bash
# Login as STAFF (PIN: 1234)
# Then try to access ADMIN endpoint
curl http://localhost:3001/api/auth/pins
# Should return 403 Forbidden
```

### Test Confirmation Requirement
```bash
# Try without confirmation
curl -X POST http://localhost:3001/api/system/reboot \
  -H "Cookie: sports-bar-session=$ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{}'
# Should return 400 Bad Request

# Try with confirmation
curl -X POST http://localhost:3001/api/system/reboot \
  -H "Cookie: sports-bar-session=$ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
# Should succeed
```

## Implementation Status

### ✅ Completed
- Database schema and migrations
- Core auth libraries (PIN, session, API key, audit)
- Authentication middleware
- Authentication API endpoints
- Login UI page
- Default credentials seeding
- Rate limiting integration
- Validation integration
- Audit logging

### ⚠️ Partially Implemented (241 endpoints need auth)
- Applied to critical ADMIN endpoints:
  - `/api/system/reboot` ✅
  - `/api/system/restart` (needs update)
  - `/api/git/*` (needs update)
  - `/api/auth/*` ✅ (already protected)

### 📋 Needs Implementation
- Apply auth to remaining 238 STAFF/ADMIN endpoints
- Add Next.js middleware for UI route protection
- Session indicator component in UI
- Logout button in UI
- Change PIN functionality in UI
- API key management UI

## Rollout Strategy

### Phase 1: Critical Endpoints (Completed)
1. ✅ Auth system API endpoints
2. ✅ Critical ADMIN endpoints (system/reboot)
3. ✅ Login page

### Phase 2: Gradual Rollout (Recommended)
1. Apply auth to admin configuration endpoints
2. Apply auth to device management endpoints
3. Apply auth to scheduling endpoints
4. Apply auth to remaining endpoints
5. Monitor audit logs for issues

### Phase 3: UI Integration
1. Add session check to UI pages
2. Redirect to login if not authenticated
3. Add logout button
4. Add session indicator
5. Add "Change PIN" page for ADMIN

### Phase 4: Testing & Hardening
1. Integration tests for auth flows
2. Load testing with sessions
3. Security audit
4. Documentation updates

## Automated Rollout Tool

A script has been created to automatically apply authentication to endpoints:

```bash
# Dry run (see what would change)
npx tsx scripts/apply-authentication.ts --dry-run

# Apply to specific endpoint
npx tsx scripts/apply-authentication.ts --endpoint=/api/firetv-devices

# Apply to all endpoints (use with caution!)
npx tsx scripts/apply-authentication.ts
```

**⚠️ Warning**: Applying auth to all endpoints at once could break functionality. Test thoroughly!

## Security Best Practices

### Production Deployment

1. **Change Default PINs Immediately**
   ```bash
   # Use the admin UI or API to change PINs
   curl -X POST http://localhost:3001/api/auth/pins \
     -H "Cookie: sports-bar-session=$ADMIN_SESSION" \
     -H "Content-Type: application/json" \
     -d '{
       "pin": "YOUR_NEW_PIN",
       "role": "ADMIN",
       "description": "Production Admin PIN"
     }'
   ```

2. **Secure API Keys**
   - Store in environment variables or secrets manager
   - Never commit to git
   - Rotate regularly
   - Use specific permissions (not wildcards)

3. **HTTPS Only**
   - Always use HTTPS in production
   - Session cookies have `secure` flag enabled

4. **Monitor Audit Logs**
   - Review failed login attempts
   - Check for unusual API key usage
   - Monitor admin actions

5. **Regular Security Updates**
   - Keep dependencies updated
   - Review audit logs weekly
   - Rotate API keys quarterly
   - Review and update PINs as staff changes

## Troubleshooting

### "Session expired" immediately after login
- Check server time synchronization
- Verify `SESSION_DURATION` environment variable
- Check database timestamps

### API key not working
- Verify key format (64 hex characters)
- Check permissions in database
- Verify endpoint matches permission pattern
- Check if key has expired

### Cannot access admin endpoints
- Verify you're logged in with ADMIN PIN (9999)
- Check session hasn't expired
- Verify endpoint requires ADMIN level

### Audit logs not recording
- Check database connection
- Verify `AuditLog` table exists
- Check for errors in server logs

## Next Steps

1. **Test the implementation**
   ```bash
   npm test
   ```

2. **Try logging in**
   - Navigate to `http://localhost:3001/login`
   - Enter PIN 1234 (STAFF) or 9999 (ADMIN)

3. **Test protected endpoints**
   - Try accessing `/api/firetv-devices` without auth (should fail)
   - Login and try again (should succeed)

4. **Review audit logs**
   - Access `/api/auth/audit-log` as ADMIN
   - Review login attempts and actions

5. **Plan gradual rollout**
   - Identify next batch of endpoints
   - Apply authentication
   - Test thoroughly
   - Monitor for issues

## Support & Contact

For questions or issues with the authentication system:
- Review this documentation
- Check audit logs for clues
- Review server logs for errors
- Consult the codebase comments

---

**Last Updated**: 2025-11-04
**Version**: 1.0.0
**Status**: Initial Implementation Complete
