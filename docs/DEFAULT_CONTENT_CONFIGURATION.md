# Default Content Configuration

**System:** AI-Powered Scheduler with ESPN & Atmosphere TV Support
**Status:** ✅ Configured and Active
**Date:** November 14, 2025

## Overview

The AI scheduler now intelligently fills idle TVs with appropriate default content when no games are scheduled or when TVs aren't needed for priority games.

## Default Content Strategy

### Main & Bar Areas → ESPN Channels
TVs in high-visibility areas display ESPN channels for sports news and highlights:

- **Input 1 (Cable Box 1)** → ESPN (Channel 206)
- **Input 2 (Cable Box 2)** → ESPN2 (Channel 207)
- **Input 3 (Cable Box 3)** → ESPNU (Channel 567)
- **Input 4 (Cable Box 4)** → ESPN News (Channel 209)

### Side & Patio Areas → Atmosphere TV
TVs in peripheral areas display ambient content:

- **Input 17** → Atmosphere TV (Ambient visual content)

## How It Works

### 1. Game Priority Distribution
When games are found:
```
Packers Playoff vs Bears (Score: 148/150)
├─ Assigned to 8 TVs (main + bar + viewing + side)
├─ Uses Input 5 (DirecTV) tuned to FOX
└─ Remaining 24 TVs available for other content

Bucks vs Heat (Score: 110/150)
├─ Assigned to 5 TVs (main + bar + viewing)
├─ Uses Input 6 (DirecTV) tuned to TNT
└─ Remaining 19 TVs available

Badgers vs Iowa (Score: 90/150)
├─ Assigned to 4 TVs (main + viewing)
├─ Uses Input 1 (Cable Box) tuned to BTN
└─ Remaining 15 TVs get default content
```

### 2. Default Content Assignment
Remaining 15 TVs are distributed:
```
Main Area TVs (5 remaining):
├─ 2 TVs → Input 2 (ESPN2)
├─ 2 TVs → Input 3 (ESPNU)
└─ 1 TV → Input 4 (ESPN News)

Bar Area TVs (4 remaining):
├─ 2 TVs → Input 1 (ESPN)
└─ 2 TVs → Input 2 (ESPN2)

Side/Patio TVs (6 remaining):
└─ All 6 TVs → Input 17 (Atmosphere TV)
```

### 3. Channel Reuse Optimization
The system avoids unnecessary channel changes:
```
✅ GOOD: Input 2 already on ESPN2 → Reuse for 4 TVs
✅ GOOD: Input 17 already on Atmosphere → Reuse for 6 TVs
❌ AVOID: Tuning Input 1 away from Badgers game
```

## Configuration Files

### ESPN Channel Mapping
Channel numbers are Spectrum-specific (may vary by market):

| Network    | Spectrum Channel | Input       |
|------------|------------------|-------------|
| ESPN       | 206              | Cable Box 1 |
| ESPN2      | 207              | Cable Box 2 |
| ESPNU      | 567              | Cable Box 3 |
| ESPN News  | 209              | Cable Box 4 |

### Matrix Input Configuration
```sql
-- Atmosphere TV (Input 17)
UPDATE MatrixInput SET
  label = 'Atmosphere TV',
  deviceType = 'Atmosphere'
WHERE channelNumber = 17;

-- ESPN Cable Boxes (Inputs 1-4)
-- Already configured with labels:
-- "Cable Box 1", "Cable Box 2", "Cable Box 3", "Cable Box 4"
```

## Distribution Logic

### Zone-Based Content Selection

```typescript
if (zone === 'main' || zone === 'bar' || zone === 'viewing-area') {
  // High-visibility zones get ESPN channels
  assignContent('ESPN' or 'ESPN2' or 'ESPNU' or 'ESPN News')
} else if (zone === 'side' || zone === 'patio') {
  // Peripheral zones get Atmosphere TV
  assignContent('Atmosphere TV')
} else {
  // Default to ESPN if zone is unknown
  assignContent('ESPN')
}
```

### Content Rotation
The Distribution Engine rotates between ESPN channels to provide variety:

**Idle Period (No Games):**
```
Main Area (8 TVs):
├─ 2 TVs → ESPN
├─ 2 TVs → ESPN2
├─ 2 TVs → ESPNU
└─ 2 TVs → ESPN News

Bar Area (8 TVs):
├─ 2 TVs → ESPN
├─ 2 TVs → ESPN2
├─ 2 TVs → ESPNU
└─ 2 TVs → ESPN News

Viewing Area (8 TVs):
├─ 2 TVs → ESPN
├─ 2 TVs → ESPN2
├─ 2 TVs → ESPNU
└─ 2 TVs → ESPN News

Side/Patio (8 TVs):
└─ All 8 TVs → Atmosphere TV
```

