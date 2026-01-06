
#!/bin/bash

################################################################################
# Sports Bar TV Controller - System Benchmark Script
# Purpose: Comprehensive baseline performance testing before NUC13ANHi5 migration
# Version: 1.1
# Date: 2025-10-07
# 
# ENHANCEMENTS:
# - Added --quick mode for faster benchmarking (~5 minutes vs 15-20 minutes)
# - Added timestamps to all output sections
# - Improved progress indicators
# - Better suited for regular monitoring
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

# Quick mode flag
QUICK_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick|-q)
            QUICK_MODE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --quick, -q    Run quick benchmark (~5 minutes)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0              # Full benchmark (~15-20 minutes)"
            echo "  $0 --quick      # Quick benchmark (~5 minutes)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Create directories
mkdir -p "${BENCHMARK_DIR}"
mkdir -p "${TEMP_DIR}"

# Progress tracking
if [ "$QUICK_MODE" = true ]; then
    TOTAL_TESTS=25  # Reduced for quick mode
else
    TOTAL_TESTS=50  # Full mode
fi
CURRENT_TEST=0

################################################################################
# Helper Functions
################################################################################

print_header() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}  [$timestamp]${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_section() {
    local timestamp=$(date '+%H:%M:%S')
    echo -e "\n${BLUE}▶ [$timestamp] $1${NC}"
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
    local timestamp=$(date '+%H:%M:%S')
    echo -e "${MAGENTA}[$timestamp] Progress: [${CURRENT_TEST}/${TOTAL_TESTS}] ${PERCENT}%${NC}"
}

# JSON helper
json_escape() {
    echo "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n'
}

################################################################################
# Initialize Reports
################################################################################

initialize_reports() {
    local start_time=$(date '+%Y-%m-%d %H:%M:%S %Z')
    print_header "Initializing Benchmark Reports"
    
    local mode_text="Full Benchmark"
    if [ "$QUICK_MODE" = true ]; then
        mode_text="Quick Benchmark"
    fi
    
    # Markdown header
    cat > "${REPORT_MD}" << EOF
# Sports Bar TV Controller - System Benchmark Report

**Generated:** ${start_time}
**Mode:** ${mode_text}
**System:** Current Production System
**Purpose:** Track system performance over time

---

## Executive Summary

This report provides ${mode_text,,} performance metrics for the Sports Bar TV Controller system.

EOF

    # JSON header
    cat > "${REPORT_JSON}" << EOF
{
  "benchmark_metadata": {
    "timestamp": "$(date -Iseconds)",
    "mode": "${mode_text}",
    "quick_mode": ${QUICK_MODE},
    "system": "Sports Bar TV Controller"
  },
EOF

    print_success "Report files initialized"
    echo "  Markdown: ${REPORT_MD}"
    echo "  JSON: ${REPORT_JSON}"
}

################################################################################
# 1. Hardware Specifications
################################################################################

collect_hardware_specs() {
    print_header "1. Hardware Specifications"
    update_progress
    
    print_section "Collecting hardware information..."
    
    # CPU Info
    CPU_MODEL=$(lscpu | grep "Model name" | cut -d':' -f2 | xargs)
    CPU_CORES=$(nproc)
    CPU_THREADS=$(lscpu | grep "^CPU(s):" | awk '{print $2}')
    CPU_FREQ=$(lscpu | grep "CPU MHz" | awk '{print $3}' | head -1)
    
    # Memory Info
    TOTAL_RAM=$(free -h | grep "Mem:" | awk '{print $2}')
    AVAILABLE_RAM=$(free -h | grep "Mem:" | awk '{print $7}')
    
    # Disk Info
    DISK_MODEL=$(lsblk -d -o name,model | grep -v "loop" | tail -1 | awk '{$1=""; print $0}' | xargs)
    DISK_SIZE=$(df -h / | tail -1 | awk '{print $2}')
    DISK_USED=$(df -h / | tail -1 | awk '{print $3}')
    DISK_AVAIL=$(df -h / | tail -1 | awk '{print $4}')
    
    # GPU Info (if available)
    if command -v lspci &> /dev/null; then
        GPU_INFO=$(lspci | grep -i vga | cut -d':' -f3 | xargs || echo "Not detected")
    else
        GPU_INFO="lspci not available"
    fi
    
    # Network Info
    NETWORK_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
    NETWORK_SPEED=$(ethtool "${NETWORK_INTERFACE}" 2>/dev/null | grep "Speed:" | awk '{print $2}' || echo "Unknown")
    
    # OS Info
    OS_VERSION=$(lsb_release -d | cut -f2)
    KERNEL_VERSION=$(uname -r)
    
    # Write to markdown
    cat >> "${REPORT_MD}" << EOF
## Hardware Specifications

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### CPU
- **Model:** ${CPU_MODEL}
- **Cores:** ${CPU_CORES}
- **Threads:** ${CPU_THREADS}
- **Current Frequency:** ${CPU_FREQ} MHz

### Memory
- **Total RAM:** ${TOTAL_RAM}
- **Available RAM:** ${AVAILABLE_RAM}

### Storage
- **Model:** ${DISK_MODEL}
- **Total Size:** ${DISK_SIZE}
- **Used:** ${DISK_USED}
- **Available:** ${DISK_AVAIL}

### Graphics
- **GPU:** ${GPU_INFO}

### Network
- **Interface:** ${NETWORK_INTERFACE}
- **Speed:** ${NETWORK_SPEED}

### Operating System
- **Distribution:** ${OS_VERSION}
- **Kernel:** ${KERNEL_VERSION}

EOF

    # Write to JSON
    cat >> "${REPORT_JSON}" << EOF
  "hardware": {
    "timestamp": "$(date -Iseconds)",
    "cpu": {
      "model": "${CPU_MODEL}",
      "cores": ${CPU_CORES},
      "threads": ${CPU_THREADS},
      "frequency_mhz": "${CPU_FREQ}"
    },
    "memory": {
      "total": "${TOTAL_RAM}",
      "available": "${AVAILABLE_RAM}"
    },
    "storage": {
      "model": "${DISK_MODEL}",
      "total": "${DISK_SIZE}",
      "used": "${DISK_USED}",
      "available": "${DISK_AVAIL}"
    },
    "gpu": "${GPU_INFO}",
    "network": {
      "interface": "${NETWORK_INTERFACE}",
      "speed": "${NETWORK_SPEED}"
    },
    "os": {
      "distribution": "${OS_VERSION}",
      "kernel": "${KERNEL_VERSION}"
    }
  },
EOF

    print_success "Hardware specifications collected"
}

################################################################################
# 2. CPU Performance Tests
################################################################################

test_cpu_performance() {
    print_header "2. CPU Performance Tests"
    
    if [ "$QUICK_MODE" = true ]; then
        print_section "Quick CPU test (single-core only)..."
        update_progress
        
        # Quick single-core test only
        SINGLE_CORE_TIME=$(sysbench cpu --cpu-max-prime=10000 --threads=1 run 2>/dev/null | grep "total time:" | awk '{print $3}' | sed 's/s//')
        
        cat >> "${REPORT_MD}" << EOF
## CPU Performance (Quick Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Single-Core Performance
- **Prime calculation (10000):** ${SINGLE_CORE_TIME}s

EOF

        cat >> "${REPORT_JSON}" << EOF
  "cpu_performance": {
    "timestamp": "$(date -Iseconds)",
    "mode": "quick",
    "single_core_time": "${SINGLE_CORE_TIME}"
  },
EOF
    else
        print_section "Running comprehensive CPU tests..."
        update_progress
        
        # Single-core test
        print_section "Single-core test..."
        SINGLE_CORE_TIME=$(sysbench cpu --cpu-max-prime=20000 --threads=1 run 2>/dev/null | grep "total time:" | awk '{print $3}' | sed 's/s//')
        update_progress
        
        # Multi-core test
        print_section "Multi-core test..."
        MULTI_CORE_TIME=$(sysbench cpu --cpu-max-prime=20000 --threads=${CPU_CORES} run 2>/dev/null | grep "total time:" | awk '{print $3}' | sed 's/s//')
        update_progress
        
        # Compression test
        print_section "Compression test..."
        dd if=/dev/zero bs=1M count=100 2>/dev/null | gzip -c > "${TEMP_DIR}/test.gz"
        COMPRESS_TIME=$(stat -c%Y "${TEMP_DIR}/test.gz")
        update_progress
        
        cat >> "${REPORT_MD}" << EOF
## CPU Performance (Full Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Single-Core Performance
- **Prime calculation (20000):** ${SINGLE_CORE_TIME}s

### Multi-Core Performance
- **Prime calculation (20000, ${CPU_CORES} threads):** ${MULTI_CORE_TIME}s
- **Speedup:** $(echo "scale=2; ${SINGLE_CORE_TIME}/${MULTI_CORE_TIME}" | bc)x

### Compression Performance
- **100MB gzip compression:** Completed

EOF

        cat >> "${REPORT_JSON}" << EOF
  "cpu_performance": {
    "timestamp": "$(date -Iseconds)",
    "mode": "full",
    "single_core_time": "${SINGLE_CORE_TIME}",
    "multi_core_time": "${MULTI_CORE_TIME}",
    "compression_completed": true
  },
EOF
    fi
    
    print_success "CPU performance tests completed"
}

################################################################################
# 3. Disk I/O Performance
################################################################################

test_disk_performance() {
    print_header "3. Disk I/O Performance"
    
    if [ "$QUICK_MODE" = true ]; then
        print_section "Quick disk I/O test..."
        update_progress
        
        # Quick sequential write test only
        WRITE_SPEED=$(dd if=/dev/zero of="${TEMP_DIR}/testfile" bs=1M count=100 oflag=direct 2>&1 | grep -oP '\d+\.?\d* MB/s' | tail -1)
        rm -f "${TEMP_DIR}/testfile"
        
        cat >> "${REPORT_MD}" << EOF
## Disk I/O Performance (Quick Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Sequential Write
- **Speed:** ${WRITE_SPEED}

EOF

        cat >> "${REPORT_JSON}" << EOF
  "disk_performance": {
    "timestamp": "$(date -Iseconds)",
    "mode": "quick",
    "sequential_write": "${WRITE_SPEED}"
  },
EOF
    else
        print_section "Running comprehensive disk I/O tests..."
        update_progress
        
        # Sequential write
        print_section "Sequential write test..."
        WRITE_SPEED=$(dd if=/dev/zero of="${TEMP_DIR}/testfile" bs=1M count=500 oflag=direct 2>&1 | grep -oP '\d+\.?\d* MB/s' | tail -1)
        update_progress
        
        # Sequential read
        print_section "Sequential read test..."
        READ_SPEED=$(dd if="${TEMP_DIR}/testfile" of=/dev/null bs=1M iflag=direct 2>&1 | grep -oP '\d+\.?\d* MB/s' | tail -1)
        update_progress
        
        # Random I/O
        print_section "Random I/O test..."
        RANDOM_READ=$(sysbench fileio --file-total-size=1G --file-test-mode=rndrd --time=10 prepare > /dev/null 2>&1 && \
                      sysbench fileio --file-total-size=1G --file-test-mode=rndrd --time=10 run 2>/dev/null | \
                      grep "read, MiB/s:" | awk '{print $3}')
        sysbench fileio --file-total-size=1G cleanup > /dev/null 2>&1
        update_progress
        
        rm -f "${TEMP_DIR}/testfile"
        
        cat >> "${REPORT_MD}" << EOF
## Disk I/O Performance (Full Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Sequential Performance
- **Write Speed:** ${WRITE_SPEED}
- **Read Speed:** ${READ_SPEED}

### Random Read Performance
- **Speed:** ${RANDOM_READ} MiB/s

EOF

        cat >> "${REPORT_JSON}" << EOF
  "disk_performance": {
    "timestamp": "$(date -Iseconds)",
    "mode": "full",
    "sequential_write": "${WRITE_SPEED}",
    "sequential_read": "${READ_SPEED}",
    "random_read_mibs": "${RANDOM_READ}"
  },
EOF
    fi
    
    print_success "Disk I/O tests completed"
}

################################################################################
# 4. Memory Performance
################################################################################

test_memory_performance() {
    print_header "4. Memory Performance"
    
    if [ "$QUICK_MODE" = true ]; then
        print_section "Quick memory test..."
        update_progress
        
        # Quick memory test
        MEM_SPEED=$(sysbench memory --memory-total-size=1G run 2>/dev/null | grep "total time:" | awk '{print $3}' | sed 's/s//')
        
        cat >> "${REPORT_MD}" << EOF
## Memory Performance (Quick Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Memory Speed
- **1GB test time:** ${MEM_SPEED}s

EOF

        cat >> "${REPORT_JSON}" << EOF
  "memory_performance": {
    "timestamp": "$(date -Iseconds)",
    "mode": "quick",
    "test_time": "${MEM_SPEED}"
  },
EOF
    else
        print_section "Running memory bandwidth tests..."
        update_progress
        
        MEM_SPEED=$(sysbench memory --memory-total-size=10G run 2>/dev/null | grep "total time:" | awk '{print $3}' | sed 's/s//')
        MEM_OPS=$(sysbench memory --memory-total-size=10G run 2>/dev/null | grep "total number of events:" | awk '{print $5}')
        update_progress
        
        cat >> "${REPORT_MD}" << EOF
## Memory Performance (Full Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Memory Bandwidth
- **10GB test time:** ${MEM_SPEED}s
- **Total operations:** ${MEM_OPS}

EOF

        cat >> "${REPORT_JSON}" << EOF
  "memory_performance": {
    "timestamp": "$(date -Iseconds)",
    "mode": "full",
    "test_time": "${MEM_SPEED}",
    "total_operations": "${MEM_OPS}"
  },
EOF
    fi
    
    print_success "Memory performance tests completed"
}

################################################################################
# 5. PostgreSQL Performance
################################################################################

test_postgresql_performance() {
    print_header "5. PostgreSQL Performance"
    update_progress
    
    print_section "Testing PostgreSQL connection and performance..."
    
    # Check if PostgreSQL is running
    if ! pgrep -x postgres > /dev/null; then
        print_warning "PostgreSQL is not running"
        
        cat >> "${REPORT_MD}" << EOF
## PostgreSQL Performance

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

**Status:** Not running

EOF

        cat >> "${REPORT_JSON}" << EOF
  "postgresql_performance": {
    "timestamp": "$(date -Iseconds)",
    "status": "not_running"
  },
EOF
        return
    fi
    
    # Get PostgreSQL version
    PG_VERSION=$(psql --version | awk '{print $3}')
    
    # Test connection time
    CONNECTION_TIME=$(time (psql -U postgres -c "SELECT 1;" > /dev/null 2>&1) 2>&1 | grep real | awk '{print $2}')
    
    if [ "$QUICK_MODE" = false ]; then
        # Query performance test (full mode only)
        QUERY_TIME=$(psql -U postgres -c "SELECT COUNT(*) FROM pg_stat_activity;" 2>/dev/null | grep "Time:" | awk '{print $2}')
        update_progress
    fi
    
    cat >> "${REPORT_MD}" << EOF
## PostgreSQL Performance

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Database Info
- **Version:** ${PG_VERSION}
- **Status:** Running
- **Connection Time:** ${CONNECTION_TIME}

EOF

    if [ "$QUICK_MODE" = false ]; then
        cat >> "${REPORT_MD}" << EOF
### Query Performance
- **Simple query time:** ${QUERY_TIME}ms

EOF
    fi

    cat >> "${REPORT_JSON}" << EOF
  "postgresql_performance": {
    "timestamp": "$(date -Iseconds)",
    "version": "${PG_VERSION}",
    "status": "running",
    "connection_time": "${CONNECTION_TIME}"
EOF

    if [ "$QUICK_MODE" = false ]; then
        cat >> "${REPORT_JSON}" << EOF
,
    "query_time_ms": "${QUERY_TIME}"
EOF
    fi

    cat >> "${REPORT_JSON}" << EOF
  },
EOF
    
    print_success "PostgreSQL tests completed"
}

################################################################################
# 6. Ollama AI Performance
################################################################################

test_ollama_performance() {
    print_header "6. Ollama AI Performance"
    update_progress
    
    print_section "Testing Ollama AI service..."
    
    # Check if Ollama is running
    if ! pgrep -x ollama > /dev/null; then
        print_warning "Ollama is not running"
        
        cat >> "${REPORT_MD}" << EOF
## Ollama AI Performance

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

**Status:** Not running

EOF

        cat >> "${REPORT_JSON}" << EOF
  "ollama_performance": {
    "timestamp": "$(date -Iseconds)",
    "status": "not_running"
  },
EOF
        return
    fi
    
    # Get available models
    MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name' 2>/dev/null || echo "Unable to fetch models")
    
    # Get the first available model
    FIRST_MODEL=$(echo "$MODELS" | head -1)
    
    if [ -n "${FIRST_MODEL}" ] && [ "${FIRST_MODEL}" != "Unable to fetch models" ]; then
        print_section "Testing with model: ${FIRST_MODEL}"
        
        if [ "$QUICK_MODE" = true ]; then
            # Quick test - single simple query
            START_TIME=$(date +%s%N)
            RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"What is 2+2?\", \"stream\": false}" | jq -r '.response' 2>/dev/null)
            END_TIME=$(date +%s%N)
            RESPONSE_TIME=$(echo "scale=3; ($END_TIME - $START_TIME) / 1000000000" | bc)
            update_progress
            
            cat >> "${REPORT_MD}" << EOF
## Ollama AI Performance (Quick Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Service Info
- **Status:** Running
- **Model:** ${FIRST_MODEL}

### Performance
- **Simple query response time:** ${RESPONSE_TIME}s

EOF

            cat >> "${REPORT_JSON}" << EOF
  "ollama_performance": {
    "timestamp": "$(date -Iseconds)",
    "status": "running",
    "model": "${FIRST_MODEL}",
    "mode": "quick",
    "response_time": "${RESPONSE_TIME}"
  },
EOF
        else
            # Full test - multiple queries
            START_TIME=$(date +%s%N)
            RESPONSE1=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"What is 2+2?\", \"stream\": false}" | jq -r '.response' 2>/dev/null)
            END_TIME=$(date +%s%N)
            RESPONSE_TIME1=$(echo "scale=3; ($END_TIME - $START_TIME) / 1000000000" | bc)
            update_progress
            
            START_TIME=$(date +%s%N)
            RESPONSE2=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"Explain what a sports bar is in one sentence.\", \"stream\": false}" | jq -r '.response' 2>/dev/null)
            END_TIME=$(date +%s%N)
            RESPONSE_TIME2=$(echo "scale=3; ($END_TIME - $START_TIME) / 1000000000" | bc)
            update_progress
            
            START_TIME=$(date +%s%N)
            RESPONSE3=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"List three popular sports shown in sports bars.\", \"stream\": false}" | jq -r '.response' 2>/dev/null)
            END_TIME=$(date +%s%N)
            RESPONSE_TIME3=$(echo "scale=3; ($END_TIME - $START_TIME) / 1000000000" | bc)
            update_progress
            
            # Token generation rate
            TOKENS=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"Count to 10.\", \"stream\": false}" | jq -r '.eval_count' 2>/dev/null || echo "N/A")
            EVAL_DURATION=$(curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"${FIRST_MODEL}\", \"prompt\": \"Count to 10.\", \"stream\": false}" | jq -r '.eval_duration' 2>/dev/null || echo "0")
            
            if [ "$EVAL_DURATION" != "0" ] && [ "$TOKENS" != "N/A" ]; then
                TOKENS_PER_SEC=$(echo "scale=2; $TOKENS / ($EVAL_DURATION / 1000000000)" | bc)
            else
                TOKENS_PER_SEC="N/A"
            fi
            update_progress
            
            cat >> "${REPORT_MD}" << EOF
