#!/bin/bash

# Deployment script for Drizzle migration fix
# Run this script on the remote server to deploy the fix

set -e  # Exit on error

echo "=========================================="
echo "Deploying Drizzle Migration Fix"
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

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

print_info "Current directory: $(pwd)"
echo ""

# Step 1: Fetch latest changes
print_info "Step 1: Fetching latest changes from GitHub..."
git fetch origin
print_success "Fetched latest changes"
echo ""

# Step 2: Show current branch
CURRENT_BRANCH=$(git branch --show-current)
print_info "Current branch: $CURRENT_BRANCH"
echo ""

# Step 3: Ask user which branch to deploy
echo "Which branch would you like to deploy?"
echo "1) main (recommended after PR is merged)"
echo "2) fix-drizzle-migration-500-errors (for testing the fix)"
read -p "Enter choice (1 or 2): " BRANCH_CHOICE

if [ "$BRANCH_CHOICE" = "1" ]; then
    TARGET_BRANCH="main"
elif [ "$BRANCH_CHOICE" = "2" ]; then
    TARGET_BRANCH="fix-drizzle-migration-500-errors"
else
    print_error "Invalid choice. Exiting."
    exit 1
fi

print_info "Deploying branch: $TARGET_BRANCH"
echo ""

# Step 4: Stash any local changes
print_info "Step 2: Stashing local changes (if any)..."
git stash
print_success "Local changes stashed"
echo ""

# Step 5: Checkout target branch
print_info "Step 3: Checking out $TARGET_BRANCH..."
git checkout $TARGET_BRANCH
print_success "Checked out $TARGET_BRANCH"
echo ""

# Step 6: Pull latest changes
print_info "Step 4: Pulling latest changes..."
git pull origin $TARGET_BRANCH
print_success "Pulled latest changes"
echo ""

# Step 7: Install dependencies
print_info "Step 5: Installing dependencies..."
npm install
print_success "Dependencies installed"
echo ""

# Step 8: Build application
print_info "Step 6: Building application..."
npm run build
print_success "Application built successfully"
echo ""

# Step 9: Restart application
print_info "Step 7: Restarting application..."

# Try PM2 first
if command -v pm2 &> /dev/null; then
    print_info "Detected PM2, restarting with PM2..."
    pm2 restart all || pm2 restart sports-bar-tv-controller || print_error "PM2 restart failed"
    print_success "Application restarted with PM2"
    echo ""
    print_info "Checking PM2 status..."
    pm2 list
elif systemctl is-active --quiet sports-bar-tv-controller; then
    print_info "Detected systemd service, restarting..."
    sudo systemctl restart sports-bar-tv-controller
    print_success "Application restarted with systemd"
    echo ""
    print_info "Checking service status..."
    sudo systemctl status sports-bar-tv-controller --no-pager
else
    print_error "Could not detect PM2 or systemd service."
    print_info "Please restart the application manually:"
    echo "  - If using PM2: pm2 restart sports-bar-tv-controller"
    echo "  - If using systemd: sudo systemctl restart sports-bar-tv-controller"
    echo "  - If running directly: Stop current process and run 'npm start'"
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""

# Step 10: Verification
print_info "Running verification tests..."
echo ""

# Wait for application to start
sleep 5

# Test endpoints
print_info "Testing /api/audio-processor endpoint..."
RESPONSE=$(curl -s http://localhost:3001/api/audio-processor)
if echo "$RESPONSE" | grep -q "processors"; then
    print_success "Audio processor endpoint working"
else
    print_error "Audio processor endpoint failed"
    echo "Response: $RESPONSE"
fi

echo ""
print_info "Testing /api/matrix/video-input-selection endpoint..."
RESPONSE=$(curl -s http://localhost:3001/api/matrix/video-input-selection)
if echo "$RESPONSE" | grep -q -E "error.*No active matrix configuration|success"; then
    print_success "Matrix endpoint working (no config is expected)"
else
    print_error "Matrix endpoint may have issues"
    echo "Response: $RESPONSE"
fi

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Check application logs:"
echo "   pm2 logs sports-bar-tv-controller"
echo ""
echo "2. Configure Atlas processor:"
echo "   curl -X POST http://localhost:3001/api/audio-processor \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{"
echo "       \"name\": \"Atlas Main Processor\","
echo "       \"model\": \"AZM4\","
echo "       \"ipAddress\": \"192.168.5.101\","
echo "       \"port\": 80,"
echo "       \"tcpPort\": 5321,"
echo "       \"zones\": 4"
echo "     }'"
echo ""
echo "3. Test Atlas connection:"
echo "   curl http://localhost:3001/api/audio-processor/test-connection"
echo ""
echo "4. Monitor for any errors in the logs"
echo ""
print_success "Deployment script completed!"
