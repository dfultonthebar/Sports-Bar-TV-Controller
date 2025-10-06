
#!/bin/bash

# AI Code Assistant - Automated Setup Script
# Detects OS, installs Ollama, pulls AI models, and verifies dependencies

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OLLAMA_MODEL="deepseek-coder:6.7b"
OLLAMA_URL="http://localhost:11434"
REQUIRED_NODE_VERSION=18

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Detect operating system
detect_os() {
    log_section "Detecting Operating System"
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        log_success "Detected: Linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        log_success "Detected: macOS"
    else
        log_error "Unsupported operating system: $OSTYPE"
        log_info "This script supports Linux and macOS only"
        exit 1
    fi
}

# Check Node.js version
check_node_version() {
    log_section "Checking Node.js Version"
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        log_info "Please install Node.js ${REQUIRED_NODE_VERSION}+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$NODE_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
        log_error "Node.js version $NODE_VERSION is too old"
        log_info "Required: Node.js ${REQUIRED_NODE_VERSION}+"
        log_info "Current: Node.js $NODE_VERSION"
        exit 1
    fi
    
    log_success "Node.js $(node -v) is installed"
}

# Check if Ollama is installed
check_ollama_installed() {
    log_section "Checking Ollama Installation"
    
    if command -v ollama &> /dev/null; then
        OLLAMA_VERSION=$(ollama --version 2>&1 | head -n1 || echo "unknown")
        log_success "Ollama is installed: $OLLAMA_VERSION"
        return 0
    else
        log_warning "Ollama is not installed"
        return 1
    fi
}

# Install Ollama
install_ollama() {
    log_section "Installing Ollama"
    
    log_info "Downloading and installing Ollama..."
    
    if [ "$OS" == "linux" ]; then
        curl -fsSL https://ollama.com/install.sh | sh
    elif [ "$OS" == "macos" ]; then
        log_info "Please install Ollama manually from: https://ollama.com/download"
        log_info "Or use Homebrew: brew install ollama"
        log_warning "After installation, run this script again"
        exit 1
    fi
    
    if command -v ollama &> /dev/null; then
        log_success "Ollama installed successfully"
    else
        log_error "Ollama installation failed"
        exit 1
    fi
}

# Check if Ollama service is running
check_ollama_running() {
    log_section "Checking Ollama Service"
    
    if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
        log_success "Ollama service is running"
        return 0
    else
        log_warning "Ollama service is not running"
        return 1
    fi
}

# Start Ollama service
start_ollama() {
    log_section "Starting Ollama Service"
    
    log_info "Starting Ollama in background..."
    
    if [ "$OS" == "linux" ]; then
        nohup ollama serve > /tmp/ollama.log 2>&1 &
        sleep 3
    elif [ "$OS" == "macos" ]; then
        # On macOS, Ollama typically runs as a service
        ollama serve > /tmp/ollama.log 2>&1 &
        sleep 3
    fi
    
    if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
        log_success "Ollama service started successfully"
    else
        log_error "Failed to start Ollama service"
        log_info "Check logs: tail -f /tmp/ollama.log"
        exit 1
    fi
}

# Check if model is available
check_model_available() {
    log_section "Checking AI Model"
    
    log_info "Checking for model: $OLLAMA_MODEL"
    
    if ollama list | grep -q "$OLLAMA_MODEL"; then
        log_success "Model $OLLAMA_MODEL is available"
        return 0
    else
        log_warning "Model $OLLAMA_MODEL is not available"
        return 1
    fi
}

# Pull AI model
pull_model() {
    log_section "Pulling AI Model"
    
    log_info "Pulling model: $OLLAMA_MODEL"
    log_info "This may take several minutes (model size: ~3.8GB)..."
    
    if ollama pull "$OLLAMA_MODEL"; then
        log_success "Model $OLLAMA_MODEL pulled successfully"
    else
        log_error "Failed to pull model $OLLAMA_MODEL"
        exit 1
    fi
}

