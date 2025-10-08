#!/usr/bin/env python3
"""Test vision API with correct parameters"""

import requests
import json

BASE_URL = "http://localhost:3000"

# First upload the image
print("Step 1: Upload image...")
with open('tests/layout_import/Graystone Layout.png', 'rb') as f:
    files = {'file': ('Graystone Layout.png', f, 'image/png')}
    response = requests.post(f"{BASE_URL}/api/bartender/upload-layout", files=files)

print(f"Upload status: {response.status_code}")
upload_result = response.json()
print(f"Upload result: {json.dumps(upload_result, indent=2)}")

image_url = upload_result.get('imageUrl')
print(f"\nImage URL: {image_url}")

# Now call vision API with the image URL
print("\nStep 2: Call vision API with imageUrl...")
payload = {
    'imageUrl': image_url
}

response = requests.post(
    f"{BASE_URL}/api/ai/vision-analyze-layout",
    json=payload,
    timeout=60
)

print(f"Vision API status: {response.status_code}")
if response.status_code == 200:
    result = response.json()
    print(f"Vision result: {json.dumps(result, indent=2)[:500]}...")
    
    if 'analysis' in result:
        analysis = result['analysis']
        print(f"\nAnalysis method: {analysis.get('analysisMethod')}")
        print(f"Total TVs: {analysis.get('totalTVs')}")
        print(f"Detections: {len(analysis.get('detections', []))}")
        
        # Show first 3 detections
        for i, det in enumerate(analysis.get('detections', [])[:3]):
            print(f"\nDetection {i+1}:")
            print(f"  Number: {det.get('number')}")
            print(f"  Label: {det.get('label')}")
            print(f"  Position: {det.get('position')}")
else:
    print(f"Vision API failed: {response.text}")
