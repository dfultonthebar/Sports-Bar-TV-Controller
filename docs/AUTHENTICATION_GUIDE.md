# Authentication User Guide

## Overview

The Sports-Bar-TV-Controller now requires authentication to protect sensitive operations and ensure only authorized staff can control the system.

## User Roles

### STAFF
- **PIN**: 1234 (change this immediately!)
- **Access**: Daily operations
  - Control FireTV devices
  - Route matrix inputs/outputs
  - Manage channel presets
  - View schedules
  - Control audio zones
  - View logs and status

### ADMIN
- **PIN**: 9999 (change this immediately!)
- **Access**: Everything STAFF can do, plus:
  - System reboot/restart
  - Git operations (pull, push, commit)
  - Create/delete PINs
  - Manage API keys
  - View audit logs
  - Change system configuration

### PUBLIC (No Login Required)
- View system health/status
- View sports guide
- View home teams
- View streaming status

## Logging In

### Web UI

1. Navigate to: `http://your-server:3001/login`
2. Enter your 4-digit PIN using the keypad
3. Click "Login"
4. You'll be redirected to the main dashboard

**Your session lasts 8 hours** and will automatically extend if you're active.

### Via API (for automation)

Use API keys instead of PINs for automated systems:

```bash
curl -X POST http://your-server:3001/api/your-endpoint \
  -H "X-API-Key: your_64_character_api_key" \
  -H "Content-Type: application/json" \
  -d '{"your": "data"}'
```

## Logging Out

### Web UI
Click the logout button in the navigation bar (to be implemented)

### Via API
```bash
curl -X POST http://your-server:3001/api/auth/logout \
  -H "Cookie: sports-bar-session=your_session_cookie"
```

## Changing Your PIN

**ADMIN users can create and manage PINs.**

### Via API
```bash
# As ADMIN, create a new PIN
curl -X POST http://your-server:3001/api/auth/pins \
  -H "Cookie: sports-bar-session=admin_session" \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "5678",
    "role": "STAFF",
    "description": "Evening bartender"
  }'
```

### Delete old PIN
```bash
# Get list of PINs
curl http://your-server:3001/api/auth/pins \
  -H "Cookie: sports-bar-session=admin_session"

# Delete a PIN by ID
curl -X DELETE http://your-server:3001/api/auth/pins/PIN_ID \
  -H "Cookie: sports-bar-session=admin_session"
```

## Dangerous Operations

Some operations require **explicit confirmation** to prevent accidental execution:

- System reboot
- System restart
- Git operations (commit, push, pull)
- File system execution

**Example**: Rebooting the system
```json
{
  "confirm": true
}
```

Without `"confirm": true`, these operations will fail with an error message.

## API Keys (for Webhooks & Automation)

### Creating an API Key (ADMIN only)

```bash
curl -X POST http://your-server:3001/api/auth/api-keys \
  -H "Cookie: sports-bar-session=admin_session" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "N8N Automation",
    "permissions": [
      "/api/webhooks/*",
      "/api/n8n/*",
      "/api/automation/*"
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "apiKey": "64_character_hex_string_here",
  "keyId": "uuid",
  "message": "SAVE THIS KEY - it will not be shown again!"
}
```

⚠️ **Important**: Save the API key immediately. It cannot be retrieved later.

### Using an API Key

Include the API key in the `X-API-Key` header:

```bash
curl -X POST http://your-server:3001/api/webhooks/control-tv \
  -H "X-API-Key: your_64_character_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "power_on",
    "device": "tv-1"
  }'
```

### Revoking an API Key

```bash
# List all API keys
curl http://your-server:3001/api/auth/api-keys \
  -H "Cookie: sports-bar-session=admin_session"

# Revoke a key by ID
curl -X DELETE http://your-server:3001/api/auth/api-keys/KEY_ID \
  -H "Cookie: sports-bar-session=admin_session"
```

## Session Management

### Check Your Session
```bash
curl http://your-server:3001/api/auth/session \
  -H "Cookie: sports-bar-session=your_session"
```

**Response:**
```json
{
  "authenticated": true,
  "role": "STAFF",
  "expiresAt": "2025-11-04T20:30:00.000Z",
  "lastActivity": "2025-11-04T18:15:00.000Z"
}
```

### Session Details
- **Duration**: 8 hours
- **Auto-extend**: Yes (if active within 30 minutes of expiry)
- **Cookie**: HttpOnly, Secure (production), SameSite=Lax

## Audit Logging

All administrative actions are logged for security and accountability.