## Ollama AI Performance (Full Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Service Info
- **Status:** Running
- **Available Models:** 
$(echo "$MODELS" | sed 's/^/  - /')

### Performance Tests (Model: ${FIRST_MODEL})
- **Simple math query:** ${RESPONSE_TIME1}s
- **Descriptive query:** ${RESPONSE_TIME2}s
- **List generation query:** ${RESPONSE_TIME3}s
- **Token generation rate:** ${TOKENS_PER_SEC} tokens/sec

EOF

            cat >> "${REPORT_JSON}" << EOF
  "ollama_performance": {
    "timestamp": "$(date -Iseconds)",
    "status": "running",
    "models": $(echo "$MODELS" | jq -R . | jq -s .),
    "mode": "full",
    "test_model": "${FIRST_MODEL}",
    "response_times": {
      "simple_math": "${RESPONSE_TIME1}",
      "descriptive": "${RESPONSE_TIME2}",
      "list_generation": "${RESPONSE_TIME3}"
    },
    "tokens_per_second": "${TOKENS_PER_SEC}"
  },
EOF
        fi
    else
        print_warning "No models available for testing"
        
        cat >> "${REPORT_MD}" << EOF
## Ollama AI Performance

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

**Status:** Running (no models available)

EOF

        cat >> "${REPORT_JSON}" << EOF
  "ollama_performance": {
    "timestamp": "$(date -Iseconds)",
    "status": "running_no_models"
  },
