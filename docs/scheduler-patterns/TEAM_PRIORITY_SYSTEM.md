# Team Priority System for AI Scheduler

## Overview

The AI scheduler must prioritize favorite/home teams over other games to ensure the most important games get the best TV placement and more screen time.

## Priority Hierarchy

### 1. Priority Levels (Highest to Lowest)

```
CRITICAL (Priority 100):
- Home team playoff games
- Championship games involving home teams

HIGH (Priority 75-90):
- Home team regular season games
- Division rival games
- Prime time home team games

MEDIUM (Priority 50-74):
- Home team away games
- Regional teams (nearby cities)
- Popular national games (highly ranked teams)

LOW (Priority 25-49):
- Other sports with home team interest
- Conference games

BACKGROUND (Priority 0-24):
- General sports content
- Filler programming
```

### 2. Home Team Definition

**Primary Home Teams**: Teams the bar actively promotes and monitors
- Milwaukee Bucks (NBA)
- Milwaukee Brewers (MLB)
- Green Bay Packers (NFL)
- Wisconsin Badgers (NCAA)
- Marquette Golden Eagles (NCAA)

**Regional Teams**: Teams with local fan base
- Chicago Bulls, Bears, Cubs, White Sox
- Minnesota Vikings, Twins, Wild
- Detroit Lions, Tigers, Pistons

**Special Events**: Can be elevated to HIGH priority
- Playoffs (any round)
- Championships
- Rivalry games

## Database Schema

### Team Priority Table

```typescript
export const teamPriorities = sqliteTable('TeamPriority', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamName: text('teamName').notNull(),
  sport: text('sport').notNull(), // 'NBA', 'NFL', 'MLB', 'NHL', 'NCAA'
  league: text('league').notNull(), // 'NBA', 'NFL', 'MLB', 'NHL', 'NCAA Football', etc.
  priorityLevel: text('priorityLevel').notNull(), // 'critical', 'high', 'medium', 'low', 'background'
  baseScore: integer('baseScore').notNull(), // 0-100
  isHomeTeam: integer('isHomeTeam', { mode: 'boolean' }).notNull().default(false),
  isRegionalTeam: integer('isRegionalTeam', { mode: 'boolean' }).notNull().default(false),
  autoPromotePlayoffs: integer('autoPromotePlayoffs', { mode: 'boolean' }).notNull().default(true),
  minTVsWhenActive: integer('minTVsWhenActive').default(3), // Minimum TVs when this team plays
  preferredZones: text('preferredZones'), // JSON array: ['main', 'bar']
  notes: text('notes'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  teamNameIdx: index('TeamPriority_teamName_idx').on(table.teamName),
  sportIdx: index('TeamPriority_sport_idx').on(table.sport),
  priorityIdx: index('TeamPriority_priorityLevel_idx').on(table.priorityLevel),
}))

// Game Priority Overrides (manual adjustments)
export const gamePriorityOverrides = sqliteTable('GamePriorityOverride', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  gameId: text('gameId'), // External game ID if available
  homeTeam: text('homeTeam').notNull(),
  awayTeam: text('awayTeam').notNull(),
  scheduledDate: timestamp('scheduledDate').notNull(),
  overridePriority: integer('overridePriority').notNull(), // 0-100
  reason: text('reason'), // "Big rivalry game", "Championship", etc.
  minTVs: integer('minTVs'), // Force minimum TV count
  createdBy: text('createdBy'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
}, (table) => ({
  dateIdx: index('GamePriorityOverride_scheduledDate_idx').on(table.scheduledDate),
}))
```

## Priority Scoring Algorithm

### Base Score Calculation

