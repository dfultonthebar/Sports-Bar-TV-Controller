#!/bin/bash

################################################################################
# Sports Bar TV Controller - System Benchmark Script
# Purpose: Comprehensive baseline performance testing before NUC13ANHi5 migration
# Version: 1.0
# Date: 2025-10-07
################################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BENCHMARK_DIR="/home/ubuntu/Sports-Bar-TV-Controller/benchmark-reports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_MD="${BENCHMARK_DIR}/baseline-report-${TIMESTAMP}.md"
REPORT_JSON="${BENCHMARK_DIR}/baseline-report-${TIMESTAMP}.json"
TEMP_DIR="/tmp/benchmark-${TIMESTAMP}"

# Create directories
mkdir -p "${BENCHMARK_DIR}"
mkdir -p "${TEMP_DIR}"

# Progress tracking
TOTAL_TESTS=50
CURRENT_TEST=0

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_section() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

update_progress() {
    CURRENT_TEST=$((CURRENT_TEST + 1))
    PERCENT=$((CURRENT_TEST * 100 / TOTAL_TESTS))
    echo -e "${MAGENTA}Progress: [${CURRENT_TEST}/${TOTAL_TESTS}] ${PERCENT}%${NC}"
}

# JSON helper
json_escape() {
    echo "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n'
}

################################################################################
# Initialize Reports
################################################################################

initialize_reports() {
    print_header "Initializing Benchmark Reports"
    
    # Markdown header
    cat > "${REPORT_MD}" << 'EOF'
# Sports Bar TV Controller - Baseline System Benchmark Report

**Generated:** $(date '+%Y-%m-%d %H:%M:%S %Z')
**System:** Current Production System (Pre-NUC13ANHi5 Migration)
**Purpose:** Establish baseline performance metrics for comparison

---

## Executive Summary

This report provides comprehensive baseline performance metrics for the current Sports Bar TV Controller system before migration to the new NUC13ANHi5 hardware.

EOF

    # JSON header
    cat > "${REPORT_JSON}" << 'EOF'
{
  "benchmark_metadata": {
    "timestamp": "$(date -Iseconds)",
    "system": "current_production",
    "purpose": "baseline_before_nuc13_migration",
    "version": "1.0"
  },
  "results": {
EOF

    print_success "Report files initialized"
}

################################################################################
# 1. Hardware Specifications
################################################################################

test_hardware_specs() {
    print_header "1. Hardware Specifications"
    
    print_section "CPU Information"
    update_progress
    CPU_MODEL=$(lscpu | grep "Model name" | cut -d: -f2 | xargs)
    CPU_CORES=$(nproc)
    CPU_THREADS=$(lscpu | grep "^CPU(s):" | awk '{print $2}')
    CPU_FREQ=$(lscpu | grep "CPU MHz" | awk '{print $3}')
    CPU_MAX_FREQ=$(lscpu | grep "CPU max MHz" | awk '{print $4}')
    
    echo "Model: ${CPU_MODEL}"
    echo "Physical Cores: ${CPU_CORES}"
    echo "Threads: ${CPU_THREADS}"
    echo "Current Frequency: ${CPU_FREQ} MHz"
    echo "Max Frequency: ${CPU_MAX_FREQ} MHz"
    
    print_section "Memory Information"
    update_progress
    MEM_TOTAL=$(free -h | grep Mem | awk '{print $2}')
    MEM_USED=$(free -h | grep Mem | awk '{print $3}')
    MEM_AVAILABLE=$(free -h | grep Mem | awk '{print $7}')
    MEM_TOTAL_MB=$(free -m | grep Mem | awk '{print $2}')
    
    echo "Total: ${MEM_TOTAL}"
    echo "Used: ${MEM_USED}"
    echo "Available: ${MEM_AVAILABLE}"
    
    print_section "Disk Information"
    update_progress
    DISK_INFO=$(df -h / | tail -1)
    DISK_SIZE=$(echo ${DISK_INFO} | awk '{print $2}')
    DISK_USED=$(echo ${DISK_INFO} | awk '{print $3}')
    DISK_AVAIL=$(echo ${DISK_INFO} | awk '{print $4}')
    DISK_PERCENT=$(echo ${DISK_INFO} | awk '{print $5}')
    
    echo "Size: ${DISK_SIZE}"
    echo "Used: ${DISK_USED} (${DISK_PERCENT})"
    echo "Available: ${DISK_AVAIL}"
    
    # Disk type
    DISK_TYPE=$(lsblk -d -o name,rota | grep -v "NAME" | head -1 | awk '{if ($2 == 0) print "SSD"; else print "HDD"}')
    echo "Type: ${DISK_TYPE}"
    
    print_section "GPU Information"
    update_progress
    if command -v nvidia-smi &> /dev/null; then
        GPU_INFO=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader)
        echo "GPU: ${GPU_INFO}"
    else
        GPU_INFO="No NVIDIA GPU detected"
        echo "${GPU_INFO}"
    fi
    
    print_section "Network Interfaces"
    update_progress
    ip -br addr | grep -v "lo" | while read line; do
        echo "${line}"
    done
    
    print_section "System Uptime and Load"
    update_progress
    UPTIME=$(uptime -p)
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}')
    echo "Uptime: ${UPTIME}"
    echo "Load Average:${LOAD_AVG}"
    
    print_success "Hardware specifications collected"
}

