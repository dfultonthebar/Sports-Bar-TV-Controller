#!/bin/bash
# OCR Service Installation Script
# Installs EasyOCR and Coral TPU support (optional)

echo "🔧 Installing OCR dependencies..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"

# Create virtual environment for Python dependencies
VENV_DIR="/home/ubuntu/Sports-Bar-TV-Controller/services/ocr-env"

if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install core dependencies
echo "📦 Installing EasyOCR and dependencies..."
pip install easyocr opencv-python-headless numpy

# Install Coral TPU support (optional - works even if TPU not plugged in)
echo "📦 Installing Coral TPU support (optional)..."
pip install pycoral || echo "⚠ Coral TPU support installation skipped (will use CPU)"

# Make OCR service executable
chmod +x /home/ubuntu/Sports-Bar-TV-Controller/services/ocr-service.py

echo ""
echo "✅ OCR Service installation complete!"
echo ""
echo "📋 Status:"
python3 -c "
try:
    import easyocr
    print('  ✓ EasyOCR: Installed')
except:
    print('  ✗ EasyOCR: Not installed')

try:
    import cv2
    print('  ✓ OpenCV: Installed')
except:
    print('  ✗ OpenCV: Not installed')

try:
    from pycoral.utils import edgetpu
    devices = edgetpu.list_edge_tpus()
    if devices:
        print(f'  ✓ Coral TPU: Detected ({len(devices)} device(s))')
    else:
        print('  ℹ Coral TPU: Libraries installed, no device detected')
        print('    (Will auto-detect when you plug in the TPU)')
except:
    print('  ℹ Coral TPU: Not installed (CPU mode only)')
"
echo ""
echo "🚀 OCR service ready! It will automatically use Coral TPU when plugged in."
