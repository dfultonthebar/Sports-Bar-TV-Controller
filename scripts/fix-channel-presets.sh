
#!/bin/bash

# =============================================================================
# CHANNEL PRESETS FIX SCRIPT
# =============================================================================
# This script fixes the "Failed to fetch channel presets" error by:
# 1. Ensuring database exists and is accessible
# 2. Applying all necessary migrations
# 3. Generating Prisma client
# 4. Restarting the server
# 5. Verifying the fix worked
# =============================================================================

set -e
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="/home/ubuntu/Sports-Bar-TV-Controller"
LOG_FILE="$PROJECT_DIR/channel-presets-fix.log"

# Logging functions
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] ${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] ${RED}✗ $1${NC}" | tee -a "$LOG_FILE" >&2
}

log_warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] ${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
}

# Change to project directory
cd "$PROJECT_DIR" || {
    log_error "Failed to change to project directory: $PROJECT_DIR"
    exit 1
}

echo "=========================================="
echo "🔧 Channel Presets Fix Script"
echo "=========================================="
log "Starting channel presets fix..."
echo ""

# =============================================================================
# 1. BACKUP DATABASE
# =============================================================================
log "📦 Step 1: Backing up database..."

# Get database path from .env
if [ -f ".env" ]; then
    DB_PATH=$(grep "DATABASE_URL" .env | cut -d'=' -f2 | tr -d '"' | sed 's|file:./||')
else
    DB_PATH="prisma/dev.db"
    log_warning ".env not found, using default path: $DB_PATH"
fi

# Find actual database location
if [ ! -f "$DB_PATH" ]; then
    log_warning "Database not found at: $DB_PATH"
    log "Searching for database..."
    
    POSSIBLE_PATHS=(
        "prisma/data/sports_bar.db"
        "data/sports_bar.db"
        "prisma/dev.db"
    )
    
    FOUND=false
    for POSSIBLE_PATH in "${POSSIBLE_PATHS[@]}"; do
        if [ -f "$POSSIBLE_PATH" ]; then
            log_success "Found database at: $POSSIBLE_PATH"
            DB_PATH="$POSSIBLE_PATH"
            FOUND=true
            
            # Update .env with correct path
            CORRECT_URL="file:./$DB_PATH"
            if [ -f ".env" ]; then
                sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=\"$CORRECT_URL\"|" .env
                log_success "Updated .env with correct path"
            fi
            break
        fi
    done
    
    if [ "$FOUND" = false ]; then
        log_warning "No existing database found - will create new one"
        DB_PATH="prisma/dev.db"
    fi
fi

# Backup if database exists
if [ -f "$DB_PATH" ]; then
    BACKUP_DIR="$HOME/sports-bar-backups/database-backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/pre-fix-backup-$TIMESTAMP.db"
    
    cp "$DB_PATH" "$BACKUP_FILE"
    log_success "Database backed up to: $BACKUP_FILE"
else
    log "No existing database to backup"
fi

echo ""

# =============================================================================
# 2. ENSURE DATABASE DIRECTORY EXISTS
# =============================================================================
log "📁 Step 2: Ensuring database directory exists..."

DB_DIR=$(dirname "$DB_PATH")
if [ ! -d "$DB_DIR" ]; then
    mkdir -p "$DB_DIR"
    log_success "Created directory: $DB_DIR"
else
    log_success "Directory exists: $DB_DIR"
fi

echo ""

# =============================================================================
# 3. GENERATE PRISMA CLIENT
# =============================================================================
log "🔧 Step 3: Generating Prisma client..."

if npx prisma generate 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Prisma client generated successfully"
else
    log_error "Failed to generate Prisma client"
    exit 1
fi

echo ""

# =============================================================================
# 4. APPLY MIGRATIONS
# =============================================================================
log "🗄️ Step 4: Applying database migrations..."

# Set DATABASE_URL from .env
if [ -f ".env" ]; then
    export $(grep "^DATABASE_URL=" .env | xargs)
fi

# Check if database exists
if [ -f "$DB_PATH" ]; then
    log "Existing database detected - applying migrations safely..."
    
    # Use migrate deploy for existing databases (preserves data)
    if npx prisma migrate deploy 2>&1 | tee /tmp/migrate_output.log | tee -a "$LOG_FILE"; then
        log_success "Migrations applied successfully"
    else
        # Check if it's just "no pending migrations"
        if grep -q "No pending migrations" /tmp/migrate_output.log || grep -q "already in sync" /tmp/migrate_output.log; then
            log_success "Database already up to date"
        else
            log_error "Migration failed - check output above"
            rm -f /tmp/migrate_output.log
            exit 1
        fi
    fi
    rm -f /tmp/migrate_output.log
else
    log "No existing database - creating new one..."
    
    # For new databases, use migrate deploy
    if npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Database created with migrations"
    else
        log_warning "Migrate deploy failed, trying db push..."
        if npx prisma db push 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Database created with schema sync"
        else
            log_error "Failed to create database"
            exit 1
        fi
    fi
fi

echo ""

# =============================================================================
# 5. VERIFY DATABASE STRUCTURE
# =============================================================================
log "🔍 Step 5: Verifying database structure..."

