# Home Teams Integration with AI Scheduler

## Overview

The existing `homeTeams` table already has a `priority` field (0-100) that we'll leverage for the AI scheduler. Instead of creating a new `teamPriorities` table, we'll enhance the existing schema with scheduler-specific fields.

## Existing Schema

```typescript
export const homeTeams = sqliteTable('HomeTeam', {
  id: text('id').primaryKey(),
  teamName: text('teamName').notNull(),
  sport: text('sport').notNull(),
  league: text('league').notNull(),
  category: text('category').notNull(),
  location: text('location'),
  conference: text('conference'),
  isPrimary: integer('isPrimary', { mode: 'boolean' }).default(false),
  logoUrl: text('logoUrl'),
  primaryColor: text('primaryColor'),
  secondaryColor: text('secondaryColor'),
  isActive: integer('isActive', { mode: 'boolean' }).default(true),
  priority: integer('priority').notNull().default(0),  // ✅ Already exists!
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})
```

## Schema Enhancement (Add New Fields)

Add these fields to the existing `homeTeams` table:

```typescript
export const homeTeams = sqliteTable('HomeTeam', {
  // ... existing fields ...

  // NEW SCHEDULER FIELDS
  minTVsWhenActive: integer('minTVsWhenActive').default(3),
  // Minimum TVs to assign when this team is playing

  autoPromotePlayoffs: integer('autoPromotePlayoffs', { mode: 'boolean' }).default(true),
  // Automatically increase priority during playoffs

  preferredZones: text('preferredZones'),
  // JSON array: ['main', 'bar', 'viewing-area']
  // Which TV zones prefer this team

  rivalTeams: text('rivalTeams'),
  // JSON array: ['Chicago Bears', 'Minnesota Vikings']
  // Teams that create rivalry bonuses

  schedulerNotes: text('schedulerNotes'),
  // Notes for scheduler logic
})
```

## Migration Script

**Path**: `/scripts/migrate-home-teams-scheduler.ts`

```typescript
import { db } from '@/db'
import { schema } from '@/db'

async function migrateHomeTeamsForScheduler() {
  console.log('Migrating homeTeams table for AI scheduler...')

  // Check if columns exist
  const tableInfo = await db.pragma(`table_info(HomeTeam)`)
  const columnNames = tableInfo.map((col: any) => col.name)

  const newColumns = [
    'minTVsWhenActive',
    'autoPromotePlayoffs',
    'preferredZones',
    'rivalTeams',
    'schedulerNotes'
  ]

  for (const column of newColumns) {
    if (!columnNames.includes(column)) {
      console.log(`Adding column: ${column}`)

      // Determine column type and default
      let columnDef = ''
      switch(column) {
        case 'minTVsWhenActive':
          columnDef = 'INTEGER DEFAULT 3'
          break
        case 'autoPromotePlayoffs':
          columnDef = 'INTEGER DEFAULT 1'
          break
        case 'preferredZones':
        case 'rivalTeams':
        case 'schedulerNotes':
          columnDef = 'TEXT'
          break
      }

      await db.run(`ALTER TABLE HomeTeam ADD COLUMN ${column} ${columnDef}`)
    }
  }

  // Set defaults for existing teams
  await setDefaultsForExistingTeams()

  console.log('Migration complete!')
}

async function setDefaultsForExistingTeams() {
  // Get all existing teams
  const teams = await db.select().from(schema.homeTeams).all()

  for (const team of teams) {
    let minTVs = 3
    let preferredZones = ['main', 'bar']
    let rivalTeams: string[] = []

    // Set team-specific defaults
    if (team.teamName.includes('Bucks')) {
      minTVs = 5
      preferredZones = ['main', 'bar', 'viewing-area']
      rivalTeams = ['Chicago Bulls', 'Miami Heat', 'Boston Celtics']
    } else if (team.teamName.includes('Packers')) {
      minTVs = 5
      preferredZones = ['main', 'bar', 'viewing-area']
      rivalTeams = ['Chicago Bears', 'Minnesota Vikings', 'Detroit Lions']
    } else if (team.teamName.includes('Brewers')) {
      minTVs = 4
      preferredZones = ['main', 'bar']
      rivalTeams = ['Chicago Cubs', 'St. Louis Cardinals', 'Cincinnati Reds']
    } else if (team.teamName.includes('Badgers')) {
      minTVs = 4
      preferredZones = ['main', 'viewing-area']
      rivalTeams = ['Minnesota', 'Iowa', 'Nebraska']
    }

    // Update team
    await db.update(schema.homeTeams)
      .set({
        minTVsWhenActive: minTVs,
        autoPromotePlayoffs: true,
        preferredZones: JSON.stringify(preferredZones),
        rivalTeams: JSON.stringify(rivalTeams)
      })
      .where(eq(schema.homeTeams.id, team.id))
      .run()

    console.log(`  Updated ${team.teamName}: ${minTVs} min TVs, zones: ${preferredZones.join(',')}`)
  }
}

// Run migration
migrateHomeTeamsForScheduler()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
```

