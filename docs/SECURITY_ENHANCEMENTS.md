# Security Enhancements Documentation

**Date:** November 2, 2025
**Version:** 1.0.0
**Status:** Implemented

## Overview

This document describes the critical security enhancements implemented in the Sports Bar TV Controller AI Hub. These changes address three major security concerns:

1. **Encrypted Streaming Credentials** - AES-256-GCM encryption for stored credentials
2. **Ollama Health Check** - Resilient AI service integration with retry logic
3. **Security Event Logging** - Database persistence of validation events for audit

---

## 1. Encrypted Streaming Credentials

### Problem
Streaming platform credentials were stored using simple base64 encoding, which provides no real security. Credentials were easily readable by anyone with file access.

### Solution
Implemented AES-256-GCM encryption with the following features:

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Derivation:** PBKDF2 with 100,000 iterations
- **Unique IVs:** Each encryption uses a random 128-bit IV
- **Unique Salts:** Each encryption uses a random 512-bit salt
- **Authentication:** GCM mode provides authentication tags to detect tampering

### Files Created/Modified

#### New Files:
- `/src/lib/security/encryption.ts` - Core encryption library
- `/scripts/migrate-credentials-encryption.ts` - Migration script for existing credentials
- `/tests/security/encryption.test.ts` - Comprehensive test suite

#### Modified Files:
- `/src/app/api/streaming-platforms/credentials/route.ts` - Updated to use new encryption
- `/.env.example` - Added ENCRYPTION_KEY configuration

### Usage

#### Generate an Encryption Key:
```bash
# Method 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 2: Using the encryption library
npx tsx -e "import { generateEncryptionKey } from './src/lib/security/encryption'; console.log(generateEncryptionKey())"
```

#### Add to Environment:
```bash
# In .env file
ENCRYPTION_KEY=your_generated_64_character_hex_key_here
```

#### Migrate Existing Credentials:
```bash
# Run migration script
npx tsx scripts/migrate-credentials-encryption.ts
```

The script will:
1. Check if ENCRYPTION_KEY is configured
2. Create a backup of existing credentials
3. Migrate each credential to AES-256-GCM encryption
4. Verify migrations by testing decryption
5. Save migrated credentials
6. Provide a detailed summary

### API Changes

The credentials API now includes:

**New Response Fields:**
- `encryptionVersion`: Tracks encryption method used
- Can be `aes-256-gcm` (new) or missing (legacy base64)

**New Endpoint:**
```
PUT /api/streaming-platforms/credentials/verify
```
Verifies that credentials can be decrypted successfully.

**Request:**
```json
{
  "platformId": "hulu-live"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credentials verified successfully",
  "encryptionVersion": "aes-256-gcm",
  "canDecrypt": true
}
```

### Security Properties

- **Confidentiality:** AES-256 provides strong encryption
- **Integrity:** GCM authentication tags detect tampering
- **Uniqueness:** Each encryption produces different ciphertext
- **Forward Secrecy:** Compromising one password doesn't affect others

---

## 2. Ollama Health Check & Resilience

### Problem
The AI client would fail immediately if Ollama was unavailable, with no retry logic or graceful degradation.

### Solution
Enhanced the AI client with:

1. **Health Check Caching** - Check Ollama health before API calls
2. **Exponential Backoff** - Retry failed requests with increasing delays
3. **Graceful Degradation** - Provide helpful error messages when unavailable
4. **Connection Monitoring** - Track consecutive failures

### Files Modified

- `/src/lib/enhanced-ai-client.ts` - Complete rewrite with health checking

### Features

#### Health Check Caching
- Caches health status for 30 seconds
- Avoids excessive health checks
- Tracks consecutive failures

#### Retry Logic
- **Max Retries:** 3 attempts
- **Initial Delay:** 1 second
- **Max Delay:** 10 seconds
- **Exponential Backoff:** Delay doubles each retry
- **Jitter:** Random delay added to prevent thundering herd

