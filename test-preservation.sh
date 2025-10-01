#!/bin/bash

# Test script to verify user data preservation
# This shows what data exists before and after an update

echo "🧪 Testing User Data Preservation"
echo "=================================="
echo ""

cd /home/ubuntu/Sports-Bar-TV-Controller

if [ ! -f "prisma/dev.db" ]; then
    echo "❌ Database not found. Run the app first to create it."
    exit 1
fi

echo "📊 Current User Data Counts:"
echo ""

# Count records in key tables
echo "Atlas Configuration:"
echo "  Inputs:  $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM MatrixInput;' 2>/dev/null || echo '0')"
echo "  Outputs: $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM MatrixOutput;' 2>/dev/null || echo '0')"
echo "  Routes:  $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM MatrixRoute;' 2>/dev/null || echo '0')"
echo "  Scenes:  $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM MatrixScene;' 2>/dev/null || echo '0')"
echo ""

echo "Devices:"
echo "  Equipment: $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM Equipment;' 2>/dev/null || echo '0')"
echo ""

echo "Audio:"
echo "  Processors: $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM AudioProcessor;' 2>/dev/null || echo '0')"
echo "  Zones:      $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM AudioZone;' 2>/dev/null || echo '0')"
echo "  Scenes:     $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM AudioScene;' 2>/dev/null || echo '0')"
echo ""

echo "System:"
echo "  Users:     $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM User;' 2>/dev/null || echo '0')"
echo "  API Keys:  $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM ApiKey;' 2>/dev/null || echo '0')"
echo "  Documents: $(sqlite3 prisma/dev.db 'SELECT COUNT(*) FROM Document;' 2>/dev/null || echo '0')"
echo ""

echo "Configuration Files:"
echo "  local.local.json exists: $([ -f config/local.local.json ] && echo '✅' || echo '❌')"
echo "  devices.local.json exists: $([ -f config/devices.local.json ] && echo '✅' || echo '❌')"
echo "  sports-teams.local.json exists: $([ -f config/sports-teams.local.json ] && echo '✅' || echo '❌')"
echo ""

echo "Environment:"
echo "  .env exists: $([ -f .env ] && echo '✅' || echo '❌')"
if [ -f .env ]; then
    echo "  Wolfpack configured: $(grep -q 'WOLFPACK_HOST' .env && echo '✅' || echo '❌')"
fi
echo ""

echo "Uploads:"
echo "  Upload directory: $([ -d uploads ] && echo '✅ exists' || echo '❌ missing')"
echo "  Files: $(find uploads -type f 2>/dev/null | wc -l)"
echo ""

echo "=================================="
echo "💡 Run ./update_from_github.sh and then run this script again"
echo "   All counts should remain the same!"

