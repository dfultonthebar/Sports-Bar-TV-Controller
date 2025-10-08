#!/usr/bin/env python3
"""
Debug the complete layout import flow to identify where outputs aren't being applied
"""

import requests
import json
import time
from pathlib import Path

BASE_URL = "http://localhost:3000"
IMAGE_PATH = Path(__file__).parent / "Graystone Layout.png"

def log(msg, level="INFO"):
    print(f"[{level}] {msg}")

def step1_upload_image():
    """Step 1: Upload the layout image"""
    log("=" * 60)
    log("STEP 1: Upload Layout Image")
    log("=" * 60)
    
    with open(IMAGE_PATH, 'rb') as f:
        files = {'file': ('Graystone Layout.png', f, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/bartender/upload-layout", files=files, timeout=30)
    
    log(f"Upload status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        log(f"Upload result: {json.dumps(result, indent=2)}")
        return result
    else:
        log(f"Upload failed: {response.text}", "ERROR")
        return None

def step2_vision_analysis(image_url):
    """Step 2: Analyze the image with vision API"""
    log("\n" + "=" * 60)
    log("STEP 2: Vision Analysis")
    log("=" * 60)
    
    # The vision API expects form data with image file
    with open(IMAGE_PATH, 'rb') as f:
        files = {'image': ('Graystone Layout.png', f, 'image/png')}
        data = {'tvCount': '25'}
        response = requests.post(
            f"{BASE_URL}/api/ai/vision-analyze-layout",
            files=files,
            data=data,
            timeout=60
        )
    
    log(f"Vision analysis status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        log(f"Vision result keys: {list(result.keys())}")
        
        if 'analysis' in result:
            analysis = result['analysis']
            log(f"Analysis method: {analysis.get('analysisMethod')}")
            log(f"Total TVs detected: {analysis.get('totalTVs')}")
            
            detections = analysis.get('detections', [])
            log(f"Detections count: {len(detections)}")
            
            # Show first 3 detections
            for i, det in enumerate(detections[:3]):
                log(f"  Detection {i+1}: {json.dumps(det, indent=4)}")
            
            return result
        else:
            log(f"No analysis in result: {json.dumps(result, indent=2)}", "ERROR")
            return None
    else:
        log(f"Vision analysis failed: {response.text}", "ERROR")
        return None

def step3_get_matrix_outputs():
    """Step 3: Get Wolfpack matrix outputs from database"""
    log("\n" + "=" * 60)
    log("STEP 3: Get Matrix Outputs")
    log("=" * 60)
    
    response = requests.get(f"{BASE_URL}/api/matrix-config", timeout=10)
    log(f"Matrix config status: {response.status_code}")
    
    if response.status_code == 200:
        config = response.json()
        log(f"Config keys: {list(config.keys())}")
        
        if 'outputs' in config:
            outputs = config['outputs']
            log(f"Total outputs: {len(outputs)}")
            
            # Show first 5 outputs
            for i, output in enumerate(outputs[:5]):
                log(f"  Output {i+1}: Channel {output.get('channelNumber')} - Label: {output.get('label')}")
            
            return outputs
        else:
            log("No outputs in config", "WARN")
            return []
    else:
        log(f"Matrix config failed: {response.text}", "ERROR")
        return None

def step4_analyze_layout(vision_result, outputs):
    """Step 4: Call analyze-layout to match outputs to TVs"""
    log("\n" + "=" * 60)
    log("STEP 4: Analyze Layout (Match Outputs to TVs)")
    log("=" * 60)
    
    if not vision_result or 'analysis' not in vision_result:
        log("No vision result available", "ERROR")
        return None
    
    analysis = vision_result['analysis']
    detections = analysis.get('detections', [])
    
    # Prepare payload for analyze-layout
    payload = {
        'detections': detections,
        'outputs': outputs or []
    }
    
    log(f"Sending {len(detections)} detections and {len(outputs or [])} outputs")
    
    response = requests.post(
        f"{BASE_URL}/api/ai/analyze-layout",
        json=payload,
        timeout=30
    )
    
    log(f"Analyze-layout status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        log(f"Result keys: {list(result.keys())}")
        
        if 'analysis' in result:
            analysis_result = result['analysis']
            log(f"Analysis result keys: {list(analysis_result.keys())}")
            
            suggestions = analysis_result.get('suggestions', [])
            log(f"Total suggestions: {len(suggestions)}")
            
            # Show first 5 suggestions
            for i, sug in enumerate(suggestions[:5]):
                log(f"  Suggestion {i+1}: {json.dumps(sug, indent=4)}")
            
            return result
        else:
            log(f"No analysis in result: {json.dumps(result, indent=2)}", "ERROR")
            return None
    else:
        log(f"Analyze-layout failed: {response.text}", "ERROR")
        return None

def step5_check_layout_file():
    """Step 5: Check if layout file was updated"""
    log("\n" + "=" * 60)
    log("STEP 5: Check Layout File")
    log("=" * 60)
    
    response = requests.get(f"{BASE_URL}/api/bartender/layout", timeout=10)
    log(f"Get layout status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        log(f"Result keys: {list(result.keys())}")
        
        if 'layout' in result:
            layout = result['layout']
            log(f"Layout keys: {list(layout.keys())}")
            log(f"Layout name: {layout.get('name')}")
            
            zones = layout.get('zones', [])
            log(f"Total zones: {len(zones)}")
            
            # Show first 5 zones
            for i, zone in enumerate(zones[:5]):
                log(f"  Zone {i+1}: {json.dumps(zone, indent=4)}")
            
            return layout
        else:
            log("No layout in result", "ERROR")
            return None
    else:
        log(f"Get layout failed: {response.text}", "ERROR")
        return None

def main():
    log("=" * 60)
    log("DEBUGGING COMPLETE LAYOUT IMPORT FLOW")
    log("=" * 60)
    
    results = {}
    
    # Step 1: Upload image
    upload_result = step1_upload_image()
    results['upload'] = upload_result
    if not upload_result:
        log("\n❌ FAILED at Step 1: Image upload", "ERROR")
        return
    
    # Step 2: Vision analysis
    vision_result = step2_vision_analysis(upload_result.get('imageUrl'))
    results['vision'] = vision_result
    if not vision_result:
        log("\n❌ FAILED at Step 2: Vision analysis", "ERROR")
        return
    
    # Step 3: Get matrix outputs
    outputs = step3_get_matrix_outputs()
    results['outputs'] = outputs
    if outputs is None:
        log("\n⚠️  WARNING: Could not get matrix outputs", "WARN")
        outputs = []
    
    # Step 4: Analyze layout
    analyze_result = step4_analyze_layout(vision_result, outputs)
    results['analyze'] = analyze_result
    if not analyze_result:
        log("\n❌ FAILED at Step 4: Analyze layout", "ERROR")
        return
    
    # Step 5: Check layout file
    layout = step5_check_layout_file()
    results['layout'] = layout
    
    # Summary
    log("\n" + "=" * 60)
    log("FLOW ANALYSIS SUMMARY")
    log("=" * 60)
    
    log(f"✓ Step 1: Image uploaded successfully")
    log(f"✓ Step 2: Vision analysis completed ({vision_result['analysis']['analysisMethod']})")
    log(f"✓ Step 3: Matrix outputs retrieved ({len(outputs)} outputs)")
    log(f"✓ Step 4: Layout analysis completed ({len(analyze_result.get('analysis', {}).get('suggestions', []))} suggestions)")
    
    if layout:
        zones = layout.get('zones', [])
        log(f"✓ Step 5: Layout file has {len(zones)} zones")
        
        # Check if zones match the detected TVs
        vision_tvs = len(vision_result['analysis']['detections'])
        if len(zones) == vision_tvs:
            log(f"✅ SUCCESS: Layout has {len(zones)} zones matching {vision_tvs} detected TVs")
        else:
            log(f"⚠️  MISMATCH: Layout has {len(zones)} zones but {vision_tvs} TVs were detected", "WARN")
    else:
        log(f"❌ Step 5: Could not retrieve layout file", "ERROR")
    
    # Save results
    output_file = Path(__file__).parent / "debug_flow_results.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    log(f"\nResults saved to: {output_file}")
    
    # Key finding
    log("\n" + "=" * 60)
    log("KEY FINDING")
    log("=" * 60)
    
    if analyze_result and not layout:
        log("❌ ISSUE: analyze-layout API returns suggestions but layout file is not updated!", "ERROR")
        log("   The analyze-layout API does NOT save the layout - it only returns suggestions.")
        log("   The frontend must call POST /api/bartender/layout to save the positions.")
    elif analyze_result and layout:
        zones = layout.get('zones', [])
        suggestions = analyze_result.get('analysis', {}).get('suggestions', [])
        if len(zones) != len(suggestions):
            log("❌ ISSUE: Layout zones don't match analyze-layout suggestions!", "ERROR")
            log(f"   Suggestions: {len(suggestions)}, Zones: {len(zones)}")
            log("   The frontend may not be calling POST /api/bartender/layout correctly.")

if __name__ == "__main__":
    main()
