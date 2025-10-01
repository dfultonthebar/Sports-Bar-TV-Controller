
#!/bin/bash

echo "🧪 Testing Ollama Local AI..."
echo "=============================="
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed"
    echo "   Run: ./install-local-ai.sh"
    exit 1
fi

echo "✅ Ollama is installed"
echo ""

# Check if service is running
if ! pgrep -x "ollama" > /dev/null; then
    echo "🔄 Starting Ollama service..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
fi

echo "✅ Ollama service is running"
echo ""

# List available models
echo "📋 Available AI Models:"
ollama list
echo ""

echo "✅ Ollama is working!"
echo ""
echo "💡 Try it yourself:"
echo "   ollama run llama2     # Chat with llama2"
echo "   ollama run mistral    # Chat with mistral (faster)"
echo "   ollama ps             # Show running models"
echo ""
echo "📚 For Sports Bar AI Assistant:"
echo "   1. Go to /ai-keys in your app"
echo "   2. Select 'Local AI' as your provider"
echo "   3. Choose llama2 or mistral model"
echo "   4. Test AI features without API keys!"