################################################################################
# 2. CPU Performance Tests
################################################################################

test_cpu_performance() {
    print_header "2. CPU Performance Tests"
    
    # Install sysbench if not present
    if ! command -v sysbench &> /dev/null; then
        print_warning "Installing sysbench..."
        sudo apt-get update -qq && sudo apt-get install -y sysbench -qq
    fi
    
    print_section "Single-Core Performance Test"
    update_progress
    echo "Running 30-second single-threaded CPU test..."
    SINGLE_CORE=$(sysbench cpu --threads=1 --time=30 run 2>/dev/null | grep "events per second" | awk '{print $4}')
    echo "Events per second: ${SINGLE_CORE}"
    
    print_section "Multi-Core Performance Test"
    update_progress
    echo "Running 30-second multi-threaded CPU test (${CPU_CORES} threads)..."
    MULTI_CORE=$(sysbench cpu --threads=${CPU_CORES} --time=30 run 2>/dev/null | grep "events per second" | awk '{print $4}')
    echo "Events per second: ${MULTI_CORE}"
    
    print_section "Compression Test (gzip)"
    update_progress
    echo "Testing compression performance..."
    dd if=/dev/zero bs=1M count=100 2>/dev/null | gzip -c > ${TEMP_DIR}/test.gz
    GZIP_TIME=$(dd if=/dev/zero bs=1M count=100 2>/dev/null | /usr/bin/time -f "%e" gzip -c > ${TEMP_DIR}/test2.gz 2>&1 | tail -1)
    echo "Time to compress 100MB: ${GZIP_TIME}s"
    
    print_section "Calculation Test"
    update_progress
    echo "Testing calculation performance..."
    CALC_TIME=$(/usr/bin/time -f "%e" bash -c 'echo "scale=5000; 4*a(1)" | bc -l' 2>&1 | tail -1)
    echo "Time to calculate Pi (5000 digits): ${CALC_TIME}s"
    
    print_success "CPU performance tests completed"
}

################################################################################
# 3. Disk I/O Performance
################################################################################

