# Wolfpack-Atlas Matrix Routing Integration

## Overview

This feature implements synchronized audio-video routing between the Wolfpack video matrix switcher and the Atlas audio processor. It allows users to route video sources through the Wolfpack matrix to provide audio to the Atlas system via 4 dedicated Matrix inputs.

## Architecture

### System Flow
```
Wolfpack Video Input → Wolfpack Matrix Output (33-36) → Atlas Matrix Input (1-4) → Atlas Zone Output
```

### Components

#### 1. Database Schema (Prisma)
- **WolfpackMatrixRouting**: Stores Matrix routing configuration
  - Maps Matrix outputs (1-4) to Wolfpack inputs
  - Tracks current routing state
  - Stores input labels for display

- **WolfpackMatrixState**: Logs routing history
  - Tracks all routing changes
  - Stores channel information
  - Provides audit trail

#### 2. API Endpoints

**GET /api/wolfpack/inputs**
- Retrieves list of all Wolfpack video inputs
- Returns input labels, channel numbers, and current channel info
- Used to populate the input selector

**POST /api/wolfpack/route-to-matrix**
- Routes a Wolfpack input to a specific Matrix output (1-4)
- Parameters:
  - `wolfpackInputNumber`: Source input channel
  - `matrixOutputNumber`: Target Matrix output (1-4)
- Updates routing state in database
- Sends routing command to Wolfpack device

**GET /api/audio-processor/matrix-routing**
- Retrieves current Matrix routing state
- Returns all active routings and recent history

**POST /api/audio-processor/matrix-routing**
- Updates Matrix routing preferences
- Configures Atlas input labels

#### 3. Services

**wolfpackMatrixService.ts**
- `routeWolfpackToMatrix()`: Core routing logic
  - Sends TCP/UDP commands to Wolfpack
  - Maps Matrix outputs to Wolfpack channels (33-36)
  - Handles error cases and timeouts

- `getMatrixRoutingState()`: Query current routing state
- `sendWolfpackCommand()`: Low-level command interface

#### 4. UI Components

**WolfpackInputSelector.tsx**
- Modal popup for selecting Wolfpack video sources
- Displays all available inputs with labels
- Shows current channel information
- Handles routing on selection
- Provides visual feedback during routing

**AudioZoneControl.tsx** (Modified)
- Detects Matrix input types
- Shows Wolfpack selector for Matrix inputs
- Maintains direct routing for non-Matrix inputs
- Visual indicators (Radio icon) for Matrix inputs

## Usage

### User Flow

1. **Select Audio Zone**: User clicks on an audio zone (e.g., "Main Bar")

2. **Choose Input Type**:
   - **Matrix Input** (Matrix 1-4): Opens Wolfpack input selector
   - **Direct Input** (Cable, DTV, Bands, Mics): Direct audio routing

3. **Matrix Input Selection**:
   - Popup shows all Wolfpack video inputs
   - User selects desired input (e.g., "Cable Box 1 - ESPN")
   - System routes video to Matrix output
   - Audio from Matrix input routes to zone

4. **Result**:
   - Video routed but NOT displayed on TVs
   - Audio from selected source plays in zone
   - Routing state saved in database

### Matrix Input Configuration

Matrix inputs are identified by:
- `type: 'matrix'` in audio input configuration
- `matrixNumber: 1-4` specifying which Matrix input
- Visual indicator (Radio icon) in UI

Example:
```typescript
{
  id: 'matrix2',
  name: 'Matrix 2',
  isActive: true,
  type: 'matrix',
  matrixNumber: 2
}
```

## Technical Details

### Wolfpack Matrix Outputs
- Matrix outputs on Wolfpack are typically channels 33-36
- These correspond to Atlas Matrix inputs 1-4
- Mapping: `wolfpackChannel = 32 + matrixNumber`

### Routing Commands
Format: `SW I{input} O{output}`
- Example: `SW I5 O33` routes input 5 to Matrix output 1

### Database Tables

**WolfpackMatrixRouting**
```sql
CREATE TABLE "WolfpackMatrixRouting" (
  "id" TEXT PRIMARY KEY,
  "matrixOutputNumber" INTEGER UNIQUE NOT NULL,
  "wolfpackInputNumber" INTEGER,
  "wolfpackInputLabel" TEXT,
  "atlasInputLabel" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "lastRouted" DATETIME,
  "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME
);
```

**WolfpackMatrixState**
```sql
CREATE TABLE "WolfpackMatrixState" (
  "id" TEXT PRIMARY KEY,
  "matrixOutputNumber" INTEGER NOT NULL,
  "wolfpackInputNumber" INTEGER NOT NULL,
  "wolfpackInputLabel" TEXT NOT NULL,
  "channelInfo" TEXT,
  "routedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration

### Matrix Input Labels
Labels can be customized via the API:
```javascript
POST /api/audio-processor/matrix-routing
{
  "matrixOutputNumber": 1,
  "atlasInputLabel": "Matrix 1 - Sports"
}
```

### Wolfpack Connection
Configured in MatrixConfiguration:
- IP Address
- TCP Port (default: 5000)
- UDP Port (default: 4000)
- Protocol (TCP/UDP)

## Testing

### Manual Testing
1. Open Audio Zone Control page
2. Click on a Matrix input (Matrix 1-4)
3. Verify Wolfpack input selector appears
4. Select a video source
5. Verify routing command sent
6. Check database for routing state

### API Testing
```bash
# Get Wolfpack inputs
curl http://localhost:3000/api/wolfpack/inputs

# Route input to Matrix
curl -X POST http://localhost:3000/api/wolfpack/route-to-matrix \
  -H "Content-Type: application/json" \
  -d '{"wolfpackInputNumber": 5, "matrixOutputNumber": 2}'

# Get routing state
curl http://localhost:3000/api/audio-processor/matrix-routing
```

## Future Enhancements

1. **Live Channel Detection**: Query Wolfpack for current channel info
2. **Automatic Label Sync**: Pull Matrix labels from Wolfpack outputs
3. **Routing Presets**: Save common routing configurations
4. **Visual Feedback**: Show active routing in UI
5. **Conflict Detection**: Warn if Matrix output already in use
6. **Batch Routing**: Route multiple Matrix outputs at once

## Troubleshooting

### Matrix Selector Not Appearing
- Check that input has `type: 'matrix'` and valid `matrixNumber`
- Verify WolfpackInputSelector component is imported

### Routing Commands Failing
- Verify Wolfpack IP address and port in MatrixConfiguration
- Check network connectivity to Wolfpack device
- Review logs for command errors

### Database Errors
- Run `npx prisma migrate dev` to apply migrations
- Check DATABASE_URL in .env file
- Verify Prisma Client is generated

## Files Modified/Created

### Created
- `prisma/migrations/*/add_wolfpack_matrix_routing/migration.sql`
- `src/app/api/wolfpack/inputs/route.ts`
- `src/app/api/wolfpack/route-to-matrix/route.ts`
- `src/app/api/audio-processor/matrix-routing/route.ts`
- `src/services/wolfpackMatrixService.ts`
- `src/components/WolfpackInputSelector.tsx`
- `WOLFPACK_MATRIX_INTEGRATION.md`

### Modified
- `prisma/schema.prisma`
- `src/components/AudioZoneControl.tsx`

## Support

For issues or questions:
1. Check logs in browser console and server logs
2. Verify database schema is up to date
3. Test API endpoints individually
4. Review Wolfpack device configuration

## License

Part of Sports Bar TV Controller system.
