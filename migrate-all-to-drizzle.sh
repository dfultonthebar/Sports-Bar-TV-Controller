#!/bin/bash

# Drizzle Migration Script
# This script helps migrate all remaining Prisma files to Drizzle ORM

echo "=== Drizzle Migration Script ==="
echo "Finding all files that still use Prisma..."
echo ""

# Find all TypeScript files that import prisma
echo "Files using @prisma/client:"
grep -rl "@prisma/client" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l

echo ""
echo "Files using 'from.*prisma':"
grep -rl "from.*prisma" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l

echo ""
echo "Files using 'prisma\.':"
grep -rl "prisma\." src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l

echo ""
echo "=== Files to Migrate ==="
echo ""

# List all files that need migration
grep -rl "import.*prisma.*from.*@/lib/db\|import.*{ prisma }\|prisma\." src/app/api --include="*.ts" 2>/dev/null | sort | uniq

echo ""
echo "=== Total files to migrate: ==="
grep -rl "import.*prisma.*from.*@/lib/db\|import.*{ prisma }\|prisma\." src/app/api --include="*.ts" 2>/dev/null | sort | uniq | wc -l

echo ""
echo "Done! Use this list to systematically migrate each file."
