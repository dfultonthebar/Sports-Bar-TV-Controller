#!/bin/bash

# Test script for uninstall/reinstall functionality
# This script tests various scenarios without actually installing

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() {
    echo -e "\n${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

echo "=========================================="
echo "Uninstall/Reinstall Test Suite"
echo "=========================================="

# Test 1: Check if scripts exist and are executable
print_test "Test 1: Script files exist and are executable"
if [ -x "install.sh" ] && [ -x "uninstall.sh" ]; then
    print_pass "Both scripts exist and are executable"
else
    print_fail "Scripts missing or not executable"
    exit 1
fi

# Test 2: Check uninstall.sh help
print_test "Test 2: Uninstall script help"
if ./uninstall.sh --help > /dev/null 2>&1; then
    print_pass "Uninstall help works"
else
    print_fail "Uninstall help failed"
fi

# Test 3: Check install.sh help
print_test "Test 3: Install script help"
if ./install.sh --help > /dev/null 2>&1; then
    print_pass "Install help works"
else
    print_fail "Install help failed"
fi

# Test 4: Dry run uninstall
print_test "Test 4: Uninstall dry run"
if ./uninstall.sh --dry-run --yes > /tmp/uninstall-dryrun.log 2>&1; then
    print_pass "Dry run completed successfully"
    print_info "Log saved to /tmp/uninstall-dryrun.log"
else
    print_fail "Dry run failed"
fi

# Test 5: Check for required functions in uninstall.sh
print_test "Test 5: Uninstall script functions"
required_functions=(
    "stop_services"
    "remove_application"
    "remove_database"
    "remove_nodejs"
    "remove_ollama"
    "backup_data"
)

for func in "${required_functions[@]}"; do
    if grep -q "^${func}()" uninstall.sh; then
        print_pass "Function '$func' found"
    else
        print_fail "Function '$func' missing"
    fi
done

# Test 6: Check for required flags in uninstall.sh
print_test "Test 6: Uninstall script flags"
required_flags=(
    "--yes"
    "--keep-nodejs"
    "--keep-ollama"
    "--backup"
    "--dry-run"
)

for flag in "${required_flags[@]}"; do
    if grep -q "$flag" uninstall.sh; then
        print_pass "Flag '$flag' implemented"
    else
        print_fail "Flag '$flag' missing"
    fi
done

# Test 7: Check install.sh for reinstall flag
print_test "Test 7: Install script reinstall flag"
if grep -q "\-\-reinstall" install.sh; then
    print_pass "Reinstall flag found in install.sh"
else
    print_fail "Reinstall flag missing from install.sh"
fi

# Test 8: Check if install.sh calls uninstall
print_test "Test 8: Install script calls uninstall"
if grep -q "run_uninstall" install.sh; then
    print_pass "Install script has uninstall integration"
else
    print_fail "Install script missing uninstall integration"
fi

# Test 9: Check documentation
print_test "Test 9: Documentation exists"
if [ -f "UNINSTALL_GUIDE.md" ]; then
    print_pass "UNINSTALL_GUIDE.md exists"
    word_count=$(wc -w < UNINSTALL_GUIDE.md)
    print_info "Documentation has $word_count words"
else
    print_fail "UNINSTALL_GUIDE.md missing"
fi

# Test 10: Check README.md for uninstall section
print_test "Test 10: README.md has uninstall section"
if grep -q "Uninstall" README.md; then
    print_pass "README.md has uninstall section"
else
    print_fail "README.md missing uninstall section"
fi

# Test 11: Syntax check for bash scripts
print_test "Test 11: Bash syntax check"
if bash -n install.sh && bash -n uninstall.sh; then
    print_pass "Both scripts have valid bash syntax"
else
    print_fail "Syntax errors found in scripts"
fi

# Test 12: Check for logging functionality
print_test "Test 12: Logging functionality"
if grep -q "LOG_FILE=" uninstall.sh && grep -q "log()" uninstall.sh; then
    print_pass "Logging functionality implemented"
else
    print_fail "Logging functionality missing"
fi

# Summary
echo ""
echo "=========================================="
echo "Test Suite Complete"
echo "=========================================="
echo ""
print_info "Review the test results above"
print_info "Dry run log: /tmp/uninstall-dryrun.log"
echo ""
