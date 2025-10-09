# DATABASE_URL Configuration Fix

## Issue
The `DATABASE_URL` in `.env` was using a relative path which caused Prisma to create database files in incorrect locations when running from different directories.

## Fix Required
Update the `DATABASE_URL` in your `.env` file to use an absolute path:

```bash
# Before (relative path - causes issues)
DATABASE_URL="file:./prisma/data/sports_bar.db"

# After (absolute path - recommended)
DATABASE_URL="file:/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db"
```

## Why This Matters
- Ensures Prisma always writes to the same database file
- Prevents creation of duplicate database files in nested directories
- Critical for Wolf Pack configuration persistence

## Note
The `.env` file is not committed to the repository for security reasons. This change must be applied manually on each deployment.