```typescript
interface GamePriorityScore {
  gameId: string
  baseScore: number        // 0-100 from team priority
  bonusScore: number       // 0-50 from modifiers
  totalScore: number       // baseScore + bonusScore
  breakdown: {
    teamPriority: number
    playoffBonus: number
    primeTimeBonus: number
    rivalryBonus: number
    overrideBonus: number
  }
}

async function calculateGamePriority(
  game: Game,
  teamPriorities: TeamPriority[],
  overrides: GamePriorityOverride[]
): Promise<GamePriorityScore> {

  let baseScore = 0
  let bonusScore = 0
  const breakdown = {
    teamPriority: 0,
    playoffBonus: 0,
    primeTimeBonus: 0,
    rivalryBonus: 0,
    overrideBonus: 0
  }

  // Step 1: Check for manual override
  const override = overrides.find(o =>
    o.homeTeam === game.homeTeam &&
    o.awayTeam === game.awayTeam &&
    isSameDay(new Date(o.scheduledDate), new Date(game.startTime))
  )

  if (override) {
    baseScore = override.overridePriority
    breakdown.overrideBonus = override.overridePriority
    bonusScore += 10 // Extra bonus for manually prioritized games
  }

  // Step 2: Calculate team priority (home team or away team)
  const homeTeamPriority = teamPriorities.find(t =>
    t.teamName.toLowerCase() === game.homeTeam.toLowerCase()
  )
  const awayTeamPriority = teamPriorities.find(t =>
    t.teamName.toLowerCase() === game.awayTeam.toLowerCase()
  )

  // Use highest priority (prefer home team if both match)
  const teamPriority = homeTeamPriority || awayTeamPriority

  if (teamPriority) {
    baseScore = Math.max(baseScore, teamPriority.baseScore)
    breakdown.teamPriority = teamPriority.baseScore

    // Extra bonus if it's a home team's home game
    if (homeTeamPriority?.isHomeTeam) {
      bonusScore += 15
    }
  }

  // Step 3: Playoff bonus
  if (game.description?.toLowerCase().includes('playoff') ||
      game.description?.toLowerCase().includes('championship') ||
      game.league?.includes('Playoffs')) {
    bonusScore += 20
    breakdown.playoffBonus = 20
  }

  // Step 4: Prime time bonus
  const gameHour = new Date(game.startTime).getHours()
  if (gameHour >= 18 && gameHour <= 23) {
    bonusScore += 10
    breakdown.primeTimeBonus = 10
  }

  // Step 5: Rivalry bonus
  const isRivalry = checkRivalryGame(game.homeTeam, game.awayTeam, teamPriorities)
  if (isRivalry) {
    bonusScore += 15
    breakdown.rivalryBonus = 15
  }

  const totalScore = Math.min(baseScore + bonusScore, 150) // Cap at 150

  return {
    gameId: game.id,
    baseScore,
    bonusScore,
    totalScore,
    breakdown
  }
}

function checkRivalryGame(
  homeTeam: string,
  awayTeam: string,
  priorities: TeamPriority[]
): boolean {

  // Define rivalry matchups
  const rivalries = {
    'Bucks': ['Bulls', 'Heat', 'Celtics', '76ers'],
    'Packers': ['Bears', 'Vikings', 'Lions'],
    'Brewers': ['Cubs', 'Cardinals', 'Reds'],
    'Badgers': ['Minnesota', 'Iowa', 'Nebraska']
  }

  // Check if both teams are in our priority list and are rivals
  for (const [team, rivals] of Object.entries(rivalries)) {
    if ((homeTeam.includes(team) && rivals.some(r => awayTeam.includes(r))) ||
        (awayTeam.includes(team) && rivals.some(r => homeTeam.includes(r)))) {
      return true
    }
  }

  return false
}
```

## Distribution Algorithm Enhancement

### Priority-Based TV Allocation

