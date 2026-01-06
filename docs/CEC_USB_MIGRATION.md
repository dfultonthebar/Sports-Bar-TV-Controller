# CEC USB Device Migration

## Overview

This document outlines the migration from CEC server-based implementation to USB CEC device (e.g., Pulse-Eight USB-CEC Adapter) direct integration.

## Changes Made

### 1. Database Schema Updates

#### New Model: `CECConfiguration`

```prisma
model CECConfiguration {
  id              String   @id @default(cuid())
  isEnabled       Boolean  @default(false)
  cecInputChannel Int?     // Matrix input channel where CEC device is connected
  usbDevicePath   String   @default("/dev/ttyACM0") // USB CEC adapter device path
  powerOnDelay    Int      @default(2000) // Delay in ms after power on command
  powerOffDelay   Int      @default(1000) // Delay in ms after power off command
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### Updated Model: `MatrixOutput`

Added CEC discovery fields:
- `tvBrand` - TV brand detected via CEC
- `tvModel` - TV model detected via CEC
- `cecAddress` - CEC physical address
- `lastDiscovery` - Last time TV brand was discovered

### 2. Code Changes

#### `/src/lib/services/cec-discovery-service.ts`

**Removed:**
- HTTP-based CEC server communication
- `cecServerIP` and `cecPort` parameters
- Network fetch calls to CEC server

**Added:**
- Direct USB CEC adapter communication via `cec-service`
- Initialization of USB CEC adapter before scanning
- Enhanced logging for USB device detection

#### `/src/app/api/cec/config/route.ts`

**Replaced:**
- `cecServerIP` field with `usbDevicePath`
- `cecPort` field removed
- Default USB device path: `/dev/ttyACM0`

#### `/src/lib/cec-service.ts`

**No changes** - Already using `cec-client` command-line tool for direct USB communication

### 3. Migration File

Created: `prisma/migrations/20251016055050_add_cec_configuration/migration.sql`

```sql
-- CreateTable
CREATE TABLE IF NOT EXISTS "CECConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cecInputChannel" INTEGER,
    "usbDevicePath" TEXT NOT NULL DEFAULT '/dev/ttyACM0',
    "powerOnDelay" INTEGER NOT NULL DEFAULT 2000,
    "powerOffDelay" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable: Add CEC fields to MatrixOutput
ALTER TABLE "MatrixOutput" ADD COLUMN "tvBrand" TEXT;
ALTER TABLE "MatrixOutput" ADD COLUMN "tvModel" TEXT;
ALTER TABLE "MatrixOutput" ADD COLUMN "cecAddress" TEXT;
ALTER TABLE "MatrixOutput" ADD COLUMN "lastDiscovery" DATETIME;
```

## Hardware Requirements

### USB CEC Adapter

Recommended: **Pulse-Eight USB-CEC Adapter**
- Device path: `/dev/ttyACM0` (default)
- Driver: libCEC
- Command-line tool: `cec-client`

### Installation

```bash
# Install libCEC and cec-client
sudo apt-get update
sudo apt-get install cec-utils

# Verify installation
cec-client -l

# Test device detection
echo "scan" | cec-client -s -d 1
```

## Deployment Steps

### 1. Deploy to Server

```bash
# SSH into server
ssh ubuntu@24.123.87.42 -p 224

# Navigate to project
cd /home/ubuntu/Sports-Bar-TV-Controller

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate deploy

# Restart application
pm2 restart sports-bar-tv-controller
```

### 2. Configure CEC

1. Navigate to **System Admin Settings**
2. Go to **Device Configurations**
3. Open **CEC Configuration**
4. Set:
   - **USB Device Path**: `/dev/ttyACM0` (or appropriate path)
   - **CEC Input Channel**: Matrix input where CEC adapter is connected
   - **Enable CEC**: Toggle on
   - **Power On Delay**: 2000ms (default)
   - **Power Off Delay**: 1000ms (default)

### 3. Test CEC Discovery

1. Navigate to **System Admin Settings** > **Device Configurations** > **CEC Discovery**
2. Click **Run CEC Discovery**
3. Monitor console logs for:
   ```
   [CEC Discovery] Using USB CEC adapter: /dev/ttyACM0
   [CEC Discovery] Found device: SONY TV (Sony)
   [CEC Discovery] Discovery complete: 1/1 devices detected
   ```

## API Changes

### CEC Configuration

**GET `/api/cec/config`**

Response:
```json
{
  "success": true,
  "config": {
    "id": "default",
    "isEnabled": true,
    "cecInputChannel": 1,
    "usbDevicePath": "/dev/ttyACM0",
    "powerOnDelay": 2000,
    "powerOffDelay": 1000
  }
}
```

**POST `/api/cec/config`**

Request:
```json
{
  "isEnabled": true,
  "cecInputChannel": 1,
  "usbDevicePath": "/dev/ttyACM0",
  "powerOnDelay": 2000,
  "powerOffDelay": 1000
}
```

### CEC Discovery

**POST `/api/cec/discovery`**

Discover all outputs:
```json
{
  "success": true,
  "results": [
    {
      "outputNumber": 1,
      "label": "TV 1",
      "brand": "Sony",
      "model": "SONY TV",
      "cecAddress": "0",
      "success": true
    }
  ]
}
```

Discover single output:
```json
{
  "outputNumber": 1
}
```

## Troubleshooting

### CEC Adapter Not Detected

```bash
# Check USB devices
lsusb | grep -i pulse

# Check device permissions
ls -la /dev/ttyACM0

# Add user to dialout group
sudo usermod -a -G dialout ubuntu
```

### No CEC Devices Found

```bash
# Test CEC scan
echo "scan" | cec-client -s -d 1

# Check CEC adapter status
cec-client -l
```

### Permission Denied

```bash
# Fix permissions
sudo chmod 666 /dev/ttyACM0

# Or permanently via udev rule
sudo nano /etc/udev/rules.d/99-cec.rules
# Add: SUBSYSTEM=="tty", ATTRS{idVendor}=="2548", ATTRS{idProduct}=="1001", MODE="0666"

sudo udevadm control --reload-rules
sudo udevadm trigger
```

## Benefits of USB CEC Adapter

1. **Direct Communication**: No intermediate server needed
2. **Lower Latency**: Direct hardware access
3. **Simplified Architecture**: One less service to maintain
4. **Reliable**: Hardware-based communication is more stable
5. **Standard Protocol**: Uses industry-standard libCEC

## Migration Checklist

- [x] Update Prisma schema
- [x] Create migration file
- [x] Update CEC discovery service
- [x] Update CEC configuration API
- [x] Remove CEC server references
- [ ] Test on production server
- [ ] Update system documentation
- [ ] Verify all CEC commands work
- [ ] Test power control
- [ ] Test TV discovery

## Future Enhancements

1. **Multi-TV Support**: Map specific outputs to specific CEC addresses
2. **Enhanced Discovery**: Improve brand/model detection patterns
3. **CEC Command Library**: Expand available CEC commands
4. **Status Monitoring**: Real-time CEC device status updates
5. **Auto-Recovery**: Automatic reconnection on USB adapter disconnect

## References

- [libCEC Documentation](https://github.com/Pulse-Eight/libcec)
- [CEC-O-MATIC Command Builder](http://www.cec-o-matic.com/)
- [CEC Specification (HDMI.org)](https://www.hdmi.org/spec/cec)
