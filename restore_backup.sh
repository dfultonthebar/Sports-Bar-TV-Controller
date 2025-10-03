#!/bin/bash

# =============================================================================
# SPORTS BAR TV CONTROLLER - BACKUP RESTORE SCRIPT
# =============================================================================
# This script helps you restore from a backup quickly and safely
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="$HOME/sports-bar-backups"
DB_BACKUP_DIR="$BACKUP_DIR/database-backups"
PROJECT_DIR="/home/ubuntu/Sports-Bar-TV-Controller"
PM2_APP_NAME="sports-bar-tv-controller"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# =============================================================================
# BACKUP LISTING
# =============================================================================

list_backups() {
    print_header "Available Backups"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_error "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
    
    echo ""
    echo "Configuration Backups:"
    echo "====================="
    ls -lh "$BACKUP_DIR"/config-backup-*.tar.gz 2>/dev/null | awk '{print $9, "(" $5 ")", $6, $7, $8}' || echo "No backups found"
    
    echo ""
    echo "SQL Database Dumps:"
    echo "==================="
    ls -lh "$DB_BACKUP_DIR"/dev-db-*.sql.gz 2>/dev/null | awk '{print $9, "(" $5 ")", $6, $7, $8}' || echo "No SQL dumps found"
    
    echo ""
}

# =============================================================================
# RESTORE FUNCTIONS
# =============================================================================

