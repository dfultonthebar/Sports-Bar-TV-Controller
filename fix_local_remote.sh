
#!/bin/bash

echo "🔧 Fixing Local Bartender Remote Data Loading"
echo "============================================="

# Step 1: Check current data
echo "🔍 Step 1: Checking current database state..."
node debug_remote_data.js

echo ""
echo "📝 Step 2: Setting up Wolf Pack inputs if missing..."
node scripts/setup-wolfpack-inputs.js

echo ""
echo "🔍 Step 3: Verifying after setup..."
node debug_remote_data.js

echo ""
echo "🔧 Step 4: Testing API endpoint..."
echo "Matrix Config API test:"
curl -s http://localhost:3000/api/matrix/config | jq '.inputs[] | {channelNumber: .channelNumber, label: .label}' 2>/dev/null || curl -s http://localhost:3000/api/matrix/config | head -20

echo ""
echo "📱 Step 5: Testing Bartender Remote page..."
echo "Visit: http://localhost:3000/remote"
echo ""
echo "✅ Fix completed! If you still see issues:"
echo "   1. Make sure your local server is running: npm run dev"
echo "   2. Clear browser cache and refresh"
echo "   3. Check browser console for any JavaScript errors"
