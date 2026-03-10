
#!/bin/bash
# Ollama Setup and Optimization Script
# Auto-detects hardware and configures Ollama accordingly
# Supports Intel NUC13ANHi5 (i5-1340P), i9-13900HK, and other Intel systems

set -e

echo "=========================================="
echo "Ollama Setup and Optimization"
echo "Auto-detecting hardware..."
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[x]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[i]${NC} $1"
}

# =========================================================================
# Hardware Detection
# =========================================================================

detect_hardware() {
    print_status "Detecting hardware configuration..."

    # CPU info
    CPU_MODEL=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | xargs)
    CPU_CORES=$(nproc --all)
    CPU_THREADS=$(nproc)

    # RAM in MB
    TOTAL_RAM_MB=$(free -m | awk '/Mem:/ {print $2}')
    TOTAL_RAM_GB=$((TOTAL_RAM_MB / 1024))

    # Detect Intel GPU
    HAS_INTEL_GPU=false
    if lspci 2>/dev/null | grep -qi "VGA.*Intel"; then
        HAS_INTEL_GPU=true
        GPU_MODEL=$(lspci | grep -i "VGA.*Intel" | sed 's/.*: //')
    fi

    # Calculate optimal settings based on hardware
    # Threads: use physical cores minus 2 for system headroom
    OLLAMA_THREADS=$((CPU_CORES - 2))
    if [ "$OLLAMA_THREADS" -lt 4 ]; then
        OLLAMA_THREADS=4
    fi

    # VRAM allocation based on total RAM
    if [ "$TOTAL_RAM_GB" -ge 32 ]; then
        OLLAMA_VRAM=8192
        OLLAMA_MAX_MODELS=3
        OLLAMA_PARALLEL=4
    elif [ "$TOTAL_RAM_GB" -ge 16 ]; then
        OLLAMA_VRAM=4096
        OLLAMA_MAX_MODELS=2
        OLLAMA_PARALLEL=4
    else
        OLLAMA_VRAM=2048
        OLLAMA_MAX_MODELS=1
        OLLAMA_PARALLEL=2
    fi

    echo ""
    print_info "Hardware Detected:"
    echo "  CPU:        $CPU_MODEL"
    echo "  Cores:      $CPU_CORES"
    echo "  RAM:        ${TOTAL_RAM_GB}GB"
    if [ "$HAS_INTEL_GPU" = true ]; then
        echo "  GPU:        $GPU_MODEL"
    else
        echo "  GPU:        None detected (CPU-only inference)"
    fi
    echo ""
    print_info "Calculated Ollama Settings:"
    echo "  Threads:    $OLLAMA_THREADS"
    echo "  Max VRAM:   ${OLLAMA_VRAM}MB"
    echo "  Max Models: $OLLAMA_MAX_MODELS"
    echo "  Parallel:   $OLLAMA_PARALLEL"
    echo ""
}

# =========================================================================
# Ollama Installation
# =========================================================================

install_ollama() {
    if ! command -v ollama &> /dev/null; then
        print_status "Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
    else
        print_status "Ollama is already installed: $(ollama --version 2>/dev/null || echo 'unknown version')"
    fi
}

# =========================================================================
# Configure Ollama Service
# =========================================================================