```typescript
async function generateDistributionPlan(
  games: Game[],
  systemState: SystemState,
  scheduleConfig: ScheduleConfig,
  ragContext?: string
): Promise<DistributionPlan> {

  // STEP 0: Calculate priority scores for all games
  const teamPriorities = await db.select().from(schema.teamPriorities).all()
  const overrides = await db.select()
    .from(schema.gamePriorityOverrides)
    .where(gte(schema.gamePriorityOverrides.scheduledDate, startOfToday()))
    .all()

  const gameScores = await Promise.all(
    games.map(game => calculateGamePriority(game, teamPriorities, overrides))
  )

  // Sort games by priority score (highest first)
  const sortedGames = games
    .map(game => ({
      game,
      score: gameScores.find(s => s.gameId === game.id)!
    }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore)

  logger.info(`[DISTRIBUTION] Game priorities calculated:`)
  sortedGames.forEach(({ game, score }) => {
    logger.info(`  - ${game.homeTeam} vs ${game.awayTeam}: ${score.totalScore} points (base: ${score.baseScore}, bonus: ${score.bonusScore})`)
  })

  const plan: DistributionPlan = {
    assignments: [],
    stats: { /* ... */ },
    conflicts: [],
    warnings: []
  }

  // STEP 1: Identify inputs already showing desired channels (REUSE)
  for (const { game, score } of sortedGames) {
    const existingInputs = systemState.inputs.filter(
      input => input.currentChannel === game.channel
    )

    if (existingInputs.length > 0) {
      plan.assignments.push({
        gameId: game.id,
        gameName: `${game.homeTeam} vs ${game.awayTeam}`,
        channel: game.channel,
        network: game.network,
        inputNum: existingInputs[0].inputNum,
        inputLabel: existingInputs[0].label,
        outputNums: [], // Will assign in TV allocation step
        action: 'reuse',
        reason: `Channel ${game.channel} already active on ${existingInputs[0].label}`,
        priority: score.totalScore
      })
    }
  }

  // STEP 2: For games not yet showing, find best input to switch
  const unassignedGames = sortedGames.filter(({ game }) =>
    !plan.assignments.some(a => a.gameId === game.id)
  )

  for (const { game, score } of unassignedGames) {
    const bestInput = await selectOptimalInput(game, systemState, scheduleConfig)

    if (bestInput) {
      plan.assignments.push({
        gameId: game.id,
        gameName: `${game.homeTeam} vs ${game.awayTeam}`,
        channel: game.channel,
        network: game.network,
        inputNum: bestInput.inputNum,
        inputLabel: bestInput.label,
        outputNums: [],
        action: 'switch',
        reason: `Switching ${bestInput.label} from ch ${bestInput.currentChannel} to ch ${game.channel}`,
        priority: score.totalScore
      })
    } else {
      plan.warnings.push(`Could not find suitable input for ${game.homeTeam} vs ${game.awayTeam}`)
    }
  }

  // STEP 3: PRIORITY-BASED TV ALLOCATION
  const availableOutputs = getAvailableOutputs(systemState, scheduleConfig)
  const totalTVs = availableOutputs.length

  // Allocate TVs based on priority scores
  const tvAllocations = calculatePriorityBasedAllocation(
    plan.assignments,
    totalTVs,
    teamPriorities
  )

  let outputIndex = 0
  for (const assignment of plan.assignments) {
    const allocation = tvAllocations[assignment.gameId]
    assignment.outputNums = availableOutputs
      .slice(outputIndex, outputIndex + allocation.tvCount)
      .map(o => o.outputNum)

    // Assign preferred zones if specified
    const teamPriority = teamPriorities.find(t =>
      assignment.gameName.includes(t.teamName)
    )
    if (teamPriority?.preferredZones) {
      const preferredOutputs = assignToPreferredZones(
        availableOutputs,
        JSON.parse(teamPriority.preferredZones),
        allocation.tvCount
      )
      assignment.outputNums = preferredOutputs.map(o => o.outputNum)
    } else {
      outputIndex += allocation.tvCount
    }

    logger.info(`[DISTRIBUTION] ${assignment.gameName} (priority ${assignment.priority}): ${assignment.outputNums.length} TVs`)
  }

  return plan
}

interface TVAllocation {
  gameId: string
  tvCount: number
  minTVs: number
  priority: number
}

function calculatePriorityBasedAllocation(
  assignments: GameAssignment[],
  totalTVs: number,
  teamPriorities: TeamPriority[]
): Record<string, TVAllocation> {

  const allocations: Record<string, TVAllocation> = {}

  // Step 1: Ensure minimum TVs for priority games
  let remainingTVs = totalTVs

  for (const assignment of assignments) {
    const teamPriority = teamPriorities.find(t =>
      assignment.gameName.includes(t.teamName)
    )

    const minTVs = teamPriority?.minTVsWhenActive || 1
    allocations[assignment.gameId] = {
      gameId: assignment.gameId,
      tvCount: minTVs,
      minTVs,
      priority: assignment.priority
    }
    remainingTVs -= minTVs
  }

  // Step 2: Distribute remaining TVs proportionally by priority
  const totalPriorityScore = assignments.reduce((sum, a) => sum + a.priority, 0)

  for (const assignment of assignments) {
    if (remainingTVs <= 0) break

    const priorityRatio = assignment.priority / totalPriorityScore
    const additionalTVs = Math.floor(remainingTVs * priorityRatio)

    allocations[assignment.gameId].tvCount += additionalTVs
    remainingTVs -= additionalTVs
  }

  // Step 3: Distribute any leftover TVs to highest priority game
  if (remainingTVs > 0 && assignments.length > 0) {
    const highestPriority = assignments[0] // Already sorted by priority
    allocations[highestPriority.gameId].tvCount += remainingTVs
  }

  return allocations
}

function assignToPreferredZones(
  availableOutputs: OutputState[],
  preferredZones: string[],
  count: number
): OutputState[] {

  // Filter outputs by preferred zones
  const preferredOutputs = availableOutputs.filter(output =>
    output.zone && preferredZones.includes(output.zone)
  )

  // If we have enough in preferred zones, use those
  if (preferredOutputs.length >= count) {
    return preferredOutputs.slice(0, count)
  }

  // Otherwise, use what we have in preferred zones + fill from others
  const remaining = count - preferredOutputs.length
  const otherOutputs = availableOutputs.filter(output =>
    !output.zone || !preferredZones.includes(output.zone)
  )

  return [
    ...preferredOutputs,
    ...otherOutputs.slice(0, remaining)
  ]
}
```

