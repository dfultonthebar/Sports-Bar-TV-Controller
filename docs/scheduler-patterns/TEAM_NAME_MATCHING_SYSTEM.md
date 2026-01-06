# Intelligent Team Name Matching System

## Problem Statement

Sports guides use inconsistent team names across different providers:

**Your Configuration:**
- "Wisconsin Badgers"
- "Milwaukee Bucks"
- "Green Bay Packers"

**What Appears in Guides:**
- "University of Wisconsin Badgers"
- "Wisconsin-Madison Badgers"
- "Badgers"
- "Milwaukee" (just city)
- "MIL Bucks"
- "GB Packers"
- "Packers Football"

**The scheduler must intelligently match these variations to prioritize your favorite teams.**

## Solution Architecture

### 1. Team Aliases System

Add an `aliases` field to the `homeTeams` table to store known variations:

```sql
ALTER TABLE HomeTeam ADD COLUMN aliases TEXT;
-- JSON array: ["Wisconsin-Madison", "UW Badgers", "Badgers"]
```

### 2. Multi-Level Matching Strategy

```
LEVEL 1: Exact Match
├─ "Milwaukee Bucks" == "Milwaukee Bucks" ✓

LEVEL 2: Alias Match
├─ "MIL Bucks" in aliases ✓
├─ "Bucks" in aliases ✓

LEVEL 3: Fuzzy Match (Token-Based)
├─ Extract tokens: ["Milwaukee", "Bucks"]
├─ Check if ALL tokens in guide name ✓
├─ "Milwaukee Bucks Basketball" contains both ✓

LEVEL 4: Partial Match (City/Team Name)
├─ Check city: "Milwaukee" in "MIL"
├─ Check team: "Bucks" in guide name
├─ Confidence score: 0.8

LEVEL 5: Abbreviation Match
├─ "GB" → "Green Bay"
├─ "MIL" → "Milwaukee"
├─ "UW" → "University of Wisconsin"
```

### 3. Database Schema Enhancement

```typescript
// Add to homeTeams table
export const homeTeams = sqliteTable('HomeTeam', {
  // ... existing fields ...

  aliases: text('aliases'),
  // JSON array of known variations:
  // ["Wisconsin-Madison", "UW Badgers", "Badgers", "Wisc"]

  cityAbbreviations: text('cityAbbreviations'),
  // JSON array: ["MIL", "Mil", "Milwaukee"]

  teamAbbreviations: text('teamAbbreviations'),
  // JSON array: ["GB", "GBP", "Green Bay"]

  commonVariations: text('commonVariations'),
  // JSON array: Auto-generated variations
  // ["Milwaukee Bucks Basketball", "Bucks Basketball"]

  matchingStrategy: text('matchingStrategy').default('fuzzy'),
  // 'exact' | 'fuzzy' | 'aggressive'

  minMatchConfidence: real('minMatchConfidence').default(0.7),
  // Minimum confidence score (0-1) to consider a match
})

// Team Name Match Log (for learning)
export const teamNameMatches = sqliteTable('TeamNameMatch', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  homeTeamId: text('homeTeamId').notNull().references(() => homeTeams.id),
  guideName: text('guideName').notNull(),
  // Name as it appeared in guide

  matchedBy: text('matchedBy').notNull(),
  // 'exact' | 'alias' | 'fuzzy' | 'partial' | 'abbreviation'

  confidence: real('confidence').notNull(),
  // Match confidence score 0-1

  wasCorrect: integer('wasCorrect', { mode: 'boolean' }),
  // User feedback: was this match correct?

  correctedToTeamId: text('correctedToTeamId').references(() => homeTeams.id),
  // If wrong, which team should it have matched?

  firstSeen: timestamp('firstSeen').notNull().default(timestampNow()),
  lastSeen: timestamp('lastSeen').notNull().default(timestampNow()),
  occurrenceCount: integer('occurrenceCount').notNull().default(1),
}, (table) => ({
  guideNameIdx: index('TeamNameMatch_guideName_idx').on(table.guideName),
  homeTeamIdx: index('TeamNameMatch_homeTeamId_idx').on(table.homeTeamId),
}))
```

