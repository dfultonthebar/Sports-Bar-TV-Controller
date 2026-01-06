#!/bin/bash

# Sports Bar TV Controller - Deployment Fix Script
# This script diagnoses and fixes common deployment issues

set -e

echo "=========================================="
echo "Sports Bar TV Controller - Deployment Fix"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${NC}ℹ $1${NC}"
}

# Step 1: Check if we're in the right directory
echo "Step 1: Checking directory..."
if [ ! -f "package.json" ]; then
    print_error "Not in the Sports-Bar-TV-Controller directory!"
    echo "Please cd to the project directory and run this script again."
    exit 1
fi
print_success "In correct directory"
echo ""

# Step 2: Check for running processes
echo "Step 2: Checking for running processes..."
NODE_PROCS=$(ps aux | grep -i "node.*next" | grep -v grep | wc -l)
if [ "$NODE_PROCS" -gt 0 ]; then
    print_warning "Found $NODE_PROCS running Node.js processes"
    echo "Processes:"
    ps aux | grep -i "node.*next" | grep -v grep
    echo ""
    read -p "Stop all Node.js processes? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pkill -f "node.*next" || true
        print_success "Stopped Node.js processes"
    fi
else
    print_success "No conflicting processes found"
fi
echo ""

# Step 3: Check PM2 processes
echo "Step 3: Checking PM2 processes..."
if command -v pm2 &> /dev/null; then
    PM2_PROCS=$(pm2 list | grep -c "online" || echo "0")
    if [ "$PM2_PROCS" -gt 0 ]; then
        print_warning "Found $PM2_PROCS PM2 processes running"
        pm2 list
        echo ""
        read -p "Stop all PM2 processes? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pm2 stop all
            pm2 delete all
            print_success "Stopped PM2 processes"
        fi
    else
        print_success "No PM2 processes running"
    fi
else
    print_info "PM2 not installed"
fi
echo ""

# Step 4: Check .env file
echo "Step 4: Checking .env file..."
if [ ! -f ".env" ]; then
    print_warning ".env file not found"
    echo "Creating .env file from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Created .env file"
    else
        print_error ".env.example not found"
        echo "Creating basic .env file..."
        cat > .env << 'ENVEOF'
DATABASE_URL="file:./prisma/dev.db"
NODE_ENV="production"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="change-this-to-a-random-secret"
ENVEOF
        print_success "Created basic .env file"
    fi
else
    print_success ".env file exists"
fi

# Check DATABASE_URL
if grep -q "DATABASE_URL" .env; then
    print_success "DATABASE_URL configured"
else
    print_warning "DATABASE_URL not found in .env"
    echo 'DATABASE_URL="file:./prisma/dev.db"' >> .env
    print_success "Added DATABASE_URL to .env"
fi
echo ""

# Step 5: Check database
echo "Step 5: Checking database..."
if [ -f "prisma/dev.db" ]; then
    print_success "Database file exists"
    DB_SIZE=$(du -h prisma/dev.db | cut -f1)
    print_info "Database size: $DB_SIZE"
else
    print_warning "Database file not found"
fi
echo ""

# Step 6: Install dependencies
echo "Step 6: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found"
    echo "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
else
    print_success "node_modules exists"
fi
echo ""

# Step 7: Generate Prisma client
echo "Step 7: Generating Prisma client..."
npx prisma generate
print_success "Prisma client generated"
echo ""

# Step 8: Push database schema
echo "Step 8: Pushing database schema..."
npx prisma db push --accept-data-loss
print_success "Database schema updated"
echo ""

# Step 9: Check for audio processor configuration
echo "Step 9: Checking audio processor configuration..."
PROCESSOR_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM AudioProcessor;" 2>/dev/null || echo "0")
if [ "$PROCESSOR_COUNT" -eq 0 ]; then
    print_warning "No audio processors configured"
    echo ""
    echo "Would you like to add the Atlas processor now? (y/n)"
    read -p "IP: 192.168.1.100, Model: AZMP8 " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sqlite3 prisma/dev.db << 'SQLEOF'
INSERT INTO AudioProcessor (id, name, model, ipAddress, port, tcpPort, zones, status, createdAt, updatedAt)
VALUES (
    'atlas-main-001',
    'Main Atlas Processor',
    'AZMP8',
    '192.168.1.100',
    80,
    5321,
    8,
    'offline',
    datetime('now'),
    datetime('now')
);
SQLEOF
        print_success "Atlas processor added to database"
    fi
else
    print_success "Found $PROCESSOR_COUNT audio processor(s) configured"
    echo "Processors:"
    sqlite3 prisma/dev.db "SELECT name, model, ipAddress FROM AudioProcessor;" 2>/dev/null || true
fi
echo ""

# Step 10: Test Atlas connectivity
echo "Step 10: Testing Atlas processor connectivity..."
if command -v nc &> /dev/null; then
    if timeout 3 nc -zv 192.168.1.100 5321 2>&1 | grep -q "succeeded"; then
        print_success "Atlas processor reachable on 192.168.1.100:5321"
    else
        print_error "Cannot reach Atlas processor on 192.168.1.100:5321"
        print_warning "Please verify:"
        echo "  - Atlas processor is powered on"
        echo "  - IP address is correct (192.168.1.100)"
        echo "  - Network connectivity is working"
        echo "  - Firewall allows TCP port 5321"
    fi
else
    print_warning "netcat (nc) not available, skipping connectivity test"
fi
echo ""

# Step 11: Build application
echo "Step 11: Building application..."
npm run build
print_success "Application built successfully"
echo ""

# Step 12: Start application
echo "Step 12: Starting application..."
echo ""
echo "Choose how to start the application:"
echo "1) PM2 (recommended for production)"
echo "2) npm start (foreground)"
echo "3) Skip (I'll start it manually)"
read -p "Enter choice (1-3): " -n 1 -r
echo ""

case $REPLY in
    1)
        if command -v pm2 &> /dev/null; then
            pm2 start ecosystem.config.js
            pm2 save
            print_success "Application started with PM2"
            echo ""
            echo "Useful PM2 commands:"
            echo "  pm2 list          - List all processes"
            echo "  pm2 logs          - View logs"
            echo "  pm2 restart all   - Restart application"
            echo "  pm2 stop all      - Stop application"
        else
            print_error "PM2 not installed"
            echo "Install PM2 with: npm install -g pm2"
        fi
        ;;
    2)
        print_info "Starting application in foreground..."
        echo "Press Ctrl+C to stop"
        npm start
        ;;
    3)
        print_info "Skipping application start"
        echo "To start manually, run: npm start"
        ;;
    *)
        print_warning "Invalid choice, skipping"
        ;;
esac
echo ""

# Step 13: Summary
echo "=========================================="
echo "Deployment Fix Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Stopped conflicting processes"
echo "  ✓ Configured .env file"
echo "  ✓ Generated Prisma client"
echo "  ✓ Updated database schema"
echo "  ✓ Built application"
echo ""
echo "Next steps:"
echo "  1. Access the application at http://localhost:3001"
echo "  2. Test input gain controls"
echo "  3. Test zone controls"
echo ""
echo "If issues persist, check logs:"
echo "  - PM2 logs: pm2 logs"
echo "  - Application logs: Check browser console and network tab"
echo ""
echo "For support, refer to DIAGNOSTIC_AND_FIX_REPORT.md"
echo ""
