# Sports Scheduling System with Smart Input Source Management
## Comprehensive Design Document

**Version:** 1.0
**Date:** 2025-11-14
**Author:** Claude Code Analysis

---

## Table of Contents

1. [ESPN Scoreboard API Research](#part-1-espn-scoreboard-api-research)
2. [Smart Input Source Switching Logic](#part-2-smart-input-source-switching-logic)
3. [Database Schema Design](#part-3-database-schema-design)
4. [ESPN Schedule Sync Service](#part-4-espn-schedule-sync-service)
5. [Example Scenarios](#part-5-example-scenarios)
6. [Implementation Recommendations](#implementation-recommendations)

---

## Part 1: ESPN Scoreboard API Research

### 1.1 API Endpoints Tested

#### Base Scoreboard Endpoints
```
NFL:  https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
NBA:  https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
MLB:  https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard
NCAA: https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
```

#### Date-Filtered Queries
```
Format: ?dates=YYYYMMDD
Example: https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20250115
```

### 1.2 Response Structure

ESPN uses a hierarchical structure:
```
Response Root
└── leagues[] (array of leagues)
    └── events[] (array of games)
        └── competitions[] (array of matchups within event)
            ├── competitors[] (teams)
            ├── status (game state)
            ├── broadcasts[] (TV networks)
            └── odds[] (betting lines)
```

### 1.3 Key Fields Available

#### Date/Time Fields
```json
{
  "date": "2025-11-14T01:15Z",           // ISO 8601 UTC timestamp
  "startDate": "2025-11-14T01:15Z",      // Competition start
  "displayClock": "0:00",                 // Human-readable clock
  "period": 4,                            // Current period/quarter
  "status": {
    "type": {
      "id": "1",                          // 1=scheduled, 2=in_progress, 3=final
      "name": "Scheduled",
      "state": "pre",
      "completed": false,
      "description": "Scheduled",
      "detail": "Sun, November 16th at 9:30 AM EST"
    }
  }
}
```

#### Team Information
```json
{
  "competitors": [
    {
      "id": "3",
      "uid": "s:20~l:28~t:3",
      "type": "team",
      "order": 0,
      "homeAway": "home",
      "team": {
        "id": "3",
        "location": "Green Bay",
        "name": "Packers",
        "abbreviation": "GB",
        "displayName": "Green Bay Packers",
        "shortDisplayName": "Packers",
        "color": "203731",
        "alternateColor": "FFB612",
        "logo": "https://a.espncdn.com/i/teamlogos/nfl/500/gb.png"
      },
      "score": "27",
      "linescores": [
        {"value": 7, "displayValue": "7"},
        {"value": 10, "displayValue": "10"},
        {"value": 7, "displayValue": "7"},
        {"value": 3, "displayValue": "3"}
      ],
      "records": [
        {
          "name": "overall",
          "type": "total",
          "summary": "9-2",
          "displayValue": "9-2"
        }
      ]
    }
  ]
}
```

#### Season Type & Playoff Indicators

**NFL Season Types:**
```json
{
  "season": {
    "year": 2025,
    "type": 2,                    // 1=preseason, 2=regular, 3=postseason
    "slug": "regular-season"
  },
  "week": {
    "number": 11,
    "text": "Week 11"             // Playoff: "Wild Card", "Divisional Round", etc.
  }
}
```

**Playoff Round Detection:**
```json
{
  "notes": [
    {
      "headline": "World Series - Game 7"
    }
  ],
  "series": {
    "type": "playoff",
    "title": "Playoff Series",
    "summary": "LAD win series 4-3",
    "completed": true,
    "totalCompetitions": 7
  }
}
```

**NCAA Tournament Detection:**
```json
{
  "season": {
    "type": 3,                    // Tournament = type 3
    "slug": "march-madness"       // or specific rounds
  }
}
```

#### Broadcast Information
```json
{
  "broadcasts": [
    {
      "market": "national",
      "names": ["Prime Video", "FOX"]
    },
    {
      "market": "home",
      "names": ["FanDuel SN FL", "YES"]
    }
  ],
  "geoBroadcasts": [
    {
      "type": {
        "id": "1",
        "shortName": "TV"
      },
      "market": {
        "id": "1",
        "type": "National"
      },
      "media": {
        "shortName": "FOX"
      },
      "lang": "en",
      "region": "us"
    }
  ]
}
```

### 1.4 Playoff/Tournament Detection Strategy

#### Detection Matrix

| League | Regular Season Type | Playoff Type | Round Indicator |
|--------|-------------------|--------------|-----------------|
| NFL | `season.type: 2` | `season.type: 3` | `week.text: "Wild Card"`, `"Divisional Round"`, `"Conference Championship"`, `"Super Bowl"` |
| NBA | `season.type: 2` | `season.type: 3` | `notes[].headline: "Play-In Tournament"`, `"First Round"`, `"Finals"` |
| MLB | `season.type: 2` | `season.type: 3` | `notes[].headline: "Wild Card"`, `"Division Series"`, `"Championship Series"`, `"World Series"` |
| NCAA Basketball | `season.type: 2` | `season.type: 3` | `season.slug: "march-madness"`, `week.text: "First Round"`, `"Elite Eight"`, `"Final Four"` |
| NHL | `season.type: 2` | `season.type: 3` | `notes[].headline: "Stanley Cup"` rounds |

#### Playoff Bonus Calculation
```typescript
function calculatePlayoffBonus(seasonType: number, roundText: string): number {
  if (seasonType !== 3) return 0; // Not a playoff game

  const roundBonuses: Record<string, number> = {
    // NFL
    'Wild Card': 10,
    'Divisional Round': 15,
    'Conference Championship': 25,
    'Super Bowl': 50,

    // NBA/NHL
    'Play-In Tournament': 5,
    'First Round': 10,
    'Conference Semifinals': 15,
    'Conference Finals': 25,
    'Finals': 50,
    'Stanley Cup': 50,

    // MLB
    'Wild Card': 10,
    'Division Series': 15,
    'Championship Series': 25,
    'World Series': 50,

    // NCAA
    'First Round': 10,
    'Second Round': 12,
    'Sweet 16': 15,
    'Elite Eight': 20,
    'Final Four': 30,
    'Championship': 50
  };

  return roundBonuses[roundText] || 10; // Default playoff bonus
}
```

### 1.5 Date Query Capabilities

#### Date Format
- **Parameter:** `dates=YYYYMMDD`
- **Example:** `dates=20250115` (January 15, 2025)
- **Multiple dates:** Not supported (one date per query)

#### Date Range Support
- **Past games:** Available (with final scores)
- **Future games:** Up to ~14 days ahead
- **Current day:** Default when no `dates` parameter provided

#### Query Strategy
```typescript
// Get next 7 days of games
async function getUpcomingGames(league: string): Promise<Game[]> {
  const games: Game[] = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${dateStr}`;
    const response = await fetch(url);
    const data = await response.json();

    games.push(...parseGames(data));
  }

  return games;
}
```

### 1.6 Sample Response Analysis

#### NFL Regular Season Game
```json
{
  "id": "401671899",
  "uid": "s:20~l:28~e:401671899",
  "date": "2025-11-16T17:30Z",
  "name": "Chicago Bears at Green Bay Packers",
  "shortName": "CHI @ GB",
  "season": {
    "year": 2025,
    "type": 2,
    "slug": "regular-season"
  },
  "week": {
    "number": 11,
    "text": "Week 11"
  },
  "competitions": [
    {
      "id": "401671899",
      "uid": "s:20~l:28~e:401671899~c:401671899",
      "date": "2025-11-16T17:30Z",
      "attendance": 0,
      "type": {
        "id": "1"
      },
      "timeValid": true,
      "neutralSite": false,
      "conferenceCompetition": true,
      "playByPlayAvailable": false,
      "status": {
        "clock": 0,
        "displayClock": "0:00",
        "period": 0,
        "type": {
          "id": "1",
          "name": "STATUS_SCHEDULED",
          "state": "pre",
          "completed": false,
          "description": "Scheduled",
          "detail": "Sun, November 16th at 9:30 AM EST"
        }
      },
      "competitors": [
        {
          "id": "3",
          "homeAway": "home",
          "team": {
            "id": "3",
            "location": "Green Bay",
            "name": "Packers",
            "abbreviation": "GB"
          },
          "score": "0",
          "records": [
            {
              "name": "overall",
              "summary": "9-2"
            }
          ]
        },
        {
          "id": "3",
          "homeAway": "away",
          "team": {
            "id": "3",
            "location": "Chicago",
            "name": "Bears",
            "abbreviation": "CHI"
          },
          "score": "0",
          "records": [
            {
              "name": "overall",
              "summary": "4-7"
            }
          ]
        }
      ],
      "broadcasts": [
        {
          "market": "national",
          "names": ["FOX"]
        }
      ]
    }
  ]
}
```

#### MLB World Series Game (Playoff)
```json
{
  "id": "401583219",
  "date": "2025-11-01T00:08Z",
  "name": "New York Yankees at Los Angeles Dodgers",
  "season": {
    "year": 2024,
    "type": 3,                          // POSTSEASON
    "slug": "post-season"
  },
  "competitions": [
    {
      "notes": [
        {
          "headline": "World Series - Game 7"  // Round indicator
        }
      ],
      "series": {
        "type": "playoff",
        "title": "Playoff Series",
        "summary": "LAD win series 4-3",
        "completed": true,
        "totalCompetitions": 7,
        "competitors": [
          {
            "id": "19",
            "wins": 4
          },
          {
            "id": "10",
            "wins": 3
          }
        ]
      },
      "status": {
        "type": {
          "id": "3",                      // FINAL
          "name": "STATUS_FINAL"
        }
      },
      "broadcasts": [
        {
          "market": "national",
          "names": ["FOX"]
        }
      ]
    }
  ]
}
```

### 1.7 API Limitations & Considerations

#### Rate Limiting
- **No official rate limit documented**
- **Recommended:** 1 request per second maximum
- **Cache strategy:** Store responses for 5-15 minutes depending on game status

#### Data Freshness
- **Pre-game:** Updates hourly (schedule changes)
- **Live games:** Updates every 10-15 seconds
- **Final games:** No further updates

#### Missing Data
- **Future broadcasts:** Not always available >7 days out
- **Playoff brackets:** No structured bracket data in scoreboard API
- **Streaming availability:** Limited to major platforms

#### Error Handling
```typescript
interface APIError {
  statusCode: number;
  message: string;
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

---

## Part 2: Smart Input Source Switching Logic

### 2.1 The Problem Statement

**Current System Limitation:**
- Sports bar has multiple TVs (12 total)
- Multiple input sources (Cable Box, DirecTV, Fire TV)
- HDMI matrix routes inputs to outputs (TVs)
- When a cable box changes channels, ALL TVs watching that input change
- **Critical Issue:** Cannot show two different cable channels simultaneously on one cable box

**Real-World Example:**
```
3:00 PM - Packers game starts on FOX (Cable channel 502)
  → Allocate Cable Box to Packers (8 TVs)

6:00 PM - Bucks game starts on Bally Sports (Cable channel 670)
  → Problem: Cable box already in use by Packers game
  → Bad Solution: Change cable to channel 670 → Interrupts Packers viewers!
  → Good Solution: Use Fire TV (Bally Sports app) for Bucks game
```

### 2.2 Input Source Capabilities

#### Input Source Types

| Input Type | Capabilities | Pros | Cons |
|------------|-------------|------|------|
| **Cable Box** | All cable channels (1-999) | Best quality, most channels | One channel at a time |
| **DirecTV** | All satellite channels | Good quality, sports packages | One channel at a time |
| **Fire TV** | Streaming apps (ESPN, Bally, Fox Sports, etc.) | Multiple apps = multiple "channels" | Requires app switching, slightly lower quality |

#### Input Source Inventory
```typescript
interface InputSource {
  id: string;                         // 'cable-box-1', 'directv-1', 'firetv-1'
  type: 'cable' | 'directv' | 'firetv' | 'streaming';
  matrixInputNumber: number;          // Which HDMI input on the matrix
  currentChannel?: string | null;     // Current channel/app (null if idle)
  currentAppName?: string | null;     // For streaming devices
  availableAt?: Date | null;          // When this input becomes free
  capabilities: string[];             // ['espn', 'bally-sports', 'fox-sports', 'nbc-sports']
  qualityScore: number;               // Higher = better quality (Cable=10, DirecTV=9, FireTV=7)
  simultaneousStreams: number;        // Cable/DirecTV=1, FireTV=1 per app
}

// Example inventory
const INPUT_SOURCES: InputSource[] = [
  {
    id: 'cable-box-1',
    type: 'cable',
    matrixInputNumber: 1,
    currentChannel: null,
    availableAt: null,
    capabilities: ['all-cable-channels'],
    qualityScore: 10,
    simultaneousStreams: 1
  },
  {
    id: 'directv-1',
    type: 'directv',
    matrixInputNumber: 2,
    currentChannel: null,
    availableAt: null,
    capabilities: ['all-directv-channels'],
    qualityScore: 9,
    simultaneousStreams: 1
  },
  {
    id: 'firetv-1',
    type: 'firetv',
    matrixInputNumber: 3,
    currentChannel: null,
    currentAppName: null,
    availableAt: null,
    capabilities: ['espn', 'espn2', 'bally-sports', 'fox-sports', 'nbc-sports', 'paramount-plus'],
    qualityScore: 7,
    simultaneousStreams: 1  // One app at a time
  },
  {
    id: 'firetv-2',
    type: 'firetv',
    matrixInputNumber: 4,
    currentChannel: null,
    currentAppName: null,
    availableAt: null,
    capabilities: ['espn', 'espn2', 'bally-sports', 'fox-sports', 'nbc-sports', 'paramount-plus'],
    qualityScore: 7,
    simultaneousStreams: 1
  }
];
```

### 2.3 Network-to-Input Mapping

#### Channel/Network Availability Matrix

```typescript
interface NetworkAvailability {
  networkName: string;                // 'ESPN', 'FOX', 'Bally Sports Wisconsin'
  cableChannel?: string;              // '502' (FOX on cable)
  directvChannel?: string;            // '212' (FOX on DirecTV)
  fireTVApp?: string;                 // 'Fox Sports' app
  streamingServices?: string[];       // ['Hulu Live', 'YouTube TV']
  preferredSource: 'cable' | 'directv' | 'firetv';  // Quality preference
}

const NETWORK_MAPPINGS: NetworkAvailability[] = [
  {
    networkName: 'FOX',
    cableChannel: '502',
    directvChannel: '212',
    fireTVApp: 'Fox Sports',
    streamingServices: ['Hulu Live', 'YouTube TV', 'Sling TV'],
    preferredSource: 'cable'
  },
  {
    networkName: 'ESPN',
    cableChannel: '571',
    directvChannel: '206',
    fireTVApp: 'ESPN',
    streamingServices: ['Hulu Live', 'YouTube TV', 'Sling TV'],
    preferredSource: 'cable'
  },
  {
    networkName: 'Bally Sports Wisconsin',
    cableChannel: '670',
    directvChannel: '668',
    fireTVApp: 'Bally Sports',
    streamingServices: [],  // Not on major streaming services
    preferredSource: 'cable'
  },
  {
    networkName: 'NBC Sports',
    cableChannel: '575',
    directvChannel: '220',
    fireTVApp: 'NBC Sports',
    streamingServices: ['Peacock', 'Hulu Live'],
    preferredSource: 'cable'
  },
  {
    networkName: 'CBS',
    cableChannel: '504',
    directvChannel: '214',
    fireTVApp: 'Paramount+',
    streamingServices: ['Paramount+', 'Hulu Live'],
    preferredSource: 'cable'
  },
  {
    networkName: 'Amazon Prime Video',
    cableChannel: null,
    directvChannel: null,
    fireTVApp: 'Prime Video',
    streamingServices: ['Prime Video'],
    preferredSource: 'firetv'
  }
];

function findInputOptionsForNetwork(network: string): NetworkAvailability | null {
  return NETWORK_MAPPINGS.find(n =>
    n.networkName.toLowerCase() === network.toLowerCase()
  ) || null;
}
```

### 2.4 Game Allocation Algorithm

#### Core Data Structures

```typescript
interface GameAllocation {
  // Game info
  gameId: string;                     // ESPN game ID
  espnGameId: string;
  sport: string;                      // 'football', 'basketball', etc.
  league: string;                     // 'nfl', 'nba', 'mlb'

  // Teams
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;

  // Priority team info
  priorityTeamId?: string;            // Which team is a home team (if any)
  priorityTeamName?: string;
  basePriority: number;               // From HomeTeam.priority field (0-100)
  playoffBonus: number;               // Playoff game bonus (0-50)
  totalPriority: number;              // basePriority + playoffBonus

  // Timing
  scheduledStart: Date;
  estimatedEnd: Date;                 // Calculated from sport duration
  actualStart?: Date;                 // When game actually started
  actualEnd?: Date;                   // When game actually ended

  // Broadcasting
  network: string;                    // 'ESPN', 'FOX', etc.
  broadcastInfo: string;              // JSON with all broadcast options

  // Allocation state
  allocatedInput: InputSource | null;
  allocatedTVs: number[];             // Matrix output numbers (TV IDs)
  tvCount: number;                    // Number of TVs allocated
  status: 'pending' | 'active' | 'completed' | 'cancelled';

  // Reallocation tracking
  canBeReallocated: boolean;          // True if input becomes available
  waitingForReallocation: boolean;    // True if waiting for better input
  preferredInputType: 'cable' | 'directv' | 'firetv';
}

interface AllocationPlan {
  timestamp: Date;
  allocations: GameAllocation[];
  conflicts: AllocationConflict[];
  recommendations: AllocationRecommendation[];
}

interface AllocationConflict {
  type: 'input_collision' | 'insufficient_tvs' | 'network_unavailable';
  games: GameAllocation[];
  description: string;
  suggestedResolution: string;
}

interface AllocationRecommendation {
  gameId: string;
  recommendation: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}
```

#### SmartInputAllocator Class

```typescript
class SmartInputAllocator {
  private inputSources: InputSource[];
  private networkMappings: NetworkAvailability[];
  private currentAllocations: GameAllocation[];

  constructor(
    inputSources: InputSource[],
    networkMappings: NetworkAvailability[]
  ) {
    this.inputSources = inputSources;
    this.networkMappings = networkMappings;
    this.currentAllocations = [];
  }

  /**
   * Main allocation function
   * Allocates games to input sources WITHOUT interrupting active games
   */
  allocateGames(
    upcomingGames: GameAllocation[],
    maxTVsPerGame: number = 12
  ): AllocationPlan {
    const plan: AllocationPlan = {
      timestamp: new Date(),
      allocations: [],
      conflicts: [],
      recommendations: []
    };

    // Sort games by priority (highest first)
    const sortedGames = [...upcomingGames].sort((a, b) =>
      b.totalPriority - a.totalPriority
    );

    for (const game of sortedGames) {
      // Find best available input for this game
      const bestInput = this.findBestInput(game, this.currentAllocations);

      if (!bestInput) {
        // No input available
        plan.conflicts.push({
          type: 'input_collision',
          games: [game],
          description: `No input available for ${game.homeTeamName} vs ${game.awayTeamName}`,
          suggestedResolution: this.suggestInputResolution(game)
        });
        continue;
      }

      // Calculate TV allocation
      const tvAllocation = this.calculateTVAllocation(
        game,
        bestInput,
        maxTVsPerGame
      );

      // Create allocation
      const allocation: GameAllocation = {
        ...game,
        allocatedInput: bestInput,
        allocatedTVs: tvAllocation.tvIds,
        tvCount: tvAllocation.tvIds.length,
        status: 'pending',
        canBeReallocated: bestInput.qualityScore < 10, // Can upgrade to cable later
        waitingForReallocation: false,
        preferredInputType: this.getPreferredInputType(game.network)
      };

      plan.allocations.push(allocation);
      this.currentAllocations.push(allocation);

      // Mark input as occupied
      bestInput.currentChannel = this.getChannelForNetwork(
        game.network,
        bestInput.type
      );
      bestInput.availableAt = game.estimatedEnd;

      // Add recommendation if using non-preferred input
      if (bestInput.type !== allocation.preferredInputType) {
        plan.recommendations.push({
          gameId: game.gameId,
          recommendation: `Game allocated to ${bestInput.type} but ${allocation.preferredInputType} is preferred`,
          reason: `Better quality available when ${allocation.preferredInputType} becomes free`,
          priority: game.totalPriority > 80 ? 'high' : 'medium'
        });
      }
    }

    return plan;
  }

  /**
   * Find best input source for a game
   * Priority order:
   * 1. Idle inputs first (not currently in use)
   * 2. Inputs with matching network capability
   * 3. Higher quality inputs (Cable > DirecTV > FireTV)
   * 4. Inputs that will be free soonest
   */
  findBestInput(
    game: GameAllocation,
    currentAllocations: GameAllocation[]
  ): InputSource | null {
    const now = new Date();
    const networkOptions = findInputOptionsForNetwork(game.network);

    if (!networkOptions) {
      console.error(`No input options found for network: ${game.network}`);
      return null;
    }

    // Get all inputs that CAN show this network
    const capableInputs = this.inputSources.filter(input => {
      if (input.type === 'cable' && networkOptions.cableChannel) return true;
      if (input.type === 'directv' && networkOptions.directvChannel) return true;
      if (input.type === 'firetv' && networkOptions.fireTVApp) return true;
      return false;
    });

    if (capableInputs.length === 0) {
      console.error(`No capable inputs for network: ${game.network}`);
      return null;
    }

    // Separate idle vs. occupied inputs
    const idleInputs = capableInputs.filter(input =>
      !input.currentChannel || !input.availableAt || input.availableAt <= now
    );

    const occupiedInputs = capableInputs.filter(input =>
      input.currentChannel && input.availableAt && input.availableAt > now
    );

    // PREFER IDLE INPUTS FIRST
    if (idleInputs.length > 0) {
      // Sort by quality score (highest first)
      return idleInputs.sort((a, b) => b.qualityScore - a.qualityScore)[0];
    }

    // NO IDLE INPUTS - Check if we can wait for one to become free
    // Only use occupied input if game starts AFTER it becomes free
    const availableLaterInputs = occupiedInputs.filter(input =>
      input.availableAt && input.availableAt <= game.scheduledStart
    );

    if (availableLaterInputs.length > 0) {
      // Sort by quality score, then by availability time
      return availableLaterInputs.sort((a, b) => {
        const qualityDiff = b.qualityScore - a.qualityScore;
        if (qualityDiff !== 0) return qualityDiff;
        return (a.availableAt?.getTime() || 0) - (b.availableAt?.getTime() || 0);
      })[0];
    }

    // NO INPUT AVAILABLE - Return null to trigger conflict
    return null;
  }

  /**
   * Calculate which TVs to allocate to a game
   */
  calculateTVAllocation(
    game: GameAllocation,
    input: InputSource,
    maxTVsPerGame: number
  ): { tvIds: number[]; count: number } {
    // Get currently free TVs (not allocated to active games)
    const activeAllocations = this.currentAllocations.filter(
      a => a.status === 'active' || a.status === 'pending'
    );

    const occupiedTVs = new Set<number>();
    activeAllocations.forEach(a => {
      a.allocatedTVs.forEach(tv => occupiedTVs.add(tv));
    });

    const totalTVs = 12; // Configurable
    const freeTVs: number[] = [];
    for (let i = 1; i <= totalTVs; i++) {
      if (!occupiedTVs.has(i)) {
        freeTVs.push(i);
      }
    }

    // Determine how many TVs this game should get
    // Priority-based allocation:
    // - Priority 90-100: 8-10 TVs
    // - Priority 70-89: 4-6 TVs
    // - Priority 50-69: 2-4 TVs
    // - Priority <50: 1-2 TVs

    let targetTVCount: number;
    if (game.totalPriority >= 90) {
      targetTVCount = Math.min(10, maxTVsPerGame);
    } else if (game.totalPriority >= 70) {
      targetTVCount = Math.min(6, maxTVsPerGame);
    } else if (game.totalPriority >= 50) {
      targetTVCount = Math.min(4, maxTVsPerGame);
    } else {
      targetTVCount = Math.min(2, maxTVsPerGame);
    }

    // Allocate TVs
    const allocatedTVs = freeTVs.slice(0, Math.min(targetTVCount, freeTVs.length));

    return {
      tvIds: allocatedTVs,
      count: allocatedTVs.length
    };
  }

  /**
   * Calculate when input will be free
   */
  calculateInputAvailability(
    input: InputSource,
    currentAllocations: GameAllocation[]
  ): Date | null {
    const allocationsUsingInput = currentAllocations.filter(
      a => a.allocatedInput?.id === input.id &&
           (a.status === 'active' || a.status === 'pending')
    );

    if (allocationsUsingInput.length === 0) {
      return new Date(); // Available now
    }

    // Find latest estimated end time
    const endTimes = allocationsUsingInput.map(a => a.estimatedEnd);
    return new Date(Math.max(...endTimes.map(d => d.getTime())));
  }

  /**
   * Reallocate TVs when game ends
   * This function runs when a game finishes to:
   * 1. Free up the input source
   * 2. Reallocate waiting games to better inputs
   * 3. Rebalance TV distribution
   */
  reallocateOnGameEnd(
    endedGameId: string,
    waitingGames: GameAllocation[]
  ): AllocationPlan {
    // Find the allocation that just ended
    const endedAllocation = this.currentAllocations.find(
      a => a.gameId === endedGameId
    );

    if (!endedAllocation) {
      throw new Error(`Game allocation not found: ${endedGameId}`);
    }

    // Mark as completed
    endedAllocation.status = 'completed';
    endedAllocation.actualEnd = new Date();

    // Free the input source
    if (endedAllocation.allocatedInput) {
      endedAllocation.allocatedInput.currentChannel = null;
      endedAllocation.allocatedInput.availableAt = null;
    }

    // Find games that were waiting for this input type
    const upgradeCandidates = this.currentAllocations.filter(a =>
      a.status === 'active' &&
      a.preferredInputType === endedAllocation.allocatedInput?.type &&
      a.allocatedInput?.qualityScore < (endedAllocation.allocatedInput?.qualityScore || 0)
    );

    const plan: AllocationPlan = {
      timestamp: new Date(),
      allocations: [],
      conflicts: [],
      recommendations: []
    };

    // Upgrade games to better input if available
    for (const candidate of upgradeCandidates) {
      const betterInput = this.findBestInput(candidate, this.currentAllocations);

      if (betterInput && betterInput.qualityScore > (candidate.allocatedInput?.qualityScore || 0)) {
        // Recommend upgrade
        plan.recommendations.push({
          gameId: candidate.gameId,
          recommendation: `Upgrade from ${candidate.allocatedInput?.type} to ${betterInput.type}`,
          reason: `Better quality input now available`,
          priority: 'high'
        });

        // Perform upgrade
        if (candidate.allocatedInput) {
          candidate.allocatedInput.currentChannel = null;
          candidate.allocatedInput.availableAt = null;
        }

        candidate.allocatedInput = betterInput;
        betterInput.currentChannel = this.getChannelForNetwork(
          candidate.network,
          betterInput.type
        );
        betterInput.availableAt = candidate.estimatedEnd;

        plan.allocations.push(candidate);
      }
    }

    // Allocate any waiting games
    const newAllocations = this.allocateGames(waitingGames);
    plan.allocations.push(...newAllocations.allocations);
    plan.conflicts.push(...newAllocations.conflicts);
    plan.recommendations.push(...newAllocations.recommendations);

    return plan;
  }

  /**
   * Get preferred input type for a network
   */
  private getPreferredInputType(network: string): 'cable' | 'directv' | 'firetv' {
    const mapping = findInputOptionsForNetwork(network);
    return mapping?.preferredSource || 'cable';
  }

  /**
   * Get channel number for network on specific input type
   */
  private getChannelForNetwork(network: string, inputType: string): string | null {
    const mapping = findInputOptionsForNetwork(network);
    if (!mapping) return null;

    switch (inputType) {
      case 'cable':
        return mapping.cableChannel || null;
      case 'directv':
        return mapping.directvChannel || null;
      case 'firetv':
        return mapping.fireTVApp || null;
      default:
        return null;
    }
  }

  /**
   * Suggest resolution for input collision
   */
  private suggestInputResolution(game: GameAllocation): string {
    const occupiedInputs = this.inputSources.filter(i => i.currentChannel);

    if (occupiedInputs.length === 0) {
      return 'No inputs are occupied. This is a configuration error.';
    }

    const nextAvailable = occupiedInputs
      .filter(i => i.availableAt)
      .sort((a, b) => (a.availableAt?.getTime() || 0) - (b.availableAt?.getTime() || 0))[0];

    if (nextAvailable && nextAvailable.availableAt) {
      const minutesUntilFree = Math.round(
        (nextAvailable.availableAt.getTime() - new Date().getTime()) / 60000
      );

      return `Wait ${minutesUntilFree} minutes for ${nextAvailable.type} to become available, or add another input source.`;
    }

    return 'All inputs occupied indefinitely. Add more input sources or reduce simultaneous games.';
  }
}
```

### 2.5 Game Duration Estimates

Different sports have different typical game durations:

```typescript
const GAME_DURATIONS: Record<string, number> = {
  // Hours
  'football': 3.5,        // NFL: ~3.5 hours
  'basketball': 2.5,      // NBA/NCAA: ~2.5 hours
  'baseball': 3.0,        // MLB: ~3 hours (highly variable)
  'hockey': 2.5,          // NHL: ~2.5 hours
  'soccer': 2.0,          // MLS/Premier League: ~2 hours
  'tennis': 3.0,          // Singles match: ~2-4 hours
  'golf': 4.0,            // Tournament round: ~4-5 hours
};

function estimateGameEnd(startTime: Date, sport: string): Date {
  const durationHours = GAME_DURATIONS[sport.toLowerCase()] || 3.0;
  const durationMs = durationHours * 60 * 60 * 1000;
  return new Date(startTime.getTime() + durationMs);
}

function updateGameEndEstimate(
  game: GameAllocation,
  currentPeriod: string,
  timeRemaining: string
): Date {
  // For live games, calculate more accurate end time
  // Example: NFL "Q3 5:32" remaining

  if (game.sport === 'football') {
    const periodsLeft = 4 - parseInt(currentPeriod.replace(/\D/g, ''));
    const [minutes, seconds] = timeRemaining.split(':').map(Number);
    const remainingMs = (periodsLeft * 15 + minutes) * 60 * 1000 + seconds * 1000;
    return new Date(Date.now() + remainingMs);
  }

  // Fallback: use original estimate
  return game.estimatedEnd;
}
```

### 2.6 Input Quality Scoring

```typescript
const INPUT_QUALITY_SCORES = {
  cable: 10,        // Best: Direct feed, no buffering
  directv: 9,       // Excellent: Satellite, minimal delay
  firetv: 7,        // Good: Streaming, potential buffering
  chromecast: 6,    // Fair: Streaming, more latency
  webstream: 4      // Poor: Browser-based, high latency
};

function calculateInputScore(
  input: InputSource,
  game: GameAllocation
): number {
  let score = input.qualityScore;

  // Bonus: Preferred network match
  if (input.type === game.preferredInputType) {
    score += 2;
  }

  // Penalty: Input already in use (requires channel change)
  if (input.currentChannel) {
    score -= 5;
  }

  // Penalty: Input not available until after game starts
  if (input.availableAt && input.availableAt > game.scheduledStart) {
    score -= 10;
  }

  return score;
}
```

---

## Part 3: Database Schema Design

### 3.1 New Tables Required

#### Table: `game_schedules`

Stores all scheduled, in-progress, and completed games from ESPN.

```sql
CREATE TABLE game_schedules (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- ESPN Data
  espn_game_id TEXT UNIQUE NOT NULL,
  espn_uid TEXT,

  -- Sport/League
  sport TEXT NOT NULL,                -- 'football', 'basketball', 'baseball', 'hockey'
  league TEXT NOT NULL,               -- 'nfl', 'nba', 'mlb', 'nhl', 'ncaa-mens-basketball'

  -- Teams
  home_team_id TEXT REFERENCES HomeTeam(id) ON DELETE SET NULL,
  away_team_id TEXT REFERENCES HomeTeam(id) ON DELETE SET NULL,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_team_abbr TEXT,
  away_team_abbr TEXT,
  home_team_logo TEXT,
  away_team_logo TEXT,

  -- Priority Team Detection
  priority_team_id TEXT REFERENCES HomeTeam(id) ON DELETE SET NULL,
  priority_team_name TEXT,
  base_priority INTEGER NOT NULL DEFAULT 0,      -- From HomeTeam.priority (0-100)
  playoff_bonus INTEGER NOT NULL DEFAULT 0,      -- Playoff game bonus (0-50)
  total_priority INTEGER NOT NULL DEFAULT 0,     -- base_priority + playoff_bonus

  -- Timing
  scheduled_start DATETIME NOT NULL,
  estimated_end DATETIME,                        -- Calculated from sport duration
  actual_start DATETIME,                         -- When game actually started (from ESPN status)
  actual_end DATETIME,                           -- When game actually ended

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',      -- 'scheduled', 'in_progress', 'final', 'postponed', 'cancelled'
  status_type_id TEXT,                           -- ESPN status.type.id
  status_detail TEXT,                            -- ESPN status.detail
  current_period TEXT,                           -- 'Q1', 'Top 9th', 'Period 2', etc.
  time_remaining TEXT,                           -- '5:32', 'Final', 'Halftime', etc.
  display_clock TEXT,                            -- ESPN displayClock value

  -- Playoff/Tournament Info
  season_year INTEGER NOT NULL,
  season_type INTEGER NOT NULL DEFAULT 2,        -- 1=preseason, 2=regular, 3=postseason
  season_type_name TEXT,                         -- 'Regular Season', 'Postseason'
  week_number INTEGER,
  week_text TEXT,                                -- 'Week 11', 'Wild Card', 'Super Bowl'
  playoff_round TEXT,                            -- 'Wild Card', 'Divisional Round', 'Conference Championship', 'Super Bowl'
  tournament_name TEXT,                          -- 'NCAA Tournament', 'March Madness'
  is_playoff_game BOOLEAN DEFAULT FALSE,
  is_conference_game BOOLEAN DEFAULT FALSE,

  -- Series Info (for playoffs)
  series_type TEXT,                              -- 'playoff', 'regular'
  series_title TEXT,                             -- 'Playoff Series'
  series_summary TEXT,                           -- 'LAD win series 4-3'
  series_completed BOOLEAN DEFAULT FALSE,
  series_total_games INTEGER,

  -- Venue
  venue_name TEXT,
  venue_city TEXT,
  venue_state TEXT,
  is_neutral_site BOOLEAN DEFAULT FALSE,

  -- Broadcasting
  network TEXT,                                  -- Primary network: 'ESPN', 'FOX', 'NBC'
  broadcast_market TEXT,                         -- 'national', 'home', 'away'
  broadcast_info TEXT,                           -- JSON with all broadcast options
  geo_broadcasts TEXT,                           -- JSON with geoBroadcasts data

  -- Scoring
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  home_linescores TEXT,                          -- JSON array of period scores
  away_linescores TEXT,                          -- JSON array of period scores

  -- Records
  home_team_record TEXT,                         -- '9-2', '14-5-2'
  away_team_record TEXT,

  -- Odds (optional)
  odds_spread REAL,
  odds_over_under REAL,

  -- Priority Flags
  is_priority_game BOOLEAN DEFAULT FALSE,        -- Involves a priority team
  is_featured_game BOOLEAN DEFAULT FALSE,        -- Manually featured by admin

  -- Allocation State
  allocation_status TEXT DEFAULT 'pending',      -- 'pending', 'allocated', 'active', 'completed'
  allocated_at DATETIME,

  -- Metadata
  espn_raw_data TEXT,                            -- Full JSON from ESPN (for debugging)
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Check Constraints
  CHECK (season_type IN (1, 2, 3)),
  CHECK (status IN ('scheduled', 'in_progress', 'final', 'postponed', 'cancelled')),
  CHECK (allocation_status IN ('pending', 'allocated', 'active', 'completed'))
);

-- Indexes
CREATE INDEX idx_game_schedules_start ON game_schedules(scheduled_start);
CREATE INDEX idx_game_schedules_status ON game_schedules(status);
CREATE INDEX idx_game_schedules_league ON game_schedules(league);
CREATE INDEX idx_game_schedules_teams ON game_schedules(home_team_id, away_team_id);
CREATE INDEX idx_game_schedules_priority ON game_schedules(is_priority_game, total_priority DESC, scheduled_start);
CREATE INDEX idx_game_schedules_allocation ON game_schedules(allocation_status, scheduled_start);
CREATE INDEX idx_game_schedules_playoff ON game_schedules(is_playoff_game, scheduled_start);
CREATE INDEX idx_game_schedules_espn_id ON game_schedules(espn_game_id);
```

#### Table: `input_source_allocations`

Tracks which input sources are allocated to which games.

```sql
CREATE TABLE input_source_allocations (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Input Source Info
  input_source_id TEXT NOT NULL,                 -- 'cable-box-1', 'firetv-1', 'directv-1'
  input_type TEXT NOT NULL,                      -- 'cable', 'directv', 'firetv'
  matrix_input_number INTEGER,                   -- HDMI matrix input channel

  -- Game Allocation
  game_schedule_id TEXT NOT NULL REFERENCES game_schedules(id) ON DELETE CASCADE,

  -- Channel/App Info
  channel_number TEXT,                           -- For cable/DirecTV (e.g., '502', '670')
  app_name TEXT,                                 -- For streaming (e.g., 'ESPN App', 'Bally Sports')
  network_name TEXT NOT NULL,                    -- 'ESPN', 'FOX', 'Bally Sports Wisconsin'

  -- TV Output Allocation
  allocated_tv_outputs TEXT NOT NULL,            -- JSON array of output IDs [1, 2, 3, 4, 5]
  tv_count INTEGER NOT NULL,                     -- Number of TVs allocated

  -- Timing
  allocated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_free_at DATETIME,                     -- Estimated game end time
  actually_freed_at DATETIME,                    -- Actual release time (when game ended)

  -- Status
  status TEXT NOT NULL DEFAULT 'allocated',      -- 'allocated', 'active', 'completed', 'preempted', 'cancelled'

  -- Preemption Tracking
  preempted_by TEXT REFERENCES input_source_allocations(id),  -- If interrupted by higher priority
  preempted_at DATETIME,
  preempted_reason TEXT,

  -- Reallocation Tracking
  is_preferred_input BOOLEAN DEFAULT TRUE,       -- True if this is the best quality input
  can_be_upgraded BOOLEAN DEFAULT FALSE,         -- True if waiting for better input
  upgraded_to TEXT REFERENCES input_source_allocations(id),  -- If upgraded to better allocation
  upgraded_at DATETIME,

  -- Quality Score (for tracking decisions)
  input_quality_score INTEGER NOT NULL,          -- Quality score at time of allocation

  -- Metadata
  allocation_notes TEXT,                         -- JSON with decision reasoning
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Check Constraints
  CHECK (input_type IN ('cable', 'directv', 'firetv', 'streaming')),
  CHECK (status IN ('allocated', 'active', 'completed', 'preempted', 'cancelled')),
  CHECK (tv_count > 0)
);

-- Indexes
CREATE INDEX idx_allocations_input ON input_source_allocations(input_source_id, status);
CREATE INDEX idx_allocations_game ON input_source_allocations(game_schedule_id);
CREATE INDEX idx_allocations_active ON input_source_allocations(status, expected_free_at);
CREATE INDEX idx_allocations_freed ON input_source_allocations(actually_freed_at);
CREATE INDEX idx_allocations_upgradeable ON input_source_allocations(can_be_upgraded, status);
```

#### Table: `input_sources`

Master list of available input sources (cable boxes, DirecTV receivers, Fire TVs).

```sql
CREATE TABLE input_sources (
  -- Primary Key
  id TEXT PRIMARY KEY,                           -- 'cable-box-1', 'directv-1', 'firetv-1'

  -- Basic Info
  name TEXT NOT NULL,                            -- 'Cable Box 1', 'Fire TV - Bar Area'
  input_type TEXT NOT NULL,                      -- 'cable', 'directv', 'firetv'

  -- Matrix Integration
  matrix_input_number INTEGER UNIQUE NOT NULL,   -- Which HDMI input on the matrix (1-32)
  matrix_input_label TEXT,                       -- Label from matrix config

  -- Hardware Reference
  device_id TEXT,                                -- Foreign key to device table (FireTVDevice, IRDevice, etc.)
  device_ip_address TEXT,                        -- IP address for network control

  -- Capabilities
  capabilities TEXT NOT NULL,                    -- JSON array of capabilities
  quality_score INTEGER NOT NULL DEFAULT 5,      -- Quality score (1-10)
  simultaneous_streams INTEGER DEFAULT 1,        -- How many "channels" it can show at once

  -- Current State
  current_channel TEXT,                          -- Current channel/app (null if idle)
  current_app_name TEXT,                         -- Current app name (for streaming)
  is_active BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'idle',                    -- 'idle', 'allocated', 'in_use', 'offline'

  -- Availability
  available_at DATETIME,                         -- When this input becomes free (null if free now)

  -- Metadata
  description TEXT,
  location TEXT,                                 -- Physical location
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Check Constraints
  CHECK (input_type IN ('cable', 'directv', 'firetv', 'streaming')),
  CHECK (status IN ('idle', 'allocated', 'in_use', 'offline')),
  CHECK (quality_score >= 1 AND quality_score <= 10)
);

-- Indexes
CREATE INDEX idx_input_sources_type ON input_sources(input_type);
CREATE INDEX idx_input_sources_status ON input_sources(status);
CREATE INDEX idx_input_sources_matrix ON input_sources(matrix_input_number);
CREATE INDEX idx_input_sources_available ON input_sources(available_at);

-- Sample Data
INSERT INTO input_sources (id, name, input_type, matrix_input_number, capabilities, quality_score, simultaneous_streams) VALUES
('cable-box-1', 'Cable Box 1', 'cable', 1, '["all-cable-channels"]', 10, 1),
('directv-1', 'DirecTV Receiver 1', 'directv', 2, '["all-directv-channels"]', 9, 1),
('firetv-1', 'Fire TV - Main Bar', 'firetv', 3, '["espn", "espn2", "bally-sports", "fox-sports", "nbc-sports", "paramount-plus"]', 7, 1),
('firetv-2', 'Fire TV - Back Room', 'firetv', 4, '["espn", "espn2", "bally-sports", "fox-sports", "nbc-sports", "paramount-plus"]', 7, 1);
```

#### Table: `network_mappings`

Maps TV networks to available input sources.

```sql
CREATE TABLE network_mappings (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Network Info
  network_name TEXT UNIQUE NOT NULL,             -- 'ESPN', 'FOX', 'Bally Sports Wisconsin'
  network_abbr TEXT,                             -- 'ESPN', 'FS1', 'BSW'

  -- Channel Mappings
  cable_channel TEXT,                            -- '571' (ESPN on cable)
  directv_channel TEXT,                          -- '206' (ESPN on DirecTV)
  firetv_app TEXT,                               -- 'ESPN' app name

  -- Streaming Services
  streaming_services TEXT,                       -- JSON array: ['Hulu Live', 'YouTube TV']

  -- Quality Preference
  preferred_source TEXT NOT NULL DEFAULT 'cable',  -- 'cable', 'directv', 'firetv'

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Check Constraints
  CHECK (preferred_source IN ('cable', 'directv', 'firetv'))
);

-- Indexes
CREATE INDEX idx_network_mappings_name ON network_mappings(network_name);
CREATE INDEX idx_network_mappings_preferred ON network_mappings(preferred_source);

-- Sample Data
INSERT INTO network_mappings (network_name, network_abbr, cable_channel, directv_channel, firetv_app, streaming_services, preferred_source) VALUES
('ESPN', 'ESPN', '571', '206', 'ESPN', '["Hulu Live", "YouTube TV", "Sling TV"]', 'cable'),
('ESPN2', 'ESPN2', '572', '209', 'ESPN', '["Hulu Live", "YouTube TV", "Sling TV"]', 'cable'),
('FOX', 'FOX', '502', '212', 'Fox Sports', '["Hulu Live", "YouTube TV", "Sling TV"]', 'cable'),
('NBC', 'NBC', '504', '214', 'NBC Sports', '["Peacock", "Hulu Live"]', 'cable'),
('CBS', 'CBS', '505', '215', 'Paramount+', '["Paramount+", "Hulu Live"]', 'cable'),
('Bally Sports Wisconsin', 'BSW', '670', '668', 'Bally Sports', '[]', 'cable'),
('NBC Sports', 'NBCSN', '575', '220', 'NBC Sports', '["Peacock"]', 'cable'),
('FS1', 'FS1', '573', '219', 'Fox Sports', '["Hulu Live", "YouTube TV"]', 'cable'),
('Amazon Prime Video', 'Prime', NULL, NULL, 'Prime Video', '["Prime Video"]', 'firetv');
```

#### Table: `tournament_brackets`

Stores tournament bracket data (March Madness, playoffs, etc.).

```sql
CREATE TABLE tournament_brackets (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Tournament Info
  tournament_name TEXT NOT NULL,                 -- 'NCAA Men\'s Basketball Tournament'
  season_year INTEGER NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,

  -- Structure
  total_rounds INTEGER,                          -- 6 for NCAA (64 teams)
  current_round INTEGER,
  current_round_name TEXT,                       -- 'First Round', 'Elite Eight', 'Final Four'

  -- Bracket Data
  bracket_data TEXT,                             -- JSON with full bracket structure

  -- Tracking
  games_scheduled INTEGER DEFAULT 0,
  games_in_progress INTEGER DEFAULT 0,
  games_completed INTEGER DEFAULT 0,

  -- Timing
  starts_at DATETIME,
  ends_at DATETIME,

  -- Status
  status TEXT DEFAULT 'upcoming',                -- 'upcoming', 'in_progress', 'completed'

  -- Metadata
  espn_tournament_id TEXT,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Check Constraints
  CHECK (status IN ('upcoming', 'in_progress', 'completed'))
);

-- Indexes
CREATE INDEX idx_tournament_brackets_year ON tournament_brackets(season_year);
CREATE INDEX idx_tournament_brackets_league ON tournament_brackets(league);
CREATE INDEX idx_tournament_brackets_status ON tournament_brackets(status);
```

#### Table: `espn_sync_logs`

Tracks ESPN API sync operations.

```sql
CREATE TABLE espn_sync_logs (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Sync Info
  sync_type TEXT NOT NULL,                       -- 'full', 'incremental', 'live_update', 'manual'
  league TEXT NOT NULL,                          -- 'nfl', 'nba', 'mlb', etc.
  date_range_start DATE,
  date_range_end DATE,

  -- Results
  games_found INTEGER DEFAULT 0,
  games_created INTEGER DEFAULT 0,
  games_updated INTEGER DEFAULT 0,
  games_unchanged INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'running',        -- 'running', 'completed', 'failed'
  error_message TEXT,

  -- Performance
  duration_ms INTEGER,                           -- How long the sync took
  api_calls_made INTEGER DEFAULT 0,

  -- Metadata
  triggered_by TEXT,                             -- 'scheduler', 'admin', 'webhook'
  sync_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_completed_at DATETIME,

  -- Check Constraints
  CHECK (sync_type IN ('full', 'incremental', 'live_update', 'manual')),
  CHECK (status IN ('running', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX idx_espn_sync_logs_league ON espn_sync_logs(league);
CREATE INDEX idx_espn_sync_logs_started ON espn_sync_logs(sync_started_at);
CREATE INDEX idx_espn_sync_logs_status ON espn_sync_logs(status);
```

### 3.2 Modifications to Existing Tables

#### Update `HomeTeam` table (already exists)

Add scheduler integration fields (these already exist based on schema analysis):
- `minTVsWhenActive` - Minimum TVs when game is on
- `autoPromotePlayoffs` - Auto-boost playoff games
- `preferredZones` - JSON array of preferred zone names
- `rivalTeams` - JSON array of rival team names for bonus priority
- `schedulerNotes` - Admin notes for scheduling decisions

No changes needed - these fields already exist in the schema.

### 3.3 Database Relationships

```
game_schedules
├── home_team_id → HomeTeam(id)
├── away_team_id → HomeTeam(id)
└── priority_team_id → HomeTeam(id)

input_source_allocations
├── game_schedule_id → game_schedules(id)
├── preempted_by → input_source_allocations(id)
└── upgraded_to → input_source_allocations(id)

input_sources
└── (no foreign keys, but device_id references various device tables)

network_mappings
└── (standalone table)

tournament_brackets
└── (standalone table)

espn_sync_logs
└── (standalone table)
```

---

## Part 4: ESPN Schedule Sync Service

### 4.1 Service Architecture

```typescript
// /src/lib/espn-schedule-sync-service.ts

import { db } from '@/db';
import { schema } from '@/db';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import { logger } from '@/lib/logger';

interface ESPNGame {
  id: string;
  uid: string;
  date: string;
  name: string;
  season: {
    year: number;
    type: number;
    slug: string;
  };
  week?: {
    number: number;
    text: string;
  };
  competitions: ESPNCompetition[];
}

interface ESPNCompetition {
  id: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
    };
    clock?: string;
    displayClock?: string;
    period?: number;
  };
  competitors: ESPNCompetitor[];
  broadcasts?: {
    market: string;
    names: string[];
  }[];
  notes?: {
    headline: string;
  }[];
  series?: {
    type: string;
    summary: string;
  };
}

interface ESPNCompetitor {
  id: string;
  uid: string;
  type: string;
  order: number;
  homeAway: 'home' | 'away';
  team: {
    id: string;
    location: string;
    name: string;
    abbreviation: string;
    displayName: string;
    logo: string;
  };
  score?: string;
  records?: {
    name: string;
    summary: string;
  }[];
}

export class ESPNScheduleSyncService {
  private readonly BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';
  private readonly LEAGUES = {
    nfl: 'football/nfl',
    nba: 'basketball/nba',
    mlb: 'baseball/mlb',
    nhl: 'hockey/nhl',
    'ncaa-mens-basketball': 'basketball/mens-college-basketball'
  };

  /**
   * Fetch today's games for all configured leagues
   */
  async syncTodaysGames(): Promise<void> {
    logger.info('[ESPN-SYNC] Starting today\'s games sync');

    const startTime = Date.now();
    let totalGames = 0;

    for (const [leagueKey, leaguePath] of Object.entries(this.LEAGUES)) {
      try {
        const url = `${this.BASE_URL}/${leaguePath}/scoreboard`;
        logger.info(`[ESPN-SYNC] Fetching ${leagueKey} scoreboard`, { url });

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const games = this.parseScoreboardResponse(data, leagueKey);

        logger.info(`[ESPN-SYNC] Found ${games.length} ${leagueKey} games today`);

        for (const game of games) {
          await this.upsertGame(game, leagueKey);
        }

        totalGames += games.length;

        // Rate limiting: 1 request per second
        await this.sleep(1000);

      } catch (error: any) {
        logger.error(`[ESPN-SYNC] Error syncing ${leagueKey}:`, error);
        await this.logSyncError(leagueKey, 'full', error.message);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[ESPN-SYNC] Completed today's sync: ${totalGames} games in ${duration}ms`);
  }

  /**
   * Fetch next N days of games for priority teams
   */
  async syncUpcomingGames(days: number = 7): Promise<void> {
    logger.info(`[ESPN-SYNC] Starting ${days}-day upcoming games sync`);

    const startTime = Date.now();
    let totalGames = 0;
    let apiCalls = 0;

    // Get all priority teams
    const priorityTeams = await db
      .select()
      .from(schema.homeTeams)
      .where(eq(schema.homeTeams.isActive, true));

    logger.info(`[ESPN-SYNC] Syncing for ${priorityTeams.length} priority teams`);

    for (const [leagueKey, leaguePath] of Object.entries(this.LEAGUES)) {
      try {
        for (let i = 0; i < days; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);
          const dateStr = this.formatDateForESPN(date);

          const url = `${this.BASE_URL}/${leaguePath}/scoreboard?dates=${dateStr}`;
          logger.debug(`[ESPN-SYNC] Fetching ${leagueKey} for ${dateStr}`, { url });

          const response = await fetch(url);
          if (!response.ok) {
            logger.warn(`[ESPN-SYNC] HTTP ${response.status} for ${leagueKey} on ${dateStr}`);
            continue;
          }

          const data = await response.json();
          const games = this.parseScoreboardResponse(data, leagueKey);

          // Filter to only priority team games
          const priorityGames = games.filter(game =>
            this.isPriorityGame(game, priorityTeams)
          );

          logger.debug(`[ESPN-SYNC] Found ${priorityGames.length}/${games.length} priority games on ${dateStr}`);

          for (const game of priorityGames) {
            await this.upsertGame(game, leagueKey);
          }

          totalGames += priorityGames.length;
          apiCalls++;

          // Rate limiting
          await this.sleep(1000);
        }

      } catch (error: any) {
        logger.error(`[ESPN-SYNC] Error syncing ${leagueKey} upcoming:`, error);
        await this.logSyncError(leagueKey, 'incremental', error.message);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[ESPN-SYNC] Completed ${days}-day sync: ${totalGames} games, ${apiCalls} API calls in ${duration}ms`);

    await this.logSyncSuccess('incremental', 'all', totalGames, apiCalls, duration);
  }

  /**
   * Update live game status (scores, time remaining)
   */
  async updateLiveGames(): Promise<void> {
    logger.info('[ESPN-SYNC] Updating live games');

    // Get all in-progress games
    const liveGames = await db
      .select()
      .from(schema.gameSchedules)
      .where(eq(schema.gameSchedules.status, 'in_progress'));

    if (liveGames.length === 0) {
      logger.debug('[ESPN-SYNC] No live games to update');
      return;
    }

    logger.info(`[ESPN-SYNC] Updating ${liveGames.length} live games`);

    // Group by league to minimize API calls
    const gamesByLeague = this.groupByLeague(liveGames);

    for (const [league, games] of Object.entries(gamesByLeague)) {
      try {
        const leaguePath = this.LEAGUES[league as keyof typeof this.LEAGUES];
        const url = `${this.BASE_URL}/${leaguePath}/scoreboard`;

        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();
        const currentGames = this.parseScoreboardResponse(data, league);

        // Update each live game
        for (const dbGame of games) {
          const espnGame = currentGames.find(g => g.id === dbGame.espnGameId);
          if (!espnGame) continue;

          await this.updateGameStatus(dbGame.id, espnGame);
        }

        await this.sleep(1000);

      } catch (error: any) {
        logger.error(`[ESPN-SYNC] Error updating live ${league} games:`, error);
      }
    }
  }

  /**
   * Detect and mark playoff games
   */
  async detectPlayoffGames(): Promise<void> {
    logger.info('[ESPN-SYNC] Detecting playoff games');

    // Get all games in postseason
    const postseasonGames = await db
      .select()
      .from(schema.gameSchedules)
      .where(eq(schema.gameSchedules.seasonType, 3));

    for (const game of postseasonGames) {
      const playoffBonus = this.calculatePlayoffBonus(
        game.seasonType,
        game.weekText || '',
        game.playoffRound || ''
      );

      await db
        .update(schema.gameSchedules)
        .set({
          isPlayoffGame: true,
          playoffBonus: playoffBonus,
          totalPriority: game.basePriority + playoffBonus,
          lastUpdated: new Date().toISOString()
        })
        .where(eq(schema.gameSchedules.id, game.id));
    }

    logger.info(`[ESPN-SYNC] Updated ${postseasonGames.length} playoff games`);
  }

  /**
   * Calculate priority scores for all games
   */
  async calculateGamePriorities(): Promise<void> {
    logger.info('[ESPN-SYNC] Calculating game priorities');

    // Get all scheduled/in-progress games
    const games = await db
      .select()
      .from(schema.gameSchedules)
      .where(
        or(
          eq(schema.gameSchedules.status, 'scheduled'),
          eq(schema.gameSchedules.status, 'in_progress')
        )
      );

    for (const game of games) {
      let basePriority = 0;
      let priorityTeamId = null;
      let priorityTeamName = null;

      // Check if home team is a priority team
      if (game.homeTeamId) {
        const homeTeam = await db
          .select()
          .from(schema.homeTeams)
          .where(eq(schema.homeTeams.id, game.homeTeamId))
          .limit(1);

        if (homeTeam.length > 0 && homeTeam[0].isActive) {
          basePriority = homeTeam[0].priority;
          priorityTeamId = homeTeam[0].id;
          priorityTeamName = homeTeam[0].teamName;
        }
      }

      // Check if away team is a priority team (use higher priority)
      if (game.awayTeamId) {
        const awayTeam = await db
          .select()
          .from(schema.homeTeams)
          .where(eq(schema.homeTeams.id, game.awayTeamId))
          .limit(1);

        if (awayTeam.length > 0 && awayTeam[0].isActive && awayTeam[0].priority > basePriority) {
          basePriority = awayTeam[0].priority;
          priorityTeamId = awayTeam[0].id;
          priorityTeamName = awayTeam[0].teamName;
        }
      }

      // Calculate playoff bonus
      const playoffBonus = this.calculatePlayoffBonus(
        game.seasonType,
        game.weekText || '',
        game.playoffRound || ''
      );

      // Update game priority
      await db
        .update(schema.gameSchedules)
        .set({
          priorityTeamId,
          priorityTeamName,
          basePriority,
          playoffBonus,
          totalPriority: basePriority + playoffBonus,
          isPriorityGame: basePriority > 0,
          lastUpdated: new Date().toISOString()
        })
        .where(eq(schema.gameSchedules.id, game.id));
    }

    logger.info(`[ESPN-SYNC] Updated priorities for ${games.length} games`);
  }

  /**
   * Parse ESPN scoreboard response
   */
  private parseScoreboardResponse(data: any, league: string): ESPNGame[] {
    if (!data.leagues || !data.leagues[0] || !data.leagues[0].events) {
      return [];
    }

    return data.leagues[0].events.map((event: any) => ({
      id: event.id,
      uid: event.uid,
      date: event.date,
      name: event.name,
      season: event.season,
      week: event.week,
      competitions: event.competitions
    }));
  }

  /**
   * Upsert game into database
   */
  private async upsertGame(espnGame: ESPNGame, league: string): Promise<void> {
    const competition = espnGame.competitions[0];
    if (!competition) return;

    const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
    const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

    if (!homeCompetitor || !awayCompetitor) return;

    // Extract playoff round
    const playoffRound = this.extractPlayoffRound(
      espnGame.season.type,
      espnGame.week?.text,
      competition.notes
    );

    // Extract network
    const network = competition.broadcasts?.[0]?.names?.[0] || null;

    // Calculate estimated end
    const scheduledStart = new Date(espnGame.date);
    const estimatedEnd = this.estimateGameEnd(scheduledStart, this.getSportFromLeague(league));

    // Check if game exists
    const existing = await db
      .select()
      .from(schema.gameSchedules)
      .where(eq(schema.gameSchedules.espnGameId, espnGame.id))
      .limit(1);

    const gameData = {
      espnGameId: espnGame.id,
      espnUid: espnGame.uid,
      sport: this.getSportFromLeague(league),
      league,
      homeTeamName: homeCompetitor.team.displayName,
      awayTeamName: awayCompetitor.team.displayName,
      homeTeamAbbr: homeCompetitor.team.abbreviation,
      awayTeamAbbr: awayCompetitor.team.abbreviation,
      homeTeamLogo: homeCompetitor.team.logo,
      awayTeamLogo: awayCompetitor.team.logo,
      scheduledStart: scheduledStart.toISOString(),
      estimatedEnd: estimatedEnd.toISOString(),
      status: this.mapESPNStatus(competition.status.type.id),
      statusTypeId: competition.status.type.id,
      statusDetail: competition.status.type.description,
      currentPeriod: competition.status.period?.toString() || null,
      timeRemaining: competition.status.displayClock || null,
      displayClock: competition.status.displayClock || null,
      seasonYear: espnGame.season.year,
      seasonType: espnGame.season.type,
      seasonTypeName: espnGame.season.slug,
      weekNumber: espnGame.week?.number || null,
      weekText: espnGame.week?.text || null,
      playoffRound,
      isPlayoffGame: espnGame.season.type === 3,
      network,
      broadcastInfo: JSON.stringify(competition.broadcasts || []),
      geoBroadcasts: JSON.stringify(competition.geoBroadcasts || []),
      homeScore: parseInt(homeCompetitor.score || '0'),
      awayScore: parseInt(awayCompetitor.score || '0'),
      homeTeamRecord: homeCompetitor.records?.[0]?.summary || null,
      awayTeamRecord: awayCompetitor.records?.[0]?.summary || null,
      espnRawData: JSON.stringify(espnGame),
      lastUpdated: new Date().toISOString()
    };

    if (existing.length > 0) {
      // Update existing
      await db
        .update(schema.gameSchedules)
        .set(gameData)
        .where(eq(schema.gameSchedules.id, existing[0].id));
    } else {
      // Insert new
      await db
        .insert(schema.gameSchedules)
        .values({
          id: crypto.randomUUID(),
          ...gameData,
          createdAt: new Date().toISOString()
        });
    }
  }

  /**
   * Update game status (for live games)
   */
  private async updateGameStatus(gameId: string, espnGame: ESPNGame): Promise<void> {
    const competition = espnGame.competitions[0];
    if (!competition) return;

    const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
    const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

    await db
      .update(schema.gameSchedules)
      .set({
        status: this.mapESPNStatus(competition.status.type.id),
        statusTypeId: competition.status.type.id,
        statusDetail: competition.status.type.description,
        currentPeriod: competition.status.period?.toString() || null,
        timeRemaining: competition.status.displayClock || null,
        displayClock: competition.status.displayClock || null,
        homeScore: parseInt(homeCompetitor?.score || '0'),
        awayScore: parseInt(awayCompetitor?.score || '0'),
        lastUpdated: new Date().toISOString()
      })
      .where(eq(schema.gameSchedules.id, gameId));
  }

  /**
   * Helper: Map ESPN status ID to our status
   */
  private mapESPNStatus(statusId: string): string {
    const statusMap: Record<string, string> = {
      '1': 'scheduled',
      '2': 'in_progress',
      '3': 'final',
      '4': 'postponed',
      '5': 'cancelled'
    };

    return statusMap[statusId] || 'scheduled';
  }

  /**
   * Helper: Extract playoff round from ESPN data
   */
  private extractPlayoffRound(
    seasonType: number,
    weekText?: string,
    notes?: { headline: string }[]
  ): string | null {
    if (seasonType !== 3) return null;

    // Check week text first
    if (weekText) {
      const playoffRounds = [
        'Wild Card', 'Divisional Round', 'Conference Championship', 'Super Bowl',
        'First Round', 'Conference Semifinals', 'Conference Finals', 'Finals',
        'Division Series', 'Championship Series', 'World Series',
        'Sweet 16', 'Elite Eight', 'Final Four', 'Championship'
      ];

      for (const round of playoffRounds) {
        if (weekText.includes(round)) return round;
      }
    }

    // Check notes
    if (notes && notes.length > 0) {
      return notes[0].headline;
    }

    return 'Playoff';
  }

  /**
   * Helper: Calculate playoff bonus
   */
  private calculatePlayoffBonus(
    seasonType: number,
    weekText: string,
    playoffRound: string
  ): number {
    if (seasonType !== 3) return 0;

    const roundBonuses: Record<string, number> = {
      'Wild Card': 10,
      'Divisional Round': 15,
      'Conference Championship': 25,
      'Super Bowl': 50,
      'Play-In Tournament': 5,
      'First Round': 10,
      'Conference Semifinals': 15,
      'Conference Finals': 25,
      'Finals': 50,
      'Stanley Cup': 50,
      'Division Series': 15,
      'Championship Series': 25,
      'World Series': 50,
      'Sweet 16': 15,
      'Elite Eight': 20,
      'Final Four': 30,
      'Championship': 50
    };

    return roundBonuses[playoffRound] || roundBonuses[weekText] || 10;
  }

  /**
   * Helper: Estimate game end time
   */
  private estimateGameEnd(startTime: Date, sport: string): Date {
    const durations: Record<string, number> = {
      'football': 3.5,
      'basketball': 2.5,
      'baseball': 3.0,
      'hockey': 2.5,
      'soccer': 2.0
    };

    const durationHours = durations[sport] || 3.0;
    const durationMs = durationHours * 60 * 60 * 1000;
    return new Date(startTime.getTime() + durationMs);
  }

  /**
   * Helper: Get sport from league
   */
  private getSportFromLeague(league: string): string {
    const mapping: Record<string, string> = {
      'nfl': 'football',
      'nba': 'basketball',
      'ncaa-mens-basketball': 'basketball',
      'mlb': 'baseball',
      'nhl': 'hockey',
      'mls': 'soccer'
    };

    return mapping[league] || 'unknown';
  }

  /**
   * Helper: Check if game involves priority team
   */
  private isPriorityGame(game: ESPNGame, priorityTeams: any[]): boolean {
    const competition = game.competitions[0];
    if (!competition) return false;

    const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

    return priorityTeams.some(team =>
      team.teamName === homeTeam?.team.displayName ||
      team.teamName === awayTeam?.team.displayName
    );
  }

  /**
   * Helper: Format date for ESPN API
   */
  private formatDateForESPN(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Helper: Group games by league
   */
  private groupByLeague(games: any[]): Record<string, any[]> {
    return games.reduce((acc, game) => {
      if (!acc[game.league]) acc[game.league] = [];
      acc[game.league].push(game);
      return acc;
    }, {} as Record<string, any[]>);
  }

  /**
   * Helper: Log sync success
   */
  private async logSyncSuccess(
    syncType: string,
    league: string,
    gamesFound: number,
    apiCalls: number,
    duration: number
  ): Promise<void> {
    await db.insert(schema.espnSyncLogs).values({
      id: crypto.randomUUID(),
      syncType,
      league,
      gamesFound,
      gamesCreated: 0, // Would need to track this
      gamesUpdated: 0,
      errorsCount: 0,
      status: 'completed',
      durationMs: duration,
      apiCallsMade: apiCalls,
      triggeredBy: 'scheduler',
      syncStartedAt: new Date().toISOString(),
      syncCompletedAt: new Date().toISOString()
    });
  }

  /**
   * Helper: Log sync error
   */
  private async logSyncError(
    league: string,
    syncType: string,
    errorMessage: string
  ): Promise<void> {
    await db.insert(schema.espnSyncLogs).values({
      id: crypto.randomUUID(),
      syncType,
      league,
      gamesFound: 0,
      gamesCreated: 0,
      gamesUpdated: 0,
      errorsCount: 1,
      status: 'failed',
      errorMessage,
      triggeredBy: 'scheduler',
      syncStartedAt: new Date().toISOString(),
      syncCompletedAt: new Date().toISOString()
    });
  }

  /**
   * Helper: Sleep for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4.2 Sync Schedule Strategy

#### Cron Schedule

```typescript
// /src/lib/espn-sync-scheduler.ts

import cron from 'node-cron';
import { ESPNScheduleSyncService } from './espn-schedule-sync-service';
import { logger } from './logger';

export class ESPNSyncScheduler {
  private syncService: ESPNScheduleSyncService;

  constructor() {
    this.syncService = new ESPNScheduleSyncService();
  }

  /**
   * Start all scheduled sync jobs
   */
  start(): void {
    logger.info('[ESPN-SCHEDULER] Starting ESPN sync scheduler');

    // Every 15 minutes: Update live games
    cron.schedule('*/15 * * * *', async () => {
      logger.info('[ESPN-SCHEDULER] Running live game update (15min)');
      try {
        await this.syncService.updateLiveGames();
      } catch (error) {
        logger.error('[ESPN-SCHEDULER] Live update failed:', error);
      }
    });

    // Every hour: Sync upcoming games (next 7 days)
    cron.schedule('0 * * * *', async () => {
      logger.info('[ESPN-SCHEDULER] Running upcoming games sync (hourly)');
      try {
        await this.syncService.syncUpcomingGames(7);
      } catch (error) {
        logger.error('[ESPN-SCHEDULER] Upcoming sync failed:', error);
      }
    });

    // Daily at midnight: Full resync
    cron.schedule('0 0 * * *', async () => {
      logger.info('[ESPN-SCHEDULER] Running full resync (daily)');
      try {
        await this.syncService.syncUpcomingGames(14); // 2 weeks
        await this.syncService.detectPlayoffGames();
        await this.syncService.calculateGamePriorities();
      } catch (error) {
        logger.error('[ESPN-SCHEDULER] Daily resync failed:', error);
      }
    });

    // Every 6 hours: Calculate game priorities
    cron.schedule('0 */6 * * *', async () => {
      logger.info('[ESPN-SCHEDULER] Recalculating game priorities');
      try {
        await this.syncService.calculateGamePriorities();
      } catch (error) {
        logger.error('[ESPN-SCHEDULER] Priority calculation failed:', error);
      }
    });

    logger.info('[ESPN-SCHEDULER] All sync jobs scheduled');
  }
}
```

---

## Part 5: Example Scenarios

### Scenario 1: Two Priority Games Overlap

#### Setup
- **Packers game** (priority 100) starts 3:00 PM on FOX (Cable channel 502)
- **Bucks game** (priority 90) starts 6:00 PM on Bally Sports (Cable channel 670)
- **Available inputs:**
  - Cable Box (matrix input 1)
  - Fire TV (matrix input 3)
- **Available TVs:** 12 total
- **Current time:** 2:45 PM

#### Timeline Walkthrough

**2:45 PM - Pre-allocation (15 min before Packers)**

```typescript
// System runs allocation check
const allocator = new SmartInputAllocator(inputSources, networkMappings);

const upcomingGames = [
  {
    gameId: 'nfl-game-123',
    homeTeamName: 'Green Bay Packers',
    awayTeamName: 'Chicago Bears',
    basePriority: 100,
    playoffBonus: 0,
    totalPriority: 100,
    scheduledStart: new Date('2025-11-14T20:00:00Z'), // 3:00 PM local
    estimatedEnd: new Date('2025-11-14T23:30:00Z'),   // 6:30 PM local
    network: 'FOX',
    status: 'pending'
  },
  {
    gameId: 'nba-game-456',
    homeTeamName: 'Milwaukee Bucks',
    awayTeamName: 'Boston Celtics',
    basePriority: 90,
    playoffBonus: 0,
    totalPriority: 90,
    scheduledStart: new Date('2025-11-15T00:00:00Z'), // 6:00 PM local
    estimatedEnd: new Date('2025-11-15T02:30:00Z'),   // 8:30 PM local
    network: 'Bally Sports Wisconsin',
    status: 'pending'
  }
];

const plan = allocator.allocateGames(upcomingGames);
```

**Allocation Plan Result:**
```json
{
  "timestamp": "2025-11-14T19:45:00Z",
  "allocations": [
    {
      "gameId": "nfl-game-123",
      "homeTeamName": "Green Bay Packers",
      "totalPriority": 100,
      "network": "FOX",
      "allocatedInput": {
        "id": "cable-box-1",
        "type": "cable",
        "matrixInputNumber": 1,
        "qualityScore": 10
      },
      "allocatedTVs": [1, 2, 3, 4, 5, 6, 7, 8],
      "tvCount": 8,
      "status": "pending",
      "preferredInputType": "cable",
      "canBeReallocated": false
    },
    {
      "gameId": "nba-game-456",
      "homeTeamName": "Milwaukee Bucks",
      "totalPriority": 90,
      "network": "Bally Sports Wisconsin",
      "allocatedInput": {
        "id": "firetv-1",
        "type": "firetv",
        "matrixInputNumber": 3,
        "qualityScore": 7
      },
      "allocatedTVs": [9, 10, 11, 12],
      "tvCount": 4,
      "status": "pending",
      "preferredInputType": "cable",
      "canBeReallocated": true
    }
  ],
  "conflicts": [],
  "recommendations": [
    {
      "gameId": "nba-game-456",
      "recommendation": "Game allocated to firetv but cable is preferred",
      "reason": "Better quality available when cable becomes free at 6:30 PM",
      "priority": "high"
    }
  ]
}
```

**Decision Rationale:**
1. Packers (priority 100) get Cable Box + 8 TVs (highest quality)
2. Bucks (priority 90) get Fire TV + 4 TVs (still good quality)
3. System notes that Bucks could be upgraded to Cable after Packers game ends

---

**3:00 PM - Packers Game Starts**

```typescript
// Mark allocation as active
await db.update(schema.inputSourceAllocations)
  .set({
    status: 'active',
    actualStart: new Date().toISOString()
  })
  .where(eq(schema.inputSourceAllocations.gameScheduleId, 'nfl-game-123'));

// Update input source state
await db.update(schema.inputSources)
  .set({
    currentChannel: '502',
    status: 'in_use',
    availableAt: new Date('2025-11-14T23:30:00Z').toISOString() // 6:30 PM
  })
  .where(eq(schema.inputSources.id, 'cable-box-1'));
```

**Matrix Routing:**
- Outputs 1-8 → Input 1 (Cable Box on channel 502)
- 8 TVs now showing Packers game

---

**6:00 PM - Bucks Game Starts (Packers Still On)**

```typescript
// Check: Is Cable Box still occupied?
const cableBox = await db.select()
  .from(schema.inputSources)
  .where(eq(schema.inputSources.id, 'cable-box-1'))
  .limit(1);

if (cableBox[0].availableAt > new Date()) {
  logger.info('[ALLOCATOR] Cable Box still in use, using Fire TV for Bucks');
}

// Activate Bucks allocation
await db.update(schema.inputSourceAllocations)
  .set({
    status: 'active',
    actualStart: new Date().toISOString()
  })
  .where(eq(schema.inputSourceAllocations.gameScheduleId, 'nba-game-456'));

// Update Fire TV state
await db.update(schema.inputSources)
  .set({
    currentAppName: 'Bally Sports',
    status: 'in_use',
    availableAt: new Date('2025-11-15T02:30:00Z').toISOString() // 8:30 PM
  })
  .where(eq(schema.inputSources.id, 'firetv-1'));
```

**Matrix Routing:**
- Outputs 1-8 → Input 1 (Cable Box - Packers)
- Outputs 9-12 → Input 3 (Fire TV - Bucks)

**Current State:**
- 8 TVs: Packers on FOX (Cable)
- 4 TVs: Bucks on Bally Sports (Fire TV)

---

**6:30 PM - Packers Game Ends**

```typescript
// Game completed
await db.update(schema.gameSchedules)
  .set({
    status: 'final',
    actualEnd: new Date().toISOString()
  })
  .where(eq(schema.gameSchedules.id, 'nfl-game-123'));

// Free Cable Box
await db.update(schema.inputSourceAllocations)
  .set({
    status: 'completed',
    actuallyFreedAt: new Date().toISOString()
  })
  .where(eq(schema.inputSourceAllocations.gameScheduleId, 'nfl-game-123'));

await db.update(schema.inputSources)
  .set({
    currentChannel: null,
    status: 'idle',
    availableAt: null
  })
  .where(eq(schema.inputSources.id, 'cable-box-1'));

// Trigger reallocation
const allocator = new SmartInputAllocator(inputSources, networkMappings);
const reallocationPlan = allocator.reallocateOnGameEnd('nfl-game-123', []);
```

**Reallocation Decision:**
```json
{
  "recommendations": [
    {
      "gameId": "nba-game-456",
      "recommendation": "Upgrade from firetv to cable",
      "reason": "Better quality input now available",
      "priority": "high"
    }
  ]
}
```

**Should we upgrade Bucks to Cable?**
- **Pros:** Better quality (cable > firetv)
- **Cons:** Requires app switch on Fire TV, potential 10-15 second interruption
- **Decision:** YES - Priority 90 game warrants upgrade

```typescript
// Upgrade Bucks to Cable Box
await db.update(schema.inputSourceAllocations)
  .set({
    status: 'completed',
    actuallyFreedAt: new Date().toISOString()
  })
  .where(eq(schema.inputSourceAllocations.gameScheduleId, 'nba-game-456'));

// Create new allocation on Cable
await db.insert(schema.inputSourceAllocations).values({
  id: crypto.randomUUID(),
  inputSourceId: 'cable-box-1',
  inputType: 'cable',
  gameScheduleId: 'nba-game-456',
  channelNumber: '670',
  networkName: 'Bally Sports Wisconsin',
  allocatedTvOutputs: JSON.stringify([1, 2, 3, 4, 5, 6]), // Expand to 6 TVs
  tvCount: 6,
  status: 'active',
  allocatedAt: new Date().toISOString(),
  inputQualityScore: 10
});
```

**New Matrix Routing:**
- Outputs 1-6 → Input 1 (Cable Box channel 670 - Bucks)
- Outputs 7-12 → Input 3 (Fire TV - idle/menu)

**Final State:**
- 6 TVs: Bucks on Bally Sports (Cable - upgraded!)
- 6 TVs: Available for other content

---

### Scenario 2: Three Games, Limited Inputs

#### Setup
- **3 simultaneous priority games:**
  1. Packers (priority 100) @ 12:00 PM on FOX
  2. Bucks (priority 90) @ 12:00 PM on Bally Sports
  3. Brewers (priority 80) @ 12:10 PM on ESPN
- **Available inputs:**
  - Cable Box (quality 10)
  - Fire TV (quality 7)
- **Available TVs:** 12 total

#### Allocation Challenge

```typescript
const upcomingGames = [
  {
    gameId: 'nfl-1',
    team: 'Packers',
    priority: 100,
    start: new Date('2025-11-14T17:00:00Z'), // 12:00 PM
    end: new Date('2025-11-14T20:30:00Z'),   // 3:30 PM
    network: 'FOX'
  },
  {
    gameId: 'nba-1',
    team: 'Bucks',
    priority: 90,
    start: new Date('2025-11-14T17:00:00Z'), // 12:00 PM
    end: new Date('2025-11-14T19:30:00Z'),   // 2:30 PM
    network: 'Bally Sports Wisconsin'
  },
  {
    gameId: 'mlb-1',
    team: 'Brewers',
    priority: 80,
    start: new Date('2025-11-14T17:10:00Z'), // 12:10 PM
    end: new Date('2025-11-14T20:10:00Z'),   // 3:10 PM
    network: 'ESPN'
  }
];

const plan = allocator.allocateGames(upcomingGames);
```

**Allocation Result:**
```json
{
  "allocations": [
    {
      "gameId": "nfl-1",
      "team": "Packers",
      "priority": 100,
      "allocatedInput": {
        "id": "cable-box-1",
        "type": "cable"
      },
      "allocatedTVs": [1, 2, 3, 4, 5, 6, 7, 8],
      "tvCount": 8
    },
    {
      "gameId": "nba-1",
      "team": "Bucks",
      "priority": 90,
      "allocatedInput": {
        "id": "firetv-1",
        "type": "firetv"
      },
      "allocatedTVs": [9, 10, 11, 12],
      "tvCount": 4
    }
  ],
  "conflicts": [
    {
      "type": "input_collision",
      "games": [{
        "gameId": "mlb-1",
        "team": "Brewers",
        "priority": 80
      }],
      "description": "No input available for Milwaukee Brewers game",
      "suggestedResolution": "Wait 140 minutes for firetv to become available (Bucks game ends 2:30 PM), or add another input source"
    }
  ],
  "recommendations": [
    {
      "gameId": "mlb-1",
      "recommendation": "Add a third input source (DirecTV or another Fire TV) to handle 3+ simultaneous games",
      "priority": "high"
    }
  ]
}
```

**Timeline:**

**12:00 PM:**
- Packers: Cable Box (8 TVs)
- Bucks: Fire TV (4 TVs)
- Brewers: **WAITING** (no input available)

**2:30 PM - Bucks Game Ends:**
```typescript
// Fire TV becomes available
// System automatically allocates Brewers to Fire TV
const reallocationPlan = allocator.reallocateOnGameEnd('nba-1', [
  { gameId: 'mlb-1', team: 'Brewers', priority: 80 }
]);
```

**New Allocation:**
- Packers: Cable Box (8 TVs) - continues
- Brewers: Fire TV (4 TVs) - **NOW PLAYING** (started at 2:30 PM, already in progress)

**3:10 PM - Brewers Game Ends:**
- Fire TV idle

**3:30 PM - Packers Game Ends:**
- Cable Box idle

**Admin Recommendation:**
Add 3rd input source to handle 3+ simultaneous games.

---

### Scenario 3: Playoff Game Priority Boost

#### Setup
- **Two games at same time:**
  1. Packers Regular Season game (base priority 100) @ 3:00 PM on FOX
  2. Brewers **Playoff Game** (base priority 70, +15 playoff bonus = 85 total) @ 3:00 PM on TBS
- **Available inputs:**
  - Cable Box
  - Fire TV

#### Initial Expectation
"Packers have higher priority (100 vs 70), so they should get Cable Box, right?"

#### Actual Allocation
```typescript
const upcomingGames = [
  {
    gameId: 'nfl-regular',
    team: 'Packers',
    basePriority: 100,
    playoffBonus: 0,
    totalPriority: 100,
    network: 'FOX',
    seasonType: 2 // Regular season
  },
  {
    gameId: 'mlb-playoff',
    team: 'Brewers',
    basePriority: 70,
    playoffBonus: 15, // Division Series
    totalPriority: 85,
    network: 'TBS',
    seasonType: 3, // Postseason
    playoffRound: 'Division Series'
  }
];

const plan = allocator.allocateGames(upcomingGames);
```

**Allocation Result:**
```json
{
  "allocations": [
    {
      "gameId": "nfl-regular",
      "team": "Packers",
      "totalPriority": 100,
      "allocatedInput": {
        "id": "cable-box-1",
        "type": "cable",
        "qualityScore": 10
      },
      "allocatedTVs": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "tvCount": 10
    },
    {
      "gameId": "mlb-playoff",
      "team": "Brewers",
      "totalPriority": 85,
      "allocatedInput": {
        "id": "firetv-1",
        "type": "firetv",
        "qualityScore": 7
      },
      "allocatedTVs": [11, 12],
      "tvCount": 2
    }
  ]
}
```

**Decision:** Packers (100) still beat Brewers (85), but it's closer!

**What if Brewers were in World Series?**

```typescript
{
  gameId: 'mlb-worldseries',
  team: 'Brewers',
  basePriority: 70,
  playoffBonus: 50, // World Series bonus
  totalPriority: 120, // NOW HIGHER THAN PACKERS!
  seasonType: 3,
  playoffRound: 'World Series'
}
```

**New Allocation:**
```json
{
  "allocations": [
    {
      "gameId": "mlb-worldseries",
      "team": "Brewers",
      "totalPriority": 120,
      "allocatedInput": {
        "id": "cable-box-1",
        "type": "cable"
      },
      "allocatedTVs": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "tvCount": 10
    },
    {
      "gameId": "nfl-regular",
      "team": "Packers",
      "totalPriority": 100,
      "allocatedInput": {
        "id": "firetv-1",
        "type": "firetv"
      },
      "allocatedTVs": [11, 12],
      "tvCount": 2
    }
  ]
}
```

**World Series Brewers** (120) now get Cable Box + 10 TVs, bumping Packers to Fire TV!

**Playoff Bonus Impact:**
- Regular season: Base priority only
- Wild Card/First Round: +10
- Divisional/Second Round: +15
- Conference Finals/Championship Series: +25
- Super Bowl/World Series/NBA Finals: +50

---

## Implementation Recommendations

### Phase 1: Foundation (Week 1-2)

#### Deliverables
1. **Database Schema**
   - Create all new tables (`game_schedules`, `input_source_allocations`, `input_sources`, `network_mappings`, `tournament_brackets`, `espn_sync_logs`)
   - Run migrations
   - Seed `input_sources` and `network_mappings` with bar's configuration

2. **ESPN Sync Service (Basic)**
   - Implement `ESPNScheduleSyncService` class
   - Test with one league (e.g., NFL)
   - Verify data parsing and storage
   - No automation yet (manual testing only)

3. **Testing**
   - Unit tests for ESPN data parsing
   - Integration tests for database operations
   - Verify game priority calculations

#### Success Criteria
- ESPN API successfully fetches and stores games
- Game priorities calculated correctly
- Data persists in database

---

### Phase 2: Smart Allocation Engine (Week 3-4)

#### Deliverables
1. **SmartInputAllocator Class**
   - Implement full allocation algorithm
   - Handle conflicts and recommendations
   - Support reallocation on game end

2. **Input Source Management**
   - Track input source availability
   - Update current channel/app state
   - Calculate quality scores

3. **API Endpoints**
   - `POST /api/scheduler/allocate` - Trigger allocation
   - `GET /api/scheduler/plan` - View allocation plan
   - `GET /api/scheduler/conflicts` - View conflicts
   - `POST /api/scheduler/reallocate` - Manual reallocation

4. **Testing**
   - Test scenarios 1, 2, 3 from above
   - Verify matrix routing commands
   - Test reallocation logic

#### Success Criteria
- Allocation algorithm works for all scenarios
- No input collisions (interrupted games)
- Reallocations happen automatically

---

### Phase 3: Automation & UI (Week 5-6)

#### Deliverables
1. **Automated Scheduling**
   - Implement `ESPNSyncScheduler` with cron jobs
   - 15-min live updates
   - Hourly upcoming game sync
   - Daily full resync

2. **Scheduler Dashboard UI**
   - `/scheduler` page showing:
     - Upcoming games with priorities
     - Current allocations (which input, which TVs)
     - Conflicts and recommendations
     - Manual override controls

3. **Admin Controls**
   - Manual priority adjustment
   - Force reallocation
   - Add/remove input sources
   - Edit network mappings

4. **Notifications**
   - Alert when conflicts occur
   - Notify before reallocations
   - Playoff game detection alerts

#### Success Criteria
- System runs automatically 24/7
- Bartenders can view schedule from UI
- Admins can override decisions
- No manual intervention needed for normal operation

---

### Phase 4: Advanced Features (Week 7+)

#### Optional Enhancements
1. **Predictive Allocation**
   - Forecast input availability for next 24 hours
   - Suggest input source purchases
   - Optimize TV distribution across zones

2. **Multi-Bar Support**
   - Support multiple locations
   - Different input configurations per location
   - Centralized priority team management

3. **Analytics**
   - Input utilization reports
   - Most-watched teams
   - Conflict frequency analysis
   - ROI for adding input sources

4. **Mobile App**
   - Bartender mobile view
   - Push notifications for conflicts
   - One-tap reallocations

---

## Appendix: Code Integration Points

### Existing Codebase Integration

#### 1. Matrix Control Integration
```typescript
// /src/lib/matrix-control.ts already exists
import { switchMatrixRoute } from '@/lib/matrix-control';

// When allocating game to input
async function applyAllocation(allocation: GameAllocation) {
  for (const tvOutputNumber of allocation.allocatedTVs) {
    await switchMatrixRoute(
      allocation.allocatedInput.matrixInputNumber,
      tvOutputNumber
    );
  }
}
```

#### 2. Fire TV Control Integration
```typescript
// /src/lib/adb-client.ts already exists
import { ADBClient } from '@/lib/adb-client';

// When switching Fire TV app
async function switchFireTVApp(deviceId: string, appName: string) {
  const device = await db.select()
    .from(schema.fireTVDevices)
    .where(eq(schema.fireTVDevices.id, deviceId))
    .limit(1);

  const adb = new ADBClient(device[0].ipAddress);
  await adb.launchApp(getAppPackageName(appName));
}
```

#### 3. IR/DirecTV Control Integration
```typescript
// /src/lib/global-cache-api.ts (IR)
// /src/lib/directv-client.ts (DirecTV IP)

async function tuneChannel(inputSource: InputSource, channel: string) {
  if (inputSource.type === 'cable') {
    // Use IR blaster
    await sendIRChannelSequence(channel);
  } else if (inputSource.type === 'directv') {
    // Use DirecTV IP control
    await directvClient.tuneChannel(channel);
  }
}
```

---

## Summary

This design provides:

1. **ESPN API Integration** - Comprehensive understanding of scoreboard endpoints, playoff detection, and data structures

2. **Smart Allocation Algorithm** - Prevents interrupting priority games by intelligently routing to alternative inputs

3. **Complete Database Schema** - All tables needed for game scheduling, input allocation, and tracking

4. **Sync Service** - Automated ESPN data fetching with cron scheduling

5. **Real-World Scenarios** - Detailed walkthroughs showing system behavior

6. **Phased Implementation** - Clear roadmap from foundation to advanced features

The system solves the core problem: **Never interrupt a high-priority game by changing the cable channel.** Instead, route lower-priority simultaneous games to Fire TV or wait for inputs to become available.

**Next Steps:**
1. Review and approve design
2. Begin Phase 1 implementation
3. Test with real ESPN data
4. Deploy to production with manual controls
5. Enable automation after validation
