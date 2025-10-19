#!/bin/bash
# Script to push changes to GitHub
# Run this on your server after configuring Git credentials

echo "Pushing changes to GitHub..."
echo ""
echo "If this is your first time, you may need to configure Git:"
echo "  git config --global user.name 'Your Name'"
echo "  git config --global user.email 'your.email@example.com'"
echo ""
echo "You'll be prompted for your GitHub username and password/token"
echo ""

git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Changes pushed successfully!"
else
    echo ""
    echo "✗ Push failed. Please check your credentials."
    echo ""
    echo "If using 2FA, you need a Personal Access Token:"
    echo "  1. Go to GitHub Settings > Developer settings > Personal access tokens"
    echo "  2. Generate new token with 'repo' scope"
    echo "  3. Use token as password when prompted"
fi
