#!/bin/bash

# Fix PM2 PATH issue
# This script adds PM2 to the system PATH permanently

set -e

echo "🔧 Fixing PM2 PATH configuration..."
echo ""

# Check if PM2 is installed
if ! npm list -g pm2 &>/dev/null; then
    echo "❌ PM2 is not installed globally"
    echo "   Installing PM2..."
    npm install -g pm2
fi

# Get npm global bin path
NPM_GLOBAL_BIN=$(npm bin -g)
echo "📍 NPM global bin path: $NPM_GLOBAL_BIN"

# Check if already in PATH
if echo "$PATH" | grep -q "$NPM_GLOBAL_BIN"; then
    echo "✅ PM2 is already in PATH"
else
    echo "➕ Adding PM2 to PATH..."
    
    # Add to .bashrc
    if ! grep -q "npm bin -g" ~/.bashrc; then
        echo "" >> ~/.bashrc
        echo "# Add npm global binaries to PATH" >> ~/.bashrc
        echo 'export PATH="$(npm bin -g):$PATH"' >> ~/.bashrc
        echo "✅ Added to ~/.bashrc"
    fi
    
    # Add to .profile
    if ! grep -q "npm bin -g" ~/.profile; then
        echo "" >> ~/.profile
        echo "# Add npm global binaries to PATH" >> ~/.profile
        echo 'export PATH="$(npm bin -g):$PATH"' >> ~/.profile
        echo "✅ Added to ~/.profile"
    fi
    
    # Export for current session
    export PATH="$NPM_GLOBAL_BIN:$PATH"
    echo "✅ Exported for current session"
fi

echo ""
echo "🧪 Testing PM2 command..."
if command -v pm2 &>/dev/null; then
    echo "✅ PM2 is now accessible: $(which pm2)"
    echo "   Version: $(pm2 --version)"
else
    echo "⚠️  PM2 not yet in PATH for this session"
    echo "   Run: source ~/.bashrc"
    echo "   Or start a new terminal session"
fi

echo ""
echo "✅ PM2 PATH fix complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Run: source ~/.bashrc"
echo "   2. Verify: pm2 --version"
echo "   3. Check PM2 processes: pm2 status"
