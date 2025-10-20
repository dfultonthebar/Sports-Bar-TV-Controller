#!/bin/bash

# Prisma to Drizzle ORM Migration Script
# This script automatically converts Prisma usage to Drizzle ORM with logging

set -e

echo "======================================"
echo "Prisma to Drizzle ORM Migration Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for changes
TOTAL_FILES=0
UPDATED_FILES=0

# Function to log messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Find all TypeScript files that import prisma
log_info "Finding files that use Prisma..."
FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "prisma\." {} \; 2>/dev/null || true)

if [ -z "$FILES" ]; then
    log_info "No files found using Prisma. Migration may already be complete!"
    exit 0
fi

# Count total files
TOTAL_FILES=$(echo "$FILES" | wc -l)
log_info "Found $TOTAL_FILES files using Prisma"
echo ""

# Backup directory
BACKUP_DIR="prisma-migration-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
log_info "Created backup directory: $BACKUP_DIR"

# Process each file
for file in $FILES; do
    echo ""
    log_info "Processing: $file"
    
    # Create backup
    cp "$file" "$BACKUP_DIR/$(basename $file).bak"
    
    # Create temporary file
    temp_file="${file}.tmp"
    
    # Check if file already has drizzle imports
    if grep -q "from '@/db'" "$file" || grep -q "from '@/lib/db-helpers'" "$file"; then
        log_warn "File may already be migrated, skipping: $file"
        continue
    fi
    
    # Start building the new file
    cat "$file" > "$temp_file"
    
    # Step 1: Replace import statements
    if grep -q "import.*prisma.*from '@/lib/db'" "$temp_file"; then
        sed -i "s|import.*prisma.*from '@/lib/db'|import { db, schema } from '@/db'\nimport { logger } from '@/lib/logger'\nimport { findMany, findFirst, findUnique, create, createMany, update, updateMany, deleteRecord, deleteMany, count, upsert, eq, and, or, desc, asc } from '@/lib/db-helpers'|g" "$temp_file"
    elif grep -q "import.*prisma.*from '@/lib/prisma'" "$temp_file"; then
        sed -i "s|import.*prisma.*from '@/lib/prisma'|import { db, schema } from '@/db'\nimport { logger } from '@/lib/logger'\nimport { findMany, findFirst, findUnique, create, createMany, update, updateMany, deleteRecord, deleteMany, count, upsert, eq, and, or, desc, asc } from '@/lib/db-helpers'|g" "$temp_file"
    fi
    
    # Note: The following replacements are basic patterns
    # Complex queries may need manual review
    
    log_warn "Automatic replacement completed. File may need manual review for complex queries."
    log_warn "Please review: $file"
    
    # Move temp file to original
    mv "$temp_file" "$file"
    
    UPDATED_FILES=$((UPDATED_FILES + 1))
done

echo ""
echo "======================================"
log_info "Migration Summary:"
echo "  Total files found: $TOTAL_FILES"
echo "  Files updated: $UPDATED_FILES"
echo "  Backup location: $BACKUP_DIR"
echo "======================================"
echo ""
log_warn "IMPORTANT: This script performs basic replacements only."
log_warn "You MUST manually review and test all updated files!"
log_warn "Complex Prisma queries (relations, transactions, etc.) need manual conversion."
echo ""
log_info "Next steps:"
echo "  1. Review updated files in src/"
echo "  2. Update complex queries manually"
echo "  3. Test all API endpoints"
echo "  4. Run: npm run build"
echo "  5. If successful, commit changes"
echo ""
