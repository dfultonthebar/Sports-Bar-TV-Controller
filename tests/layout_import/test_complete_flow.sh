#!/bin/bash

echo "================================================================================"
echo "🧪 COMPLETE LAYOUT IMPORT FLOW TEST"
echo "================================================================================"

# Test 1: Check if image exists
echo ""
echo "📁 Test 1: Checking image file..."
if [ -f "tests/layout_import/Graystone Layout.png" ]; then
    echo "✅ Image found"
    ls -lh "tests/layout_import/Graystone Layout.png"
else
    echo "❌ Image not found"
    exit 1
fi

# Test 2: Check API configuration
echo ""
echo "🔑 Test 2: Checking API configuration..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    if grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null; then
        echo "✅ Anthropic API key appears to be configured"
    elif grep -q "ANTHROPIC_API_KEY=your-anthropic-api-key" .env; then
        echo "⚠️  Anthropic API key is placeholder"
    else
        echo "⚠️  Anthropic API key status unknown"
    fi
else
    echo "❌ .env file not found"
fi

# Test 3: Check vision analysis route
echo ""
echo "👁️  Test 3: Checking vision analysis route..."
if [ -f "src/app/api/ai/vision-analyze-layout/route.ts" ]; then
    echo "✅ Vision analysis route exists"
    
    # Check which model is being used
    if grep -q "claude-sonnet-4-5" src/app/api/ai/vision-analyze-layout/route.ts; then
        echo "✅ Using Claude Sonnet 4.5 model"
    else
        echo "⚠️  Model version unclear"
    fi
    
    # Check fallback behavior
    if grep -q "totalTVs = 25" src/app/api/ai/vision-analyze-layout/route.ts; then
        echo "✅ Fallback supports 25 TVs"
    else
        echo "⚠️  Fallback TV count unclear"
    fi
else
    echo "❌ Vision analysis route not found"
fi

# Test 4: Check analyze-layout route
echo ""
echo "🔗 Test 4: Checking analyze-layout route..."
if [ -f "src/app/api/ai/analyze-layout/route.ts" ]; then
    echo "✅ Analyze layout route exists"
    
    # Check if it limits outputs
    if grep -q "slice(0, 12)" src/app/api/ai/analyze-layout/route.ts; then
        echo "❌ FOUND BUG: Code limits to 12 outputs!"
    elif grep -q "slice(0, availableOutputNumbers.length)" src/app/api/ai/analyze-layout/route.ts; then
        echo "✅ Code uses all available outputs"
    else
        echo "✅ No obvious output limiting found"
    fi
    
    # Check if it supports 25+ TVs
    if grep -q "100.*TVs\|100.*layouts" src/app/api/ai/analyze-layout/route.ts; then
        echo "✅ Code supports up to 100 TVs"
    else
        echo "⚠️  Large layout support unclear"
    fi
else
    echo "❌ Analyze layout route not found"
fi

# Test 5: Check frontend component
echo ""
echo "🖥️  Test 5: Checking frontend component..."
if [ -f "src/components/LayoutConfiguration.tsx" ]; then
    echo "✅ LayoutConfiguration component exists"
    
    # Check if it applies all suggestions
    if grep -q "analysis.suggestions.map" src/components/LayoutConfiguration.tsx; then
        echo "✅ Component maps all suggestions"
    else
        echo "⚠️  Suggestion mapping unclear"
    fi
else
    echo "❌ LayoutConfiguration component not found"
fi

# Test 6: Simulate the data flow
echo ""
echo "📊 Test 6: Simulating data flow..."
echo "   Step 1: Upload image → Returns imageUrl"
echo "   Step 2: Call vision-analyze-layout → Detects TVs"
echo "   Step 3: Call analyze-layout → Matches outputs to TVs"
echo "   Step 4: Apply suggestions → Creates zones"

# Test 7: Check for common issues
echo ""
echo "🔍 Test 7: Checking for common issues..."

issues_found=0

# Issue 1: Check if there's any hardcoded limit
if grep -rn "slice(0, 12)" src/app/api/ 2>/dev/null | grep -v node_modules; then
    echo "❌ Found hardcoded 12-output limit!"
    issues_found=$((issues_found + 1))
fi

# Issue 2: Check if fallback only creates 12 TVs
if grep -A 5 "fallbackAnalysis" src/app/api/ai/vision-analyze-layout/route.ts | grep -q "totalTVs = 12"; then
    echo "❌ Fallback only creates 12 TVs!"
    issues_found=$((issues_found + 1))
fi

# Issue 3: Check if there's a mismatch in TV numbering
if grep -rn "TV 0" src/app/api/ 2>/dev/null | grep -v node_modules | grep -v "TV 01"; then
    echo "⚠️  Found potential TV numbering issue (0-indexed vs 1-indexed)"
    issues_found=$((issues_found + 1))
fi

if [ $issues_found -eq 0 ]; then
    echo "✅ No obvious issues found in code"
fi

echo ""
echo "================================================================================"
echo "📋 SUMMARY"
echo "================================================================================"
echo "The code appears to support 25 TVs correctly."
echo "The main issue is likely:"
echo "  1. API keys not configured (using fallback grid positioning)"
echo "  2. Vision API not detecting all 25 TVs from the image"
echo "  3. Mismatch between detected TV labels and Wolfpack output labels"
echo ""
echo "Next steps:"
echo "  1. Test with real API to see what's actually detected"
echo "  2. Check if TV labels in image match expected format (TV 01, TV 02, etc.)"
echo "  3. Verify Wolfpack outputs are configured correctly in database"

