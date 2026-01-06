#!/usr/bin/env tsx

/**
 * Seed Script: Milwaukee Team Aliases and Scheduler Configuration
 *
 * This script populates the HomeTeam table with:
 * - Team name aliases for fuzzy matching
 * - City and team abbreviations
 * - Rivalry information
 * - Scheduler preferences (min TVs, preferred zones)
 * - Priority scoring
 */

import { db } from '../src/db'
import { schema } from '../src/db'
import { eq } from 'drizzle-orm'

interface TeamSeedData {
  teamName: string
  sport: string
  league: string
  category: string
  location: string
  conference?: string
  isPrimary: boolean
  priority: number
  aliases: string[]
  cityAbbreviations: string[]
  teamAbbreviations: string[]
  commonVariations: string[]
  rivalTeams: string[]
  minTVsWhenActive: number
  autoPromotePlayoffs: boolean
  preferredZones: string[]
  schedulerNotes: string
}

const milwaukeeTeams: TeamSeedData[] = [
  // Milwaukee Bucks - PRIMARY TEAM
  {
    teamName: 'Milwaukee Bucks',
    sport: 'Basketball',
    league: 'NBA',
    category: 'Professional',
    location: 'Milwaukee, WI',
    conference: 'Eastern Conference',
    isPrimary: true,
    priority: 95, // CRITICAL priority
    aliases: [
      'Bucks',
      'MIL Bucks',
      'Milwaukee',
      'MKE Bucks',
      'Bucks Basketball',
      'The Bucks',
      'Milwaukee Bucks Basketball',
      'Milw Bucks'
    ],
    cityAbbreviations: ['MIL', 'MKE', 'Milw'],
    teamAbbreviations: ['MIL', 'MKE'],
    commonVariations: [
      'Bucks Game',
      'Milwaukee vs',
      'Bucks vs',
      'MIL vs'
    ],
    rivalTeams: [
      'Chicago Bulls',
      'Miami Heat',
      'Boston Celtics',
      'Toronto Raptors'
    ],
    minTVsWhenActive: 5, // Minimum 5 TVs when Bucks are playing
    autoPromotePlayoffs: true,
    preferredZones: ['main', 'bar', 'viewing-area'],
    schedulerNotes: 'Primary team - always prioritize. Playoff games get max TVs.'
  },

  // Green Bay Packers - PRIMARY TEAM
  {
    teamName: 'Green Bay Packers',
    sport: 'Football',
    league: 'NFL',
    category: 'Professional',
    location: 'Green Bay, WI',
    conference: 'NFC North',
    isPrimary: true,
    priority: 98, // CRITICAL priority (higher than Bucks - football culture)
    aliases: [
      'Packers',
      'GB Packers',
      'Green Bay',
      'GreenBay Packers',
      'The Pack',
      'Packers Football',
      'Green Bay Packers Football',
      'GB',
      'G.B. Packers'
    ],
    cityAbbreviations: ['GB', 'G.B.', 'GreenBay'],
    teamAbbreviations: ['GB', 'G.B.', 'GNB'],
    commonVariations: [
      'Packers Game',
      'Green Bay vs',
      'Packers vs',
      'GB vs',
      'Pack vs'
    ],
    rivalTeams: [
      'Chicago Bears',
      'Minnesota Vikings',
      'Detroit Lions',
      'Dallas Cowboys',
      'San Francisco 49ers'
    ],
    minTVsWhenActive: 8, // Minimum 8 TVs - Packers games are huge
    autoPromotePlayoffs: true,
    preferredZones: ['main', 'bar', 'viewing-area', 'side'],
    schedulerNotes: 'Primary team - highest priority. Sunday games often take over entire bar.'
  },

  // Milwaukee Brewers - PRIMARY TEAM
  {
    teamName: 'Milwaukee Brewers',
    sport: 'Baseball',
    league: 'MLB',
    category: 'Professional',
    location: 'Milwaukee, WI',
    conference: 'National League Central',
    isPrimary: true,
    priority: 85, // HIGH priority
    aliases: [
      'Brewers',
      'MIL Brewers',
      'Milwaukee',
      'MKE Brewers',
      'Brewers Baseball',
      'The Brew Crew',
      'Brew Crew',
      'Milwaukee Brewers Baseball',
      'Milw Brewers'
    ],
    cityAbbreviations: ['MIL', 'MKE', 'Milw'],
    teamAbbreviations: ['MIL', 'MKE'],
    commonVariations: [
      'Brewers Game',
      'Milwaukee vs',
      'Brewers vs',
      'MIL vs'
    ],
    rivalTeams: [
      'Chicago Cubs',
      'St. Louis Cardinals',
      'Cincinnati Reds',
      'Pittsburgh Pirates'
    ],
    minTVsWhenActive: 3, // Baseball is longer, fewer TVs needed
    autoPromotePlayoffs: true,
    preferredZones: ['main', 'bar'],
    schedulerNotes: 'Primary team - prioritize playoff games and division rivals.'
  },

  // Wisconsin Badgers - SECONDARY TEAM
  {
    teamName: 'Wisconsin Badgers',
    sport: 'Football',
    league: 'NCAA',
    category: 'College',
    location: 'Madison, WI',
    conference: 'Big Ten',
    isPrimary: false, // Secondary to pro teams
    priority: 75, // HIGH priority (but below pro teams)
    aliases: [
      'Badgers',
      'UW Badgers',
      'Wisconsin',
      'University of Wisconsin Badgers',
      'UW-Madison Badgers',
      'UW Madison Badgers',
      'Wisc Badgers',
      'Wisconsin-Madison Badgers',
      'Badgers Football',
      'Wisconsin Badgers Football',
      'UW Football'
    ],
    cityAbbreviations: ['UW', 'Wisc', 'Wis'],
    teamAbbreviations: ['UW', 'Wisc', 'WIS'],
    commonVariations: [
      'Badgers Game',
      'Wisconsin vs',
      'Badgers vs',
      'UW vs'
    ],
    rivalTeams: [
      'Minnesota Golden Gophers',
      'Iowa Hawkeyes',
      'Michigan Wolverines',
      'Ohio State Buckeyes',
      'Nebraska Cornhuskers'
    ],
    minTVsWhenActive: 4, // College football gets good coverage
    autoPromotePlayoffs: true,
    preferredZones: ['main', 'viewing-area'],
    schedulerNotes: 'College football - prioritize rivalry games and Big Ten matchups.'
  },

  // Wisconsin Badgers Basketball - SECONDARY TEAM
  {
    teamName: 'Wisconsin Badgers Basketball',
    sport: 'Basketball',
    league: 'NCAA',
    category: 'College',
    location: 'Madison, WI',
    conference: 'Big Ten',
    isPrimary: false,
    priority: 65, // MEDIUM priority
    aliases: [
      'Badgers',
      'UW Badgers',
      'Wisconsin',
      'University of Wisconsin Badgers',
      'UW-Madison Badgers',
      'Wisc Badgers',
      'Badgers Basketball',
      'Wisconsin Badgers Basketball',
      'UW Basketball',
      'Wisconsin Hoops'
    ],
    cityAbbreviations: ['UW', 'Wisc', 'Wis'],
    teamAbbreviations: ['UW', 'Wisc', 'WIS'],
    commonVariations: [
      'Badgers Game',
      'Wisconsin vs',
      'Badgers vs',
      'UW vs'
    ],
    rivalTeams: [
      'Michigan State Spartans',
      'Purdue Boilermakers',
      'Illinois Fighting Illini',
      'Minnesota Golden Gophers'
    ],
    minTVsWhenActive: 2, // College basketball gets fewer TVs
    autoPromotePlayoffs: true,
    preferredZones: ['bar', 'side'],
    schedulerNotes: 'College basketball - prioritize March Madness and Big Ten tournament.'
  }
]

