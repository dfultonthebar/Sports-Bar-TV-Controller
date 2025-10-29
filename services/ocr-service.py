#!/usr/bin/env python3
"""
OCR Service for TV Layout Detection
Supports Google Coral TPU with automatic fallback to CPU
"""

import sys
import json
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# Setup logging
logging.basicConfig(level=logging.INFO, format='[OCR Service] %(message)s')
logger = logging.getLogger(__name__)

# Check for Coral TPU availability
try:
    from pycoral.utils import edgetpu
    from pycoral.adapters import common
    CORAL_AVAILABLE = True
    logger.info("✓ Coral TPU libraries detected")
except ImportError:
    CORAL_AVAILABLE = False
    logger.info("ℹ Coral TPU libraries not found - will use CPU")

# Try to import EasyOCR
try:
    import easyocr
    EASYOCR_AVAILABLE = True
    logger.info("✓ EasyOCR available")
except ImportError:
    EASYOCR_AVAILABLE = False
    logger.warning("⚠ EasyOCR not installed - installing recommended")

# Try to import OpenCV for image processing
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("⚠ OpenCV not installed - some features may be limited")


class TVLayoutOCR:
    """OCR service for detecting TV labels in layout images"""

    def __init__(self):
        self.device = 'cpu'
        self.tpu_available = False
        self.reader = None

        # Check for Coral TPU
        if CORAL_AVAILABLE:
            self.tpu_available = self._detect_coral_tpu()

        # Initialize OCR reader
        if EASYOCR_AVAILABLE:
            self._init_easyocr()
        else:
            logger.error("❌ EasyOCR not available - OCR features disabled")

    def _detect_coral_tpu(self) -> bool:
        """Detect if Coral TPU is connected"""
        try:
            devices = edgetpu.list_edge_tpus()
            if devices:
                logger.info(f"✓ Coral TPU detected: {devices}")
                self.device = 'tpu'
                return True
            else:
                logger.info("ℹ Coral TPU not detected - using CPU")
                return False
        except Exception as e:
            logger.warning(f"⚠ Error detecting TPU: {e}")
            return False

    def _init_easyocr(self):
        """Initialize EasyOCR reader"""
        try:
            # Use GPU if available (Coral TPU doesn't directly accelerate EasyOCR,
            # but GPU can be used if CUDA is available)
            gpu = False  # Can be enabled if CUDA GPU is available

            logger.info(f"Initializing EasyOCR (device: {self.device})...")
            self.reader = easyocr.Reader(['en'], gpu=gpu)
            logger.info("✓ EasyOCR initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize EasyOCR: {e}")
            self.reader = None

    def extract_text_from_region(self, image_path: str, bbox: Dict) -> Optional[str]:
        """
        Extract text from a specific region of the image

        Args:
            image_path: Path to the layout image
            bbox: Bounding box {x, y, width, height} in percentages

        Returns:
            Extracted text or None
        """
        if not self.reader or not CV2_AVAILABLE:
            return None

        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                logger.error(f"Failed to load image: {image_path}")
                return None

            height, width = img.shape[:2]

            # Convert percentage bbox to pixels
            x = int((bbox['x'] / 100) * width)
            y = int((bbox['y'] / 100) * height)
            w = int((bbox['width'] / 100) * width)
            h = int((bbox['height'] / 100) * height)

            # Expand region to catch nearby text (labels are usually near the TV box)
            padding = int(max(w, h) * 1.0)  # 100% padding to catch labels above/below boxes
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(width, x + w + padding)
            y2 = min(height, y + h + padding)

            # Crop region
            region = img[y1:y2, x1:x2]

            # Perform OCR
            results = self.reader.readtext(region, detail=0, paragraph=False)

            # Filter and clean results
            text = self._clean_ocr_text(results)

            if text:
                logger.info(f"Found text near ({x}, {y}): '{text}'")

            return text

        except Exception as e:
            logger.error(f"Error extracting text: {e}")
            return None

    def _clean_ocr_text(self, results: List[str]) -> Optional[str]:
        """Clean and filter OCR results to find TV labels"""
        import re

        for text in results:
            text = text.strip().upper()

            # Look for patterns like "TV 01", "TV01", "TV-01", "#01", etc.
            patterns = [
                r'TV\s*0*(\d+)',  # TV 01, TV01, TV 1
                r'#\s*0*(\d+)',   # #01, # 1
                r'(\d+)',         # Just numbers
            ]

            for pattern in patterns:
                match = re.search(pattern, text)
                if match:
                    number = int(match.group(1))
                    return f"TV {number:02d}"  # Normalize to "TV 01" format

        return None

    def process_layout(self, image_path: str, zones: List[Dict]) -> List[Dict]:
        """
        Process layout image and extract labels for all TV zones

        Args:
            image_path: Path to layout image
            zones: List of detected zones with bbox coordinates

        Returns:
            Updated zones with extracted labels
        """
        logger.info(f"Processing {len(zones)} zones in {image_path}")

        updated_zones = []

        for i, zone in enumerate(zones):
            zone_copy = zone.copy()

            # Try to extract label from this zone
            label = self.extract_text_from_region(image_path, {
                'x': zone['x'],
                'y': zone['y'],
                'width': zone['width'],
                'height': zone['height']
            })

            if label:
                zone_copy['label'] = label
                zone_copy['confidence'] = 0.95  # High confidence for OCR-detected labels
            else:
                # Keep original label if OCR didn't find anything
                logger.info(f"No label found for zone {i+1}, keeping default")

            updated_zones.append(zone_copy)

        logger.info(f"OCR processing complete: {sum(1 for z in updated_zones if 'TV' in z.get('label', ''))} labels detected")

        return updated_zones


def main():
    """Main entry point for OCR service"""
    if len(sys.argv) < 3:
        print(json.dumps({
            'error': 'Usage: ocr-service.py <image_path> <zones_json>'
        }))
        sys.exit(1)

    image_path = sys.argv[1]
    zones_json = sys.argv[2]

    try:
        zones = json.loads(zones_json)
    except json.JSONDecodeError as e:
        print(json.dumps({
            'error': f'Invalid JSON: {e}'
        }))
        sys.exit(1)

    # Initialize OCR service
    ocr = TVLayoutOCR()

    # Process layout
    if ocr.reader:
        updated_zones = ocr.process_layout(image_path, zones)
        print(json.dumps({
            'success': True,
            'zones': updated_zones,
            'device': ocr.device,
            'tpu_available': ocr.tpu_available
        }))
    else:
        # OCR not available, return original zones
        print(json.dumps({
            'success': False,
            'zones': zones,
            'error': 'OCR not available',
            'device': 'none'
        }))


if __name__ == '__main__':
    main()
