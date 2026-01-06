#!/bin/bash

#############################################################################
# Database Migration Reset Utility
# 
# This script helps recover from failed database migrations by:
# 1. Backing up the current database
# 2. Clearing failed migration records
# 3. Resetting the migration state
# 4. Re-applying the schema using db push
#
# Usage: ./scripts/reset-database-migrations.sh
#############################################################################

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$HOME/sports-bar-backups/database-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Get database path from .env
get_database_path() {
    local db_url=$(grep "DATABASE_URL" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | sed 's|file:./||' || echo "")
    
    if [ -z "$db_url" ]; then
        log_warning "DATABASE_URL not found in .env, using default"
        echo "prisma/dev.db"
        return
    fi
    
    # Try to find the actual database file
    local possible_paths=(
        "$db_url"
        "prisma/$db_url"
        "prisma/data/sports_bar.db"
        "data/sports_bar.db"
        "prisma/dev.db"
    )
    
    for path in "${possible_paths[@]}"; do
        if [ -f "$PROJECT_DIR/$path" ]; then
            echo "$path"
            return
        fi
    done
    
    # If not found, return the path from .env anyway
    echo "$db_url"
}

# Main script
main() {
    print_header "Database Migration Reset Utility"
    
    cd "$PROJECT_DIR" || {
        log_error "Failed to change to project directory: $PROJECT_DIR"
        exit 1
    }
    
    # Get database path
    DB_PATH=$(get_database_path)
    DB_FULL_PATH="$PROJECT_DIR/$DB_PATH"
    
    log_info "Database path: $DB_PATH"
    
    # Check if database exists
    if [ ! -f "$DB_FULL_PATH" ]; then
        log_error "Database file not found at: $DB_FULL_PATH"
        log_info "This might be a fresh installation. No reset needed."
        exit 1
    fi
    
    log_success "Database file found: $DB_FULL_PATH"
    
    # Show database info
    if command -v sqlite3 &> /dev/null; then
        DB_SIZE=$(du -h "$DB_FULL_PATH" | cut -f1)
        log_info "Database size: $DB_SIZE"
    fi
    
    # Warning message
    echo ""
    log_warning "⚠️  WARNING: This will reset the migration state of your database"
    log_warning "Your data will be preserved, but migration history will be cleared"
    echo ""
    log_info "This is useful when you encounter migration errors like:"
    log_info "  - P3009: Failed migrations in the database"
    log_info "  - P3005: Database schema is not empty"
    log_info "  - Migration conflicts or inconsistencies"
    echo ""
    
    # Confirm action
    read -p "Do you want to continue? (yes/no): " confirm
    if [[ ! "$confirm" =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    print_header "Step 1: Backing Up Database"
    
    BACKUP_FILE="$BACKUP_DIR/pre-reset-backup-$TIMESTAMP.db"
    
    log_info "Creating backup..."
    cp "$DB_FULL_PATH" "$BACKUP_FILE"
    
    if [ -f "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_success "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
    else
        log_error "Failed to create backup"
        exit 1
    fi
    
    # Create SQL dump if sqlite3 is available
    if command -v sqlite3 &> /dev/null; then
        SQL_BACKUP="$BACKUP_DIR/pre-reset-backup-$TIMESTAMP.sql"
        log_info "Creating SQL dump..."
        
        if sqlite3 "$DB_FULL_PATH" .dump > "$SQL_BACKUP" 2>/dev/null; then
            gzip "$SQL_BACKUP"
            SQL_BACKUP="${SQL_BACKUP}.gz"
            SQL_SIZE=$(du -h "$SQL_BACKUP" | cut -f1)
            log_success "SQL dump created: $SQL_BACKUP ($SQL_SIZE)"
        else
            log_warning "SQL dump failed, but binary backup is available"
        fi
    fi
    
    # Clear migration records
    print_header "Step 2: Clearing Failed Migration Records"
    
    if command -v sqlite3 &> /dev/null; then
        log_info "Checking for _prisma_migrations table..."
        
        # Check if migrations table exists
        if sqlite3 "$DB_FULL_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations';" | grep -q "_prisma_migrations"; then
            log_info "Found _prisma_migrations table"
            
            # Show current migration status
            log_info "Current migration records:"
            sqlite3 "$DB_FULL_PATH" "SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations;" 2>/dev/null || true
            
            # Delete failed migrations
            log_info "Removing failed migration records..."
            sqlite3 "$DB_FULL_PATH" "DELETE FROM _prisma_migrations WHERE finished_at IS NULL OR applied_steps_count = 0;" 2>/dev/null || true
            
            # Optionally clear all migration records for a clean slate
            read -p "Clear ALL migration records for a clean slate? (yes/no): " clear_all
            if [[ "$clear_all" =~ ^[Yy][Ee][Ss]$ ]]; then
                sqlite3 "$DB_FULL_PATH" "DELETE FROM _prisma_migrations;" 2>/dev/null || true
                log_success "All migration records cleared"
            else
                log_success "Failed migration records cleared"
            fi
        else
            log_info "No _prisma_migrations table found (this is normal for db push)"
        fi
    else
        log_warning "sqlite3 not available, skipping migration record cleanup"
    fi
    
    # Re-apply schema using db push
    print_header "Step 3: Re-applying Database Schema"
    
    log_info "Using 'prisma db push' to sync schema..."
    log_info "This will preserve all your data while fixing the schema"
    
    # Set DATABASE_URL
    export DATABASE_URL="file:./$DB_PATH"
    
    if npx prisma db push --schema=./prisma/schema.prisma 2>&1 | tee /tmp/prisma_reset.log; then
        log_success "Database schema synchronized successfully"
    else
        # Check if it's just a "no changes" message
        if grep -q "already in sync" /tmp/prisma_reset.log || grep -q "P3005" /tmp/prisma_reset.log; then
            log_success "Database schema is already in sync"
        else
            log_error "Schema synchronization failed"
            log_error "Check the output above for details"
            log_info "Your data is safe in the backup: $BACKUP_FILE"
            rm -f /tmp/prisma_reset.log
            exit 1
        fi
    fi
    
    rm -f /tmp/prisma_reset.log
    
    # Verify database integrity
    print_header "Step 4: Verifying Database Integrity"
    
    if command -v sqlite3 &> /dev/null; then
        log_info "Running integrity check..."
        
        if sqlite3 "$DB_FULL_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_success "Database integrity check passed"
        else
            log_warning "Database integrity check reported issues"
            log_info "Your data is safe in the backup: $BACKUP_FILE"
        fi
        
        # Show table count
        TABLE_COUNT=$(sqlite3 "$DB_FULL_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "unknown")
        log_info "Database contains $TABLE_COUNT tables"
    fi
    
    # Generate Prisma Client
    print_header "Step 5: Regenerating Prisma Client"
    
    log_info "Generating Prisma Client..."
    
    if npx prisma generate --schema=./prisma/schema.prisma 2>&1 | tee /tmp/prisma_generate.log; then
        log_success "Prisma Client generated successfully"
    else
        log_error "Prisma Client generation failed"
        log_error "Check the output above for details"
        rm -f /tmp/prisma_generate.log
        exit 1
    fi
    
    rm -f /tmp/prisma_generate.log
    
    # Completion message
    print_header "Migration Reset Complete!"
    
    echo ""
    log_success "Database migration state has been reset successfully"
    log_success "All your data has been preserved"
    echo ""
    log_info "Backup files:"
    log_info "  Binary backup: $BACKUP_FILE"
    if [ -f "$SQL_BACKUP" ]; then
        log_info "  SQL dump: $SQL_BACKUP"
    fi
    echo ""
    log_info "Next steps:"
    log_info "  1. Restart your application"
    log_info "  2. Verify that everything works correctly"
    log_info "  3. If issues persist, you can restore from backup:"
    log_info "     cp $BACKUP_FILE $DB_FULL_PATH"
    echo ""
    log_success "You can now run update_from_github.sh without migration errors"
    echo ""
}

# Run main function
main "$@"
