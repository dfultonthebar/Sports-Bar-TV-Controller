#!/bin/bash

# Setup script for AI Vision API configuration
# This script helps configure OpenAI or Anthropic API keys for TV position detection

set -e

echo "================================================"
echo "  TV Position Detection - Vision API Setup"
echo "================================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file"
    else
        echo "❌ .env.example not found. Creating new .env file..."
        cat > .env << 'EOF'
# AI Vision API Keys for TV Position Detection
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Database
DATABASE_URL="file:./dev.db"

# Application
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
EOF
        echo "✅ Created new .env file"
    fi
fi

echo ""
echo "Current API Key Status:"
echo "----------------------"

# Check OpenAI key
if grep -q 'OPENAI_API_KEY="sk-' .env 2>/dev/null; then
    echo "✅ OpenAI API Key: Configured"
    OPENAI_CONFIGURED=true
else
    echo "❌ OpenAI API Key: Not configured (placeholder)"
    OPENAI_CONFIGURED=false
fi

# Check Anthropic key
if grep -q 'ANTHROPIC_API_KEY="sk-ant-' .env 2>/dev/null; then
    echo "✅ Anthropic API Key: Configured"
    ANTHROPIC_CONFIGURED=true
else
    echo "❌ Anthropic API Key: Not configured (placeholder)"
    ANTHROPIC_CONFIGURED=false
fi

echo ""

# If both are configured, we're done
if [ "$OPENAI_CONFIGURED" = true ] || [ "$ANTHROPIC_CONFIGURED" = true ]; then
    echo "✅ At least one AI vision API is configured!"
    echo ""
    echo "Your system will use AI vision to detect TV positions from layout images."
    echo ""
    exit 0
fi

# Prompt user to configure
echo "⚠️  No AI vision API keys are configured."
echo ""
echo "Without API keys, the system will use fallback grid positioning."
echo "To enable accurate TV position detection from images, you need to configure"
echo "at least one AI vision API key."
echo ""
echo "Options:"
echo "  1. OpenAI GPT-4 Vision (Recommended)"
echo "     - Get key from: https://platform.openai.com/api-keys"
echo "     - Requires GPT-4 Vision access (paid account)"
echo "     - Cost: ~$0.01-0.03 per image"
echo ""
echo "  2. Anthropic Claude Vision (Alternative)"
echo "     - Get key from: https://console.anthropic.com/settings/keys"
echo "     - Claude 3.5 Sonnet has vision capabilities"
echo "     - Cost: ~$0.01-0.02 per image"
echo ""
echo "You only need ONE of the above APIs."
echo ""

read -p "Would you like to configure an API key now? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Skipping API key configuration."
    echo "The system will use fallback grid positioning for TV layouts."
    echo ""
    echo "To configure later, run: ./scripts/setup-vision-api.sh"
    echo "Or manually edit the .env file."
    exit 0
fi

echo ""
echo "Which API would you like to configure?"
echo "  1. OpenAI GPT-4 Vision"
echo "  2. Anthropic Claude Vision"
echo ""
read -p "Enter choice (1 or 2): " -n 1 -r API_CHOICE
echo ""

if [ "$API_CHOICE" = "1" ]; then
    echo ""
    echo "Configuring OpenAI API Key"
    echo "-------------------------"
    echo "Get your API key from: https://platform.openai.com/api-keys"
    echo ""
    read -p "Enter your OpenAI API key (starts with sk-proj-): " OPENAI_KEY
    
    if [[ $OPENAI_KEY == sk-proj-* ]] || [[ $OPENAI_KEY == sk-* ]]; then
        # Update .env file
        if grep -q "OPENAI_API_KEY=" .env; then
            sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=\"$OPENAI_KEY\"|" .env
        else
            echo "OPENAI_API_KEY=\"$OPENAI_KEY\"" >> .env
        fi
        echo "✅ OpenAI API key configured successfully!"
    else
        echo "❌ Invalid API key format. OpenAI keys should start with 'sk-proj-' or 'sk-'"
        exit 1
    fi
    
elif [ "$API_CHOICE" = "2" ]; then
    echo ""
    echo "Configuring Anthropic API Key"
    echo "----------------------------"
    echo "Get your API key from: https://console.anthropic.com/settings/keys"
    echo ""
    read -p "Enter your Anthropic API key (starts with sk-ant-): " ANTHROPIC_KEY
    
    if [[ $ANTHROPIC_KEY == sk-ant-* ]]; then
        # Update .env file
        if grep -q "ANTHROPIC_API_KEY=" .env; then
            sed -i "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=\"$ANTHROPIC_KEY\"|" .env
        else
            echo "ANTHROPIC_API_KEY=\"$ANTHROPIC_KEY\"" >> .env
        fi
        echo "✅ Anthropic API key configured successfully!"
    else
        echo "❌ Invalid API key format. Anthropic keys should start with 'sk-ant-'"
        exit 1
    fi
else
    echo "❌ Invalid choice. Please run the script again and select 1 or 2."
    exit 1
fi

echo ""
echo "================================================"
echo "  Configuration Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Install dependencies: npm install"
echo "  2. Build the application: npm run build"
echo "  3. Start the server: npm start"
echo ""
echo "Your system will now use AI vision to detect TV positions from layout images!"
echo ""
