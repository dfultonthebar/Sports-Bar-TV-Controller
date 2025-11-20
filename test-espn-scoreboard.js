/**
 * Test ESPN Scoreboard API Client
 * Run with: node test-espn-scoreboard.js
 */

async function testESPNScoreboard() {
  console.log('Testing ESPN Scoreboard API...\n');

  // Test 1: NFL Games
  console.log('=== Test 1: NFL Games (Today) ===');
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const nflUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${today}`;

  try {
    const response = await fetch(nflUrl);
    const data = await response.json();
    console.log(`URL: ${nflUrl}`);
    console.log(`Status: ${response.status}`);
    console.log(`Games found: ${data.events?.length || 0}`);

    if (data.events && data.events.length > 0) {
      const game = data.events[0];
      const competition = game.competitions?.[0];
      const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
      const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');

      console.log(`\nSample Game: ${game.name}`);
      console.log(`  Date: ${game.date}`);
      console.log(`  Home: ${homeTeam?.team?.displayName} (${homeTeam?.score || 0})`);
      console.log(`  Away: ${awayTeam?.team?.displayName} (${awayTeam?.score || 0})`);
      console.log(`  Status: ${competition?.status?.type?.detail}`);
      console.log(`  Season Type: ${game.season?.type} (3=Playoffs)`);

      if (game.week) {
        console.log(`  Week: ${game.week.number} - ${game.week.text || 'Regular Season'}`);
      }

      if (competition?.broadcasts) {
        const networks = competition.broadcasts.map(b => b.names.join(', ')).join(', ');
        console.log(`  Broadcast: ${networks}`);
      }
    }
  } catch (error) {
    console.error('Error fetching NFL games:', error.message);
  }

  // Test 2: NBA Games (Date Range)
  console.log('\n=== Test 2: NBA Games (This Week) ===');
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 1);
  const endDate = new Date(now);
  endDate.setDate(now.getDate() + 6);

  const start = startDate.toISOString().split('T')[0].replace(/-/g, '');
  const end = endDate.toISOString().split('T')[0].replace(/-/g, '');
  const nbaUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${start}-${end}`;

  try {
    const response = await fetch(nbaUrl);
    const data = await response.json();
    console.log(`URL: ${nbaUrl}`);
    console.log(`Status: ${response.status}`);
    console.log(`Games found: ${data.events?.length || 0}`);
    console.log(`Date range: ${start} to ${end}`);

    if (data.events && data.events.length > 0) {
      // Group by date
      const byDate = {};
      data.events.forEach(game => {
        const date = game.date.split('T')[0];
        byDate[date] = (byDate[date] || 0) + 1;
      });

      console.log('\nGames by date:');
      Object.keys(byDate).sort().forEach(date => {
        console.log(`  ${date}: ${byDate[date]} games`);
      });
    }
  } catch (error) {
    console.error('Error fetching NBA games:', error.message);
  }

  // Test 3: College Basketball (Playoff Detection)
  console.log('\n=== Test 3: College Basketball (March Madness Detection) ===');
  const ncaamUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${today}`;

  try {
    const response = await fetch(ncaamUrl);
    const data = await response.json();
    console.log(`URL: ${ncaamUrl}`);
    console.log(`Status: ${response.status}`);
    console.log(`Games found: ${data.events?.length || 0}`);

    if (data.leagues && data.leagues.length > 0) {
      const league = data.leagues[0];
      console.log(`\nSeason Info:`);
      console.log(`  Year: ${league.season?.year}`);
      console.log(`  Type: ${league.season?.type} (1=Pre, 2=Regular, 3=Postseason)`);

      if (league.season?.type === 3) {
        console.log('  🏆 PLAYOFF/TOURNAMENT GAMES!');
      }
    }
  } catch (error) {
    console.error('Error fetching NCAAM games:', error.message);
  }

  console.log('\n✅ ESPN Scoreboard API Test Complete');
}

testESPNScoreboard();