EOF
    fi
    
    print_success "Ollama AI tests completed"
}

################################################################################
# 7. Next.js Application Performance
################################################################################

test_nextjs_performance() {
    print_header "7. Next.js Application Performance"
    update_progress
    
    print_section "Testing Next.js application..."
    
    # Check if PM2 is running the app
    if ! pm2 list | grep -q "sports-bar-tv-controller.*online"; then
        print_warning "Application is not running in PM2"
        
        cat >> "${REPORT_MD}" << EOF
## Next.js Application Performance

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

**Status:** Not running

EOF

        cat >> "${REPORT_JSON}" << EOF
  "nextjs_performance": {
    "timestamp": "$(date -Iseconds)",
    "status": "not_running"
  },
EOF
        return
    fi
    
    # Get PM2 info
    PM2_UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="sports-bar-tv-controller") | .pm2_env.pm_uptime' 2>/dev/null || echo "0")
    PM2_RESTARTS=$(pm2 jlist | jq -r '.[] | select(.name=="sports-bar-tv-controller") | .pm2_env.restart_time' 2>/dev/null || echo "0")
    
    # Test response time
    if [ "$QUICK_MODE" = true ]; then
        # Quick test - single request
        RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:3000 2>/dev/null || echo "N/A")
        update_progress
        
        cat >> "${REPORT_MD}" << EOF