## Priority Score Mapping

Use the existing `priority` field (0-100) as the base score:

```typescript
interface PriorityLevel {
  name: string
  scoreRange: [number, number]
  description: string
}

const PRIORITY_LEVELS: PriorityLevel[] = [
  {
    name: 'CRITICAL',
    scoreRange: [90, 100],
    description: 'Primary home teams (Bucks, Packers, Brewers, Badgers)'
  },
  {
    name: 'HIGH',
    scoreRange: [70, 89],
    description: 'Regional teams and important matchups'
  },
  {
    name: 'MEDIUM',
    scoreRange: [50, 69],
    description: 'Secondary interest teams'
  },
  {
    name: 'LOW',
    scoreRange: [25, 49],
    description: 'Background sports'
  },
  {
    name: 'BACKGROUND',
    scoreRange: [0, 24],
    description: 'Filler content'
  }
]

function getPriorityLevel(score: number): string {
  for (const level of PRIORITY_LEVELS) {
    if (score >= level.scoreRange[0] && score <= level.scoreRange[1]) {
      return level.name
    }
  }
  return 'BACKGROUND'
}
```

## Integration with Scheduler

### Step 1: Load Home Teams in Distribution Engine

```typescript
async function generateDistributionPlan(
  games: Game[],
  systemState: SystemState,
  scheduleConfig: ScheduleConfig
): Promise<DistributionPlan> {

  // Load home teams from database
  const homeTeams = await db.select()
    .from(schema.homeTeams)
    .where(eq(schema.homeTeams.isActive, true))
    .all()

  // Calculate priority for each game
  const gameScores = games.map(game =>
    calculateGamePriority(game, homeTeams)
  )

  // Sort by priority (highest first)
  const sortedGames = games
    .map(game => ({
      game,
      score: gameScores.find(s => s.gameId === game.id)!
    }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore)

  // ... rest of distribution logic
}
```

### Step 2: Calculate Game Priority Using Home Teams

```typescript
function calculateGamePriority(
  game: Game,
  homeTeams: HomeTeam[]
): GamePriorityScore {

  let baseScore = 0
  let bonusScore = 0
  const breakdown = {
    teamPriority: 0,
    playoffBonus: 0,
    primeTimeBonus: 0,
    rivalryBonus: 0,
    primaryTeamBonus: 0
  }

  // Find matching home team
  const homeTeam = homeTeams.find(t =>
    game.homeTeam.toLowerCase().includes(t.teamName.toLowerCase()) ||
    game.awayTeam.toLowerCase().includes(t.teamName.toLowerCase())
  )

  if (homeTeam) {
    // Use existing priority field as base score
    baseScore = homeTeam.priority
    breakdown.teamPriority = homeTeam.priority

    // Bonus if it's a primary team (isPrimary = true)
    if (homeTeam.isPrimary) {
      bonusScore += 15
      breakdown.primaryTeamBonus = 15
    }

    // Check for rivalry
    if (homeTeam.rivalTeams) {
      const rivals = JSON.parse(homeTeam.rivalTeams)
      const isRivalry = rivals.some((rival: string) =>
        game.homeTeam.includes(rival) || game.awayTeam.includes(rival)
      )
      if (isRivalry) {
        bonusScore += 15
        breakdown.rivalryBonus = 15
      }
    }
  }

  // Playoff bonus
  if (game.description?.toLowerCase().includes('playoff')) {
    if (homeTeam?.autoPromotePlayoffs) {
      bonusScore += 20
      breakdown.playoffBonus = 20
    }
  }

  // Prime time bonus
  const gameHour = new Date(game.startTime).getHours()
  if (gameHour >= 18 && gameHour <= 23) {
    bonusScore += 10
    breakdown.primeTimeBonus = 10
  }

  const totalScore = Math.min(baseScore + bonusScore, 150)

  return {
    gameId: game.id,
    baseScore,
    bonusScore,
    totalScore,
    breakdown,
    homeTeam: homeTeam || null
  }
}
```