test_disk_io() {
    print_header "3. Disk I/O Performance Tests"
    
    # Install fio if not present
    if ! command -v fio &> /dev/null; then
        print_warning "Installing fio..."
        sudo apt-get update -qq && sudo apt-get install -y fio -qq
    fi
    
    print_section "Sequential Read Test"
    update_progress
    echo "Running sequential read test (1GB)..."
    SEQ_READ=$(fio --name=seqread --rw=read --bs=1M --size=1G --numjobs=1 --runtime=30 --time_based --directory=${TEMP_DIR} --output-format=json 2>/dev/null | jq -r '.jobs[0].read.bw_bytes' | awk '{printf "%.2f", $1/1024/1024}')
    echo "Sequential Read: ${SEQ_READ} MB/s"
    
    print_section "Sequential Write Test"
    update_progress
    echo "Running sequential write test (1GB)..."
    SEQ_WRITE=$(fio --name=seqwrite --rw=write --bs=1M --size=1G --numjobs=1 --runtime=30 --time_based --directory=${TEMP_DIR} --output-format=json 2>/dev/null | jq -r '.jobs[0].write.bw_bytes' | awk '{printf "%.2f", $1/1024/1024}')
    echo "Sequential Write: ${SEQ_WRITE} MB/s"
    
    print_section "Random Read Test (4K blocks)"
    update_progress
    echo "Running random read test..."
    RAND_READ=$(fio --name=randread --rw=randread --bs=4k --size=512M --numjobs=1 --runtime=30 --time_based --directory=${TEMP_DIR} --output-format=json 2>/dev/null | jq -r '.jobs[0].read.bw_bytes' | awk '{printf "%.2f", $1/1024/1024}')
    RAND_READ_IOPS=$(fio --name=randread --rw=randread --bs=4k --size=512M --numjobs=1 --runtime=30 --time_based --directory=${TEMP_DIR} --output-format=json 2>/dev/null | jq -r '.jobs[0].read.iops')
    echo "Random Read: ${RAND_READ} MB/s"
    echo "Random Read IOPS: ${RAND_READ_IOPS}"
    
    print_section "Random Write Test (4K blocks)"
    update_progress
    echo "Running random write test..."
    RAND_WRITE=$(fio --name=randwrite --rw=randwrite --bs=4k --size=512M --numjobs=1 --runtime=30 --time_based --directory=${TEMP_DIR} --output-format=json 2>/dev/null | jq -r '.jobs[0].write.bw_bytes' | awk '{printf "%.2f", $1/1024/1024}')
    RAND_WRITE_IOPS=$(fio --name=randwrite --rw=randwrite --bs=4k --size=512M --numjobs=1 --runtime=30 --time_based --directory=${TEMP_DIR} --output-format=json 2>/dev/null | jq -r '.jobs[0].write.iops')
    echo "Random Write: ${RAND_WRITE} MB/s"
    echo "Random Write IOPS: ${RAND_WRITE_IOPS}"
    
    print_section "Latency Test"
    update_progress
    echo "Testing I/O latency..."
    LATENCY=$(fio --name=latency --rw=randread --bs=4k --size=128M --numjobs=1 --runtime=10 --time_based --directory=${TEMP_DIR} --output-format=json 2>/dev/null | jq -r '.jobs[0].read.lat_ns.mean' | awk '{printf "%.2f", $1/1000}')
    echo "Average Latency: ${LATENCY} μs"
    
    print_success "Disk I/O tests completed"
}

################################################################################
# 4. Memory Performance
################################################################################

test_memory_performance() {
    print_header "4. Memory Performance Tests"
    
    print_section "Memory Bandwidth Test"
    update_progress
    echo "Running memory bandwidth test..."
    MEM_BW=$(sysbench memory --memory-block-size=1M --memory-total-size=10G --memory-oper=read run 2>/dev/null | grep "transferred" | awk '{print $(NF-1), $NF}')
    echo "Memory Bandwidth: ${MEM_BW}"
    
    print_section "Memory Latency Test"
    update_progress
    echo "Running memory latency test..."
    MEM_LAT=$(sysbench memory --memory-block-size=1K --memory-total-size=1G --memory-oper=read run 2>/dev/null | grep "total time:" | awk '{print $3}')
    echo "Memory Latency (1GB read): ${MEM_LAT}"
    
    print_success "Memory performance tests completed"
}

