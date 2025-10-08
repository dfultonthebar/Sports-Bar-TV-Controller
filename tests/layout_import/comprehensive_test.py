#!/usr/bin/env python3
"""
Comprehensive end-to-end test for Graystone Layout import
Tests the complete flow from image upload to output positioning
"""

import requests
import json
import time
import sys
from pathlib import Path

BASE_URL = "http://localhost:3000"
IMAGE_PATH = Path(__file__).parent / "Graystone Layout.png"

def log(message, level="INFO"):
    """Log with timestamp"""
    print(f"[{level}] {message}")

def test_api_accessible():
    """Test if API is accessible"""
    log("Testing API accessibility...")
    try:
        # Try to access the bartender layout endpoint
        response = requests.get(f"{BASE_URL}/api/bartender/layout", timeout=5)
        log(f"API accessibility check status: {response.status_code}")
        return True
    except Exception as e:
        log(f"API not accessible: {e}", "ERROR")
        return False

def test_vision_analyze():
    """Test vision analysis endpoint"""
    log("Testing vision analysis...")
    
    if not IMAGE_PATH.exists():
        log(f"Image not found: {IMAGE_PATH}", "ERROR")
        return None
    
    try:
        with open(IMAGE_PATH, 'rb') as f:
            files = {'image': ('Graystone Layout.png', f, 'image/png')}
            data = {'tvCount': '25'}
            
            log(f"Uploading image: {IMAGE_PATH.name} ({IMAGE_PATH.stat().st_size} bytes)")
            response = requests.post(
                f"{BASE_URL}/api/ai/vision-analyze-layout",
                files=files,
                data=data,
                timeout=60
            )
            
            log(f"Vision analysis status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                log(f"Vision analysis result keys: {list(result.keys())}")
                
                if 'detections' in result:
                    detections = result['detections']
                    log(f"Total TVs detected: {len(detections)}")
                    
                    # Show first 3 detections
                    for i, det in enumerate(detections[:3]):
                        log(f"  TV {i+1}: {json.dumps(det, indent=4)}")
                    
                    return result
                else:
                    log(f"No detections in result: {json.dumps(result, indent=2)}", "ERROR")
                    return None
            else:
                log(f"Vision analysis failed: {response.text}", "ERROR")
                return None
                
    except Exception as e:
        log(f"Vision analysis error: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return None

def test_get_bartender_layout():
    """Get bartender layout which includes outputs"""
    log("Fetching bartender layout...")
    try:
        response = requests.get(f"{BASE_URL}/api/bartender/layout", timeout=10)
        log(f"Get bartender layout status: {response.status_code}")
        
        if response.status_code == 200:
            layout = response.json()
            log(f"Layout keys: {list(layout.keys())}")
            
            if 'outputs' in layout:
                outputs = layout['outputs']
                log(f"Total outputs: {len(outputs)}")
                
                # Show Wolfpack outputs
                wolfpack_outputs = [o for o in outputs if 'Wolfpack' in o.get('name', '')]
                log(f"Wolfpack outputs: {len(wolfpack_outputs)}")
                
                for i, output in enumerate(wolfpack_outputs[:5]):
                    log(f"  Output {i+1}: {output.get('name')} - Label: {output.get('label')} - Position: {output.get('position')}")
                
                return layout
            else:
                log("No outputs in layout", "ERROR")
                return None
        else:
            log(f"Get bartender layout failed: {response.text}", "ERROR")
            return None
            
    except Exception as e:
        log(f"Get bartender layout error: {e}", "ERROR")
        return None

def test_analyze_layout(vision_result, layout):
    """Test the analyze-layout endpoint that matches outputs to TVs"""
    log("Testing analyze-layout endpoint...")
    
    if not vision_result or not layout:
        log("Missing vision result or layout", "ERROR")
        return None
    
    try:
        # Prepare the request payload
        payload = {
            'detections': vision_result.get('detections', []),
            'outputs': layout.get('outputs', [])
        }
        
        log(f"Sending {len(payload['detections'])} detections and {len(payload['outputs'])} outputs")
        
        response = requests.post(
            f"{BASE_URL}/api/ai/analyze-layout",
            json=payload,
            timeout=30
        )
        
        log(f"Analyze-layout status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            log(f"Analyze-layout result keys: {list(result.keys())}")
            
            if 'matches' in result:
                matches = result['matches']
                log(f"Total matches: {len(matches)}")
                
                for i, match in enumerate(matches[:5]):
                    log(f"  Match {i+1}: {json.dumps(match, indent=4)}")
            
            log(f"Full result: {json.dumps(result, indent=2)}")
            return result
        else:
            log(f"Analyze-layout failed: {response.text}", "ERROR")
            return None
            
    except Exception as e:
        log(f"Analyze-layout error: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        return None

def test_get_final_layout():
    """Get the final layout after analysis"""
    log("Fetching final layout configuration...")
    try:
        response = requests.get(f"{BASE_URL}/api/bartender/layout", timeout=10)
        log(f"Get final layout status: {response.status_code}")
        
        if response.status_code == 200:
            layout = response.json()
            
            if 'outputs' in layout:
                outputs = layout['outputs']
                log(f"Final layout has {len(outputs)} outputs")
                
                # Check for positioned outputs
                positioned = [o for o in outputs if o.get('position')]
                log(f"Positioned outputs: {len(positioned)}")
                
                for i, output in enumerate(positioned[:5]):
                    log(f"  Output {i+1}: {output.get('label')} at {output.get('position')}")
            
            return layout
        else:
            log(f"Get final layout failed: {response.text}", "ERROR")
            return None
            
    except Exception as e:
        log(f"Get final layout error: {e}", "ERROR")
        return None

def main():
    """Run comprehensive test"""
    log("=" * 60)
    log("COMPREHENSIVE LAYOUT IMPORT TEST")
    log("=" * 60)
    
    results = {
        'api_accessible': False,
        'vision_analysis': None,
        'initial_layout': None,
        'analyze_layout': None,
        'final_layout': None
    }
    
    # Step 1: API accessibility check
    if not test_api_accessible():
        log("API not accessible, exiting", "ERROR")
        return 1
    results['api_accessible'] = True
    
    log("\n" + "=" * 60)
    
    # Step 2: Get initial layout
    initial_layout = test_get_bartender_layout()
    results['initial_layout'] = initial_layout
    
    if not initial_layout:
        log("Failed to get initial layout, exiting", "ERROR")
        return 1
    
    log("\n" + "=" * 60)
    
    # Step 3: Vision analysis
    vision_result = test_vision_analyze()
    results['vision_analysis'] = vision_result
    
    if not vision_result:
        log("Vision analysis failed, exiting", "ERROR")
        return 1
    
    log("\n" + "=" * 60)
    
    # Step 4: Analyze layout (match outputs to TVs)
    analyze_result = test_analyze_layout(vision_result, initial_layout)
    results['analyze_layout'] = analyze_result
    
    log("\n" + "=" * 60)
    
    # Step 5: Get final layout
    final_layout = test_get_final_layout()
    results['final_layout'] = final_layout
    
    log("\n" + "=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    log(f"API accessible: {'✓' if results['api_accessible'] else '✗'}")
    log(f"Initial layout: {'✓' if results['initial_layout'] else '✗'}")
    log(f"Vision analysis: {'✓' if results['vision_analysis'] else '✗'}")
    log(f"Analyze layout: {'✓' if results['analyze_layout'] else '✗'}")
    log(f"Final layout: {'✓' if results['final_layout'] else '✗'}")
    
    # Check if outputs were positioned
    if results['final_layout'] and 'outputs' in results['final_layout']:
        positioned = [o for o in results['final_layout']['outputs'] if o.get('position')]
        log(f"\nFinal positioned outputs: {len(positioned)}")
        if len(positioned) == 0:
            log("⚠️  WARNING: No outputs were positioned!", "ERROR")
    
    # Save results
    output_file = Path(__file__).parent / "comprehensive_test_results.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    log(f"\nResults saved to: {output_file}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
