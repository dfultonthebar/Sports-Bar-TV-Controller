# Dependency Update: Next.js 15 & React 19

## Overview

This document covers the major dependency update from Next.js 14 to Next.js 15 and React 18 to React 19, including breaking changes and fixes applied.

## Update Summary

### Major Version Updates

- **Next.js**: 14.2.33 → 15.5.6
- **React**: 18.2.0 → 19.2.0
- **React-DOM**: 18.2.0 → 19.2.0
- **Total packages updated**: 450+

### Additional Dependencies

- Added `dotenv` package (required for environment variable handling)

## Breaking Changes

### 1. Drizzle ORM Date Handling

**Issue**: After updating to Next.js 15 and React 19, the codebase indexing feature failed with:
```
TypeError: SQLite3 can only bind numbers, strings, bigints, buffers, and null
```

**Root Cause**: The newer version of Drizzle ORM no longer accepts JavaScript `Date` objects directly when inserting into SQLite database.

**Solution**: Convert all Date objects to ISO strings before database operations.

**Code Example**:

**Before (Broken)**:
```typescript
await db.insert(indexedFiles).values({
  id: crypto.randomUUID(),
  lastModified: file.lastModified,        // Date object
  lastIndexed: new Date(),                 // Date object
  createdAt: new Date(),                   // Date object
  updatedAt: new Date()                    // Date object
});
```

**After (Fixed)**:
```typescript
await db.insert(indexedFiles).values({
  id: crypto.randomUUID(),
  lastModified: file.lastModified.toISOString(),  // ISO string
  lastIndexed: new Date().toISOString(),           // ISO string
  createdAt: new Date().toISOString(),             // ISO string
  updatedAt: new Date().toISOString()              // ISO string
});
```

**Affected Files**:
- `src/app/api/ai-assistant/index-codebase/route.ts`

### 2. Next.js Version Compatibility

**Issue**: Initially attempted to update to Next.js 16, but encountered peer dependency conflicts with `next-auth`.

**Solution**: Settled on Next.js 15 which is compatible with both React 19 and next-auth@4.24.11.

**Command Used**:
```bash
npm install next@15 --legacy-peer-deps
```

## Installation & Build Process

### Update Commands

```bash
# Update Next.js and React
npm install next@15 react@19 react-dom@19 --legacy-peer-deps

# Install missing dependencies
npm install dotenv --legacy-peer-deps

# Update all other packages
npm update --legacy-peer-deps
```

### Build & Restart

```bash
# Clean and rebuild
rm -rf .next
npm run build

# Restart PM2
pm2 restart sports-bar-tv-controller
```

## Testing & Verification

### Codebase Indexing Test

After fixing the Date handling issue:

```bash
curl -X POST http://localhost:3001/api/ai-assistant/index-codebase \
  -H "Content-Type: application/json" \
  -d '{"action": "index"}'
```

**Expected Result**:
```json
{
  "success": true,
  "stats": {
    "totalFiles": 1051,
    "indexed": 1051,
    "updated": 0,
    "skipped": 0,
    "deactivated": 0,
    "duration": 518
  }
}
```

### Index Statistics

```bash
curl http://localhost:3001/api/ai-assistant/index-codebase
```

**Expected Result**:
```json
{
  "success": true,
  "stats": {
    "totalFiles": 1051,
    "totalSize": 8498140,
    "filesByType": [
      {"type": "typescript", "count": 393},
      {"type": "markdown", "count": 320},
      {"type": "typescript-react", "count": 152},
      {"type": "json", "count": 149},
      {"type": "javascript", "count": 37}
    ]
  }
}
```

## Known Issues & Workarounds

### 1. Browser Cache Issues

**Problem**: After updating, users may see a white screen due to cached old JavaScript bundles.

**Solution**: Hard refresh with `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac).

### 2. React `use()` Hook Errors

**Problem**: If you see errors like `TypeError: (0, s.use) is not a function`, it means React version is incompatible.

**Solution**: Ensure React 19+ is installed, which includes the `use()` hook:
```bash
npm install react@19 react-dom@19 --legacy-peer-deps
```

## Compatibility Matrix

| Package | Minimum Version | Recommended Version | Notes |
|---------|----------------|---------------------|-------|
| Next.js | 15.0.0 | 15.5.6 | Version 16 incompatible with next-auth |
| React | 19.0.0 | 19.2.0 | Includes `use()` hook |
| React-DOM | 19.0.0 | 19.2.0 | Must match React version |
| next-auth | 4.24.11 | 4.24.11 | Does not support Next.js 16+ |
| Drizzle ORM | 0.44.6+ | 0.44.7 | Requires ISO string dates for SQLite |

## Migration Checklist

- [ ] Update package.json with new dependency versions
- [ ] Run `npm install --legacy-peer-deps`
- [ ] Search codebase for direct Date object insertions to database
- [ ] Convert all Date objects to ISO strings with `.toISOString()`
- [ ] Clear `.next` build directory
- [ ] Run `npm run build`
- [ ] Test all database operations
- [ ] Verify homepage loads
- [ ] Test API endpoints
- [ ] Push changes to GitHub
- [ ] Update AI Q&A system with new documentation

## Resources

- [Next.js 15 Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)

## Commit Reference

Commit: 3de7748
Date: 2025-10-29
Branch: main