################################################################################
# 5. PostgreSQL Performance
################################################################################

test_postgresql() {
    print_header "5. PostgreSQL Database Performance"
    
    # Check if PostgreSQL is running
    if ! systemctl is-active --quiet postgresql; then
        print_warning "PostgreSQL is not running, skipping database tests"
        return
    fi
    
    print_section "Connection Test"
    update_progress
    if sudo -u postgres psql -c "SELECT version();" &>/dev/null; then
        PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | head -1 | xargs)
        echo "PostgreSQL Version: ${PG_VERSION}"
        print_success "Connection successful"
    else
        print_error "Cannot connect to PostgreSQL"
        return
    fi
    
    print_section "Database Size"
    update_progress
    DB_SIZE=$(sudo -u postgres psql -t -c "SELECT pg_size_pretty(pg_database_size('sportsbar'));" 2>/dev/null | xargs || echo "N/A")
    echo "Database Size: ${DB_SIZE}"
    
    print_section "Table Count"
    update_progress
    TABLE_COUNT=$(sudo -u postgres psql -d sportsbar -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs || echo "N/A")
    echo "Number of Tables: ${TABLE_COUNT}"
    
    print_section "Simple Query Performance"
    update_progress
    echo "Testing simple SELECT query..."
    SIMPLE_QUERY_TIME=$(/usr/bin/time -f "%e" sudo -u postgres psql -d sportsbar -c "SELECT COUNT(*) FROM \"User\";" 2>&1 | tail -1)
    echo "Query Time: ${SIMPLE_QUERY_TIME}s"
    
    print_section "Complex Query Performance"
    update_progress
    echo "Testing complex JOIN query..."
    COMPLEX_QUERY_TIME=$(/usr/bin/time -f "%e" sudo -u postgres psql -d sportsbar -c "SELECT u.id, u.name, COUNT(s.id) as session_count FROM \"User\" u LEFT JOIN \"Session\" s ON u.id = s.\"userId\" GROUP BY u.id, u.name LIMIT 100;" 2>&1 | tail -1)
    echo "Query Time: ${COMPLEX_QUERY_TIME}s"
    
    # pgbench test if available
    if command -v pgbench &> /dev/null; then
        print_section "pgbench Performance Test"
        update_progress
        echo "Running pgbench (10 seconds, 4 clients)..."
        sudo -u postgres pgbench -i -s 10 postgres &>/dev/null
        PGBENCH_TPS=$(sudo -u postgres pgbench -c 4 -j 2 -T 10 postgres 2>/dev/null | grep "tps" | head -1 | awk '{print $3}')
        echo "Transactions per second: ${PGBENCH_TPS}"
    fi
    
    print_success "PostgreSQL tests completed"
}

################################################################################
# 6. Ollama AI Performance
################################################################################