async function seedMilwaukeeTeams() {
  console.log('🌱 Seeding Milwaukee teams with aliases and scheduler config...\n')

  for (const teamData of milwaukeeTeams) {
    try {
      // Check if team already exists
      const existing = await db
        .select()
        .from(schema.homeTeams)
        .where(eq(schema.homeTeams.teamName, teamData.teamName))
        .limit(1)

      if (existing.length > 0) {
        // Update existing team with new fields
        console.log(`📝 Updating existing team: ${teamData.teamName}`)

        await db
          .update(schema.homeTeams)
          .set({
            aliases: JSON.stringify(teamData.aliases),
            cityAbbreviations: JSON.stringify(teamData.cityAbbreviations),
            teamAbbreviations: JSON.stringify(teamData.teamAbbreviations),
            commonVariations: JSON.stringify(teamData.commonVariations),
            rivalTeams: JSON.stringify(teamData.rivalTeams),
            minTVsWhenActive: teamData.minTVsWhenActive,
            autoPromotePlayoffs: teamData.autoPromotePlayoffs ? 1 : 0,
            preferredZones: JSON.stringify(teamData.preferredZones),
            schedulerNotes: teamData.schedulerNotes,
            priority: teamData.priority,
            isPrimary: teamData.isPrimary ? 1 : 0,
            matchingStrategy: 'fuzzy',
            minMatchConfidence: 0.7,
            updatedAt: new Date().toISOString()
          })
          .where(eq(schema.homeTeams.id, existing[0].id))

        console.log(`   ✅ Updated with ${teamData.aliases.length} aliases, ${teamData.rivalTeams.length} rivals`)
        console.log(`   ⚙️  Priority: ${teamData.priority}, Min TVs: ${teamData.minTVsWhenActive}`)
      } else {
        // Create new team
        console.log(`🆕 Creating new team: ${teamData.teamName}`)

        await db.insert(schema.homeTeams).values({
          teamName: teamData.teamName,
          sport: teamData.sport,
          league: teamData.league,
          category: teamData.category,
          location: teamData.location,
          conference: teamData.conference,
          isPrimary: teamData.isPrimary ? 1 : 0,
          priority: teamData.priority,
          aliases: JSON.stringify(teamData.aliases),
          cityAbbreviations: JSON.stringify(teamData.cityAbbreviations),
          teamAbbreviations: JSON.stringify(teamData.teamAbbreviations),
          commonVariations: JSON.stringify(teamData.commonVariations),
          rivalTeams: JSON.stringify(teamData.rivalTeams),
          minTVsWhenActive: teamData.minTVsWhenActive,
          autoPromotePlayoffs: teamData.autoPromotePlayoffs ? 1 : 0,
          preferredZones: JSON.stringify(teamData.preferredZones),
          schedulerNotes: teamData.schedulerNotes,
          matchingStrategy: 'fuzzy',
          minMatchConfidence: 0.7,
          isActive: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

        console.log(`   ✅ Created with ${teamData.aliases.length} aliases, ${teamData.rivalTeams.length} rivals`)
        console.log(`   ⚙️  Priority: ${teamData.priority}, Min TVs: ${teamData.minTVsWhenActive}`)
      }

      console.log('') // Blank line
    } catch (error) {
      console.error(`❌ Error seeding ${teamData.teamName}:`, error)
    }
  }

  console.log('✅ Milwaukee teams seeded successfully!\n')
  console.log('📊 Summary:')
  console.log(`   - ${milwaukeeTeams.filter(t => t.isPrimary).length} Primary teams (Bucks, Packers, Brewers)`)
  console.log(`   - ${milwaukeeTeams.filter(t => !t.isPrimary).length} Secondary teams (Badgers)`)
  console.log(`   - Total: ${milwaukeeTeams.length} teams configured`)
}

// Run the seed
seedMilwaukeeTeams()
  .then(() => {
    console.log('\n🎉 Seeding complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  })
