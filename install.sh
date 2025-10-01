
#!/bin/bash

set -e

echo "🏈 Installing Sports Bar AI Assistant"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

GITHUB_REPO="https://github.com/dfultonthebar/Sports-Bar-TV-Controller"
PROJECT_NAME="Sports-Bar-TV-Controller"
INSTALL_DIR="/home/ubuntu/$PROJECT_NAME"

echo -e "${BLUE}📦 Installing system dependencies...${NC}"

# Update system
sudo apt update

# Install Node.js 18.x if not installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install PostgreSQL if not installed
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE sports_bar_ai;" 2>/dev/null || echo "Database may already exist"
    sudo -u postgres psql -c "CREATE USER sports_bar_user WITH PASSWORD 'sports_bar_pass';" 2>/dev/null || echo "User may already exist"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sports_bar_ai TO sports_bar_user;" 2>/dev/null || echo "Privileges may already be granted"
fi

# Install Yarn if not installed
if ! command -v yarn &> /dev/null; then
    echo "Installing Yarn..."
    sudo npm install -g yarn
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install CEC libraries for HDMI-CEC control
echo -e "${BLUE}📺 Installing HDMI-CEC support (libCEC)...${NC}"
if ! command -v cec-client &> /dev/null; then
    echo "Installing libCEC for Pulse-Eight USB CEC Adapter..."
    sudo apt install -y cec-utils libcec6 libcec-dev
    echo -e "${GREEN}✅ libCEC installed successfully${NC}"
else
    echo "libCEC already installed"
fi

echo -e "${YELLOW}📁 Setting up project...${NC}"

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo "Cloning repository..."
    git clone "$GITHUB_REPO.git" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo -e "${YELLOW}📦 Installing project dependencies...${NC}"
yarn install

echo -e "${YELLOW}🔧 Setting up environment...${NC}"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cat > .env << EOF
# Database
DATABASE_URL="postgresql://sports_bar_user:sports_bar_pass@localhost:5432/sports_bar_ai?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Application
NODE_ENV="production"
PORT=3000
EOF
    echo "Created .env file with default settings"
else
    echo ".env file already exists"
fi

echo -e "${YELLOW}🗄️ Setting up database...${NC}"
yarn prisma generate
yarn prisma db push

echo -e "${YELLOW}🚀 Building application...${NC}"
yarn build

echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo -e "${GREEN}🚀 To start the application:${NC}"
echo -e "${BLUE}   ./start.sh${NC}"
echo ""
echo -e "${GREEN}🌐 Access your application at:${NC}"
echo -e "${BLUE}   http://localhost:3000${NC}"
echo ""
echo -e "${GREEN}📋 Management commands:${NC}"
echo -e "${BLUE}   ./start.sh    - Start the application${NC}"
echo -e "${BLUE}   ./stop.sh     - Stop the application${NC}"
echo -e "${BLUE}   ./restart.sh  - Restart the application${NC}"
echo -e "${BLUE}   ./logs.sh     - View application logs${NC}"
echo -e "${BLUE}   ./deploy.sh   - Deploy updates from GitHub${NC}"
