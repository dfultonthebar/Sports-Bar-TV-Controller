#!/usr/bin/env python3
"""
Test script to verify vision analysis API
"""
import json
import base64
from pathlib import Path

# Check if the user's image exists
image_path = Path("/home/ubuntu/Uploads/Graystone Layout.png")
if not image_path.exists():
    print(f"❌ Image not found at {image_path}")
    exit(1)

print(f"✅ Found image: {image_path}")
print(f"   Size: {image_path.stat().st_size / 1024:.1f} KB")

# Read and encode image
with open(image_path, 'rb') as f:
    image_data = f.read()
    base64_image = base64.b64encode(image_data).decode('utf-8')

print(f"✅ Image encoded to base64 ({len(base64_image)} chars)")

# Check if API keys are configured
env_path = Path("/home/ubuntu/github_repos/Sports-Bar-TV-Controller/.env")
if env_path.exists():
    with open(env_path) as f:
        env_content = f.read()
        has_openai = 'OPENAI_API_KEY=' in env_content and 'your-openai-api-key' not in env_content
        has_anthropic = 'ANTHROPIC_API_KEY=' in env_content and 'your-anthropic-api-key' not in env_content
        
        print(f"\n🔑 API Keys Status:")
        print(f"   OpenAI: {'✅ Configured' if has_openai else '❌ Not configured (placeholder)'}")
        print(f"   Anthropic: {'✅ Configured' if has_anthropic else '❌ Not configured (placeholder)'}")
        
        if not has_openai and not has_anthropic:
            print(f"\n⚠️  WARNING: No AI vision API keys configured!")
            print(f"   The system will use fallback grid positioning.")
            print(f"   To enable real vision analysis, configure API keys in .env")
else:
    print("❌ .env file not found")

print("\n📊 Expected behavior:")
print("   - With API keys: AI will detect 25 TVs with accurate x/y positions from image")
print("   - Without API keys: Fallback will create 25 TVs in a grid pattern")
print("\n✅ Test preparation complete!")