# Verify npm dependencies
check_npm_dependencies() {
    log_section "Checking npm Dependencies"
    
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found"
        return 1
    fi
    
    # Check for critical dependencies
    MISSING_DEPS=()
    
    if [ ! -d "node_modules/uuid" ]; then
        MISSING_DEPS+=("uuid")
    fi
    
    if [ ${#MISSING_DEPS[@]} -eq 0 ]; then
        log_success "All npm dependencies are installed"
        return 0
    else
        log_warning "Missing dependencies: ${MISSING_DEPS[*]}"
        return 1
    fi
}

# Install npm dependencies
install_npm_dependencies() {
    log_section "Installing npm Dependencies"
    
    log_info "Running npm install..."
    
    if npm install; then
        log_success "npm dependencies installed successfully"
    else
        log_error "Failed to install npm dependencies"
        exit 1
    fi
}

# Create required directories
create_directories() {
    log_section "Creating Required Directories"
    
    mkdir -p .ai-assistant/backups
    mkdir -p .ai-assistant/logs
    
    log_success "Required directories created"
}

# Run system readiness checks
run_readiness_checks() {
    log_section "Running System Readiness Checks"
    
    local all_checks_passed=true
    
    # Check 1: Ollama API
    log_info "Testing Ollama API..."
    if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
        log_success "Ollama API is accessible"
    else
        log_error "Ollama API is not accessible"
        all_checks_passed=false
    fi
    
    # Check 2: Model availability
    log_info "Verifying model availability..."
    if ollama list | grep -q "$OLLAMA_MODEL"; then
        log_success "Model $OLLAMA_MODEL is ready"
    else
        log_error "Model $OLLAMA_MODEL is not available"
        all_checks_passed=false
    fi
    
    # Check 3: Test model generation
    log_info "Testing model generation..."
    TEST_RESPONSE=$(curl -s "$OLLAMA_URL/api/generate" -d "{
        \"model\": \"$OLLAMA_MODEL\",
        \"prompt\": \"Say 'test'\",
        \"stream\": false
    }" 2>&1)
    
    if echo "$TEST_RESPONSE" | grep -q "response"; then
        log_success "Model generation test passed"
    else
        log_warning "Model generation test failed (may still work)"
    fi
    
    # Check 4: Directory structure
    log_info "Verifying directory structure..."
    if [ -d "ai-assistant" ] && [ -d ".ai-assistant/backups" ]; then
        log_success "Directory structure is correct"
    else
        log_error "Directory structure is incomplete"
        all_checks_passed=false
    fi
    
    # Check 5: npm dependencies
    log_info "Verifying npm dependencies..."
    if [ -d "node_modules/uuid" ]; then
        log_success "Critical npm dependencies are present"
    else
        log_error "Some npm dependencies are missing"
        all_checks_passed=false
    fi
    
    if [ "$all_checks_passed" = true ]; then
        log_success "All readiness checks passed!"
        return 0
    else
        log_error "Some readiness checks failed"
        return 1
    fi
}

# Display final status
display_final_status() {
    log_section "Setup Complete!"
    
    echo ""
    echo -e "${GREEN}✓ AI Code Assistant is ready to use!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start the application: ${BLUE}npm run dev${NC}"
    echo "  2. Access the AI Assistant: ${BLUE}http://localhost:3000/ai-assistant${NC}"
    echo "  3. Check system status: ${BLUE}npm run check:ai${NC}"
    echo ""
    echo "Useful commands:"
    echo "  • Check Ollama status: ${BLUE}ollama list${NC}"
    echo "  • View Ollama logs: ${BLUE}tail -f /tmp/ollama.log${NC}"
    echo "  • Test AI generation: ${BLUE}ollama run $OLLAMA_MODEL${NC}"
    echo ""
    echo "Documentation:"
    echo "  • README: ${BLUE}ai-assistant/README.md${NC}"
    echo "  • Deployment: ${BLUE}ai-assistant/DEPLOYMENT.md${NC}"
    echo "  • Examples: ${BLUE}ai-assistant/EXAMPLES.md${NC}"
    echo ""
}

# Main setup flow
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                       ║${NC}"
    echo -e "${BLUE}║       AI Code Assistant - Automated Setup             ║${NC}"
    echo -e "${BLUE}║                                                       ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Detect OS
    detect_os
    
    # Check Node.js
    check_node_version
    
    # Check and install Ollama
    if ! check_ollama_installed; then
        install_ollama
    fi
    
    # Check and start Ollama service
    if ! check_ollama_running; then
        start_ollama
    fi
    
    # Check and pull model
    if ! check_model_available; then
        pull_model
    fi
    
    # Check and install npm dependencies
    if ! check_npm_dependencies; then
        install_npm_dependencies
    fi
    
    # Create required directories
    create_directories
    
    # Run readiness checks
    if run_readiness_checks; then
        display_final_status
        exit 0
    else
        log_error "Setup completed with warnings"
        log_info "Please review the errors above and try again"
        exit 1
    fi
}

# Run main function
main
