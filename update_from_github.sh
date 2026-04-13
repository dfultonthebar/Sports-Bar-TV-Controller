#!/bin/bash

# =============================================================================
# Sports Bar TV Controller - GitHub Update Script
# =============================================================================
# This script safely updates the application from GitHub with proper error
# handling, PM2 process management, and data preservation.
#
# Based on successful deployment process from PR #140
# =============================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# =============================================================================
# CONFIGURATION
# =============================================================================
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/Sports-Bar-TV-Controller}"
readonly LOG_FILE="$PROJECT_DIR/update.log"
readonly PM2_APP_NAME="sports-bar-tv-controller"
readonly BACKUP_DIR="$HOME/sports-bar-backups"

# Drizzle (current) DB path — used for pre-update DB snapshot
readonly DB_PATH="/home/ubuntu/sports-bar-data/production.db"
readonly DB_BACKUP_DIR="/home/ubuntu/sports-bar-data/backups"

# Location-specific files whose local version must always win on merge conflict.
# These live on location branches (location/graystone, location/holmgren-way,
# location/stoneyard-greenville, location/lucky-s-1313) and must never be
# overwritten by merges from main. Paths not present on disk are harmless —
# `git checkout --ours` is a no-op when the path isn't in the conflict set.
readonly LOCATION_PATHS_OURS=(
    "apps/web/data/tv-layout.json"
    "apps/web/data/directv-devices.json"
    "apps/web/data/firetv-devices.json"
    "apps/web/data/device-subscriptions.json"
    "apps/web/data/wolfpack-devices.json"
    "apps/web/data/channel-presets-cable.json"
    "apps/web/data/channel-presets-directv.json"
    "data/tv-layout.json"
    "data/directv-devices.json"
    "data/firetv-devices.json"
    "data/device-subscriptions.json"
    "data/wolfpack-devices.json"
    ".env"
)

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# =============================================================================
# LOGGING FUNCTIONS
# =============================================================================
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[$timestamp] ❌ ERROR: $1${NC}" | tee -a "$LOG_FILE" >&2
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[$timestamp] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

log_info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp] ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

# =============================================================================
# ERROR HANDLING
# =============================================================================
cleanup_on_error() {
    local exit_code=$?
    local failed_line="${1:-unknown}"
    log_error "Script failed at line $failed_line (exit code: $exit_code)"
    log_error "Check $LOG_FILE for details"

    # If we have a backup, mention it
    if [ -n "${BACKUP_FILE:-}" ] && [ -f "$BACKUP_FILE" ]; then
        log_info "Your configuration backup: $BACKUP_FILE"
    fi
    if [ -n "${DB_BACKUP_FILE:-}" ] && [ -f "$DB_BACKUP_FILE" ]; then
        log_info "Your database backup: $DB_BACKUP_FILE"
    fi

    exit $exit_code
}

trap 'cleanup_on_error $LINENO' ERR

# =============================================================================
# PREREQUISITE CHECKS
# =============================================================================
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check for required commands
    for cmd in git npm node pm2; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_tools+=("$cmd")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install missing tools and try again"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# =============================================================================
# PORT DETECTION
# =============================================================================
get_server_port() {
    local port=3000  # Default fallback
    
    # Try to extract port from ecosystem.config.js
    if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
        # Extract PORT value from env section
        local extracted_port=$(grep -A 10 "env:" "$PROJECT_DIR/ecosystem.config.js" | \
                              grep "PORT:" | \
                              sed 's/.*PORT:[[:space:]]*\([0-9]*\).*/\1/' | \
                              head -1)
        
        if [ -n "$extracted_port" ] && [ "$extracted_port" -gt 0 ] 2>/dev/null; then
            port=$extracted_port
        fi
    fi
    
    echo "$port"
}

# =============================================================================
# DIRECTORY VALIDATION
# =============================================================================
validate_directory() {
    log_info "Validating project directory..."
    
    # Check if we're in the right directory
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        log_error "Not in a valid Node.js project directory"
        log_error "Expected: $PROJECT_DIR"
        log_error "Current: $(pwd)"
        exit 1
    fi
    
    # Check if it's a git repository
    if [ ! -d "$PROJECT_DIR/.git" ]; then
        log_error "Not a git repository: $PROJECT_DIR"
        exit 1
    fi
    
    log_success "Project directory validated"
}