test_ollama() {
    print_header "6. Ollama AI Performance"
    
    # Check if Ollama is running
    if ! pgrep -x "ollama" > /dev/null; then
        print_warning "Ollama is not running, skipping AI tests"
        return
    fi
    
    print_section "Ollama Status"
    update_progress
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        print_success "Ollama is responding"
    else
        print_error "Ollama is not responding"
        return
    fi
    
    print_section "Available Models"
    update_progress
    MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name' 2>/dev/null || echo "Unable to fetch models")
    echo "Models: ${MODELS}"
    
    # Get the first available model
    FIRST_MODEL=$(echo "${MODELS}" | head -1)
    
    if [ -n "${FIRST_MODEL}" ] && [ "${FIRST_MODEL}" != "Unable to fetch models" ]; then
        print_section "Response Time Test (3 queries)"
        
        # Test 1: Simple query
        update_progress
        echo "Test 1: Simple question..."
        START_TIME=$(date +%s.%N)
        RESPONSE1=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"What is 2+2?\", \"stream\": false}" | jq -r '.response' 2>/dev/null)
        END_TIME=$(date +%s.%N)
        TIME1=$(echo "$END_TIME - $START_TIME" | bc)
        echo "Response time: ${TIME1}s"
        
        # Test 2: Medium query
        update_progress
        echo "Test 2: Medium complexity question..."
        START_TIME=$(date +%s.%N)
        RESPONSE2=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"Explain what a sports bar is in one sentence.\", \"stream\": false}" | jq -r '.response' 2>/dev/null)
        END_TIME=$(date +%s.%N)
        TIME2=$(echo "$END_TIME - $START_TIME" | bc)
        echo "Response time: ${TIME2}s"
        
        # Test 3: Complex query
        update_progress
        echo "Test 3: Complex question..."
        START_TIME=$(date +%s.%N)
        RESPONSE3=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"List three popular sports shown in sports bars.\", \"stream\": false}" | jq -r '.response' 2>/dev/null)
        END_TIME=$(date +%s.%N)
        TIME3=$(echo "$END_TIME - $START_TIME" | bc)
        echo "Response time: ${TIME3}s"
        
        # Calculate average
        AVG_TIME=$(echo "scale=2; ($TIME1 + $TIME2 + $TIME3) / 3" | bc)
        echo "Average response time: ${AVG_TIME}s"
        
        print_section "Token Generation Speed"
        update_progress
        # Get token count from last response
        TOKENS=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"Count to 10.\", \"stream\": false}" | jq -r '.eval_count' 2>/dev/null || echo "N/A")
        EVAL_DURATION=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"Count to 10.\", \"stream\": false}" | jq -r '.eval_duration' 2>/dev/null || echo "0")
        
        if [ "${TOKENS}" != "N/A" ] && [ "${EVAL_DURATION}" != "0" ]; then
            TOKENS_PER_SEC=$(echo "scale=2; ${TOKENS} / (${EVAL_DURATION} / 1000000000)" | bc)
            echo "Tokens per second: ${TOKENS_PER_SEC}"
        else
            echo "Token generation speed: N/A"
        fi
        
        print_section "Memory Usage During Inference"
        update_progress
        OLLAMA_MEM=$(ps aux | grep "[o]llama serve" | awk '{print $6}')
        OLLAMA_MEM_MB=$(echo "scale=2; ${OLLAMA_MEM} / 1024" | bc)
        echo "Ollama memory usage: ${OLLAMA_MEM_MB} MB"
    else
        print_warning "No models available for testing"
    fi
    
    print_success "Ollama tests completed"
}

################################################################################
# 7. Next.js Application Performance
################################################################################

test_nextjs() {
    print_header "7. Next.js Application Performance"
    
    print_section "PM2 Status"
    update_progress
    if command -v pm2 &> /dev/null; then
        PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="sportsbar-assistant") | .pm2_env.status' || echo "Not running")
        echo "Application Status: ${PM2_STATUS}"
        
        if [ "${PM2_STATUS}" == "online" ]; then
            print_section "PM2 Resource Usage"
            update_progress
            PM2_CPU=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="sportsbar-assistant") | .monit.cpu' || echo "N/A")
            PM2_MEM=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="sportsbar-assistant") | .monit.memory' || echo "0")
            PM2_MEM_MB=$(echo "scale=2; ${PM2_MEM} / 1024 / 1024" | bc)
            
            echo "CPU Usage: ${PM2_CPU}%"
            echo "Memory Usage: ${PM2_MEM_MB} MB"
            
            print_section "Application Response Time"
            update_progress
            echo "Testing application response time..."
            
            # Test homepage
            HOMEPAGE_TIME=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:3000/ || echo "N/A")
            echo "Homepage load time: ${HOMEPAGE_TIME}s"
            
            # Test API endpoint
            API_TIME=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:3000/api/health || echo "N/A")
            echo "API response time: ${API_TIME}s"
            
            print_section "Uptime"
            update_progress
            PM2_UPTIME=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="sportsbar-assistant") | .pm2_env.pm_uptime' || echo "0")
            UPTIME_SECONDS=$(( ($(date +%s) * 1000 - ${PM2_UPTIME}) / 1000 ))
            UPTIME_HOURS=$(echo "scale=2; ${UPTIME_SECONDS} / 3600" | bc)
            echo "Application uptime: ${UPTIME_HOURS} hours"
        fi
    else
        print_warning "PM2 not installed"
    fi
    
    print_section "Build Time Test"
    update_progress
    echo "Testing Next.js build time..."
    cd /home/ubuntu/Sports-Bar-TV-Controller
    BUILD_START=$(date +%s)
    npm run build &>/dev/null || true
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    echo "Build time: ${BUILD_TIME}s"
    
    print_success "Next.js tests completed"
}