### 4. Team Name Matcher Service

**Path**: `/src/lib/scheduler/team-name-matcher.ts`

```typescript
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface TeamMatch {
  homeTeam: HomeTeam
  confidence: number
  matchedBy: 'exact' | 'alias' | 'fuzzy' | 'partial' | 'abbreviation' | 'learned'
  matchedToken?: string
}

export class TeamNameMatcher {
  private homeTeams: HomeTeam[] = []
  private abbreviationMap: Map<string, string> = new Map()

  constructor() {
    this.initializeAbbreviationMap()
  }

  async loadHomeTeams(): Promise<void> {
    this.homeTeams = await db.select()
      .from(schema.homeTeams)
      .where(eq(schema.homeTeams.isActive, true))
      .all()

    logger.info(`[TEAM-MATCHER] Loaded ${this.homeTeams.length} home teams`)
  }

  /**
   * Find matching home team for a guide team name
   */
  async findMatch(guideName: string, sport?: string): Promise<TeamMatch | null> {
    if (!guideName) return null

    const normalizedGuide = this.normalizeTeamName(guideName)

    // Try each matching strategy in order of confidence
    let match: TeamMatch | null = null

    // Level 1: Exact match
    match = this.exactMatch(normalizedGuide)
    if (match) return this.logMatch(guideName, match)

    // Level 2: Alias match
    match = this.aliasMatch(normalizedGuide)
    if (match) return this.logMatch(guideName, match)

    // Level 3: Learned match (from previous corrections)
    match = await this.learnedMatch(guideName)
    if (match) return this.logMatch(guideName, match)

    // Level 4: Fuzzy token match
    match = this.fuzzyMatch(normalizedGuide, sport)
    if (match && match.confidence >= 0.7) return this.logMatch(guideName, match)

    // Level 5: Partial match
    match = this.partialMatch(normalizedGuide, sport)
    if (match && match.confidence >= 0.6) return this.logMatch(guideName, match)

    // Level 6: Abbreviation match
    match = this.abbreviationMatch(normalizedGuide)
    if (match) return this.logMatch(guideName, match)

    logger.debug(`[TEAM-MATCHER] No match found for "${guideName}"`)
    return null
  }

  /**
   * Normalize team name for matching
   */
  private normalizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize whitespace
  }

  /**
   * Level 1: Exact match
   */
  private exactMatch(guideName: string): TeamMatch | null {
    for (const team of this.homeTeams) {
      if (this.normalizeTeamName(team.teamName) === guideName) {
        return {
          homeTeam: team,
          confidence: 1.0,
          matchedBy: 'exact',
          matchedToken: team.teamName
        }
      }
    }
    return null
  }

  /**
   * Level 2: Alias match
   */
  private aliasMatch(guideName: string): TeamMatch | null {
    for (const team of this.homeTeams) {
      if (!team.aliases) continue

      const aliases = JSON.parse(team.aliases) as string[]
      for (const alias of aliases) {
        if (this.normalizeTeamName(alias) === guideName) {
          return {
            homeTeam: team,
            confidence: 0.95,
            matchedBy: 'alias',
            matchedToken: alias
          }
        }
      }
    }
    return null
  }

  /**
   * Level 3: Learned match (from match log)
   */
  private async learnedMatch(guideName: string): Promise<TeamMatch | null> {
    const learned = await db.select()
      .from(schema.teamNameMatches)
      .where(eq(schema.teamNameMatches.guideName, guideName))
      .orderBy(desc(schema.teamNameMatches.occurrenceCount))
      .limit(1)
      .get()

    if (learned && learned.wasCorrect !== false) {
      const team = this.homeTeams.find(t => t.id === learned.homeTeamId)
      if (team) {
        return {
          homeTeam: team,
          confidence: learned.confidence,
          matchedBy: 'learned',
          matchedToken: guideName
        }
      }
    }

    return null
  }

  /**
   * Level 4: Fuzzy token-based match
   */
  private fuzzyMatch(guideName: string, sport?: string): TeamMatch | null {
    const guideTokens = guideName.split(' ').filter(t => t.length > 2)

    let bestMatch: TeamMatch | null = null
    let highestScore = 0

    for (const team of this.homeTeams) {
      // Skip if sport doesn't match
      if (sport && team.sport.toLowerCase() !== sport.toLowerCase()) {
        continue
      }

      const teamTokens = this.normalizeTeamName(team.teamName)
        .split(' ')
        .filter(t => t.length > 2)

      // Calculate token overlap
      const matchingTokens = teamTokens.filter(token =>
        guideTokens.some(gt => gt.includes(token) || token.includes(gt))
      )

      if (matchingTokens.length === 0) continue

      // Score based on percentage of team tokens matched
      const score = matchingTokens.length / teamTokens.length

      // Bonus if city matches
      if (team.location && guideName.includes(team.location.toLowerCase())) {
        score += 0.2
      }

      if (score > highestScore) {
        highestScore = score
        bestMatch = {
          homeTeam: team,
          confidence: Math.min(score, 1.0),
          matchedBy: 'fuzzy',
          matchedToken: matchingTokens.join(' ')
        }
      }
    }

    return bestMatch
  }

  /**
   * Level 5: Partial match (city or team name alone)
   */
  private partialMatch(guideName: string, sport?: string): TeamMatch | null {
    for (const team of this.homeTeams) {
      if (sport && team.sport.toLowerCase() !== sport.toLowerCase()) {
        continue
      }

      const teamNameParts = this.normalizeTeamName(team.teamName).split(' ')
      const city = team.location ? this.normalizeTeamName(team.location) : null

      // Check if guide name contains team name (last part usually)
      const teamName = teamNameParts[teamNameParts.length - 1]
      if (guideName.includes(teamName) && teamName.length > 3) {
        return {
          homeTeam: team,
          confidence: 0.7,
          matchedBy: 'partial',
          matchedToken: teamName
        }
      }

      // Check if city matches
      if (city && guideName.includes(city)) {
        // City match alone is lower confidence
        const hasTeamName = guideName.includes(teamName)
        return {
          homeTeam: team,
          confidence: hasTeamName ? 0.75 : 0.6,
          matchedBy: 'partial',
          matchedToken: city
        }
      }
    }

    return null
  }

  /**
   * Level 6: Abbreviation match
   */
  private abbreviationMatch(guideName: string): TeamMatch | null {
    for (const team of this.homeTeams) {
      // Check city abbreviations
      if (team.cityAbbreviations) {
        const cityAbbrevs = JSON.parse(team.cityAbbreviations) as string[]
        for (const abbrev of cityAbbrevs) {
          if (guideName.startsWith(abbrev.toLowerCase())) {
            return {
              homeTeam: team,
              confidence: 0.65,
              matchedBy: 'abbreviation',
              matchedToken: abbrev
            }
          }
        }
      }

      // Check team abbreviations
      if (team.teamAbbreviations) {
        const teamAbbrevs = JSON.parse(team.teamAbbreviations) as string[]
        for (const abbrev of teamAbbrevs) {
          if (guideName.includes(abbrev.toLowerCase())) {
            return {
              homeTeam: team,
              confidence: 0.7,
              matchedBy: 'abbreviation',
              matchedToken: abbrev
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Log match for learning
   */
  private async logMatch(guideName: string, match: TeamMatch): Promise<TeamMatch> {
    try {
      // Check if we've seen this match before
      const existing = await db.select()
        .from(schema.teamNameMatches)
        .where(
          and(
            eq(schema.teamNameMatches.guideName, guideName),
            eq(schema.teamNameMatches.homeTeamId, match.homeTeam.id)
          )
        )
        .limit(1)
        .get()

      if (existing) {
        // Update occurrence count and last seen
        await db.update(schema.teamNameMatches)
          .set({
            lastSeen: new Date().toISOString(),
            occurrenceCount: existing.occurrenceCount + 1,
            confidence: Math.max(existing.confidence, match.confidence)
          })
          .where(eq(schema.teamNameMatches.id, existing.id))
          .run()
      } else {
        // Create new match log
        await db.insert(schema.teamNameMatches).values({
          guideName,
          homeTeamId: match.homeTeam.id,
          matchedBy: match.matchedBy,
          confidence: match.confidence,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          occurrenceCount: 1
        }).run()
      }

      logger.debug(
        `[TEAM-MATCHER] Matched "${guideName}" → "${match.homeTeam.teamName}" ` +
        `(${match.matchedBy}, ${(match.confidence * 100).toFixed(0)}%)`
      )
    } catch (error) {
      logger.error('[TEAM-MATCHER] Error logging match:', error)
    }

    return match
  }

  /**
   * Initialize common abbreviations
   */
  private initializeAbbreviationMap(): void {
    this.abbreviationMap.set('gb', 'green bay')
    this.abbreviationMap.set('mil', 'milwaukee')
    this.abbreviationMap.set('uw', 'university of wisconsin')
    this.abbreviationMap.set('wisc', 'wisconsin')
    this.abbreviationMap.set('chi', 'chicago')
    this.abbreviationMap.set('min', 'minnesota')
    // Add more as needed
  }

  /**
   * Generate common variations for a team
   */
  static generateCommonVariations(teamName: string, location?: string): string[] {
    const variations: string[] = []
    const parts = teamName.split(' ')

    // Full name
    variations.push(teamName)

    // Team name only (last part)
    if (parts.length > 1) {
      variations.push(parts[parts.length - 1])
    }

    // With location
    if (location) {
      variations.push(`${location} ${teamName}`)
      variations.push(`${location} ${parts[parts.length - 1]}`)
    }

    // With "University of" prefix
    if (teamName.toLowerCase().includes('badgers') ||
        teamName.toLowerCase().includes('golden eagles')) {
      variations.push(`University of ${teamName}`)
      variations.push(`UW ${parts[parts.length - 1]}`)
    }

    // Common suffixes
    const sport = teamName.toLowerCase().includes('packers') ? 'Football' :
                  teamName.toLowerCase().includes('bucks') ? 'Basketball' :
                  teamName.toLowerCase().includes('brewers') ? 'Baseball' : ''

    if (sport) {
      variations.push(`${teamName} ${sport}`)
      if (parts.length > 1) {
        variations.push(`${parts[parts.length - 1]} ${sport}`)
      }
    }

    return [...new Set(variations)] // Remove duplicates
  }
}

// Export singleton instance
export const teamNameMatcher = new TeamNameMatcher()
```