# =============================================================================
# BACKUP FUNCTIONS
# =============================================================================
create_backup() {
    log_info "Creating backup of configuration and database..."

    mkdir -p "$BACKUP_DIR"
    mkdir -p "$DB_BACKUP_DIR"

    local timestamp=$(date +%Y-%m-%d-%H-%M-%S)
    BACKUP_FILE="$BACKUP_DIR/config-backup-$timestamp.tar.gz"
    DB_BACKUP_FILE="$DB_BACKUP_DIR/pre-update-$timestamp.db"

    # --- Config / location-data tarball (best-effort) -----------------------
    tar -czf "$BACKUP_FILE" \
        .env \
        apps/web/data/*.json \
        data/*.json \
        2>/dev/null || true

    if [ -f "$BACKUP_FILE" ]; then
        local backup_size=$(du -h "$BACKUP_FILE" | cut -f1)
        log_success "Config backup created: $BACKUP_FILE ($backup_size)"

        # Keep only last 7 config backups
        cd "$BACKUP_DIR"
        ls -t config-backup-*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
        cd - > /dev/null
    else
        log_warning "No configuration to backup (first run?)"
    fi

    # --- Drizzle production DB snapshot -------------------------------------
    # Use sqlite3 .backup (not cp) — the DB may have open WAL connections from
    # the running PM2 process, and cp would produce a corrupt copy.
    if [ -f "$DB_PATH" ]; then
        log_info "Backing up Drizzle DB to $DB_BACKUP_FILE"
        if command -v sqlite3 &> /dev/null; then
            if sqlite3 "$DB_PATH" ".backup '$DB_BACKUP_FILE'" 2>&1 | tee -a "$LOG_FILE"; then
                local db_size=$(du -h "$DB_BACKUP_FILE" | cut -f1)
                log_success "DB backup created: $DB_BACKUP_FILE ($db_size)"
                # Keep only last 14 DB backups
                cd "$DB_BACKUP_DIR"
                ls -t pre-update-*.db 2>/dev/null | tail -n +15 | xargs rm -f 2>/dev/null || true
                cd - > /dev/null
            else
                log_warning "sqlite3 .backup failed — continuing without DB snapshot"
            fi
        else
            log_warning "sqlite3 not installed — cannot snapshot DB safely (refusing to cp live WAL DB)"
        fi
    else
        log_warning "DB not found at $DB_PATH — skipping backup (fresh install?)"
    fi
}

# =============================================================================
# GIT OPERATIONS
# =============================================================================
#
# Auto-resolve merge conflicts on known location-specific paths.
# - Files in LOCATION_PATHS_OURS: keep the local (location-branch) version.
# - package-lock.json: always take the version from main (we want latest lock).
# Any OTHER unresolved conflict is a real conflict — bail out with a clear msg.
#
auto_resolve_location_conflicts() {
    local unresolved_before
    unresolved_before=$(git status --porcelain | grep -c '^UU ' || true)
    if [ "$unresolved_before" -eq 0 ]; then
        return 0
    fi

    log_warning "Merge produced $unresolved_before conflict(s) — attempting auto-resolution"

    # 1. Location paths → keep ours
    for path in "${LOCATION_PATHS_OURS[@]}"; do
        if git status --porcelain -- "$path" 2>/dev/null | grep -q '^UU '; then
            log_info "Conflict on $path — keeping location version (--ours)"
            git checkout --ours -- "$path"
            git add -- "$path"
        fi
    done

    # 2. package-lock.json → take theirs (main is authoritative for lockfile)
    if git status --porcelain -- package-lock.json 2>/dev/null | grep -q '^UU '; then
        log_info "Conflict on package-lock.json — taking main version (--theirs)"
        git checkout --theirs -- package-lock.json
        git add -- package-lock.json
    fi

    # 3. Anything still unresolved is a genuine code conflict — refuse to proceed
    local still_unresolved
    still_unresolved=$(git status --porcelain | grep '^UU ' || true)
    if [ -n "$still_unresolved" ]; then
        log_error "Unresolved merge conflicts outside LOCATION_PATHS_OURS:"
        echo "$still_unresolved" | tee -a "$LOG_FILE"
        log_error "Aborting merge. Resolve manually or run: git merge --abort"
        git merge --abort 2>&1 | tee -a "$LOG_FILE" || true
        exit 1
    fi

    # 4. Finalize the merge
    log_info "All conflicts auto-resolved — finalizing merge commit"
    if ! git commit --no-edit 2>&1 | tee -a "$LOG_FILE"; then
        log_error "Failed to finalize merge commit after auto-resolution"
        exit 1
    fi
    log_success "Merge conflicts auto-resolved and committed"
}

pull_latest_code() {
    log_info "Merging latest code from origin/main into current branch..."

    # --- Detect current branch (refuse detached HEAD) -----------------------
    local CURRENT_BRANCH
    CURRENT_BRANCH=$(git branch --show-current)
    if [ -z "$CURRENT_BRANCH" ]; then
        log_error "Detached HEAD — refusing to update"
        log_error "Check out a branch first: git checkout main  (or a location/* branch)"
        exit 1
    fi
    log_info "Current branch: $CURRENT_BRANCH"

    # --- Stash any uncommitted local changes --------------------------------
    local has_stashed=false
    local stash_name="auto-stash-$(date +%Y%m%d-%H%M%S)"

    if ! git diff-index --quiet HEAD -- 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        log_warning "Detected uncommitted local changes"
        log_info "Stashing local changes before merge..."

        if git stash push -u -m "$stash_name" 2>&1 | tee -a "$LOG_FILE"; then
            has_stashed=true
            log_success "Local changes stashed successfully"
        else
            log_error "Failed to stash local changes"
            log_error "Please manually commit or stash your changes"
            exit 1
        fi
    else
        log_info "No local changes detected"
    fi

    # --- Fetch origin -------------------------------------------------------
    log_info "Fetching latest changes from origin..."
    if ! git fetch origin 2>&1 | tee -a "$LOG_FILE"; then
        log_error "git fetch origin failed"
        exit 1
    fi

    # --- Merge origin/main into current branch ------------------------------
    # This works whether CURRENT_BRANCH is main (fast-forward) or a location/*
    # branch (real merge). We do NOT use `git pull origin main`, which would
    # silently overwrite location-branch work when run on a location branch.
    log_info "Merging origin/main into $CURRENT_BRANCH..."
    set +e
    git merge origin/main --no-edit -m "chore: auto-merge main into $CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"
    local merge_exit=${PIPESTATUS[0]}
    set -e

    if [ "$merge_exit" -ne 0 ]; then
        # Merge stopped — most likely due to conflicts. Try auto-resolution.
        auto_resolve_location_conflicts
    else
        log_success "Merge completed cleanly (no conflicts)"
    fi

    # --- Reapply stashed changes --------------------------------------------
    if [ "$has_stashed" = true ]; then
        log_info "Reapplying stashed local changes..."

        if git stash pop 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Local changes reapplied successfully"
        else
            log_error "Conflict detected while reapplying stashed changes"
            log_error "Your changes are still in the stash: $stash_name"
            log_error "To view stashed changes: git stash list"
            log_error "To manually apply:        git stash pop"
            log_warning "Continuing with update, but you'll need to resolve conflicts manually"
            # Don't exit — let the update continue; user can fix conflicts later
        fi
    fi
}

# =============================================================================
# DATABASE MIGRATION
# =============================================================================
migrate_database_location() {
    log_info "Checking database location..."
    
    # Check if migration script exists
    if [ ! -f "$PROJECT_DIR/scripts/migrate-database-location.sh" ]; then
        log_warning "Migration script not found, skipping database migration"
        return 0
    fi
    
    # Check current DATABASE_URL in .env
    if [ -f "$PROJECT_DIR/.env" ]; then
        CURRENT_DB_URL=$(grep "^DATABASE_URL=" "$PROJECT_DIR/.env" | cut -d'=' -f2- | tr -d '"')
        EXPECTED_DB_URL="file:./prisma/data/sports_bar.db"
        
        if [ "$CURRENT_DB_URL" = "$EXPECTED_DB_URL" ]; then
            log_success "Database location already correct"
            return 0
        fi
        
        log_warning "Database location needs migration"
        log_info "Current: $CURRENT_DB_URL"
        log_info "Expected: $EXPECTED_DB_URL"
        
        # Run migration script
        if bash "$PROJECT_DIR/scripts/migrate-database-location.sh"; then
            log_success "Database migration completed successfully"
        else
            log_error "Database migration failed"
            log_warning "Continuing with update, but database may need manual migration"
        fi
    else
        log_warning ".env file not found, will be created from .env.example"
    fi
}

# =============================================================================
# DEPENDENCY MANAGEMENT
# =============================================================================
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Use npm ci if package-lock.json exists, otherwise npm install
    if [ -f "$PROJECT_DIR/package-lock.json" ]; then
        if npm ci; then
            log_success "Dependencies installed with npm ci"
        else
            log_error "Failed to install dependencies"
            exit 1
        fi
    else
        log_warning "package-lock.json not found, using npm install"
        if npm install; then
            log_success "Dependencies installed with npm install"
        else
            log_error "Failed to install dependencies"
            exit 1
        fi
    fi
}

# =============================================================================
# PRISMA CLIENT REGENERATION
# =============================================================================
verify_drizzle_schema() {
    log_info "Regenerating Prisma client..."
    
    # Check if Prisma schema exists
    if [ ! -f "$PROJECT_DIR/prisma/schema.prisma" ]; then
        log_warning "Prisma schema not found, skipping Prisma client regeneration"
        return 0
    fi
    
    # Regenerate Prisma client
    if echo "Drizzle schema ready (no generation needed)" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Prisma client regenerated successfully"
    else
        log_error "Failed to regenerate Prisma client"
        log_error "This may cause runtime errors with database operations"
        log_warning 'You may need to run `echo "Drizzle schema ready (no generation needed)"` manually'
        # Don't exit - let the update continue, but warn the user
    fi
}

# =============================================================================
# BUILD APPLICATION
# =============================================================================
build_application() {
    log_info "Building application..."
    log_warning "This may take a few minutes..."
    
    # Set timeout for build (10 minutes)
    if timeout 600 npm run build 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Application built successfully"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_error "Build timed out after 10 minutes"
        else
            log_error "Build failed with exit code: $exit_code"
        fi
        log_error "Check the output above for details"
        return 1
    fi
}

# =============================================================================
# DATABASE SCHEMA PUSH
# =============================================================================
push_database_schema() {
    log_info "Pushing database schema changes (creating new tables if needed)..."

    if npx drizzle-kit push --config drizzle.config.ts 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Database schema pushed successfully"
    else
        log_warning "Database schema push failed - new tables may not exist"
        log_warning "You can retry manually: npx drizzle-kit push --config drizzle.config.ts"
        # Don't exit - the app may still work with existing tables
    fi
}

# =============================================================================
# PM2 PROCESS MANAGEMENT
# =============================================================================
stop_all_pm2_processes() {
    log_info "Stopping all PM2 processes..."
    
    # Check if any PM2 processes are running
    if pm2 list | grep -q "online\|stopped\|errored"; then
        # Stop all processes
        if pm2 stop all 2>&1 | tee -a "$LOG_FILE"; then
            log_success "All PM2 processes stopped"
        else
            log_warning "Failed to stop some PM2 processes"
        fi
        
        # Give processes time to stop gracefully
        sleep 2
    else
        log_info "No PM2 processes running"
    fi
}

delete_all_pm2_processes() {
    log_info "Deleting all PM2 processes (clearing old config)..."
    
    # Delete all processes to clear old configuration
    if pm2 delete all 2>&1 | tee -a "$LOG_FILE"; then
        log_success "All PM2 processes deleted"
    else
        log_warning "Failed to delete some PM2 processes"
    fi
    
    # Give PM2 time to clean up
    sleep 1
}

start_with_ecosystem() {
    log_info "Starting application with ecosystem.config.js..."
    
    # Verify ecosystem.config.js exists
    if [ ! -f "$PROJECT_DIR/ecosystem.config.js" ]; then
        log_error "ecosystem.config.js not found"
        log_error "Cannot start application without ecosystem configuration"
        exit 1
    fi
    
    # Start with ecosystem config
    if pm2 start ecosystem.config.js 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Application started with ecosystem.config.js"
    else
        log_error "Failed to start application"
        exit 1
    fi
    
    # Give app time to start
    sleep 3
}

save_pm2_config() {
    log_info "Saving PM2 configuration..."
    
    if pm2 save 2>&1 | tee -a "$LOG_FILE"; then
        log_success "PM2 configuration saved"
    else
        log_warning "Failed to save PM2 configuration"
    fi
}

# =============================================================================
# VERIFICATION
# =============================================================================
verify_app_running() {
    # Get the actual port from ecosystem.config.js
    local SERVER_PORT=$(get_server_port)
    
    log_info "Verifying application is running..."
    
    # Check PM2 status
    if ! pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        log_error "Application is not running in PM2"
        log_error "Check PM2 status: pm2 status"
        log_error "Check PM2 logs: pm2 logs $PM2_APP_NAME"
        return 1
    fi
    
    log_success "PM2 process is online"
    
    # Wait for server to respond (max 30 seconds)
    log_info "Waiting for server to respond on port $(get_server_port)..."
    local count=0
    local max_attempts=30
    
    while [ $count -lt $max_attempts ]; do
        if curl -s http://localhost:$(get_server_port) > /dev/null 2>&1; then
            log_success "Server is responding on port $(get_server_port)"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    
    log_error "Server not responding after 30 seconds"
    log_error "Check PM2 logs: pm2 logs $PM2_APP_NAME"
    return 1
}

show_status() {
    log_info "Current PM2 status:"
    pm2 status | tee -a "$LOG_FILE"
}

# =============================================================================
# MAIN UPDATE PROCESS
# =============================================================================
main() {
    log ""
    log "=========================================="
    log "🚀 Sports Bar TV Controller Update"
    log "=========================================="
    log ""
    
    # Change to project directory
    cd "$PROJECT_DIR" || {
        log_error "Failed to change to project directory: $PROJECT_DIR"
        exit 1
    }
    
    # Step 1: Check prerequisites
    check_prerequisites
    log ""
    
    # Step 2: Validate directory
    validate_directory
    log ""
    
    # Step 3: Create backup
    create_backup
    log ""
    
    # Step 4: Pull latest code
    pull_latest_code
    log ""
    
    # Step 5: Run database migration (if needed)
    migrate_database_location
    log ""
    
    # Step 6: Install dependencies
    install_dependencies
    log ""
    
    # Step 7: Regenerate Prisma client
    verify_drizzle_schema
    log ""
    
    # Step 8: Build application
    if ! build_application; then
        log_error "Build failed - aborting update"
        log_error "Your previous version is still running"
        exit 1
    fi
    log ""

    # Step 8.5: Push DB schema changes (creates new tables if any)
    push_database_schema
    log ""

    # Step 9: Stop all PM2 processes
    stop_all_pm2_processes
    log ""
    
    # Step 10: Delete all PM2 processes (clear old config)
    delete_all_pm2_processes
    log ""
    
    # Step 11: Start with ecosystem.config.js
    start_with_ecosystem
    log ""
    
    # Step 12: Save PM2 configuration
    save_pm2_config
    log ""
    
    # Step 13: Verify app is running
    if verify_app_running; then
        log ""
        show_status
        log ""
        log "=========================================="
        log_success "✅ Update completed successfully!"
        log "=========================================="
        log ""
        log "🌐 Access your application at:"
        log "   http://localhost:$(get_server_port)"
        log "   http://$(hostname -I | awk '{print $1}'):$(get_server_port)"
        log ""
        log "📋 What was updated:"
        log "   ✅ Latest code from GitHub"
        log "   ✅ Dependencies installed"
        log "   ✅ Prisma client regenerated"
        log "   ✅ Application rebuilt"
        log "   ✅ PM2 processes cleaned and restarted"
        log "   ✅ Configuration saved"
        log ""
        log "💾 Backup saved to:"
        log "   $BACKUP_FILE"
        log ""
        log "🔧 Useful PM2 commands:"
        log "   pm2 status              - View process status"
        log "   pm2 logs $PM2_APP_NAME  - View application logs"
        log "   pm2 restart $PM2_APP_NAME - Restart application"
        log "   pm2 monit               - Monitor in real-time"
        log ""
        log "📝 Full update log: $LOG_FILE"
        log ""
    else
        log ""
        log "=========================================="
        log_error "❌ Update completed but app not responding"
        log "=========================================="
        log ""
        log "🔧 Troubleshooting steps:"
        log "   1. Check PM2 status: pm2 status"
        log "   2. View logs: pm2 logs $PM2_APP_NAME --lines 50"
        log "   3. Try restarting: pm2 restart $PM2_APP_NAME"
        log ""
        log "💾 Your backup is safe at:"
        log "   $BACKUP_FILE"
        log ""
        exit 1
    fi
}

# =============================================================================
# SCRIPT ENTRY POINT
# =============================================================================
main "$@"