configure_ollama() {
    print_status "Configuring Ollama service for detected hardware..."

    # Stop Ollama service
    sudo systemctl stop ollama 2>/dev/null || true

    # Create override directory
    sudo mkdir -p /etc/systemd/system/ollama.service.d/

    # Build environment configuration based on detected hardware
    local gpu_envs=""
    if [ "$HAS_INTEL_GPU" = true ]; then
        gpu_envs='Environment="OLLAMA_INTEL_GPU=1"
Environment="SYCL_CACHE_PERSISTENT=1"
Environment="BIGDL_LLM_XMX_DISABLED=1"'
        print_status "Intel GPU acceleration enabled"
    fi

    cat << EOF | sudo tee /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_NUM_PARALLEL=${OLLAMA_PARALLEL}"
Environment="OLLAMA_MAX_LOADED_MODELS=${OLLAMA_MAX_MODELS}"
${gpu_envs}
# Optimized for ${CPU_MODEL} (${CPU_CORES} cores, ${TOTAL_RAM_GB}GB RAM)
Environment="OLLAMA_NUM_THREADS=${OLLAMA_THREADS}"
Environment="OLLAMA_MAX_VRAM=${OLLAMA_VRAM}"
EOF

    # Reload and restart
    sudo systemctl daemon-reload
    sudo systemctl enable ollama
    sudo systemctl start ollama

    # Wait for Ollama to be ready
    print_status "Waiting for Ollama to start..."
    local max_wait=30
    local waited=0
    while ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
        if [ $waited -ge $max_wait ]; then
            print_error "Ollama service failed to start within ${max_wait}s"
            sudo journalctl -u ollama -n 20 --no-pager
            exit 1
        fi
        sleep 2
        waited=$((waited + 2))
    done
    print_status "Ollama service is running"
}

# =========================================================================
# Pull Required Models
# =========================================================================

pull_models() {
    print_status "Pulling required AI models..."

    # Required models for the Sports Bar TV Controller
    local MODELS=(
        "llama3.2:3b|Primary model for chat, log analysis, and AI features"
        "phi3:mini|Lightweight model for sports guide and quick queries"
        "nomic-embed-text|Embedding model for RAG documentation search"
    )

    local total=${#MODELS[@]}
    local current=0
    local failed=()

    for entry in "${MODELS[@]}"; do
        current=$((current + 1))
        local model="${entry%%|*}"
        local desc="${entry##*|}"

        echo ""
        echo -e "${CYAN}[$current/$total] $model${NC}"
        echo -e "${CYAN}  Purpose: $desc${NC}"

        if ollama list 2>/dev/null | grep -q "^${model}"; then
            print_status "$model is already installed"
            continue
        fi

        if ollama pull "$model"; then
            print_status "$model downloaded successfully"
        else
            print_error "Failed to download $model"
            failed+=("$model")
        fi
    done

    echo ""
    print_status "Installed models:"
    ollama list
    echo ""

    if [ ${#failed[@]} -gt 0 ]; then
        print_warning "Failed models (can be retried later):"
        for m in "${failed[@]}"; do
            echo "  - ollama pull $m"
        done
    else
        print_status "All required models installed successfully"
    fi
}

# =========================================================================
# Test Inference
# =========================================================================

test_inference() {
    print_status "Testing model inference..."
    local response
    response=$(curl -s http://localhost:11434/api/generate \
        -d '{"model":"llama3.2:3b","prompt":"Say OK","stream":false}' \
        2>/dev/null | grep -o '"response":"[^"]*"' | head -1)

    if [ -n "$response" ]; then
        print_status "Inference test passed: $response"
    else
        print_warning "Inference test returned no response (model may still be loading)"
    fi
}

# =========================================================================
# Main
# =========================================================================

main() {
    detect_hardware
    install_ollama
    configure_ollama
    pull_models
    test_inference

    echo ""
    echo "=========================================="
    print_status "Ollama setup complete!"
    echo ""
    echo "Configuration Summary:"
    echo "  Service:    Running on 0.0.0.0:11434"
    echo "  CPU:        $CPU_MODEL"
    echo "  Threads:    $OLLAMA_THREADS / $CPU_CORES"
    echo "  Max VRAM:   ${OLLAMA_VRAM}MB"
    echo "  Max Models: $OLLAMA_MAX_MODELS loaded concurrently"
    if [ "$HAS_INTEL_GPU" = true ]; then
        echo "  GPU:        Intel GPU acceleration enabled"
    fi
    echo ""
    echo "Models: llama3.2:3b, phi3:mini, nomic-embed-text"
    echo "=========================================="
}

main "$@"