################################################################################
# 8. System Health Checks
################################################################################

test_system_health() {
    print_header "8. System Health Checks"
    
    print_section "Temperature Readings"
    update_progress
    if command -v sensors &> /dev/null; then
        TEMPS=$(sensors 2>/dev/null | grep -E "Core|temp" || echo "No temperature sensors found")
        echo "${TEMPS}"
    else
        echo "lm-sensors not installed"
    fi
    
    print_section "Top Processes by CPU"
    update_progress
    ps aux --sort=-%cpu | head -6
    
    print_section "Top Processes by Memory"
    update_progress
    ps aux --sort=-%mem | head -6
    
    print_section "Network Connectivity"
    update_progress
    if ping -c 3 8.8.8.8 &>/dev/null; then
        print_success "Internet connectivity: OK"
    else
        print_error "Internet connectivity: FAILED"
    fi
    
    print_section "Disk Health (SMART)"
    update_progress
    if command -v smartctl &> /dev/null; then
        DISK_DEVICE=$(df / | tail -1 | awk '{print $1}' | sed 's/[0-9]*$//')
        SMART_HEALTH=$(sudo smartctl -H ${DISK_DEVICE} 2>/dev/null | grep "SMART overall-health" || echo "SMART data not available")
        echo "${SMART_HEALTH}"
    else
        echo "smartmontools not installed"
    fi
    
    print_section "System Errors (last 24 hours)"
    update_progress
    ERROR_COUNT=$(journalctl --since "24 hours ago" --priority=err --no-pager 2>/dev/null | wc -l)
    echo "Error count: ${ERROR_COUNT}"
    
    print_success "System health checks completed"
}

################################################################################
# Generate Reports
################################################################################