#### Graceful Degradation
When Ollama is unavailable, returns a helpful mock response:
```
[AI Service Unavailable]

The AI service is currently unavailable. This is a fallback response.

To resolve this issue:
1. Ensure Ollama is installed and running: `ollama serve`
2. Verify the OLLAMA_BASE_URL environment variable
3. Check that the model is installed: `ollama pull llama3.2`
4. Review Ollama logs for any errors
```

### New Methods

#### `getHealthStatus()`
Get current health status:
```typescript
const status = await aiClient.getHealthStatus();
// Returns:
// {
//   healthy: boolean,
//   lastChecked: Date | null,
//   consecutiveFailures: number,
//   ollamaUrl: string,
//   ollamaModel: string
// }
```

#### `forceHealthCheck()`
Force a new health check (bypass cache):
```typescript
const result = await aiClient.forceHealthCheck();
// Returns: { healthy: boolean, error?: string }
```

### Configuration

Set environment variables:
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### Response Format

AI responses now include:
```typescript
{
  content?: string,
  error?: string,
  healthCheckPassed?: boolean
}
```

---

## 3. Security Validation Logging

### Problem
Security validation events (blocked commands, dangerous patterns, unauthorized access) were not persisted, making audit and forensics impossible.

### Solution
Implemented comprehensive security event logging to database.

### Files Created/Modified

#### New Files:
- `/src/lib/ai-tools/security/security-logger.ts` - Logging utilities
- `/src/app/api/security/logs/route.ts` - API to view logs
- `/drizzle/0002_security_validation_logs.sql` - Database migration
- `/tests/security/enhanced-validator.test.ts` - Validator tests

#### Modified Files:
- `/src/db/schema.ts` - Added securityValidationLogs table
- `/src/lib/ai-tools/security/enhanced-validator.ts` - Integrated logging

### Database Schema

New table: `SecurityValidationLog`

```sql
CREATE TABLE "SecurityValidationLog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "validationType" TEXT NOT NULL,        -- file_system, code_execution, bash_command, resource_limit
  "operationType" TEXT,                  -- read, write, execute, delete
  "allowed" INTEGER NOT NULL,            -- 0 = blocked, 1 = allowed
  "blockedReason" TEXT,                  -- Why it was blocked
  "blockedPatterns" TEXT,                -- JSON array of matched patterns
  "requestPath" TEXT,                    -- File path or command
  "requestContent" TEXT,                 -- Sanitized content (truncated)
  "sanitizedInput" TEXT,                 -- JSON sanitized input
  "severity" TEXT NOT NULL DEFAULT 'info', -- info, warning, critical
  "ipAddress" TEXT,
  "userId" TEXT,
  "sessionId" TEXT,
  "metadata" TEXT,                       -- Additional JSON metadata
  "timestamp" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Logging Features

#### Automatic Logging
All security validations are automatically logged:
- File system operations
- Code execution requests
- Bash command validations
- Resource limit checks

#### Asynchronous Logging
- Non-blocking: Logging never delays validation
- Fire-and-forget: Errors don't break validation
- Database batching for performance

#### Severity Levels
- **info:** Successful validations
- **warning:** Blocked operations (non-critical)
- **critical:** Dangerous patterns detected (fork bombs, rm -rf, etc.)

### API Endpoints

#### GET `/api/security/logs`

Query security logs with filters.

**Query Parameters:**
- `validationType`: Filter by type (file_system, code_execution, etc.)
- `allowed`: Filter by status (true/false)
- `severity`: Filter by severity (info, warning, critical)
- `userId`: Filter by user
- `startDate`: Start date (ISO string)
- `endDate`: End date (ISO string)
- `limit`: Max results (default: 100)
- `offset`: Pagination offset

**Example:**
```bash
GET /api/security/logs?severity=critical&limit=50
```

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "...",
      "validationType": "bash_command",
      "operationType": "execute",
      "allowed": false,
      "blockedReason": "Command blocked: Fork bomb (critical severity)",
      "blockedPatterns": ["Fork bomb"],
      "requestPath": ":",
      "requestContent": ":(){ :|:& };:",
      "severity": "critical",
      "timestamp": "2025-11-02T12:34:56.789Z"
    }
  ],
  "count": 1
}
```

