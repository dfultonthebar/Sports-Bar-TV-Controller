
#!/bin/bash

set -e

echo "🚀 Deploying Sports Bar AI Assistant Updates"
echo "============================================="

GITHUB_REPO="https://github.com/dfultonthebar/Sports-Bar-TV-Controller"
PROJECT_DIR="/home/ubuntu/Sports-Bar-TV-Controller"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$PROJECT_DIR"

echo -e "${YELLOW}📥 Pulling latest changes from GitHub...${NC}"
git pull origin main

echo -e "${YELLOW}📦 Installing/updating dependencies...${NC}"
yarn install

echo -e "${YELLOW}🗄️ Updating database schema...${NC}"
yarn prisma generate
yarn prisma db push

echo -e "${YELLOW}🏗️ Building application...${NC}"
yarn build

echo -e "${YELLOW}🔄 Restarting application...${NC}"
pm2 restart sports-bar-ai || pm2 start ecosystem.config.js

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}🌐 Application running at: http://localhost:3001${NC}"
