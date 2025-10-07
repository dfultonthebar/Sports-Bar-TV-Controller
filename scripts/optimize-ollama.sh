
#!/bin/bash
# Optimize Ollama for CPU-only performance

echo "=== Ollama CPU Optimization Script ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "This script needs sudo privileges to modify system settings."
    echo "Please run with: sudo ./optimize-ollama.sh"
    exit 1
fi

# Create systemd override directory
mkdir -p /etc/systemd/system/ollama.service.d/

# Create optimization configuration
cat > /etc/systemd/system/ollama.service.d/optimization.conf << 'EOF'
[Service]
# CPU Optimization Settings
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_FLASH_ATTENTION=1"

# Thread optimization for i5-7200U (2 cores, 4 threads)
Environment="OMP_NUM_THREADS=4"
Environment="GOMAXPROCS=4"

# Memory optimization
Environment="OLLAMA_MAX_QUEUE=2"

# Keep model loaded to avoid reload overhead
Environment="OLLAMA_KEEP_ALIVE=30m"

# Reduce context window for faster responses
Environment="OLLAMA_NUM_CTX=2048"

# CPU affinity and priority
CPUAffinity=0-3
Nice=-5
IOSchedulingClass=realtime
IOSchedulingPriority=0
EOF

echo "✓ Created Ollama optimization configuration"

# Install lm-sensors if not present
if ! command -v sensors &> /dev/null; then
    echo "Installing lm-sensors for temperature monitoring..."
    apt-get update -qq
    apt-get install -y lm-sensors
    sensors-detect --auto
    echo "✓ Installed lm-sensors"
fi

# Reload systemd and restart Ollama
echo "Reloading systemd configuration..."
systemctl daemon-reload

echo "Restarting Ollama service..."
systemctl restart ollama

# Wait for service to start
sleep 3

# Check status
if systemctl is-active --quiet ollama; then
    echo "✓ Ollama service restarted successfully"
    echo ""
    echo "=== Optimization Applied ==="
    echo "- Limited parallel requests to 2"
    echo "- Set max loaded models to 1"
    echo "- Enabled flash attention"
    echo "- Optimized thread count for CPU"
    echo "- Set model keep-alive to 30 minutes"
    echo "- Reduced context window to 2048 tokens"
    echo "- Increased process priority"
    echo ""
    echo "Current Ollama environment:"
    systemctl show ollama --property=Environment
else
    echo "✗ Failed to restart Ollama service"
    echo "Check logs with: journalctl -u ollama -n 50"
    exit 1
fi

echo ""
echo "=== Next Steps ==="
echo "1. Monitor performance with: ./scripts/view-performance.sh"
echo "2. Test AI response time in the application"
echo "3. Check temperature: sensors"
echo ""
echo "To revert changes, run:"
echo "  sudo rm /etc/systemd/system/ollama.service.d/optimization.conf"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl restart ollama"