### 5. Integration with Game Priority Calculation

**Update**: `/src/lib/scheduler/distribution-engine.ts`

```typescript
import { teamNameMatcher } from './team-name-matcher'

async function calculateGamePriority(
  game: Game,
  homeTeams: HomeTeam[]
): Promise<GamePriorityScore> {

  let baseScore = 0
  let bonusScore = 0
  let matchedTeam: HomeTeam | null = null

  // Use intelligent matching for both home and away teams
  const homeMatch = await teamNameMatcher.findMatch(game.homeTeam, game.sport)
  const awayMatch = await teamNameMatcher.findMatch(game.awayTeam, game.sport)

  // Use the match with higher confidence
  let bestMatch = homeMatch
  if (awayMatch && (!homeMatch || awayMatch.confidence > homeMatch.confidence)) {
    bestMatch = awayMatch
  }

  if (bestMatch) {
    matchedTeam = bestMatch.homeTeam
    baseScore = bestMatch.homeTeam.priority

    // Confidence penalty if match is uncertain
    if (bestMatch.confidence < 0.9) {
      const penalty = (1 - bestMatch.confidence) * 10
      baseScore = Math.max(0, baseScore - penalty)

      logger.debug(
        `[PRIORITY] Fuzzy match confidence ${(bestMatch.confidence * 100).toFixed(0)}%, ` +
        `applied -${penalty.toFixed(0)} point penalty`
      )
    }

    logger.info(
      `[PRIORITY] Matched "${game.homeTeam}" vs "${game.awayTeam}" → ` +
      `${matchedTeam.teamName} (${bestMatch.matchedBy}, ${(bestMatch.confidence * 100).toFixed(0)}%)`
    )
  }

  // ... rest of priority calculation (playoffs, rivalry, etc.)

  return {
    gameId: game.id,
    baseScore,
    bonusScore,
    totalScore: baseScore + bonusScore,
    breakdown: { /* ... */ },
    matchedTeam,
    matchConfidence: bestMatch?.confidence || 0
  }
}
```

