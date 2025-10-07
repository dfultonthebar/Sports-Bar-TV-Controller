
#!/bin/bash
# Performance Monitoring and Optimization Setup for NUC13ANHi5
# Sports Bar TV Controller

set -e

echo "=========================================="
echo "Performance Monitoring Setup"
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

# Install monitoring tools
print_status "Installing performance monitoring tools..."
sudo apt install -y htop iotop nethogs sysstat glances

# Configure PostgreSQL for 12-core CPU and 16GB RAM
print_status "Optimizing PostgreSQL configuration..."

# Backup original config
sudo cp /etc/postgresql/15/main/postgresql.conf /etc/postgresql/15/main/postgresql.conf.backup

# Apply optimized settings
sudo tee -a /etc/postgresql/15/main/postgresql.conf > /dev/null << 'EOF'

# ========================================
# Performance Tuning for NUC13ANHi5
# Intel i5-1340P (12 cores) with 16GB RAM
# ========================================

# Memory Settings
shared_buffers = 4GB                    # 25% of RAM
effective_cache_size = 12GB             # 75% of RAM
maintenance_work_mem = 1GB              # For VACUUM, CREATE INDEX
work_mem = 64MB                         # Per operation (adjust based on connections)

# Checkpoint Settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1                  # For SSD
effective_io_concurrency = 200          # For SSD

# Parallel Query Settings (optimized for 12 cores)
max_worker_processes = 12
max_parallel_workers_per_gather = 6
max_parallel_workers = 12
max_parallel_maintenance_workers = 4

# Connection Settings
max_connections = 200

# Write-Ahead Log
wal_level = replica
max_wal_size = 2GB
min_wal_size = 1GB

# Query Planner
cpu_tuple_cost = 0.01
cpu_index_tuple_cost = 0.005
cpu_operator_cost = 0.0025

# Autovacuum Settings
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 10s
autovacuum_vacuum_threshold = 50
autovacuum_vacuum_scale_factor = 0.2
autovacuum_analyze_threshold = 50
autovacuum_analyze_scale_factor = 0.1

# Logging
log_min_duration_statement = 1000       # Log queries taking > 1 second
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

EOF

# Restart PostgreSQL
print_status "Restarting PostgreSQL..."
sudo systemctl restart postgresql

# Create performance monitoring script
print_status "Creating performance monitoring script..."

cat << 'EOF' > $HOME/monitor-performance.sh
#!/bin/bash
# Performance Monitoring Script for Sports Bar TV Controller

echo "=========================================="
echo "Sports Bar TV Controller - Performance Monitor"
echo "=========================================="
echo ""

# System Information
echo "=== System Information ==="
echo "CPU: $(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)"
echo "Cores: $(nproc)"
echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
echo ""

# CPU Usage
echo "=== CPU Usage ==="
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print "CPU Usage: " 100 - $1"%"}'
echo ""

# Memory Usage
echo "=== Memory Usage ==="
free -h
echo ""

# Disk Usage
echo "=== Disk Usage ==="
df -h / | tail -n 1
echo ""

# PostgreSQL Status
echo "=== PostgreSQL Status ==="
sudo -u postgres psql -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"
sudo -u postgres psql -c "SELECT datname, blks_hit*100/(blks_hit+blks_read) as cache_hit_ratio FROM pg_stat_database WHERE datname = 'sportsbar_tv';"
echo ""

# PM2 Status
echo "=== PM2 Application Status ==="
pm2 status
echo ""

# PM2 Resource Usage
echo "=== PM2 Resource Usage ==="
pm2 describe sports-bar-tv | grep -E "cpu|memory"
echo ""

# Ollama Status
echo "=== Ollama Status ==="
systemctl status ollama --no-pager | head -n 5
curl -s http://localhost:11434/api/tags | jq -r '.models[] | "\(.name) - \(.size/1024/1024/1024 | floor)GB"' 2>/dev/null || echo "Ollama API not responding"
echo ""

# Network Connections
echo "=== Network Connections ==="
ss -s
echo ""

# Intel GPU Status
echo "=== Intel Iris Xe GPU Status ==="
intel_gpu_top -l 1 2>/dev/null || echo "intel_gpu_top not available"
echo ""

# Load Average
echo "=== Load Average ==="
uptime
echo ""

