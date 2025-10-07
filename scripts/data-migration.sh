
#!/bin/bash
# Data Migration Script from Old System to NUC13ANHi5
# Sports Bar TV Controller

set -e

echo "=========================================="
echo "Data Migration Script"
echo "From: 135.131.39.26:223 (Old System)"
echo "To: NUC13ANHi5 (New System)"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Configuration
OLD_HOST="135.131.39.26"
OLD_PORT="223"
OLD_USER="ubuntu"
BACKUP_DIR="$HOME/migration-backup-$(date +%Y%m%d-%H%M%S)"
APP_DIR="/opt/sports-bar-tv"

print_warning "This script will migrate data from the old system to the new NUC13ANHi5"
print_warning "Make sure you have SSH access to the old system"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_error "Migration cancelled"
    exit 1
fi

# Create backup directory
print_status "Creating backup directory: $BACKUP_DIR"
mkdir -p $BACKUP_DIR

# Test SSH connection
print_status "Testing SSH connection to old system..."
if ! ssh -p $OLD_PORT -o ConnectTimeout=10 $OLD_USER@$OLD_HOST "echo 'Connection successful'" > /dev/null 2>&1; then
    print_error "Cannot connect to old system. Please check SSH credentials."
    print_warning "Host: $OLD_HOST:$OLD_PORT"
    print_warning "User: $OLD_USER"
    exit 1
fi

print_status "SSH connection successful"

# Backup PostgreSQL database from old system
print_status "Backing up PostgreSQL database from old system..."
ssh -p $OLD_PORT $OLD_USER@$OLD_HOST "sudo -u postgres pg_dump sportsbar_tv" > $BACKUP_DIR/database.sql

if [ -s $BACKUP_DIR/database.sql ]; then
    print_status "Database backup completed: $(du -h $BACKUP_DIR/database.sql | cut -f1)"
else
    print_error "Database backup failed or is empty"
    exit 1
fi

# Backup environment variables
print_status "Backing up environment variables..."
ssh -p $OLD_PORT $OLD_USER@$OLD_HOST "cat /home/ubuntu/Sports-Bar-TV-Controller/.env" > $BACKUP_DIR/.env.old 2>/dev/null || print_warning "No .env file found on old system"

# Backup knowledge base
print_status "Backing up knowledge base..."
ssh -p $OLD_PORT $OLD_USER@$OLD_HOST "tar -czf /tmp/knowledge-base.tar.gz -C /home/ubuntu/Sports-Bar-TV-Controller .ai-assistant 2>/dev/null || echo 'No knowledge base found'" > /dev/null
scp -P $OLD_PORT $OLD_USER@$OLD_HOST:/tmp/knowledge-base.tar.gz $BACKUP_DIR/ 2>/dev/null || print_warning "No knowledge base to backup"

# Backup PM2 configuration
print_status "Backing up PM2 configuration..."
ssh -p $OLD_PORT $OLD_USER@$OLD_HOST "pm2 save && cat ~/.pm2/dump.pm2" > $BACKUP_DIR/pm2-dump.json 2>/dev/null || print_warning "No PM2 configuration found"

# Backup custom scripts
print_status "Backing up custom scripts..."
ssh -p $OLD_PORT $OLD_USER@$OLD_HOST "tar -czf /tmp/custom-scripts.tar.gz -C /home/ubuntu/Sports-Bar-TV-Controller *.sh 2>/dev/null || echo 'No scripts found'" > /dev/null
scp -P $OLD_PORT $OLD_USER@$OLD_HOST:/tmp/custom-scripts.tar.gz $BACKUP_DIR/ 2>/dev/null || print_warning "No custom scripts to backup"

# Get Ollama model list
print_status "Getting Ollama model list from old system..."
ssh -p $OLD_PORT $OLD_USER@$OLD_HOST "ollama list" > $BACKUP_DIR/ollama-models.txt 2>/dev/null || print_warning "Could not get Ollama model list"

# Restore database to new system
print_status "Restoring database to new system..."
sudo -u postgres psql -d sportsbar_tv < $BACKUP_DIR/database.sql

if [ $? -eq 0 ]; then
    print_status "Database restored successfully"
else
    print_error "Database restoration failed"
    exit 1
fi

# Restore knowledge base
if [ -f $BACKUP_DIR/knowledge-base.tar.gz ]; then
    print_status "Restoring knowledge base..."
    tar -xzf $BACKUP_DIR/knowledge-base.tar.gz -C $APP_DIR/
    print_status "Knowledge base restored"
fi

# Merge environment variables
if [ -f $BACKUP_DIR/.env.old ]; then
    print_status "Merging environment variables..."
    print_warning "Please review and merge the following environment variables manually:"
    echo ""
    echo "Old system .env saved to: $BACKUP_DIR/.env.old"
    echo "New system .env location: $APP_DIR/.env"
    echo ""
fi

# Pull Ollama models from old system list
if [ -f $BACKUP_DIR/ollama-models.txt ]; then
    print_status "Checking Ollama models to pull..."
    while IFS= read -r line; do
        if [[ $line =~ ^([a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+) ]]; then
            MODEL="${BASH_REMATCH[1]}"
            print_status "Pulling model: $MODEL"
            ollama pull $MODEL || print_warning "Failed to pull $MODEL"
        fi
    done < $BACKUP_DIR/ollama-models.txt
fi

# Restart application
print_status "Restarting application..."
pm2 restart sports-bar-tv

# Create migration summary
cat << EOF > $BACKUP_DIR/MIGRATION_SUMMARY.txt
Sports Bar TV Controller - Migration Summary
=============================================
Date: $(date)
From: $OLD_HOST:$OLD_PORT
To: NUC13ANHi5 (New System)

Backup Location: $BACKUP_DIR

Files Backed Up:
- Database: database.sql
- Environment: .env.old
- Knowledge Base: knowledge-base.tar.gz
- PM2 Config: pm2-dump.json
- Custom Scripts: custom-scripts.tar.gz
- Ollama Models: ollama-models.txt

Migration Status:
- Database: Restored
- Knowledge Base: Restored
- Application: Restarted

Next Steps:
1. Review and merge environment variables
2. Test application functionality
3. Verify AI chat responses
4. Check streaming integrations
5. Monitor performance

Backup Retention:
Keep this backup for at least 30 days before deletion.
EOF

print_status "Migration completed successfully!"
echo ""
echo "Migration Summary:"
cat $BACKUP_DIR/MIGRATION_SUMMARY.txt
echo ""
print_warning "IMPORTANT: Please review the migration summary and test all functionality"
print_warning "Backup location: $BACKUP_DIR"