## RAG Knowledge Base Enhancement

### Add to `docs/scheduler-patterns/scheduling-rules.md`:

```markdown
# Team Priority Rules

## Home Team Priority

**RULE 1: Home teams ALWAYS get priority over other games**
- Milwaukee Bucks, Brewers, Packers, Badgers games must be shown
- Minimum 3 TVs when home team is playing
- Best viewing zones (main bar, main viewing area)

**RULE 2: Playoff games get elevated priority**
- Home team playoff games: CRITICAL priority (100 points)
- Any playoff game: +20 bonus points
- Championship games: +30 bonus points

**RULE 3: Rivalry games get bonus priority**
- Packers vs Bears: +15 bonus
- Bucks vs Bulls/Heat: +15 bonus
- Brewers vs Cubs/Cardinals: +15 bonus

## Priority Distribution Strategy

When distributing TVs across multiple games:

1. **High Priority Game (90+ points)**: 40-50% of TVs
2. **Medium Priority Game (60-89 points)**: 30-40% of TVs
3. **Low Priority Game (30-59 points)**: 20-30% of TVs
4. **Background (0-29 points)**: 10-20% of TVs

**Example**: 15 TVs, 3 games (Bucks 95pts, Brewers 70pts, Random NBA 30pts)
- Bucks: 7 TVs (47%)
- Brewers: 5 TVs (33%)
- Other: 3 TVs (20%)

## Zone Preferences

**Main Bar Area**: Home team games only (highest priority)
**Main Viewing Area**: Mix of high and medium priority
**Side Rooms**: Medium and low priority games
**Patio/Casual Areas**: Background content acceptable
```

## UI Enhancements

### Team Priority Management Page