# Recent Errors (last 10)
echo "=== Recent Application Errors ==="
tail -n 10 /home/ubuntu/logs/sports-bar-tv/error.log 2>/dev/null || echo "No error log found"
echo ""

echo "=========================================="
echo "Monitoring completed at $(date)"
echo "=========================================="
EOF

chmod +x $HOME/monitor-performance.sh

# Create automated performance report cron job
print_status "Setting up automated performance reports..."

# Create reports directory
mkdir -p $HOME/performance-reports

# Add cron job for hourly performance reports
(crontab -l 2>/dev/null; echo "0 * * * * $HOME/monitor-performance.sh > $HOME/performance-reports/perf-report-\$(date +\%Y\%m\%d-\%H\%M).txt 2>&1") | crontab -

# Create system optimization script
print_status "Creating system optimization script..."

cat << 'EOF' > $HOME/optimize-system.sh
#!/bin/bash
# System Optimization Script for NUC13ANHi5

echo "Running system optimizations..."

# Clear system cache (safe operation)
sync; echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null

# Optimize PostgreSQL
echo "Optimizing PostgreSQL..."
sudo -u postgres psql -d sportsbar_tv -c "VACUUM ANALYZE;"

# Clean PM2 logs
echo "Cleaning PM2 logs..."
pm2 flush

# Clean old performance reports (keep last 7 days)
echo "Cleaning old performance reports..."
find $HOME/performance-reports -name "perf-report-*.txt" -mtime +7 -delete

# Update system packages
echo "Checking for system updates..."
sudo apt update > /dev/null 2>&1

echo "System optimization completed!"
EOF

chmod +x $HOME/optimize-system.sh

# Add weekly optimization cron job
(crontab -l 2>/dev/null; echo "0 2 * * 0 $HOME/optimize-system.sh >> $HOME/logs/optimization.log 2>&1") | crontab -

# Create benchmark script
print_status "Creating benchmark script..."

cat << 'EOF' > $HOME/benchmark-system.sh
#!/bin/bash
# Benchmark Script for NUC13ANHi5

echo "=========================================="
echo "System Benchmark - NUC13ANHi5"
echo "=========================================="
echo ""

# CPU Benchmark
echo "=== CPU Benchmark ==="
echo "Running CPU stress test (10 seconds)..."
sysbench cpu --cpu-max-prime=20000 --threads=12 run | grep -E "events per second|total time"
echo ""

# Memory Benchmark
echo "=== Memory Benchmark ==="
echo "Running memory test..."
sysbench memory --memory-total-size=10G --threads=12 run | grep -E "transferred|total time"
echo ""

# Disk I/O Benchmark
echo "=== Disk I/O Benchmark ==="
echo "Running disk I/O test..."
sysbench fileio --file-total-size=2G prepare > /dev/null 2>&1
sysbench fileio --file-total-size=2G --file-test-mode=rndrw --threads=12 run | grep -E "read|written|total time"
sysbench fileio --file-total-size=2G cleanup > /dev/null 2>&1
echo ""

# PostgreSQL Benchmark
echo "=== PostgreSQL Benchmark ==="
echo "Running database benchmark..."
pgbench -i -s 50 sportsbar_tv > /dev/null 2>&1
pgbench -c 10 -j 4 -t 1000 sportsbar_tv | grep -E "tps|latency"
echo ""

# Node.js Performance
echo "=== Node.js Performance ==="
node -e "console.time('test'); for(let i=0; i<1000000; i++){Math.sqrt(i);} console.timeEnd('test');"
echo ""

echo "Benchmark completed!"
EOF

chmod +x $HOME/benchmark-system.sh

# Install sysbench for benchmarking
print_status "Installing benchmarking tools..."
sudo apt install -y sysbench

print_status "Performance monitoring setup completed!"
echo ""
echo "Available monitoring tools:"
echo "  ./monitor-performance.sh  - Real-time performance monitoring"
echo "  ./optimize-system.sh      - System optimization"
echo "  ./benchmark-system.sh     - System benchmarking"
echo "  htop                      - Interactive process viewer"
echo "  glances                   - Advanced system monitoring"
echo ""
echo "Automated tasks:"
echo "  - Hourly performance reports: ~/performance-reports/"
echo "  - Weekly system optimization: Sundays at 2 AM"
echo ""
print_status "Run ./monitor-performance.sh to see current system status"