### 6. Team Alias Seed Data

**Path**: `/scripts/seed-team-aliases.ts`

```typescript
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { TeamNameMatcher } from '@/lib/scheduler/team-name-matcher'

const TEAM_ALIAS_DATA = {
  'Milwaukee Bucks': {
    aliases: [
      'Bucks',
      'MIL Bucks',
      'Milwaukee',
      'Bucks Basketball',
      'Milwaukee Bucks Basketball'
    ],
    cityAbbreviations: ['MIL', 'Mil'],
    teamAbbreviations: []
  },

  'Green Bay Packers': {
    aliases: [
      'Packers',
      'GB Packers',
      'Green Bay',
      'Packers Football',
      'GreenBay Packers'
    ],
    cityAbbreviations: ['GB', 'GBP'],
    teamAbbreviations: ['GB']
  },

  'Milwaukee Brewers': {
    aliases: [
      'Brewers',
      'MIL Brewers',
      'Milwaukee Brewers Baseball',
      'Brew Crew'
    ],
    cityAbbreviations: ['MIL', 'Mil'],
    teamAbbreviations: []
  },

  'Wisconsin Badgers': {
    aliases: [
      'Badgers',
      'UW Badgers',
      'University of Wisconsin Badgers',
      'Wisconsin-Madison Badgers',
      'UW-Madison Badgers',
      'Wisc Badgers',
      'Wisconsin',
      'UW',
      'Badgers Football',
      'Wisconsin Badgers Football'
    ],
    cityAbbreviations: ['UW', 'Wisc'],
    teamAbbreviations: ['UW', 'Wisc']
  },

  'Marquette Golden Eagles': {
    aliases: [
      'Golden Eagles',
      'Marquette',
      'Marquette Basketball',
      'MU Golden Eagles',
      'Eagles'
    ],
    cityAbbreviations: ['MU'],
    teamAbbreviations: []
  }
}

async function seedTeamAliases() {
  console.log('Seeding team aliases...')

  for (const [teamName, data] of Object.entries(TEAM_ALIAS_DATA)) {
    // Find team in database
    const team = await db.select()
      .from(schema.homeTeams)
      .where(eq(schema.homeTeams.teamName, teamName))
      .limit(1)
      .get()

    if (!team) {
      console.log(`  ⚠️  Team not found: ${teamName}`)
      continue
    }

    // Generate common variations
    const variations = TeamNameMatcher.generateCommonVariations(
      teamName,
      team.location || undefined
    )

    // Combine with manual aliases
    const allAliases = [...new Set([...data.aliases, ...variations])]

    // Update team
    await db.update(schema.homeTeams)
      .set({
        aliases: JSON.stringify(allAliases),
        cityAbbreviations: JSON.stringify(data.cityAbbreviations),
        teamAbbreviations: JSON.stringify(data.teamAbbreviations),
        commonVariations: JSON.stringify(variations)
      })
      .where(eq(schema.homeTeams.id, team.id))
      .run()

    console.log(`  ✓ ${teamName}: ${allAliases.length} aliases`)
  }

  console.log('Done!')
}

seedTeamAliases()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
```

