
#!/bin/bash

# Ollama Installation Script for Sports Bar AI Assistant
# This script installs Ollama for local AI capabilities

set -e

echo "🤖 Installing Ollama for Local AI Support..."
echo "============================================"

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed"
    ollama --version
    
    # Check if ollama is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama service is running"
    else
        echo "⚠️  Ollama is installed but not running"
        echo "Starting Ollama service..."
        ollama serve > /dev/null 2>&1 &
        sleep 3
        echo "✅ Ollama service started"
    fi
else
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    
    echo "🚀 Starting Ollama service..."
    ollama serve > /dev/null 2>&1 &
    sleep 5
    echo "✅ Ollama service started"
fi

# Pull recommended models for sports bar use
echo ""
echo "📥 Pulling recommended AI models..."
echo "This may take a few minutes depending on your internet connection..."

# Llama 3.2 - Fast and efficient for general tasks
if ollama list | grep -q "llama3.2:3b"; then
    echo "✅ llama3.2:3b already installed"
else
    echo "📥 Pulling llama3.2:3b (lightweight, fast responses)..."
    ollama pull llama3.2:3b
    echo "✅ llama3.2:3b installed"
fi

# Alternative: Phi-3 - Very lightweight and fast
if ollama list | grep -q "phi3:mini"; then
    echo "✅ phi3:mini already installed"
else
    echo "📥 Pulling phi3:mini (ultra-lightweight)..."
    ollama pull phi3:mini
    echo "✅ phi3:mini installed"
fi

echo ""
echo "✅ Ollama installation complete!"
echo ""
echo "📊 Installed Models:"
ollama list
echo ""
echo "🔗 Ollama API: http://localhost:11434"
echo "📝 Model Endpoint: http://localhost:11434/api/generate"
echo ""
echo "💡 You can now use local AI features in the Sports Bar AI Assistant!"
echo "   The app will automatically use Ollama when available."
echo ""
echo "🔄 To stop Ollama: pkill ollama"
echo "🚀 To start Ollama: ollama serve &"
