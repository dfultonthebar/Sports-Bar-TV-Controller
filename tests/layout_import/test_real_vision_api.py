#!/usr/bin/env python3
"""
Test script to call the actual vision API and see what it detects
"""
import json
import base64
import os
from pathlib import Path
from anthropic import Anthropic

def load_image(image_path):
    """Load and encode image to base64"""
    with open(image_path, 'rb') as f:
        image_data = f.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')
    return base64_image

def call_vision_api(image_base64):
    """Call Anthropic Claude Vision API"""
    # Load API key from .env
    env_path = Path(__file__).parent.parent.parent / '.env'
    api_key = None
    
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.startswith('ANTHROPIC_API_KEY='):
                    api_key = line.split('=', 1)[1].strip()
                    break
    
    if not api_key or api_key == 'your-anthropic-api-key':
        print("❌ No valid Anthropic API key found")
        return None
    
    print(f"✅ Using Anthropic API key: {api_key[:10]}...")
    
    client = Anthropic(api_key=api_key)
    
    prompt = """Analyze this bar/restaurant floor plan layout image and detect all TV positions.

For each TV/screen/display you detect:
1. Identify the TV number or label (if visible)
2. Determine its position as a percentage from the top-left corner (x: 0-100% from left, y: 0-100% from top)
3. Provide a brief description of its location

Return your analysis as a JSON object with this exact structure:
{
  "totalTVs": <number>,
  "imageWidth": <width in pixels if detectable>,
  "imageHeight": <height in pixels if detectable>,
  "detections": [
    {
      "number": <TV number>,
      "label": "TV <number>",
      "position": {
        "x": <percentage 0-100>,
        "y": <percentage 0-100>
      },
      "confidence": <0-100>,
      "description": "<location description>"
    }
  ]
}

Important:
- Look for numbered markers, TV icons, screen symbols, or labeled positions
- Calculate positions accurately based on where the TV appears in the image
- If you see "TV 1", "1", "Marker 1", etc., use that as the number
- Be precise with x/y coordinates - they should reflect actual positions in the image
- If no numbers are visible, number them sequentially from 1
- Confidence should be 90-100 if clearly visible, 70-89 if partially visible, below 70 if uncertain"""
    
    print("🤖 Calling Claude Vision API...")
    
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    )
    
    return message

def main():
    print("=" * 80)
    print("🧪 REAL VISION API TEST - Graystone Layout")
    print("=" * 80)
    
    # Load image
    print("\n📁 Loading Graystone Layout image...")
    image_path = Path(__file__).parent / "Graystone Layout.png"
    if not image_path.exists():
        print(f"❌ Image not found at {image_path}")
        return 1
    
    image_base64 = load_image(image_path)
    print(f"✅ Image loaded and encoded ({len(image_base64)} chars)")
    
    # Call vision API
    print("\n👁️  Calling Vision API...")
    try:
        response = call_vision_api(image_base64)
        
        if not response:
            print("❌ API call failed")
            return 1
        
        print("✅ API call successful!")
        print(f"\n📄 Raw Response:")
        print(f"   Model: {response.model}")
        print(f"   Stop Reason: {response.stop_reason}")
        print(f"   Usage: {response.usage}")
        
        # Extract text content
        content = response.content[0]
        if content.type == 'text':
            print(f"\n📝 Response Text:")
            print(content.text)
            
            # Try to parse JSON
            print(f"\n🔍 Parsing JSON response...")
            import re
            json_match = re.search(r'\{[\s\S]*\}', content.text)
            if json_match:
                analysis_data = json.loads(json_match.group(0))
                
                print(f"\n✅ Parsed Analysis:")
                print(f"   Total TVs: {analysis_data.get('totalTVs', 0)}")
                print(f"   Detections: {len(analysis_data.get('detections', []))}")
                
                # Show first 10 detections
                print(f"\n📍 Detected TVs (first 10):")
                for detection in analysis_data.get('detections', [])[:10]:
                    print(f"   {detection.get('label', 'Unknown')}: "
                          f"x={detection.get('position', {}).get('x', 0):.1f}%, "
                          f"y={detection.get('position', {}).get('y', 0):.1f}% "
                          f"(confidence: {detection.get('confidence', 0)}%) - "
                          f"{detection.get('description', 'No description')}")
                
                if len(analysis_data.get('detections', [])) > 10:
                    print(f"   ... and {len(analysis_data.get('detections', [])) - 10} more")
                
                # Save results
                output_file = Path(__file__).parent / "real_vision_results.json"
                with open(output_file, 'w') as f:
                    json.dump(analysis_data, f, indent=2)
                print(f"\n💾 Full results saved to: {output_file}")
                
                # Analysis
                print(f"\n" + "=" * 80)
                print("📊 ANALYSIS")
                print("=" * 80)
                
                total_detected = len(analysis_data.get('detections', []))
                if total_detected < 25:
                    print(f"⚠️  Only {total_detected} TVs detected (expected 25)")
                    print(f"   Missing: {25 - total_detected} TVs")
                elif total_detected > 25:
                    print(f"⚠️  {total_detected} TVs detected (expected 25)")
                    print(f"   Extra: {total_detected - 25} TVs")
                else:
                    print(f"✅ Correct number of TVs detected: {total_detected}")
                
                # Check TV numbers
                detected_numbers = [d.get('number', 0) for d in analysis_data.get('detections', [])]
                expected_numbers = list(range(1, 26))
                missing_numbers = [n for n in expected_numbers if n not in detected_numbers]
                extra_numbers = [n for n in detected_numbers if n not in expected_numbers]
                
                if missing_numbers:
                    print(f"⚠️  Missing TV numbers: {missing_numbers}")
                if extra_numbers:
                    print(f"⚠️  Extra/unexpected TV numbers: {extra_numbers}")
                if not missing_numbers and not extra_numbers:
                    print(f"✅ All TV numbers (1-25) detected correctly")
                
                return 0
            else:
                print("❌ Could not extract JSON from response")
                return 1
        else:
            print(f"❌ Unexpected content type: {content.type}")
            return 1
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
