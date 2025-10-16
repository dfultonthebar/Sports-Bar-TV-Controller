
#!/bin/bash
# Ollama Setup and Optimization Script for NUC13ANHi5
# Optimized for Intel i5-1340P with Intel Iris Xe Graphics

set -e

echo "=========================================="
echo "Ollama Setup and Optimization"
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

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    print_error "Ollama is not installed. Please run system-setup.sh first."
    exit 1
fi

# Stop Ollama service if running
print_status "Stopping Ollama service..."
sudo systemctl stop ollama 2>/dev/null || true

# Configure Ollama environment for Intel GPU
print_status "Configuring Ollama for Intel Iris Xe Graphics..."

# Create Ollama service override directory
sudo mkdir -p /etc/systemd/system/ollama.service.d/

# Create environment configuration
cat << 'EOF' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_NUM_PARALLEL=4"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_INTEL_GPU=1"
Environment="SYCL_CACHE_PERSISTENT=1"
Environment="BIGDL_LLM_XMX_DISABLED=1"
# Optimize for 12-core CPU
Environment="OLLAMA_NUM_THREADS=10"
# Memory settings for 16GB RAM system
Environment="OLLAMA_MAX_VRAM=4096"
EOF

print_status "Ollama environment configured"

# Reload systemd and restart Ollama
print_status "Reloading systemd and starting Ollama..."
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# Wait for Ollama to start
sleep 5

# Verify Ollama is running
if systemctl is-active --quiet ollama; then
    print_status "Ollama service is running"
else
    print_error "Ollama service failed to start"
    sudo journalctl -u ollama -n 50
    exit 1
fi

# Pull required models
print_status "Pulling required AI models..."

# Pull Llama 3.2 (3B) - Optimized for performance
print_status "Pulling llama3.2:3b (recommended for production)..."
ollama pull llama3.2:3b

# Pull Qwen2.5 (3B) - Alternative model
print_status "Pulling qwen2.5:3b (alternative model)..."
ollama pull qwen2.5:3b

# Verify models
print_status "Verifying installed models..."
ollama list

# Test model inference
print_status "Testing model inference..."
echo "Testing llama3.2:3b..."
ollama run llama3.2:3b "Hello, this is a test. Respond with 'OK' if you're working." --verbose

# Create Ollama monitoring script
print_status "Creating Ollama monitoring script..."
cat << 'EOF' > $HOME/monitor-ollama.sh
#!/bin/bash
# Ollama Performance Monitor

echo "Ollama Service Status:"
systemctl status ollama --no-pager | head -n 10
echo ""

echo "Ollama Models:"
ollama list
echo ""

echo "Ollama API Status:"
curl -s http://localhost:11434/api/tags | jq '.'
echo ""

echo "System Resources:"
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}'
echo ""
echo "Memory Usage:"
free -h
echo ""

echo "GPU Status (Intel Iris Xe):"
intel_gpu_top -l 1 2>/dev/null || echo "intel_gpu_top not available"
EOF

chmod +x $HOME/monitor-ollama.sh

print_status "Ollama setup completed successfully!"
echo ""
echo "Ollama Configuration Summary:"
echo "  - Service: Running on 0.0.0.0:11434"
echo "  - Models: llama3.2:3b, qwen2.5:3b"
echo "  - CPU Threads: 10 (optimized for 12-core CPU)"
echo "  - Intel GPU: Enabled (Iris Xe)"
echo "  - Max VRAM: 4GB"
echo ""
echo "To monitor Ollama performance, run:"
echo "  ./monitor-ollama.sh"
echo ""
print_warning "Note: GPU acceleration may vary. Monitor performance and adjust settings if needed."