#### GET `/api/security/logs?stats=true`

Get security statistics.

**Query Parameters:**
- `days`: Number of days to analyze (default: 7)

**Response:**
```json
{
  "success": true,
  "stats": {
    "period": "Last 7 days",
    "total": 1250,
    "blocked": 45,
    "critical": 3,
    "byType": [
      { "validationType": "bash_command", "count": 500 },
      { "validationType": "file_system", "count": 600 },
      { "validationType": "code_execution", "count": 150 }
    ]
  }
}
```

### Programmatic Usage

```typescript
import { logSecurityEventAsync, getSecurityLogs } from '@/lib/ai-tools/security/security-logger';

// Log an event
logSecurityEventAsync({
  validationType: 'file_system',
  operationType: 'write',
  allowed: false,
  blockedReason: 'Path outside allowed directories',
  requestPath: '/etc/passwd',
  severity: 'critical',
});

// Query logs
const logs = await getSecurityLogs({
  severity: 'critical',
  startDate: new Date('2025-11-01'),
  limit: 100,
});
```

---

## Migration Guide

### Prerequisites

1. **Backup Your Data:**
```bash
# Backup streaming credentials
cp data/streaming-credentials.json data/streaming-credentials.backup.json

# Backup database
cp /home/ubuntu/sports-bar-data/production.db /home/ubuntu/sports-bar-data/production.backup.db
```

2. **Generate Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. **Update Environment:**
```bash
# Add to .env
ENCRYPTION_KEY=your_generated_key_here
```

### Step-by-Step Migration

#### 1. Apply Database Migration
```bash
# Run the migration SQL
sqlite3 /home/ubuntu/sports-bar-data/production.db < drizzle/0002_security_validation_logs.sql
```

Or use Drizzle:
```bash
npm run db:push
```

#### 2. Migrate Credentials
```bash
# Run migration script
npx tsx scripts/migrate-credentials-encryption.ts
```

The script will:
- Validate ENCRYPTION_KEY is set
- Create a backup
- Migrate all credentials
- Verify each migration
- Provide a summary

#### 3. Verify Migration
```bash
# Test credentials endpoint
curl http://localhost:3001/api/streaming-platforms/credentials

# Verify a specific credential
curl -X PUT http://localhost:3001/api/streaming-platforms/credentials/verify \
  -H "Content-Type: application/json" \
  -d '{"platformId":"hulu-live"}'
```

#### 4. Test AI Health Check
```bash
# Start Ollama (if not running)
ollama serve

# Test AI endpoint
curl http://localhost:3001/api/generate-script \
  -H "Content-Type: application/json" \
  -d '{
    "description": "List files",
    "scriptType": "bash",
    "requirements": ["Safe command"]
  }'
```

#### 5. Monitor Security Logs
```bash
# View recent security events
curl http://localhost:3001/api/security/logs?limit=10

# View security statistics
curl http://localhost:3001/api/security/logs?stats=true&days=7
```

---

## Testing

### Run Test Suite

```bash
# Run all tests
npm test

# Run security tests only
npm test tests/security/

# Run with coverage
npm run test:coverage
```

### Test Coverage

#### Encryption Tests (`tests/security/encryption.test.ts`)
- ✓ Encrypt/decrypt round-trip
- ✓ Unique ciphertexts for same plaintext
- ✓ Unicode character handling
- ✓ Long string handling
- ✓ Tamper detection (authentication)
- ✓ Base64 string encryption
- ✓ Key generation
- ✓ Hashing and hash comparison
- ✓ Setup validation

#### Validator Tests (`tests/security/enhanced-validator.test.ts`)
- ✓ File system operation validation
- ✓ Path traversal detection
- ✓ Blocked directory detection
- ✓ Extension validation
- ✓ Code execution validation
- ✓ Bash command validation
- ✓ Dangerous pattern detection
- ✓ Resource limit validation

---

## Environment Variables

### Required
```bash
# Encryption key (minimum 32 characters)
ENCRYPTION_KEY=your_64_character_hex_key_here
```