## Next.js Application Performance (Quick Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### PM2 Status
- **Status:** Running
- **Uptime:** $(date -d @$((PM2_UPTIME/1000)) -u +%H:%M:%S)
- **Restarts:** ${PM2_RESTARTS}

### Performance
- **Response time:** ${RESPONSE_TIME}s

EOF

        cat >> "${REPORT_JSON}" << EOF
  "nextjs_performance": {
    "timestamp": "$(date -Iseconds)",
    "status": "running",
    "mode": "quick",
    "pm2_uptime_ms": ${PM2_UPTIME},
    "pm2_restarts": ${PM2_RESTARTS},
    "response_time": "${RESPONSE_TIME}"
  },
EOF
    else
        # Full test - multiple requests
        RESPONSE_TIME1=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:3000 2>/dev/null || echo "N/A")
        update_progress
        RESPONSE_TIME2=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:3000/api/health 2>/dev/null || echo "N/A")
        update_progress
        RESPONSE_TIME3=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:3000 2>/dev/null || echo "N/A")
        update_progress
        
        # Calculate average
        if [ "$RESPONSE_TIME1" != "N/A" ] && [ "$RESPONSE_TIME2" != "N/A" ] && [ "$RESPONSE_TIME3" != "N/A" ]; then
            AVG_RESPONSE=$(echo "scale=3; ($RESPONSE_TIME1 + $RESPONSE_TIME2 + $RESPONSE_TIME3) / 3" | bc)
        else
            AVG_RESPONSE="N/A"
        fi
        
        cat >> "${REPORT_MD}" << EOF
