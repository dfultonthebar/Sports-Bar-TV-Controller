#!/bin/bash
# Quick test of AI setup logic from update_from_github.sh

echo "🧪 Testing AI Setup Logic..."
echo ""

# Test 1: Check Ollama installation
echo "Test 1: Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "   ❌ Ollama not installed (will be installed by update script)"
else
    echo "   ✅ Ollama is installed"
    ollama --version
fi

# Test 2: Check if service is running
echo ""
echo "Test 2: Checking Ollama service..."
if pgrep -x "ollama" > /dev/null; then
    echo "   ✅ Ollama service is running"
else
    echo "   ⚠️  Ollama service not running (will be started by update script)"
fi

# Test 3: Check for required models
echo ""
echo "Test 3: Checking required models..."
REQUIRED_MODELS=("llama3.2" "llama2" "mistral")

if command -v ollama &> /dev/null; then
    for MODEL in "${REQUIRED_MODELS[@]}"; do
        if ollama list 2>/dev/null | grep -q "^$MODEL"; then
            echo "   ✅ $MODEL is available"
        else
            echo "   ❌ $MODEL not found (will be downloaded by update script)"
        fi
    done
else
    echo "   ⚠️  Cannot check models - Ollama not installed"
fi

# Test 4: Check scripts
echo ""
echo "Test 4: Checking AI scripts..."
if [ -f "scripts/ai-style-analyzer.js" ]; then
    echo "   ✅ AI style analyzer found"
else
    echo "   ❌ AI style analyzer missing"
fi

if [ -f "scripts/run-style-analysis.sh" ]; then
    echo "   ✅ Style analysis runner found"
else
    echo "   ❌ Style analysis runner missing"
fi

# Test 5: Check documentation
echo ""
echo "Test 5: Checking documentation..."
if [ -f "AI_MODELS_SETUP.md" ]; then
    echo "   ✅ AI models documentation found"
else
    echo "   ❌ AI models documentation missing"
fi

if [ -f "COLOR_SCHEME_STANDARD.md" ]; then
    echo "   ✅ Color scheme standard found"
else
    echo "   ❌ Color scheme standard missing"
fi

echo ""
echo "=================================================="
echo "🎯 Summary:"
echo ""
echo "When you run './update_from_github.sh', it will:"
echo "  1. Pull latest code from GitHub"
echo "  2. Install Ollama (if needed)"
echo "  3. Start Ollama service (if needed)"
echo "  4. Download all required models:"
for MODEL in "${REQUIRED_MODELS[@]}"; do
    echo "     - $MODEL"
done
echo "  5. Verify everything is working"
echo ""
echo "No manual intervention required! 🚀"
