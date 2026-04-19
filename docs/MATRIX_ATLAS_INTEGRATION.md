# Matrix-Atlas Integration with Video Input Selection

## Overview

This feature enables seamless integration between the Wolfpack Matrix video switcher and Atlas audio processors, allowing users to select video inputs for matrix outputs and automatically route the corresponding audio to Atlas zones.

## Architecture

### Components

1. **Frontend UI (MatrixControl.tsx)**
   - Video input selection modal for Matrix outputs 1-4 (channels 33-36)
   - Visual feedback showing selected video input and routing
   - Real-time label updates based on video input selection

2. **Backend APIs**
   - `/api/matrix/video-input-selection` - Handles video input selection and routing
   - `/api/atlas/route-matrix-to-zone` - Routes Matrix audio inputs to Atlas zones
   - `/api/matrix/config` - Updated to store video input selections

3. **Database Schema**
   - `MatrixOutput` model extended with:
     - `selectedVideoInput` - The video input number selected for this matrix output
     - `videoInputLabel` - Label of the selected video input
   - `WolfpackMatrixRouting` - Tracks routing state between Wolfpack and Matrix
   - `WolfpackMatrixState` - Logs routing history

### Data Flow

```
User selects video input (e.g., "Cable Box 2") for Matrix 3
    ↓
Video Input Selection API
    ↓
1. Routes video: Cable Box 2 (Input 3) → Matrix 3 Output (Channel 35)
2. Sends Wolfpack command: "3X35."
3. Updates database with routing state
4. Updates Matrix 3 label to "Cable Box 2"
    ↓
When routing Matrix 3 to a zone
    ↓
Atlas Zone Routing API
    ↓
Routes Atlas Input (Matrix 3) → Selected Zone(s)
Syncs audio with video routing
```

## Usage

### 1. Configure Matrix Outputs

Navigate to the Matrix Control page and go to the "Outputs" tab. For Matrix outputs (33-36), you'll see a special "Matrix Audio Routing" section.

### 2. Select Video Input

1. Click "Select Video Input" button on any Matrix output (1-4)
2. A modal will appear showing all available video inputs
3. Click on the desired video input (e.g., "Cable Box 2")
4. The system will:
   - Route the video input to the matrix output
   - Update the label to match the video input
   - Store the routing configuration

### 3. Route to Atlas Zones

When you route a Matrix input to an Atlas zone (via the Atlas control interface), the system automatically:
- Routes the corresponding audio input to the selected zone(s)
- Maintains synchronization between video and audio routing
- Updates zone labels to reflect the current source

## API Endpoints

### POST /api/matrix/video-input-selection

Select and route a video input to a matrix output.

**Request Body:**
```json
{
  "matrixOutputNumber": 3,
  "videoInputNumber": 5,
  "videoInputLabel": "Cable Box 2"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully routed Cable Box 2 to Matrix 3",
  "routing": {
    "videoInput": {
      "number": 5,
      "label": "Cable Box 2"
    },
    "matrixOutput": {
      "number": 3,
      "label": "Matrix 3"
    },
    "atlasInput": "Matrix 3",
    "command": "5X35."
  }
}
```

### GET /api/matrix/video-input-selection

Retrieve current video input selections for matrix outputs.

**Query Parameters:**
- `matrixOutputNumber` (optional) - Specific matrix output to query (1-4)

**Response:**
```json
{
  "success": true,
  "selections": [
    {
      "matrixOutputNumber": 1,
      "matrixOutputLabel": "Matrix 1",
      "selectedVideoInput": 3,
      "videoInputLabel": "Cable Box 1",
      "atlasInputLabel": "Matrix 1",
      "lastRouted": "2025-10-09T23:30:00Z",
      "isActive": true
    }
  ]
}
```

### POST /api/atlas/route-matrix-to-zone

Route a Matrix audio input to Atlas zones.

**Request Body:**
```json
{
  "matrixInputNumber": 3,
  "zoneNumbers": [1, 2, 5],
  "processorId": "processor-id-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully routed Matrix 3 (Cable Box 2) to zones 1, 2, 5",
  "routing": {
    "matrixInput": 3,
    "videoInputLabel": "Cable Box 2",
    "atlasInput": "Matrix 3",
    "zones": [
      { "number": 1, "name": "Zone 1" },
      { "number": 2, "name": "Zone 2" },
      { "number": 5, "name": "Zone 5" }
    ],
    "processor": {
      "id": "processor-id",
      "name": "Atlas AZMP8",
      "model": "AZMP8"
    }
  }
}
```

### GET /api/atlas/route-matrix-to-zone

Get current Matrix-to-Zone routing state.

**Query Parameters:**
- `processorId` (optional) - Specific processor to query
- `matrixInputNumber` (optional) - Specific matrix input to query (1-4)

