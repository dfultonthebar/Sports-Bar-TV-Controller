# Atlas Processor Output Configuration

## Documented from Atlas Web Interface (24.123.87.42:8888)
**Date:** October 23, 2025

## Physical Output Configuration

### Amp Module 1 (Outputs 1-4)
| Output # | Zone Name | Type | Status |
|----------|-----------|------|--------|
| 1 | Bar | Mono | Active |
| 2 | Bar Sub | Mono | Active |
| 3 | Dining | Mono | Active |
| 4 | Party Room West | Mono | Active |

### Amp Module 2 (Outputs 5-8)
| Output # | Zone Name | Type | Status |
|----------|-----------|------|--------|
| 5 | Party Room East | Mono | Active |
| 6 | Patio | Mono | Active |
| 7 | Bathrooms | Mono | Active |
| 8 | -- | -- | Not Configured |

## Zone Groups Configuration

The Atlas processor has the following groups configured:

1. **Main Bar (MB)** - 2 Zones
   - Bar
   - Bar Sub

2. **Dining (D)** - 1 Zone
   - Dining

3. **Party Room (PR)** - Multiple configurations
   - Party Room West
   - Party Room East

4. **Patio (P)** - 1 Zone
   - Patio

5. **Bathroom (B)** - 1 Zone
   - Bathrooms

## Issues Identified

### Issue 1: Bartender Remote - Zones Tab
**Problem:** The Bartender Remote Audio Panel shows a "Zones" tab that should not be visible.

**Expected Behavior:** Only show:
- Groups
- Input Meters
- Output Meters

**File to Fix:** `src/components/BartenderRemoteAudioPanel.tsx`

### Issue 2: Atlas Programming Interface - Output Names
**Problem:** The Atlas Programming Interface is not pulling the correct output names from the Atlas processor.

**Expected Behavior:**
- Output 1 should show as "Bar"
- Output 2 should show as "Bar Sub"
- Output 3 should show as "Dining"
- etc.

**Root Cause:** The configuration API reads from a local JSON file instead of querying the Atlas hardware directly. Users need to use the "Query Hardware" button to fetch actual names.

**Files Involved:**
- `src/components/BartenderRemoteAudioPanel.tsx`
- `src/app/api/atlas/configuration/route.ts`
- `src/app/api/atlas/query-hardware/route.ts`

## Solution Approach

1. Remove the "Zones" tab from BartenderRemoteAudioPanel
2. Update default tab to "groups"
3. Add automatic hardware query on Atlas Programming Interface load
4. Improve UI to indicate when hardware needs to be queried