restore_full() {
    local backup_file="$1"
    
    print_header "Full Restore from Tar Backup"
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    # Verify backup integrity
    print_info "Verifying backup integrity..."
    if ! tar -tzf "$backup_file" > /dev/null 2>&1; then
        print_error "Backup file is corrupted!"
        exit 1
    fi
    print_success "Backup file is valid"
    
    # Show what will be restored
    echo ""
    print_info "Backup contents:"
    tar -tzf "$backup_file" | head -20
    if [ $(tar -tzf "$backup_file" | wc -l) -gt 20 ]; then
        echo "... and $(( $(tar -tzf "$backup_file" | wc -l) - 20 )) more files"
    fi
    
    # Confirm
    echo ""
    read -p "Do you want to restore from this backup? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_warning "Restore cancelled"
        exit 0
    fi
    
    # Stop application
    print_info "Stopping application..."
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        pm2 stop "$PM2_APP_NAME" 2>/dev/null || true
        print_success "Application stopped"
    else
        print_warning "Application not running in PM2"
    fi
    
    # Create safety backup of current state
    print_info "Creating safety backup of current state..."
    SAFETY_BACKUP="$BACKUP_DIR/pre-restore-safety-$(date +%Y%m%d-%H%M%S).tar.gz"
    cd "$PROJECT_DIR"
    tar -czf "$SAFETY_BACKUP" \
        config/*.local.json \
        .env \
        prisma/dev.db \
        data/*.json \
        2>/dev/null || true
    print_success "Safety backup created: $SAFETY_BACKUP"
    
    # Extract backup
    print_info "Restoring files..."
    cd "$PROJECT_DIR"
    tar -xzf "$backup_file"
    print_success "Files restored successfully"
    
    # Restart application
    print_info "Restarting application..."
    pm2 restart "$PM2_APP_NAME" 2>/dev/null || pm2 start npm --name "$PM2_APP_NAME" -- start
    sleep 3
    
    # Verify
    if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        print_success "Application restarted successfully"
        echo ""
        print_success "Restore completed!"
        print_info "Check logs: pm2 logs $PM2_APP_NAME"
    else
        print_error "Application failed to start"
        print_warning "Check logs: pm2 logs $PM2_APP_NAME"
        print_info "You can restore from safety backup: $SAFETY_BACKUP"
        exit 1
    fi
}

restore_database() {
    local sql_dump="$1"
    
    print_header "Database Restore from SQL Dump"
    
    if [ ! -f "$sql_dump" ]; then
        print_error "SQL dump not found: $sql_dump"
        exit 1
    fi
    
    # Confirm
    echo ""
    print_warning "This will replace your current database!"
    read -p "Do you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_warning "Restore cancelled"
        exit 0
    fi
    
    # Stop application
    print_info "Stopping application..."
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        pm2 stop "$PM2_APP_NAME" 2>/dev/null || true
        print_success "Application stopped"
    fi
    
    # Backup current database
    print_info "Backing up current database..."
    cd "$PROJECT_DIR"
    cp prisma/dev.db "prisma/dev.db.before-restore-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
    print_success "Current database backed up"
    
    # Restore from SQL dump
    print_info "Restoring database from SQL dump..."
    gunzip -c "$sql_dump" | sqlite3 prisma/dev.db
    print_success "Database restored successfully"
    
    # Restart application
    print_info "Restarting application..."
    pm2 restart "$PM2_APP_NAME" 2>/dev/null || pm2 start npm --name "$PM2_APP_NAME" -- start
    sleep 3
    
    # Verify
    if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        print_success "Application restarted successfully"
        echo ""
        print_success "Database restore completed!"
        print_info "Check logs: pm2 logs $PM2_APP_NAME"
    else
        print_error "Application failed to start"
        print_warning "Check logs: pm2 logs $PM2_APP_NAME"
        exit 1
    fi
}

# =============================================================================
# MAIN MENU
# =============================================================================

show_menu() {
    clear
    print_header "Sports Bar TV Controller - Backup Restore"
    echo ""
    echo "1) List available backups"
    echo "2) Restore from full backup (tar.gz)"
    echo "3) Restore database only (SQL dump)"
    echo "4) View backup manifest"
    echo "5) Exit"
    echo ""
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

# Check if running from correct directory
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

# Interactive mode if no arguments
if [ $# -eq 0 ]; then
    while true; do
        show_menu
        read -p "Select an option (1-5): " choice
        
        case $choice in
            1)
                list_backups
                read -p "Press Enter to continue..."
                ;;
            2)
                list_backups
                echo ""
                read -p "Enter backup filename (or full path): " backup_file
                if [ ! -f "$backup_file" ]; then
                    backup_file="$BACKUP_DIR/$backup_file"
                fi
                restore_full "$backup_file"
                read -p "Press Enter to continue..."
                ;;
            3)
                echo ""
                echo "SQL Dumps:"
                ls -lh "$DB_BACKUP_DIR"/dev-db-*.sql.gz 2>/dev/null || echo "No SQL dumps found"
                echo ""
                read -p "Enter SQL dump filename (or full path): " sql_dump
                if [ ! -f "$sql_dump" ]; then
                    sql_dump="$DB_BACKUP_DIR/$sql_dump"
                fi
                restore_database "$sql_dump"
                read -p "Press Enter to continue..."
                ;;
            4)
                echo ""
                echo "Backup Manifests:"
                ls -lh "$BACKUP_DIR"/backup-manifest-*.txt 2>/dev/null || echo "No manifests found"
                echo ""
                read -p "Enter manifest filename to view: " manifest
                if [ -f "$BACKUP_DIR/$manifest" ]; then
                    cat "$BACKUP_DIR/$manifest"
                else
                    print_error "Manifest not found"
                fi
                read -p "Press Enter to continue..."
                ;;
            5)
                print_info "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                sleep 2
                ;;
        esac
    done
else
    # Command line mode
    case "$1" in
        list)
            list_backups
            ;;
        restore)
            if [ -z "$2" ]; then
                print_error "Usage: $0 restore <backup-file>"
                exit 1
            fi
            restore_full "$2"
            ;;
        restore-db)
            if [ -z "$2" ]; then
                print_error "Usage: $0 restore-db <sql-dump-file>"
                exit 1
            fi
            restore_database "$2"
            ;;
        *)
            echo "Usage: $0 [list|restore <file>|restore-db <file>]"
            echo ""
            echo "Commands:"
            echo "  list              - List available backups"
            echo "  restore <file>    - Restore from full backup"
            echo "  restore-db <file> - Restore database from SQL dump"
            echo ""
            echo "Run without arguments for interactive mode"
            exit 1
            ;;
    esac
fi