### View Audit Logs (ADMIN only)

```bash
curl 'http://your-server:3001/api/auth/audit-log?limit=50' \
  -H "Cookie: sports-bar-session=admin_session"
```

### Filter by Action
```bash
curl 'http://your-server:3001/api/auth/audit-log?action=SYSTEM_REBOOT' \
  -H "Cookie: sports-bar-session=admin_session"
```

### Filter by Date Range
```bash
curl 'http://your-server:3001/api/auth/audit-log?startDate=2025-11-01&endDate=2025-11-04' \
  -H "Cookie: sports-bar-session=admin_session"
```

## Troubleshooting

### "Authentication required" Error

**Problem**: You're not logged in or your session has expired.

**Solution**:
1. Go to `/login` and enter your PIN
2. If you were in the middle of something, you'll be redirected back after login

### "Insufficient permissions" Error

**Problem**: Your role doesn't have access to this operation.

**Solution**:
- STAFF operations: Login with STAFF or ADMIN PIN
- ADMIN operations: Login with ADMIN PIN (9999)

### "Session expired" Error

**Problem**: Your 8-hour session has ended.

**Solution**: Login again at `/login`

### "Invalid PIN" Error

**Problem**: The PIN you entered is incorrect.

**Solution**:
- Verify you're entering the correct PIN
- Check with your manager/admin if unsure
- Default PINs: 1234 (STAFF), 9999 (ADMIN)

### "Confirmation required" Error

**Problem**: Dangerous operation requires explicit confirmation.

**Solution**: Add `"confirm": true` to your request body:
```json
{
  "confirm": true,
  "your": "other data"
}
```

## Best Practices

### For Staff
1. **Login at start of shift**
2. **Logout at end of shift** (optional, session will expire)
3. **Don't share your PIN** with others
4. **Report any suspicious activity** to your manager

### For Admins
1. **Change default PINs immediately** after setup
2. **Create unique PINs** for each staff member
3. **Use descriptive names** when creating PINs (e.g., "Evening Bartender")
4. **Review audit logs regularly** for unusual activity
5. **Rotate API keys** quarterly or when staff changes
6. **Set expiration dates** for temporary PINs
7. **Revoke access** immediately when staff leaves

### For Automation
1. **Use API keys**, not PINs
2. **Store keys securely** (environment variables, secrets manager)
3. **Use specific permissions**, not wildcards
4. **Monitor usage** via audit logs
5. **Rotate keys regularly**

## Quick Reference

### Default Credentials
- STAFF PIN: `1234` ⚠️ Change immediately!
- ADMIN PIN: `9999` ⚠️ Change immediately!

### Common Endpoints
- Login: `POST /api/auth/login`
- Logout: `POST /api/auth/logout`
- Check session: `GET /api/auth/session`
- List PINs (ADMIN): `GET /api/auth/pins`
- Create PIN (ADMIN): `POST /api/auth/pins`
- List API keys (ADMIN): `GET /api/auth/api-keys`
- Create API key (ADMIN): `POST /api/auth/api-keys`
- Audit log (ADMIN): `GET /api/auth/audit-log`

### Session Duration
- **Initial**: 8 hours
- **Auto-extend**: Yes (if active within 30 min of expiry)
- **Max**: Unlimited (as long as you're active)

### Cookie Settings
- **Name**: `sports-bar-session`
- **HttpOnly**: Yes (prevents XSS)
- **Secure**: Yes (production HTTPS only)
- **SameSite**: Lax (CSRF protection)

## Security Tips

1. **Never share your PIN or API key**
2. **Change default PINs immediately**
3. **Use HTTPS in production** (secure cookies)
4. **Logout when done** (or let session expire)
5. **Report suspicious activity**
6. **Don't write down PINs** (or store securely if you must)
7. **Review your own audit log** occasionally

## Getting Help

If you're having trouble:
1. **Check this guide** for common issues
2. **Contact your manager/admin**
3. **Review the technical documentation** (AUTHENTICATION_IMPLEMENTATION.md)
4. **Check server logs** if you have access

## Multi-Location Support (Future)

The system is designed to support multiple bar locations:
- Each location has its own PINs and API keys
- Sessions are location-specific
- Audit logs track which location performed actions
- Future: Central management dashboard

To set up a new location:
1. Set `LOCATION_ID` and `LOCATION_NAME` in `.env`
2. Run the seed script to create default credentials
3. Change the default PINs immediately

---

**Last Updated**: 2025-11-04
**For Questions**: Contact your system administrator
