#!/bin/bash
# Deployment script for AI model name fix
# Run this on the production server: 135.131.39.26:223

set -e

echo "=== Deploying AI Model Name Fix ==="
echo "Starting deployment at $(date)"

# Navigate to project directory
cd /home/ubuntu/Sports-Bar-TV-Controller

# Fetch latest changes
echo "Fetching latest changes from GitHub..."
git fetch origin

# Checkout diagnostics-merge branch
echo "Checking out diagnostics-merge branch..."
git checkout diagnostics-merge

# Merge the fix branch
echo "Merging fix-ai-model-names branch..."
git merge origin/fix-ai-model-names --no-edit

# Build the project
echo "Building project..."
npm run build

# Restart PM2 services
echo "Restarting PM2 services..."
pm2 restart all

# Show PM2 status
echo "PM2 Status:"
pm2 status

echo "=== Deployment Complete at $(date) ==="
echo ""
echo "Next steps:"
echo "1. Test the diagnostics chat API"
echo "2. Verify Claude and Grok are responding correctly"
echo "3. Check PM2 logs for any errors: pm2 logs --lines 50"