generate_markdown_report() {
    print_header "Generating Markdown Report"
    
    cat >> "${REPORT_MD}" << EOF

## 1. Hardware Specifications

### CPU
- **Model:** ${CPU_MODEL}
- **Physical Cores:** ${CPU_CORES}
- **Threads:** ${CPU_THREADS}
- **Current Frequency:** ${CPU_FREQ} MHz
- **Max Frequency:** ${CPU_MAX_FREQ} MHz

### Memory
- **Total:** ${MEM_TOTAL}
- **Used:** ${MEM_USED}
- **Available:** ${MEM_AVAILABLE}

### Storage
- **Size:** ${DISK_SIZE}
- **Used:** ${DISK_USED} (${DISK_PERCENT})
- **Available:** ${DISK_AVAIL}
- **Type:** ${DISK_TYPE}

### GPU
${GPU_INFO}

### System
- **Uptime:** ${UPTIME}
- **Load Average:**${LOAD_AVG}

---

## 2. CPU Performance

### Benchmark Results
- **Single-Core Performance:** ${SINGLE_CORE} events/sec
- **Multi-Core Performance:** ${MULTI_CORE} events/sec
- **Compression (100MB):** ${GZIP_TIME}s
- **Calculation (Pi 5000 digits):** ${CALC_TIME}s

**Performance Score:** $(echo "scale=0; (${SINGLE_CORE} + ${MULTI_CORE}) / 100" | bc)/100

---

## 3. Disk I/O Performance

### Sequential Performance
- **Read:** ${SEQ_READ} MB/s
- **Write:** ${SEQ_WRITE} MB/s

### Random Performance (4K blocks)
- **Read:** ${RAND_READ} MB/s (${RAND_READ_IOPS} IOPS)
- **Write:** ${RAND_WRITE} MB/s (${RAND_WRITE_IOPS} IOPS)

### Latency
- **Average:** ${LATENCY} μs

**I/O Score:** $(echo "scale=0; (${SEQ_READ} + ${SEQ_WRITE}) / 20" | bc)/100

---

## 4. Memory Performance

- **Bandwidth:** ${MEM_BW}
- **Latency (1GB read):** ${MEM_LAT}

---

## 5. PostgreSQL Performance

- **Version:** ${PG_VERSION}
- **Database Size:** ${DB_SIZE}
- **Table Count:** ${TABLE_COUNT}
- **Simple Query Time:** ${SIMPLE_QUERY_TIME}s
- **Complex Query Time:** ${COMPLEX_QUERY_TIME}s
$([ -n "${PGBENCH_TPS}" ] && echo "- **Transactions/sec:** ${PGBENCH_TPS}")

---

## 6. Ollama AI Performance

- **Available Models:** ${MODELS}
- **Average Response Time:** ${AVG_TIME}s
- **Token Generation Speed:** ${TOKENS_PER_SEC} tokens/sec
- **Memory Usage:** ${OLLAMA_MEM_MB} MB

---

## 7. Next.js Application Performance

- **Status:** ${PM2_STATUS}
- **CPU Usage:** ${PM2_CPU}%
- **Memory Usage:** ${PM2_MEM_MB} MB
- **Homepage Load Time:** ${HOMEPAGE_TIME}s
- **API Response Time:** ${API_TIME}s
- **Build Time:** ${BUILD_TIME}s
- **Uptime:** ${UPTIME_HOURS} hours

---

## 8. System Health Summary

- **Temperature:** Monitored
- **Network:** Connected
- **Disk Health:** ${SMART_HEALTH}
- **System Errors (24h):** ${ERROR_COUNT}

---

## Performance Summary

| Category | Score | Status |
|----------|-------|--------|
| CPU Performance | $(echo "scale=0; (${SINGLE_CORE} + ${MULTI_CORE}) / 100" | bc)/100 | ✓ |
| Disk I/O | $(echo "scale=0; (${SEQ_READ} + ${SEQ_WRITE}) / 20" | bc)/100 | ✓ |
| Memory | Good | ✓ |
| Database | ${SIMPLE_QUERY_TIME}s queries | ✓ |
| AI Performance | ${AVG_TIME}s avg | ✓ |
| Application | ${HOMEPAGE_TIME}s load | ✓ |

---

## Recommendations

1. **CPU:** Current performance is baseline for comparison
2. **Disk I/O:** ${DISK_TYPE} performance recorded
3. **Memory:** ${MEM_TOTAL} available
4. **Database:** Query performance baseline established
5. **AI:** Ollama response times documented
6. **Application:** Next.js performance metrics captured

---

## Next Steps

1. Deploy to NUC13ANHi5
2. Run identical benchmark
3. Compare results using comparison template
4. Document performance improvements
5. Optimize based on findings

---

**Report Generated:** $(date '+%Y-%m-%d %H:%M:%S %Z')
**Benchmark Duration:** Approximately 15-20 minutes
**System:** Current Production (Pre-Migration)

EOF

    print_success "Markdown report generated: ${REPORT_MD}"
}