**Path**: `/src/app/admin/team-priorities/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function TeamPrioritiesPage() {
  const [priorities, setPriorities] = useState<TeamPriority[]>([])
  const [editing, setEditing] = useState<string | null>(null)

  // Load priorities
  useEffect(() => {
    fetch('/api/team-priorities')
      .then(r => r.json())
      .then(data => setPriorities(data.priorities))
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Team Priorities</h1>

      <div className="mb-6">
        <Button onClick={() => createNewPriority()}>
          Add Team Priority
        </Button>
      </div>

      <div className="space-y-4">
        {priorities.map(priority => (
          <TeamPriorityCard
            key={priority.id}
            priority={priority}
            onEdit={() => setEditing(priority.id)}
            onSave={savePriority}
          />
        ))}
      </div>
    </div>
  )
}

function TeamPriorityCard({ priority, onEdit, onSave }) {
  return (
    <div className="border rounded-lg p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold">{priority.teamName}</h3>
          <p className="text-sm text-gray-600">
            {priority.sport} • {priority.league}
          </p>
        </div>

        <div className="flex space-x-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            priority.priorityLevel === 'critical' ? 'bg-red-100 text-red-800' :
            priority.priorityLevel === 'high' ? 'bg-orange-100 text-orange-800' :
            priority.priorityLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {priority.priorityLevel.toUpperCase()} ({priority.baseScore})
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">Home Team:</span>{' '}
          {priority.isHomeTeam ? '✓ Yes' : '✗ No'}
        </div>
        <div>
          <span className="font-medium">Min TVs:</span>{' '}
          {priority.minTVsWhenActive}
        </div>
        <div>
          <span className="font-medium">Auto-Promote Playoffs:</span>{' '}
          {priority.autoPromotePlayoffs ? '✓ Yes' : '✗ No'}
        </div>
        <div>
          <span className="font-medium">Preferred Zones:</span>{' '}
          {priority.preferredZones ? JSON.parse(priority.preferredZones).join(', ') : 'Any'}
        </div>
      </div>

      <div className="mt-4 flex space-x-2">
        <Button size="sm" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="outline">Delete</Button>
      </div>
    </div>
  )
}
```

## Example Execution with Priorities

### Scenario

**15 TVs available, 4 games found:**

1. **Bucks vs Heat (playoff game)** - FS Wisconsin Ch 40
   - Base score: 90 (high priority home team)
   - Playoff bonus: +20
   - Prime time bonus: +10
   - **Total: 120 points**

2. **Brewers vs Cubs** - Bally Sports Ch 29
   - Base score: 75 (high priority home team)
   - Rivalry bonus: +15
   - **Total: 90 points**

3. **Packers highlights** - ESPN Ch 30
   - Base score: 50 (medium priority)
   - **Total: 50 points**

4. **Lakers vs Warriors** - TNT Ch 58
   - Base score: 25 (low priority)
   - **Total: 25 points**

### Distribution:

```
Total Priority Score: 120 + 90 + 50 + 25 = 285

Bucks (120pts, 42%):  6 TVs (min 3 guaranteed) → Main bar + viewing area
Brewers (90pts, 32%): 5 TVs (min 3 guaranteed) → Bar + side area
Packers (50pts, 18%): 3 TVs (min 1) → Side room
Lakers (25pts, 8%):   1 TV → Patio/casual
```

### Execution Log:

```
[19:00:01] [PRIORITY] Game priorities calculated:
  - Bucks vs Heat: 120 points (base: 90, playoff: 20, primetime: 10)
  - Brewers vs Cubs: 90 points (base: 75, rivalry: 15)
  - Packers highlights: 50 points (base: 50)
  - Lakers vs Warriors: 25 points (base: 25)

[19:00:01] [DISTRIBUTION] Bucks vs Heat (priority 120): 6 TVs (main bar zone)
[19:00:01] [DISTRIBUTION] Brewers vs Cubs (priority 90): 5 TVs (bar zone)
[19:00:01] [DISTRIBUTION] Packers highlights (priority 50): 3 TVs
[19:00:01] [DISTRIBUTION] Lakers vs Warriors (priority 25): 1 TV

[19:00:01] [EXECUTOR] Reusing input 1 already on channel 40 (Bucks)
[19:00:02] [EXECUTOR] Switching input 2 to channel 29 (Brewers)
[19:00:05] [EXECUTOR] Execution complete: 15 TVs assigned, 1 channel changed
```

## Migration Plan

1. Create team priority table and seed with Milwaukee teams
2. Update distribution engine with priority calculation
3. Add RAG team priority rules
4. Create admin UI for managing priorities
5. Test with real games
6. Monitor and adjust scoring algorithm

## Success Metrics

- Home team games get 40%+ of TVs when playing
- Playoff games automatically prioritized
- Customer complaints about "wrong game showing" decrease
- Bar staff reports easier game management
