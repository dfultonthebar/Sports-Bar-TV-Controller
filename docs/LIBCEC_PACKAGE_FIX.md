
# libCEC Package Fix for Ubuntu 22.04

## Issue
The installation scripts were attempting to install `libcec4`, which is not available in Ubuntu 22.04 repositories.

## Solution
Updated all installation scripts to use the correct package name `libcec6` for Ubuntu 22.04 compatibility.

## Files Updated
1. **install.sh** - Main installation script
2. **install-cec-bridge.sh** - CEC bridge installation script  
3. **update_from_github.sh** - GitHub update script

## Changes Made
Changed package installation command from:
```bash
sudo apt install -y cec-utils libcec4 libcec-dev
```

To:
```bash
sudo apt install -y cec-utils libcec6 libcec-dev
```

## Verification
- ✅ libcec6 (6.0.2-5) installed successfully
- ✅ cec-utils installed successfully
- ✅ libcec-dev installed successfully
- ✅ Changes committed to GitHub
- ✅ Server running on http://localhost:3000

## Package Information
- **Package Name**: libcec6
- **Version**: 6.0.2-5
- **Description**: USB CEC Adaptor communication Library (shared library)
- **Ubuntu Version**: 22.04 (Jammy)

## Note
This fix ensures that future installations and updates will use the correct package name for Ubuntu 22.04 and later versions.

---
*Fixed: October 1, 2025*