## Example Scenarios

### Scenario 1: Peak Game Day (Sunday NFL)
**Input:**
- Packers vs Bears (Priority 148)
- Bucks vs Heat (Priority 110)
- Brewers vs Cubs (Priority 100)
- Badgers vs Iowa (Priority 90)

**Output:**
```
Packers: 8 TVs (main + bar + viewing + side)
Bucks: 5 TVs (main + bar + viewing)
Brewers: 3 TVs (main + bar)
Badgers: 4 TVs (main + viewing)
ESPN Channels: 8 TVs (remaining main/bar)
Atmosphere TV: 4 TVs (patio)
━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 32 TVs ✅
```

### Scenario 2: Light Game Day (Weekday Afternoon)
**Input:**
- Brewers vs Cardinals (Priority 85)

**Output:**
```
Brewers: 3 TVs (main + bar)
ESPN: 10 TVs (main + bar)
ESPN2: 7 TVs (main + bar + viewing)
ESPNU: 4 TVs (viewing)
Atmosphere TV: 8 TVs (side + patio)
━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 32 TVs ✅
```

### Scenario 3: No Games Scheduled
**Input:**
- No active games

**Output:**
```
ESPN: 8 TVs (main + bar)
ESPN2: 8 TVs (main + bar + viewing)
ESPNU: 4 TVs (viewing)
ESPN News: 4 TVs (bar)
Atmosphere TV: 8 TVs (side + patio)
━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 32 TVs ✅
```

## Admin Management

### Check Current Configuration
```bash
# View ESPN channel assignments
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT inputNum, inputLabel, channelNumber, channelName
   FROM InputCurrentChannel
   WHERE channelName LIKE '%ESPN%'
   ORDER BY inputNum;"

# View Atmosphere TV status
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT channelNumber, label, deviceType
   FROM MatrixInput
   WHERE deviceType = 'Atmosphere';"
```

### Update ESPN Channel Numbers
If Spectrum changes channel numbers:

```bash
# Update ESPN channel
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "UPDATE InputCurrentChannel
   SET channelNumber = '206'
   WHERE inputLabel = 'Cable Box 1';"
```

### Test Distribution Plan
```bash
# Create test distribution plan
curl -X POST http://localhost:3001/api/scheduler/distribution-plan \
  -H "Content-Type: application/json" \
  -d '{
    "games": [],
    "execute": false
  }' | jq .
```

## Integration with Scheduler

The AI scheduler automatically uses default content when:

1. **No games found** - All TVs get ESPN/Atmosphere TV
2. **Games end** - TVs revert to default content
3. **Low-priority games** - TVs not needed for games get default content
4. **Before games start** - TVs show ESPN while waiting for game time

## Benefits

✅ **No Black Screens** - Every TV always has content
✅ **Sports-Focused** - Main areas always show sports content (ESPN)
✅ **Ambient Atmosphere** - Side areas get visual appeal (Atmosphere TV)
✅ **Automatic** - No manual intervention required
✅ **Smart Rotation** - Variety across ESPN channels
✅ **Channel Reuse** - Minimizes unnecessary tuning

## Future Enhancements

- [ ] Time-based content (News in morning, highlights in evening)
- [ ] Custom channel presets per zone
- [ ] Weather channel integration
- [ ] Local news channels for breaking events
- [ ] Fire TV streaming apps (YouTube TV, Peacock) for overflow

## Monitoring

Distribution Engine logs show default content assignments:

```log
[AI_SCHEDULER] Distribution plan created: 3 games, 20/32 TVs assigned
[AI_SCHEDULER] ✅ Packers vs Bears: 8 TVs in main, bar, viewing-area, side
[AI_SCHEDULER] ✅ Bucks vs Heat: 5 TVs in main, bar, viewing-area
[AI_SCHEDULER] ✅ Brewers vs Cubs: 3 TVs in main, bar
[AI_SCHEDULER] Default content assigned to 12 idle TVs
[AI_SCHEDULER]    - 8 TVs → ESPN channels (main/bar areas)
[AI_SCHEDULER]    - 4 TVs → Atmosphere TV (patio area)
```

## Summary

The AI scheduler now provides a complete content distribution solution:

- **High-priority games** get maximum TVs in preferred zones
- **Medium-priority games** get adequate coverage
- **Idle TVs** display appropriate default content (ESPN or Atmosphere)
- **Zone-based strategy** ensures optimal viewing experience
- **Automatic rotation** prevents monotony
- **Channel reuse** minimizes hardware load

All default content is handled automatically by the Distribution Engine with no manual configuration required during operation!
