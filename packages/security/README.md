# @sports-bar/security

**Purpose:** Symmetric encryption + hashing helpers for sensitive data (API keys, secrets, audit-trail integrity). Minimal surface — Node `crypto` wrappers with safe defaults.

**Key exports** (`src/index.ts`):
- `encrypt(plaintext)` / `decrypt(ciphertext)` — buffer-based round trip
- `encryptToString(plaintext)` / `decryptFromString(ciphertext)` — string-safe round trip for DB storage
- `generateEncryptionKey()` — fresh 32-byte key
- `hashData(data)` / `compareHash(data, hash)` — one-way hashing
- `validateEncryptionSetup()` — sanity check that the env-configured key is usable
- Type: `EncryptedData`

**Protocol / port:** N/A — pure crypto helpers. No external deps (no `dependencies` in `package.json`).

**Used by:** `apps/web` for encrypting stored API keys / OAuth tokens / sensitive config rows. (Compare with `@sports-bar/auth` which handles login PINs / sessions, and `@sports-bar/utils` which also exposes `encrypt` / `decrypt` for legacy callers.)

**Gotchas:**
- Requires an encryption key in `.env` — `validateEncryptionSetup()` will tell you if it's missing/malformed.
- Older code uses the `encrypt` / `decrypt` exports from `@sports-bar/utils` — both should converge; check git history before assuming you can swap one for the other.
- Hashing here is for **data integrity**, NOT password storage. Passwords / PINs use `bcryptjs` in `@sports-bar/auth`.

**See also:**
- `@sports-bar/auth` (PIN hashing via bcrypt)
- `@sports-bar/utils` (sibling `encrypt`/`decrypt` exports)