### 7. Match Validation UI

**Path**: `/src/app/admin/team-matches/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function TeamMatchesPage() {
  const [matches, setMatches] = useState<TeamNameMatch[]>([])

  useEffect(() => {
    fetch('/api/team-matches')
      .then(r => r.json())
      .then(data => setMatches(data.matches))
  }, [])

  const markCorrect = async (matchId: string) => {
    await fetch(`/api/team-matches/${matchId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wasCorrect: true })
    })
    // Reload matches
  }

  const markIncorrect = async (matchId: string, correctTeamId: string) => {
    await fetch(`/api/team-matches/${matchId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wasCorrect: false,
        correctedToTeamId: correctTeamId
      })
    })
    // Reload matches
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Team Name Matches</h1>

      <div className="space-y-4">
        {matches.map(match => (
          <div key={match.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-gray-500">Guide Name</div>
                <div className="text-lg font-bold">{match.guideName}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Matched To</div>
                <div className="text-lg">{match.homeTeam.teamName}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Confidence</div>
                <div className={`text-lg font-bold ${
                  match.confidence > 0.9 ? 'text-green-600' :
                  match.confidence > 0.7 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {(match.confidence * 100).toFixed(0)}%
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Method</div>
                <div className="text-sm">{match.matchedBy}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Occurrences</div>
                <div>{match.occurrenceCount}</div>
              </div>
            </div>

            {match.wasCorrect === null && (
              <div className="mt-4 flex space-x-2">
                <Button
                  size="sm"
                  onClick={() => markCorrect(match.id)}
                >
                  ✓ Correct
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => /* show correction dialog */}
                >
                  ✗ Incorrect
                </Button>
              </div>
            )}

            {match.wasCorrect === true && (
              <div className="mt-2 text-sm text-green-600">
                ✓ Validated as correct
              </div>
            )}

            {match.wasCorrect === false && (
              <div className="mt-2 text-sm text-red-600">
                ✗ Marked incorrect (should be {match.correctedToTeam?.teamName})
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Example Matching Scenarios

### Scenario 1: Wisconsin Badgers

**Guide Names:**
```
"University of Wisconsin Badgers"
"Wisconsin-Madison Badgers"
"UW Badgers"
"Badgers Football"
"Badgers"
"Wisconsin"
```

**Matching Results:**
```typescript
{
  "University of Wisconsin Badgers": {
    match: "Wisconsin Badgers",
    confidence: 0.95,
    method: "alias"
  },
  "Wisconsin-Madison Badgers": {
    match: "Wisconsin Badgers",
    confidence: 0.95,
    method: "alias"
  },
  "UW Badgers": {
    match: "Wisconsin Badgers",
    confidence: 0.95,
    method: "alias"
  },
  "Badgers Football": {
    match: "Wisconsin Badgers",
    confidence: 0.9,
    method: "fuzzy"
  },
  "Badgers": {
    match: "Wisconsin Badgers",
    confidence: 0.95,
    method: "alias"
  }
}
```

### Scenario 2: Milwaukee Bucks

**Guide Names:**
```
"MIL Bucks"
"Milwaukee"
"Bucks Basketball"
"Bucks vs Heat"
```

**Matching Results:**
```typescript
{
  "MIL Bucks": {
    match: "Milwaukee Bucks",
    confidence: 0.95,
    method: "alias"
  },
  "Milwaukee": {
    match: "Milwaukee Bucks",
    confidence: 0.7,
    method: "partial"
  },
  "Bucks Basketball": {
    match: "Milwaukee Bucks",
    confidence: 0.9,
    method: "fuzzy"
  }
}
```

### Scenario 3: Green Bay Packers

**Guide Names:**
```
"GB Packers"
"GreenBay Packers"
"Packers Football"
"Green Bay @ Chicago"
```

**Matching Results:**
```typescript
{
  "GB Packers": {
    match: "Green Bay Packers",
    confidence: 0.95,
    method: "alias"
  },
  "GreenBay Packers": {
    match: "Green Bay Packers",
    confidence: 0.95,
    method: "alias"
  },
  "Packers Football": {
    match: "Green Bay Packers",
    confidence: 0.9,
    method: "fuzzy"
  },
  "Green Bay @ Chicago": {
    match: "Green Bay Packers",
    confidence: 0.85,
    method: "fuzzy"
  }
}
```

## Learning System

The matcher learns from real guide data:

1. **First time seeing "UW-Madison Badgers"**:
   - Matches via fuzzy logic (confidence: 0.85)
   - Logs to `teamNameMatches` table

2. **Second occurrence**:
   - Finds learned match (confidence: 0.85)
   - Increments occurrence count

3. **Admin validates** match as correct:
   - Sets `wasCorrect = true`
   - Future matches use higher confidence (0.95)

4. **Admin marks incorrect**:
   - Sets `wasCorrect = false`
   - Provides correct team
   - Future matches excluded from learned results

## Migration & Deployment

**Step 1: Add columns to homeTeams**
```sql
ALTER TABLE HomeTeam ADD COLUMN aliases TEXT;
ALTER TABLE HomeTeam ADD COLUMN cityAbbreviations TEXT;
ALTER TABLE HomeTeam ADD COLUMN teamAbbreviations TEXT;
ALTER TABLE HomeTeam ADD COLUMN commonVariations TEXT;
ALTER TABLE HomeTeam ADD COLUMN matchingStrategy TEXT DEFAULT 'fuzzy';
ALTER TABLE HomeTeam ADD COLUMN minMatchConfidence REAL DEFAULT 0.7;
```

**Step 2: Create teamNameMatches table**
```sql
CREATE TABLE TeamNameMatch (
  id TEXT PRIMARY KEY,
  homeTeamId TEXT NOT NULL REFERENCES HomeTeam(id),
  guideName TEXT NOT NULL,
  matchedBy TEXT NOT NULL,
  confidence REAL NOT NULL,
  wasCorrect INTEGER,
  correctedToTeamId TEXT REFERENCES HomeTeam(id),
  firstSeen TEXT NOT NULL,
  lastSeen TEXT NOT NULL,
  occurrenceCount INTEGER DEFAULT 1
);

CREATE INDEX TeamNameMatch_guideName_idx ON TeamNameMatch(guideName);
CREATE INDEX TeamNameMatch_homeTeamId_idx ON TeamNameMatch(homeTeamId);
```

**Step 3: Seed aliases**
```bash
npx tsx scripts/seed-team-aliases.ts
```

**Step 4: Test matching**
```typescript
import { teamNameMatcher } from '@/lib/scheduler/team-name-matcher'

await teamNameMatcher.loadHomeTeams()

const tests = [
  'University of Wisconsin Badgers',
  'MIL Bucks',
  'GB Packers',
  'UW-Madison',
  'Brewers Baseball'
]

for (const test of tests) {
  const match = await teamNameMatcher.findMatch(test)
  console.log(`"${test}" → ${match?.homeTeam.teamName} (${match?.confidence})`)
}
```

## Success Metrics

- ✅ 95%+ match rate for common variations
- ✅ No false positives (wrong team matched)
- ✅ Learning system improves over time
- ✅ Admin can validate/correct matches
- ✅ Favorite teams ALWAYS prioritized regardless of guide naming