if [ -f "$DB_PATH" ]; then
    # Check if ChannelPreset table exists
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='ChannelPreset';" 2>/dev/null | grep -q "ChannelPreset"; then
        log_success "ChannelPreset table exists"
        
        # Verify all required columns
        REQUIRED_COLS=("id" "name" "channelNumber" "deviceType" "order" "isActive" "usageCount" "lastUsed" "createdAt" "updatedAt")
        MISSING_COLS=()
        
        for col in "${REQUIRED_COLS[@]}"; do
            if ! sqlite3 "$DB_PATH" "PRAGMA table_info(ChannelPreset);" 2>/dev/null | grep -q "|$col|"; then
                MISSING_COLS+=("$col")
            fi
        done
        
        if [ ${#MISSING_COLS[@]} -eq 0 ]; then
            log_success "All required columns present"
        else
            log_error "Missing columns: ${MISSING_COLS[*]}"
            log_error "Database structure is incomplete"
            exit 1
        fi
        
        # Count records
        RECORD_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ChannelPreset;" 2>/dev/null || echo "0")
        log "Current records: $RECORD_COUNT"
    else
        log_error "ChannelPreset table does not exist!"
        log_error "Migrations may not have been applied correctly"
        exit 1
    fi
else
    log_error "Database file not found after migration!"
    exit 1
fi

echo ""

# =============================================================================
# 6. RESTART SERVER
# =============================================================================
log "🔄 Step 6: Restarting server..."

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    # Check if app exists in PM2
    if pm2 list | grep -q "sports-bar-tv-controller"; then
        log "Restarting PM2 process..."
        if pm2 restart sports-bar-tv-controller 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Server restarted via PM2"
        else
            log_error "Failed to restart via PM2"
            exit 1
        fi
    else
        log "Starting new PM2 process..."
        if pm2 start npm --name sports-bar-tv-controller -- start 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Server started via PM2"
            pm2 save 2>&1 | tee -a "$LOG_FILE"
        else
            log_error "Failed to start via PM2"
            exit 1
        fi
    fi
else
    log_warning "PM2 not installed - cannot restart server automatically"
    log "Please restart your server manually"
fi

# Wait for server to be ready
log "Waiting for server to be ready..."
sleep 5

echo ""

# =============================================================================
# 7. VERIFY FIX
# =============================================================================
log "✅ Step 7: Verifying fix..."

# Check if server is responding
MAX_ATTEMPTS=10
ATTEMPT=0
SERVER_READY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        SERVER_READY=true
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 2
done

if [ "$SERVER_READY" = false ]; then
    log_error "Server is not responding after restart"
    log_error "Check PM2 logs: pm2 logs sports-bar-tv-controller"
    exit 1
fi

log_success "Server is responding"

# Test the API endpoint
log "Testing API endpoint..."
sleep 2

if curl -s -f http://localhost:3000/api/channel-presets > /tmp/api_test.json 2>/dev/null; then
    if grep -q '"success":true' /tmp/api_test.json; then
        log_success "API endpoint is working correctly!"
        
        # Show response
        log "API Response:"
        cat /tmp/api_test.json | jq '.' 2>/dev/null | tee -a "$LOG_FILE" || cat /tmp/api_test.json | tee -a "$LOG_FILE"
    else
        log_error "API returned error response"
        cat /tmp/api_test.json | jq '.' 2>/dev/null | tee -a "$LOG_FILE" || cat /tmp/api_test.json | tee -a "$LOG_FILE"
        exit 1
    fi
else
    log_error "API endpoint is not responding"
    
    # Try to get error details
    if curl -s http://localhost:3000/api/channel-presets > /tmp/api_test.json 2>&1; then
        log_error "Error response:"
        cat /tmp/api_test.json | jq '.' 2>/dev/null | tee -a "$LOG_FILE" || cat /tmp/api_test.json | tee -a "$LOG_FILE"
    fi
    exit 1
fi

rm -f /tmp/api_test.json

echo ""

# =============================================================================
# SUCCESS SUMMARY
# =============================================================================
echo "=========================================="
echo -e "${GREEN}✅ FIX COMPLETED SUCCESSFULLY!${NC}"
echo "=========================================="
log_success "Channel presets fix completed successfully"
echo ""
echo "📋 What was fixed:"
echo "  ✓ Database structure verified/created"
echo "  ✓ ChannelPreset table with all required columns"
echo "  ✓ Prisma client regenerated"
echo "  ✓ Database migrations applied"
echo "  ✓ Server restarted"
echo "  ✓ API endpoint verified working"
echo ""
echo "🌐 You can now:"
echo "  • Access Channel Presets in the Settings tab"
echo "  • Create and manage channel presets"
echo "  • Use quick-tune functionality"
echo ""
echo "📝 Full log saved to: $LOG_FILE"
echo ""
echo "If you still experience issues:"
echo "  1. Clear your browser cache"
echo "  2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)"
echo "  3. Check browser console for errors"
echo "  4. Run diagnostic: ./scripts/diagnose-channel-presets.sh"
echo "=========================================="