**Response:**
```json
{
  "success": true,
  "processor": {
    "id": "processor-id",
    "name": "Atlas AZMP8",
    "model": "AZMP8"
  },
  "routingState": [
    {
      "matrixInput": 3,
      "videoInputLabel": "Cable Box 2",
      "atlasInputLabel": "Matrix 3",
      "zones": [
        { "number": 1, "name": "Zone 1", "volume": 50 },
        { "number": 2, "name": "Zone 2", "volume": 50 }
      ],
      "lastRouted": "2025-10-09T23:30:00Z"
    }
  ]
}
```

## Database Schema Changes

### MatrixOutput Model

```prisma
model MatrixOutput {
  id                  String              @id @default(cuid())
  configId            String
  channelNumber       Int
  label               String
  resolution          String              @default("1080p")
  isActive            Boolean             @default(true)
  status              String              @default("active")
  audioOutput         String?
  powerOn             Boolean             @default(false)
  selectedVideoInput  Int?                // NEW: Selected video input number
  videoInputLabel     String?             // NEW: Label of selected video input
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  
  config              MatrixConfiguration @relation(fields: [configId], references: [id], onDelete: Cascade)
  
  @@unique([configId, channelNumber])
}
```

## Wolfpack Command Protocol

The system uses the Wolfpack matrix switcher protocol:

- **Format:** `[input]X[output].`
- **Example:** `3X35.` routes input 3 to output 35 (Matrix 3)
- **Matrix Outputs:** Channels 33-36 correspond to Matrix 1-4
- **Protocol:** TCP (default port 23) or UDP (default port 4000)
- **Line Ending:** Commands are terminated with `\r\n`

## Atlas Integration

### Physical Mapping

- **Matrix 1** → Atlas Input 9 (or configured input)
- **Matrix 2** → Atlas Input 10
- **Matrix 3** → Atlas Input 11
- **Matrix 4** → Atlas Input 12

### Zone Routing

When a Matrix input is routed to zones, the Atlas processor:
1. Receives the routing command via HTTP API
2. Routes the corresponding physical input to the specified zones
3. Updates zone labels to reflect the current source
4. Maintains volume and EQ settings per zone

## Troubleshooting

### Video Input Not Routing

1. Check Wolfpack matrix connection status
2. Verify IP address and port configuration
3. Check network connectivity to Wolfpack device
4. Review routing logs in database (`WolfpackMatrixState` table)

### Atlas Audio Not Syncing

1. Verify Atlas processor is online
2. Check processor credentials (username/password)
3. Verify physical input mapping configuration
4. Check zone configuration in Atlas

### Label Not Updating

1. Ensure video input selection completed successfully
2. Check database for `selectedVideoInput` and `videoInputLabel` fields
3. Refresh the page to reload configuration
4. Verify matrix configuration is saved

## Future Enhancements

1. **Real-time Status Monitoring**
   - Live feedback from Wolfpack device
   - Current routing state display
   - Connection health indicators

2. **Advanced Atlas Integration**
   - Direct HTTP API calls to Atlas processor
   - Real-time audio level monitoring
   - Automatic input detection and labeling

3. **Preset Management**
   - Save common routing configurations
   - Quick recall of routing presets
   - Scheduled routing changes

4. **Multi-Processor Support**
   - Route to multiple Atlas processors
   - Synchronized routing across processors
   - Load balancing and failover

## Testing

### Manual Testing Steps

1. **Test Video Input Selection:**
   ```
   - Navigate to Matrix Control → Outputs tab
   - Click "Select Video Input" on Matrix 1
   - Select a video input (e.g., "Cable Box 1")
   - Verify routing command sent successfully
   - Verify label updated to match video input
   ```

2. **Test Atlas Zone Routing:**
   ```
   - Use Atlas control interface
   - Route Matrix 1 to Zone 1
   - Verify audio routes correctly
   - Verify zone label shows video input name
   ```

3. **Test Database Persistence:**
   ```
   - Make routing changes
   - Refresh the page
   - Verify routing state persists
   - Check database for correct values
   ```

### API Testing

```bash
# Test video input selection
curl -X POST http://24.123.87.42:3001/api/matrix/video-input-selection \
  -H "Content-Type: application/json" \
  -d '{
    "matrixOutputNumber": 3,
    "videoInputNumber": 5,
    "videoInputLabel": "Cable Box 2"
  }'

# Get current selections
curl http://24.123.87.42:3001/api/matrix/video-input-selection

# Test Atlas zone routing
curl -X POST http://24.123.87.42:3001/api/atlas/route-matrix-to-zone \
  -H "Content-Type: application/json" \
  -d '{
    "matrixInputNumber": 3,
    "zoneNumbers": [1, 2, 5]
  }'

# Get routing state
curl http://24.123.87.42:3001/api/atlas/route-matrix-to-zone
```

## Support

For issues or questions:
1. Check system logs: `~/Sports-Bar-TV-Controller/logs`
2. Review database state: `~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db`
3. Check Wolfpack connection: Matrix Control → Test Connection
4. Verify Atlas processor status: Atlas Config page

## Version History

- **v1.0.0** (2025-10-09) - Initial implementation
  - Video input selection for Matrix outputs
  - Atlas zone routing integration
  - Dynamic label updates
  - Database schema extensions
