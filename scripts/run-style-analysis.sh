
#!/bin/bash

# Color Scheme Standardization Runner
# This script helps you run the AI-powered style analysis and fixing tools

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🎨 Sports Bar AI Assistant - Color Scheme Standardization"
echo "=========================================================="
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed"
    echo ""
    echo "To install Ollama, run:"
    echo "  curl -fsSL https://ollama.ai/install.sh | sh"
    echo ""
    echo "Or use the local AI installation script:"
    echo "  cd $PROJECT_DIR"
    echo "  ./install-local-ai.sh"
    exit 1
fi

echo "✅ Ollama is installed"
echo ""

# Check if Ollama is running
if ! ollama list &> /dev/null; then
    echo "❌ Ollama is not running"
    echo ""
    echo "Start Ollama with:"
    echo "  ollama serve"
    exit 1
fi

echo "✅ Ollama is running"
echo ""

# Show menu
echo "What would you like to do?"
echo ""
echo "  1. Analyze all components (recommended first step)"
echo "  2. Apply fixes from latest report"
echo "  3. View available reports"
echo "  4. Read documentation"
echo "  5. Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🔍 Running analysis..."
        echo ""
        cd "$PROJECT_DIR"
        node scripts/ai-style-analyzer.js
        ;;
    2)
        echo ""
        # Find the latest report
        LATEST_REPORT=$(ls -t "$PROJECT_DIR/ai-style-reports"/style-analysis-*.json 2>/dev/null | head -1)
        
        if [ -z "$LATEST_REPORT" ]; then
            echo "❌ No analysis reports found"
            echo ""
            echo "Run option 1 first to analyze components"
            exit 1
        fi
        
        echo "📊 Using report: $(basename "$LATEST_REPORT")"
        echo ""
        cd "$PROJECT_DIR"
        node scripts/ai-style-fixer.js "$LATEST_REPORT"
        ;;
    3)
        echo ""
        echo "📋 Available reports:"
        echo ""
        ls -lht "$PROJECT_DIR/ai-style-reports"/style-analysis-*.json 2>/dev/null || echo "No reports found"
        echo ""
        ;;
    4)
        echo ""
        echo "📖 Documentation files:"
        echo ""
        echo "  • COLOR_SCHEME_STANDARD.md - Style guide"
        echo "  • AI_STYLE_STANDARDIZATION.md - Tool documentation"
        echo ""
        echo "To view:"
        echo "  cat $PROJECT_DIR/COLOR_SCHEME_STANDARD.md"
        echo "  cat $PROJECT_DIR/AI_STYLE_STANDARDIZATION.md"
        echo ""
        ;;
    5)
        echo ""
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo ""
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
