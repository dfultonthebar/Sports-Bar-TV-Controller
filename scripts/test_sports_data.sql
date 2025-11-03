-- Test Sports Events Data for Wisconsin Teams
-- Execute: sqlite3 /home/ubuntu/sports-bar-data/production.db < scripts/test_sports_data.sql
--
-- Purpose: Populate test data to verify sports guide UI and database functionality
-- Teams: Green Bay Packers (NFL), Milwaukee Bucks (NBA), Wisconsin Badgers (NCAA-FB/BB), Milwaukee Brewers (MLB)

-- Clean up any existing test data first
DELETE FROM SportsEvent WHERE id LIKE 'test-%';

-- Green Bay Packers vs Chicago Bears (NFL) - High importance rivalry game
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-nfl-1',
  'Football', 'NFL', 'Chicago Bears @ Green Bay Packers',
  'Green Bay Packers', 'Chicago Bears',
  '2025-11-09T13:00:00.000Z', '13:00',
  'Lambeau Field', 'Green Bay', 'USA', 'FOX',
  'high', 1, 'scheduled',
  'NFC North Division rivalry game at historic Lambeau Field',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Green Bay Packers vs Minnesota Vikings (NFL) - Division game
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-nfl-2',
  'Football', 'NFL', 'Minnesota Vikings @ Green Bay Packers',
  'Green Bay Packers', 'Minnesota Vikings',
  '2025-11-16T12:00:00.000Z', '12:00',
  'Lambeau Field', 'Green Bay', 'USA', 'CBS',
  'high', 1, 'scheduled',
  'NFC North Division matchup',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Milwaukee Bucks vs Cleveland Cavaliers (NBA) - Conference game
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-nba-1',
  'Basketball', 'NBA', 'Milwaukee Bucks vs Cleveland Cavaliers',
  'Milwaukee Bucks', 'Cleveland Cavaliers',
  '2025-11-05T19:00:00.000Z', '19:00',
  'Fiserv Forum', 'Milwaukee', 'USA', 'ESPN',
  'normal', 1, 'scheduled',
  'Eastern Conference matchup at Fiserv Forum',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Milwaukee Bucks vs Boston Celtics (NBA) - High importance game
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-nba-2',
  'Basketball', 'NBA', 'Milwaukee Bucks vs Boston Celtics',
  'Milwaukee Bucks', 'Boston Celtics',
  '2025-11-13T19:30:00.000Z', '19:30',
  'Fiserv Forum', 'Milwaukee', 'USA', 'TNT',
  'high', 1, 'scheduled',
  'Eastern Conference powerhouse matchup',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Wisconsin Badgers vs Iowa Hawkeyes (NCAA Football) - Big Ten rivalry
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-ncaa-fb-1',
  'Football', 'NCAA-FB', 'Wisconsin Badgers vs Iowa Hawkeyes',
  'University Of Wisconsin Badgers', 'Iowa Hawkeyes',
  '2025-11-08T19:30:00.000Z', '19:30',
  'Camp Randall Stadium', 'Madison', 'USA', 'BTN',
  'high', 1, 'scheduled',
  'Big Ten Conference game - Battle for the Heartland Trophy',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Wisconsin Badgers vs Penn State (NCAA Football)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-ncaa-fb-2',
  'Football', 'NCAA-FB', 'Wisconsin Badgers vs Penn State Nittany Lions',
  'University Of Wisconsin Badgers', 'Penn State Nittany Lions',
  '2025-11-15T14:30:00.000Z', '14:30',
  'Camp Randall Stadium', 'Madison', 'USA', 'ABC',
  'critical', 1, 'scheduled',
  'Critical Big Ten Conference game with playoff implications',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Milwaukee Brewers vs Chicago Cubs (MLB) - Division rivalry
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-mlb-1',
  'Baseball', 'MLB', 'Milwaukee Brewers vs Chicago Cubs',
  'Milwaukee Brewers', 'Chicago Cubs',
  '2025-11-15T13:10:00.000Z', '13:10',
  'American Family Field', 'Milwaukee', 'USA', 'FS1',
  'normal', 1, 'scheduled',
  'NL Central Division rivalry game',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Milwaukee Brewers vs St. Louis Cardinals (MLB)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-mlb-2',
  'Baseball', 'MLB', 'Milwaukee Brewers vs St. Louis Cardinals',
  'Milwaukee Brewers', 'St. Louis Cardinals',
  '2025-11-18T18:40:00.000Z', '18:40',
  'American Family Field', 'Milwaukee', 'USA', 'ESPN',
  'high', 1, 'scheduled',
  'NL Central Division game - Playoff race implications',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Wisconsin Badgers vs Michigan State (NCAA Basketball)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-ncaa-bb-1',
  'Basketball', 'NCAA-BB', 'Wisconsin Badgers vs Michigan State Spartans',
  'University Of Wisconsin Badgers', 'Michigan State Spartans',
  '2025-11-12T20:00:00.000Z', '20:00',
  'Kohl Center', 'Madison', 'USA', 'ESPN2',
  'normal', 1, 'scheduled',
  'Big Ten Conference basketball matchup',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Wisconsin Badgers vs Purdue (NCAA Basketball)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-ncaa-bb-2',
  'Basketball', 'NCAA-BB', 'Wisconsin Badgers vs Purdue Boilermakers',
  'University Of Wisconsin Badgers', 'Purdue Boilermakers',
  '2025-11-19T18:00:00.000Z', '18:00',
  'Kohl Center', 'Madison', 'USA', 'BTN',
  'high', 1, 'scheduled',
  'Big Ten Conference basketball - Top 25 matchup',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Add a sync log entry for testing
INSERT INTO SportsEventSyncLog (
  id, league, teamName, syncType, eventsFound, eventsAdded, eventsUpdated,
  success, syncedAt
) VALUES (
  'test-sync-log-1',
  'TEST', 'All Teams', 'manual', 10, 10, 0,
  1, CURRENT_TIMESTAMP
);

-- Verification queries
.echo on
.mode column
.headers on

SELECT '=== Total Events Count ===' as '';
SELECT COUNT(*) as total_events FROM SportsEvent;

SELECT '=== Events by League ===' as '';
SELECT sport, league, COUNT(*) as count
FROM SportsEvent
GROUP BY sport, league
ORDER BY sport, league;

SELECT '=== Events by Importance ===' as '';
SELECT importance, COUNT(*) as count
FROM SportsEvent
GROUP BY importance
ORDER BY
  CASE importance
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END;

SELECT '=== Upcoming Games (Next 7 Days) ===' as '';
SELECT
  DATE(eventDate) as game_date,
  TIME(eventDate) as game_time,
  league,
  eventName,
  channel,
  importance
FROM SportsEvent
WHERE eventDate >= datetime('now')
  AND eventDate <= datetime('now', '+7 days')
ORDER BY eventDate;

SELECT '=== All Test Events ===' as '';
SELECT
  id,
  league,
  eventName,
  DATE(eventDate) as date,
  TIME(eventDate) as time,
  channel,
  importance
FROM SportsEvent
WHERE id LIKE 'test-%'
ORDER BY eventDate;

.echo off