## Next.js Application Performance (Full Mode)

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### PM2 Status
- **Status:** Running
- **Uptime:** $(date -d @$((PM2_UPTIME/1000)) -u +%H:%M:%S)
- **Restarts:** ${PM2_RESTARTS}

### Response Times
- **Homepage (1st):** ${RESPONSE_TIME1}s
- **API endpoint:** ${RESPONSE_TIME2}s
- **Homepage (2nd):** ${RESPONSE_TIME3}s
- **Average:** ${AVG_RESPONSE}s

EOF

        cat >> "${REPORT_JSON}" << EOF
  "nextjs_performance": {
    "timestamp": "$(date -Iseconds)",
    "status": "running",
    "mode": "full",
    "pm2_uptime_ms": ${PM2_UPTIME},
    "pm2_restarts": ${PM2_RESTARTS},
    "response_times": {
      "homepage_1": "${RESPONSE_TIME1}",
      "api_endpoint": "${RESPONSE_TIME2}",
      "homepage_2": "${RESPONSE_TIME3}",
      "average": "${AVG_RESPONSE}"
    }
  },
EOF
    fi
    
    print_success "Next.js application tests completed"
}

################################################################################
# 8. System Health Checks
################################################################################

check_system_health() {
    print_header "8. System Health Checks"
    update_progress
    
    print_section "Checking system health..."
    
    # CPU temperature (if available)
    if command -v sensors &> /dev/null; then
        CPU_TEMP=$(sensors 2>/dev/null | grep -i "Core 0" | awk '{print $3}' | head -1 || echo "N/A")
    else
        CPU_TEMP="sensors not available"
    fi
    
    # Load average
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    
    # Top processes by CPU
    TOP_CPU=$(ps aux --sort=-%cpu | head -6 | tail -5 | awk '{printf "  - %s (%.1f%%)\n", $11, $3}')
    
    # Top processes by memory
    TOP_MEM=$(ps aux --sort=-%mem | head -6 | tail -5 | awk '{printf "  - %s (%.1f%%)\n", $11, $4}')
    
    # Disk health (SMART if available)
    if command -v smartctl &> /dev/null; then
        DISK_HEALTH=$(sudo smartctl -H /dev/sda 2>/dev/null | grep "SMART overall-health" | awk '{print $NF}' || echo "N/A")
    else
        DISK_HEALTH="smartctl not available"
    fi
    
    cat >> "${REPORT_MD}" << EOF
## System Health

**Timestamp:** $(date '+%Y-%m-%d %H:%M:%S')

### Temperature
- **CPU:** ${CPU_TEMP}

### Load Average
- **1/5/15 min:** ${LOAD_AVG}

### Top Processes (CPU)
${TOP_CPU}

### Top Processes (Memory)
${TOP_MEM}

### Disk Health
- **Status:** ${DISK_HEALTH}

EOF

    cat >> "${REPORT_JSON}" << EOF
  "system_health": {
    "timestamp": "$(date -Iseconds)",
    "cpu_temperature": "${CPU_TEMP}",
    "load_average": "${LOAD_AVG}",
    "disk_health": "${DISK_HEALTH}"
  }
}
EOF
    
    print_success "System health checks completed"
}