### Optional
```bash
# Ollama configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

---

## Troubleshooting

### Encryption Key Issues

**Problem:** "ENCRYPTION_KEY environment variable is not set"
```bash
# Solution: Generate and set key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add to .env file
```

**Problem:** "ENCRYPTION_KEY must be at least 32 characters"
```bash
# Solution: Generate a longer key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Migration Issues

**Problem:** Migration fails with decryption error
```bash
# Solution: Check if credentials are already migrated
# View current credentials
cat data/streaming-credentials.json | jq '.[] | {platformId, encryptionVersion}'

# If needed, restore from backup and try again
cp data/streaming-credentials.backup.json data/streaming-credentials.json
```

### Ollama Health Check Issues

**Problem:** "Ollama service is unavailable"
```bash
# Solution 1: Start Ollama
ollama serve

# Solution 2: Check Ollama is installed
which ollama

# Solution 3: Verify model is pulled
ollama list
ollama pull llama3.2

# Solution 4: Check environment variables
echo $OLLAMA_BASE_URL
```

### Security Log Issues

**Problem:** Logs not appearing in database
```bash
# Check if table exists
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT name FROM sqlite_master WHERE type='table' AND name='SecurityValidationLog';"

# If not, run migration
sqlite3 /home/ubuntu/sports-bar-data/production.db < drizzle/0002_security_validation_logs.sql
```

---

## Performance Considerations

### Encryption
- **Encryption Time:** ~1-2ms per operation
- **Key Derivation:** PBKDF2 with 100K iterations adds ~50-100ms
- **Caching:** Consider caching decrypted credentials in memory for frequently used values

### Health Checks
- **Cache Duration:** 30 seconds (configurable)
- **Timeout:** 5 seconds per health check
- **Retry Delays:** 1s → 2s → 4s (with jitter)

### Database Logging
- **Async Writes:** Non-blocking, fire-and-forget
- **Content Truncation:** Request content truncated to 2000 characters
- **Indexing:** All query fields are indexed for fast retrieval

---

## Security Best Practices

1. **Keep Encryption Key Secure:**
   - Store in environment variable, not in code
   - Use a secrets manager in production (AWS Secrets Manager, HashiCorp Vault)
   - Rotate keys periodically
   - Never commit to version control

2. **Monitor Security Logs:**
   - Review critical severity events daily
   - Set up alerts for unusual patterns
   - Investigate all blocked operations
   - Retain logs for audit compliance

3. **Ollama Security:**
   - Run Ollama on localhost only (not exposed to internet)
   - Use firewall rules to restrict access
   - Monitor Ollama logs for suspicious activity

4. **Regular Backups:**
   - Backup streaming credentials before migration
   - Backup database regularly
   - Test restore procedures

---

## Files Modified/Created

### Created Files
1. `/src/lib/security/encryption.ts` - Encryption library
2. `/src/lib/ai-tools/security/security-logger.ts` - Security logging
3. `/src/app/api/security/logs/route.ts` - Security logs API
4. `/scripts/migrate-credentials-encryption.ts` - Migration script
5. `/drizzle/0002_security_validation_logs.sql` - Database migration
6. `/tests/security/encryption.test.ts` - Encryption tests
7. `/tests/security/enhanced-validator.test.ts` - Validator tests
8. `/docs/SECURITY_ENHANCEMENTS.md` - This documentation

### Modified Files
1. `/src/db/schema.ts` - Added securityValidationLogs table
2. `/src/lib/ai-tools/security/enhanced-validator.ts` - Integrated logging
3. `/src/app/api/streaming-platforms/credentials/route.ts` - Added encryption
4. `/src/lib/enhanced-ai-client.ts` - Added health checking
5. `/.env.example` - Added ENCRYPTION_KEY and Ollama config

---

## Support

For issues or questions:
1. Check this documentation
2. Review test files for usage examples
3. Check application logs
4. Review security logs via API

---

## Version History

**v1.0.0** - November 2, 2025
- Initial implementation of all security enhancements
- AES-256-GCM encryption for credentials
- Ollama health check with retry logic
- Security validation logging to database
- Comprehensive test suite
- Migration scripts and documentation