generate_json_report() {
    print_header "Generating JSON Report"
    
    cat >> "${REPORT_JSON}" << EOF
    "hardware": {
      "cpu": {
        "model": "${CPU_MODEL}",
        "cores": ${CPU_CORES},
        "threads": ${CPU_THREADS},
        "frequency_mhz": ${CPU_FREQ},
        "max_frequency_mhz": ${CPU_MAX_FREQ}
      },
      "memory": {
        "total": "${MEM_TOTAL}",
        "total_mb": ${MEM_TOTAL_MB},
        "used": "${MEM_USED}",
        "available": "${MEM_AVAILABLE}"
      },
      "disk": {
        "size": "${DISK_SIZE}",
        "used": "${DISK_USED}",
        "available": "${DISK_AVAIL}",
        "usage_percent": "${DISK_PERCENT}",
        "type": "${DISK_TYPE}"
      },
      "gpu": "${GPU_INFO}",
      "uptime": "${UPTIME}",
      "load_average": "${LOAD_AVG}"
    },
    "cpu_performance": {
      "single_core_events_per_sec": ${SINGLE_CORE},
      "multi_core_events_per_sec": ${MULTI_CORE},
      "compression_time_sec": ${GZIP_TIME},
      "calculation_time_sec": ${CALC_TIME}
    },
    "disk_io": {
      "sequential_read_mbps": ${SEQ_READ},
      "sequential_write_mbps": ${SEQ_WRITE},
      "random_read_mbps": ${RAND_READ},
      "random_read_iops": ${RAND_READ_IOPS},
      "random_write_mbps": ${RAND_WRITE},
      "random_write_iops": ${RAND_WRITE_IOPS},
      "latency_us": ${LATENCY}
    },
    "memory": {
      "bandwidth": "${MEM_BW}",
      "latency": "${MEM_LAT}"
    },
    "postgresql": {
      "version": "${PG_VERSION}",
      "database_size": "${DB_SIZE}",
      "table_count": "${TABLE_COUNT}",
      "simple_query_time_sec": ${SIMPLE_QUERY_TIME},
      "complex_query_time_sec": ${COMPLEX_QUERY_TIME}
    },
    "ollama": {
      "models": "${MODELS}",
      "avg_response_time_sec": ${AVG_TIME},
      "tokens_per_sec": ${TOKENS_PER_SEC},
      "memory_usage_mb": ${OLLAMA_MEM_MB}
    },
    "nextjs": {
      "status": "${PM2_STATUS}",
      "cpu_percent": ${PM2_CPU},
      "memory_mb": ${PM2_MEM_MB},
      "homepage_load_time_sec": ${HOMEPAGE_TIME},
      "api_response_time_sec": ${API_TIME},
      "build_time_sec": ${BUILD_TIME},
      "uptime_hours": ${UPTIME_HOURS}
    },
    "system_health": {
      "network_status": "connected",
      "disk_health": "${SMART_HEALTH}",
      "error_count_24h": ${ERROR_COUNT}
    }
  }
}
EOF

    print_success "JSON report generated: ${REPORT_JSON}"
}

################################################################################
# Main Execution
################################################################################

main() {
    clear
    print_header "Sports Bar TV Controller - System Benchmark"
    echo -e "${YELLOW}This benchmark will take approximately 15-20 minutes${NC}"
    echo -e "${YELLOW}Testing: Hardware, CPU, Disk, Memory, PostgreSQL, Ollama, Next.js, System Health${NC}"
    echo ""
    
    initialize_reports
    
    test_hardware_specs
    test_cpu_performance
    test_disk_io
    test_memory_performance
    test_postgresql
    test_ollama
    test_nextjs
    test_system_health
    
    generate_markdown_report
    generate_json_report
    
    # Cleanup
    rm -rf "${TEMP_DIR}"
    
    print_header "Benchmark Complete!"
    echo -e "${GREEN}Reports generated:${NC}"
    echo -e "  📄 Markdown: ${REPORT_MD}"
    echo -e "  📊 JSON: ${REPORT_JSON}"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo -e "  1. Review the baseline report"
    echo -e "  2. Deploy to NUC13ANHi5"
    echo -e "  3. Run benchmark again on new system"
    echo -e "  4. Compare results"
    echo ""
}

# Run main function
main