################################################################################
# Generate Final Reports
################################################################################

finalize_reports() {
    print_header "Finalizing Reports"
    
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Add footer to markdown
    cat >> "${REPORT_MD}" << EOF

---

## Benchmark Complete

**Completed:** ${end_time}
**Mode:** $([ "$QUICK_MODE" = true ] && echo "Quick" || echo "Full")
**Duration:** Approximately $([ "$QUICK_MODE" = true ] && echo "5" || echo "15-20") minutes

### Notes
- All tests were run on a live production system
- Results may vary based on system load
- Compare with future benchmarks to track performance trends

### Next Steps
1. Review the metrics above
2. Save this report for future comparison
3. Run benchmarks after system changes to measure impact
4. Use quick mode (--quick) for regular monitoring

EOF

    print_success "Reports finalized"
    echo ""
    echo "📊 Benchmark reports generated:"
    echo "   Markdown: ${REPORT_MD}"
    echo "   JSON: ${REPORT_JSON}"
    echo ""
    echo "💡 View report: cat ${REPORT_MD}"
    echo "💡 Compare later: diff ${REPORT_MD} <new-report>"
}

################################################################################
# Main Execution
################################################################################

main() {
    local start_time=$(date +%s)
    
    print_header "Sports Bar TV Controller - System Benchmark"
    
    if [ "$QUICK_MODE" = true ]; then
        echo "Running in QUICK mode (~5 minutes)"
    else
        echo "Running in FULL mode (~15-20 minutes)"
    fi
    
    echo ""
    
    # Initialize reports
    initialize_reports
    
    # Run all tests
    collect_hardware_specs
    test_cpu_performance
    test_disk_performance
    test_memory_performance
    test_postgresql_performance
    test_ollama_performance
    test_nextjs_performance
    check_system_health
    
    # Finalize reports
    finalize_reports
    
    # Clean up temp directory
    rm -rf "${TEMP_DIR}"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    print_header "Benchmark Complete!"
    echo "Total time: ${minutes}m ${seconds}s"
    echo ""
}

# Run main function
main
