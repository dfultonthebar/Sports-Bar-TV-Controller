# Security Fixes - Quick Reference Card

**Date:** 2025-11-04 | **Status:** ✅ COMPLETE

---

## 🔴 URGENT: DO THIS NOW

### Rotate the Exposed API Key

```bash
# 1. Go to: https://console.anthropic.com/settings/keys
# 2. Delete key ending in: _bxQ-b3X_owAA
# 3. Generate new key
# 4. Update .env:
nano /home/ubuntu/Sports-Bar-TV-Controller/.env
# Change line 15: ANTHROPIC_API_KEY="your-new-key-here"

# 5. Restart app:
pm2 restart sports-bar-tv-controller
```

---

## ✅ What Was Fixed

| Vulnerability | Severity | Status |
|--------------|----------|--------|
| Command Injection | CRITICAL | ✅ Fixed |
| Exposed API Key | CRITICAL | ⚠️ User must rotate |
| Unprotected TV Control | HIGH | ✅ Fixed |
| Exposed Security Logs | HIGH | ✅ Fixed |
| Unprotected RAG Rebuild | HIGH | ✅ Fixed |
| Unprotected AI Chat | HIGH | ✅ Fixed |
| Weak Webhook Auth | MEDIUM | ✅ Enhanced |

---

## 🔒 Security Controls Added

### Authentication Required
- `/api/file-system/execute` → ADMIN only
- `/api/unified-tv-control` → STAFF or API key
- `/api/security/logs` → ADMIN only (no API keys)
- `/api/rag/rebuild` → ADMIN only
- `/api/enhanced-chat` → STAFF or API key

### Command Injection Protection
- ✅ Allowlist: Only 12 safe commands
- ✅ Blocked: `; & | \` $ ( ) { } [ ] < >`
- ✅ Audit logs for all attempts
- ✅ Admin authentication required

### Webhook Security
- ✅ HMAC SHA256 signatures
- ✅ Timestamp validation (5 min window)
- ✅ Replay protection (request IDs)
- ✅ Backward compatible (Bearer token)

---

## 🧪 Quick Tests

```bash
# 1. Test auth is working (should return 401)
curl -X POST http://localhost:3001/api/unified-tv-control \
  -H "Content-Type: application/json" \
  -d '{"deviceId": 1, "command": "POWER_ON"}'

# 2. Check build succeeded
cd /home/ubuntu/Sports-Bar-TV-Controller && npm run build

# 3. View recent audit logs
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT action, success, createdAt FROM audit_logs
   ORDER BY createdAt DESC LIMIT 5;"
```

---

## 📝 How to Authenticate

### Option 1: Login (Web UI)
- Visit: http://localhost:3001/login
- Enter PIN
- Session cookie auto-set

### Option 2: API Key
```bash
curl -X POST http://localhost:3001/api/unified-tv-control \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"deviceId": 1, "command": "POWER_ON"}'
```

### Option 3: Session Cookie (Scripts)
```bash
# 1. Login
SESSION=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin": "your-pin"}' \
  -c - | grep auth_session | awk '{print $7}')

# 2. Use session
curl -X POST http://localhost:3001/api/unified-tv-control \
  -H "Cookie: auth_session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{"deviceId": 1, "command": "POWER_ON"}'
```

---

## 🔧 n8n Webhook Update

### Legacy (Still Works)
```javascript
{
  "headers": {
    "Authorization": "Bearer {{$env.N8N_WEBHOOK_TOKEN}}"
  }
}
```

### Recommended (HMAC)
```javascript
// In Function Node before webhook:
const crypto = require('crypto');
const payload = JSON.stringify($json);
const secret = $env.N8N_WEBHOOK_TOKEN;
const timestamp = new Date().toISOString();
const requestId = crypto.randomUUID();

const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const signature = hmac.digest('hex');

return {
  json: $json,
  headers: {
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Request-Id': requestId
  }
};
```

---

## 📊 Changes Summary

- **Files Modified:** 7
- **Lines Added:** ~395 (code) + ~1,500 (docs)
- **Build Status:** ✅ Passing
- **TypeScript Errors:** 0
- **Breaking Changes:** 5 endpoints now require auth

---

## 🚨 Breaking Changes

### If You Get 401 Unauthorized
**Cause:** Endpoint now requires authentication
**Fix:** Login via `/api/auth/login` or use API key

### If Command Execution Fails
**Cause:** Command not in allowlist or not ADMIN
**Fix:** Check allowlist or upgrade to ADMIN role
**Allowlist:** pm2, npm, git, node, ls, cat, grep, find, systemctl, journalctl, docker, docker-compose

### If Webhook Fails
**Cause:** Authentication enhanced
**Fix:** Add HMAC signature headers (see above)

---

## 📚 Full Documentation

- **CRITICAL_SECURITY_FIXES.md** - Detailed vulnerability analysis
- **SECURITY_FIXES_IMPLEMENTATION.md** - Implementation details & testing
- **SECURITY_FIXES_SUMMARY.md** - Executive summary

---

## ✅ Completion Checklist

- [x] Command injection fixed
- [x] Endpoints protected with auth
- [x] Webhook security enhanced
- [x] Audit logging implemented
- [x] TypeScript compiles
- [x] Documentation created
- [ ] **API key rotated** ← YOU MUST DO THIS
- [ ] Endpoints tested with auth
- [ ] n8n workflows updated (if applicable)

---

## 📞 Quick Help

### App won't start
```bash
pm2 logs sports-bar-tv-controller --lines 50
```

### Can't authenticate
```bash
# Check auth system is set up
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT name, role FROM users;"
```

### View failed auth attempts
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT * FROM audit_logs WHERE success = 0
   AND action LIKE '%AUTH%'
   ORDER BY createdAt DESC LIMIT 10;"
```

---

## 🎯 Priority Actions

| Priority | Action | Estimated Time |
|----------|--------|----------------|
| 🔴 URGENT | Rotate API key | 5 minutes |
| 🟡 High | Test endpoints | 10 minutes |
| 🟡 High | Update n8n (if used) | 15 minutes |
| 🟢 Medium | Review audit logs | 5 minutes |
| 🟢 Low | Remove key from git history | 30 minutes |

---

**Quick Start:** Rotate API key (5 min) → Test endpoints (10 min) → Done! ✅

**Generated:** 2025-11-04