### Step 3: Use Home Team Settings in TV Allocation

```typescript
function calculatePriorityBasedAllocation(
  assignments: GameAssignment[],
  totalTVs: number,
  homeTeams: HomeTeam[]
): Record<string, TVAllocation> {

  const allocations: Record<string, TVAllocation> = {}
  let remainingTVs = totalTVs

  // Step 1: Ensure minimum TVs for each game
  for (const assignment of assignments) {
    // Find home team for this game
    const homeTeam = homeTeams.find(t =>
      assignment.gameName.includes(t.teamName)
    )

    // Use team's minTVsWhenActive or default to 1
    const minTVs = homeTeam?.minTVsWhenActive || 1

    allocations[assignment.gameId] = {
      gameId: assignment.gameId,
      tvCount: minTVs,
      minTVs,
      priority: assignment.priority,
      preferredZones: homeTeam?.preferredZones
        ? JSON.parse(homeTeam.preferredZones)
        : null
    }
    remainingTVs -= minTVs
  }

  // Step 2: Distribute remaining TVs by priority
  const totalPriorityScore = assignments.reduce((sum, a) => sum + a.priority, 0)

  for (const assignment of assignments) {
    if (remainingTVs <= 0) break

    const priorityRatio = assignment.priority / totalPriorityScore
    const additionalTVs = Math.floor(remainingTVs * priorityRatio)

    allocations[assignment.gameId].tvCount += additionalTVs
    remainingTVs -= additionalTVs
  }

  // Step 3: Assign remaining TVs to highest priority
  if (remainingTVs > 0 && assignments.length > 0) {
    allocations[assignments[0].gameId].tvCount += remainingTVs
  }

  return allocations
}
```

### Step 4: Assign to Preferred Zones

```typescript
function assignOutputsToAssignment(
  assignment: GameAssignment,
  allocation: TVAllocation,
  availableOutputs: OutputState[]
): number[] {

  // If team has preferred zones, prioritize those
  if (allocation.preferredZones && allocation.preferredZones.length > 0) {
    const preferredOutputs = availableOutputs.filter(output =>
      output.zone && allocation.preferredZones!.includes(output.zone)
    )

    if (preferredOutputs.length >= allocation.tvCount) {
      // Enough TVs in preferred zones
      return preferredOutputs.slice(0, allocation.tvCount).map(o => o.outputNum)
    } else {
      // Use all preferred + fill from others
      const otherOutputs = availableOutputs.filter(output =>
        !output.zone || !allocation.preferredZones!.includes(output.zone)
      )

      const remaining = allocation.tvCount - preferredOutputs.length
      const combined = [
        ...preferredOutputs,
        ...otherOutputs.slice(0, remaining)
      ]

      return combined.map(o => o.outputNum)
    }
  } else {
    // No preferred zones - use next available
    return availableOutputs.slice(0, allocation.tvCount).map(o => o.outputNum)
  }
}
```

## Example Execution with Home Teams

### Database State:

```sql
SELECT teamName, priority, isPrimary, minTVsWhenActive, preferredZones, rivalTeams
FROM HomeTeam
WHERE isActive = 1;
```

| teamName | priority | isPrimary | minTVsWhenActive | preferredZones | rivalTeams |
|----------|----------|-----------|------------------|----------------|------------|
| Milwaukee Bucks | 95 | 1 | 5 | ["main","bar","viewing-area"] | ["Chicago Bulls","Miami Heat"] |
| Milwaukee Brewers | 90 | 1 | 4 | ["main","bar"] | ["Chicago Cubs","St. Louis Cardinals"] |
| Green Bay Packers | 95 | 1 | 5 | ["main","bar","viewing-area"] | ["Chicago Bears","Minnesota Vikings"] |
| Wisconsin Badgers | 80 | 1 | 4 | ["main","viewing-area"] | ["Minnesota","Iowa"] |
| Chicago Bulls | 60 | 0 | 2 | ["side"] | ["Milwaukee Bucks"] |

### Games Found:

```json
[
  {
    "id": "game-1",
    "homeTeam": "Milwaukee Bucks",
    "awayTeam": "Miami Heat",
    "channel": "40",
    "network": "Bally Sports",
    "description": "Eastern Conference Semifinals Game 3"
  },
  {
    "id": "game-2",
    "homeTeam": "Milwaukee Brewers",
    "awayTeam": "Chicago Cubs",
    "channel": "29",
    "network": "MLB Network"
  },
  {
    "id": "game-3",
    "homeTeam": "Los Angeles Lakers",
    "awayTeam": "Golden State Warriors",
    "channel": "58",
    "network": "TNT"
  }
]
```

### Priority Calculation:

**Game 1: Bucks vs Heat**
- Base Score: 95 (home team priority)
- Primary Team Bonus: +15 (isPrimary = true)
- Playoff Bonus: +20 (playoff game)
- Rivalry Bonus: +15 (Heat is a rival)
- **Total: 145 points**

**Game 2: Brewers vs Cubs**
- Base Score: 90 (home team priority)
- Primary Team Bonus: +15 (isPrimary = true)
- Rivalry Bonus: +15 (Cubs are rivals)
- **Total: 120 points**

**Game 3: Lakers vs Warriors**
- Base Score: 0 (not in home teams)
- **Total: 0 points**

### Distribution:

15 TVs total

- **Bucks (145 pts, 55%)**: 7 TVs
  - Min guaranteed: 5 TVs
  - Extra from priority: +2 TVs
  - Zones: Main bar (3 TVs) + Viewing area (4 TVs)

- **Brewers (120 pts, 45%)**: 6 TVs
  - Min guaranteed: 4 TVs
  - Extra from priority: +2 TVs
  - Zones: Main bar (3 TVs) + Bar (3 TVs)

- **Lakers (0 pts)**: 2 TVs
  - Min guaranteed: 1 TV
  - Leftover: +1 TV
  - Zones: Side/patio areas

### Execution Log:

```
[AI-SCHEDULER] Loaded 5 active home teams from database
[AI-SCHEDULER] Game priorities calculated:
  - Bucks vs Heat (playoff): 145 points (base: 95, primary: 15, playoff: 20, rivalry: 15)
  - Brewers vs Cubs: 120 points (base: 90, primary: 15, rivalry: 15)
  - Lakers vs Warriors: 0 points (no home team match)

[DISTRIBUTION] TV allocation by priority:
  - Bucks vs Heat: 7 TVs (min 5 guaranteed) → zones: main, bar, viewing-area
  - Brewers vs Cubs: 6 TVs (min 4 guaranteed) → zones: main, bar
  - Lakers vs Warriors: 2 TVs → zones: side, patio

[EXECUTOR] Execution complete: 15 TVs assigned, 3 games displayed
```

## UI Integration

The existing home teams UI already exists. Enhance it to show scheduler settings:

**Add to existing home team form:**

```tsx
<FormField>
  <Label>Minimum TVs When Active</Label>
  <Input
    type="number"
    value={minTVsWhenActive}
    onChange={e => setMinTVsWhenActive(parseInt(e.target.value))}
    min={1}
    max={15}
  />
  <p className="text-sm text-gray-500">
    Guaranteed minimum TVs when this team is playing
  </p>
</FormField>

<FormField>
  <Label>Preferred Viewing Zones</Label>
  <MultiSelect
    options={['main', 'bar', 'viewing-area', 'side', 'patio']}
    value={preferredZones}
    onChange={setPreferredZones}
  />
</FormField>

<FormField>
  <Label>Rival Teams (for bonus priority)</Label>
  <TextArea
    value={rivalTeams.join(', ')}
    onChange={e => setRivalTeams(e.target.value.split(',').map(s => s.trim()))}
    placeholder="Chicago Bears, Minnesota Vikings"
  />
</FormField>

<FormField>
  <Label>
    <Checkbox
      checked={autoPromotePlayoffs}
      onCheckedChange={setAutoPromotePlayoffs}
    />
    Automatically promote during playoffs
  </Label>
</FormField>
```

## Summary

✅ **No new table needed** - Use existing `homeTeams` table
✅ **Add 5 new columns** via migration script
✅ **Leverage existing `priority` field** (0-100) as base score
✅ **Integrate with existing home teams UI**
✅ **Scheduler reads from single source of truth**

The home teams become the central configuration for:
- Team priorities
- Minimum TV allocations
- Zone preferences
- Rivalry bonuses
- Playoff auto-promotion
