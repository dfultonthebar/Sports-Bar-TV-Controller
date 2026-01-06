
#!/bin/bash
# Application Deployment Script for NUC13ANHi5
# Sports Bar TV Controller

set -e

echo "=========================================="
echo "Sports Bar TV Controller - App Deployment"
echo "Target: Intel NUC13ANHi5 (i5-1340P)"
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
APP_DIR="/opt/sports-bar-tv"
REPO_URL="https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git"
BRANCH="main"

# Check prerequisites
print_status "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { print_error "Node.js is not installed"; exit 1; }
command -v npm >/dev/null 2>&1 || { print_error "npm is not installed"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { print_error "PM2 is not installed"; exit 1; }
command -v psql >/dev/null 2>&1 || { print_error "PostgreSQL is not installed"; exit 1; }

# Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    print_status "Updating existing repository..."
    cd $APP_DIR
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
else
    print_status "Cloning repository..."
    git clone -b $BRANCH $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci --production=false

# Setup PostgreSQL database
print_status "Setting up PostgreSQL database..."

# Create database user and database
sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'sportsbar') THEN
        CREATE USER sportsbar WITH PASSWORD 'sportsbar_secure_password_change_me';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE sportsbar_tv OWNER sportsbar'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sportsbar_tv')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE sportsbar_tv TO sportsbar;
EOF

print_status "Database created successfully"

# Configure environment variables
print_status "Configuring environment variables..."

if [ ! -f "$APP_DIR/.env" ]; then
    cat << EOF > $APP_DIR/.env
# Database Configuration
DATABASE_URL="postgresql://sportsbar:sportsbar_secure_password_change_me@localhost:5432/sportsbar_tv"

# Application Configuration
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Session Secret (generate a secure random string)
SESSION_SECRET=$(openssl rand -base64 32)

# Optional: External API Keys (configure as needed)
# YOUTUBE_API_KEY=
# TWITCH_CLIENT_ID=
# TWITCH_CLIENT_SECRET=
EOF
    print_status "Environment file created"
    print_warning "Please update .env file with your specific configuration"
else
    print_warning ".env file already exists, skipping creation"
fi

# Run database migrations
print_status "Running database migrations..."
npx prisma generate
npx prisma migrate deploy

# Build the application
print_status "Building Next.js application (optimized for 12-core CPU)..."
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# Configure PM2 ecosystem
print_status "Configuring PM2 ecosystem..."

cat << 'EOF' > $APP_DIR/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'sports-bar-tv',
      script: 'npm',
      args: 'start',
      cwd: '/opt/sports-bar-tv',
      instances: 10, // Optimized for 12-core CPU (leaving 2 cores for system)
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      max_memory_restart: '1G',
      error_file: '/home/ubuntu/logs/sports-bar-tv/error.log',
      out_file: '/home/ubuntu/logs/sports-bar-tv/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000
    }
  ]
};
EOF

print_status "PM2 ecosystem configured"

# Stop existing PM2 processes
print_status "Stopping existing PM2 processes..."
pm2 delete sports-bar-tv 2>/dev/null || true

# Start application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Display status
print_status "Application deployed successfully!"
echo ""
echo "Application Status:"
pm2 status
echo ""
echo "Application URL: http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  pm2 status           - View application status"
echo "  pm2 logs sports-bar-tv - View application logs"
echo "  pm2 monit            - Monitor resources"
echo "  pm2 restart sports-bar-tv - Restart application"
echo "  pm2 reload sports-bar-tv  - Zero-downtime reload"
echo ""
print_warning "Next step: Run ./scripts/data-migration.sh to migrate data from old system"
