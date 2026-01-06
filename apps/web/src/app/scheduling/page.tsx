'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TournamentBracket from '@/components/scheduling/TournamentBracket';
import ConflictAlerts from '@/components/scheduling/ConflictAlerts';

interface GameSchedule {
  id: string;
  awayTeamName: string;
  homeTeamName: string;
  scheduledStart: number;
  status: string;
  primaryNetwork: string | null;
  broadcastNetworks: string[];
  calculatedPriority: number;
  isPriorityGame: boolean;
}

interface InputSource {
  id: string;
  name: string;
  type: string;
  availableNetworks: string[];
  isActive: boolean;
  currentlyAllocated: boolean;
}

interface Allocation {
  allocation: {
    id: string;
    tvOutputIds: string[];
    tvCount: number;
    status: string;
    allocatedAt: number;
  };
  game: GameSchedule;
  inputSource: InputSource;
}

export default function SchedulingDashboard() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<GameSchedule[]>([]);
  const [inputSources, setInputSources] = useState<InputSource[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [allocationsRes, gamesRes, sourcesRes] = await Promise.all([
        fetch('/api/scheduling/allocate'),
        fetch('/api/scheduling/games?limit=20'),
        fetch('/api/scheduling/input-sources'),
      ]);

      const allocationsData = await allocationsRes.json();
      const gamesData = await gamesRes.json();
      const sourcesData = await sourcesRes.json();

      if (allocationsData.success) {
        setAllocations(allocationsData.allocations || []);
      }
      if (gamesData.success) {
        setUpcomingGames(gamesData.games || []);
      }
      if (sourcesData.success) {
        setInputSources(sourcesData.sources || []);
      }
    } catch (error) {
      console.error('Error fetching scheduling data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Smart Scheduling Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Smart Scheduling Dashboard</h1>
        <p className="text-slate-400">Monitor game allocations, upcoming games, tournaments, and input sources</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Scheduling Conflicts */}
          <ConflictAlerts lookAheadHours={24} autoRefresh={true} refreshInterval={60000} />

          {/* Active Allocations */}
          <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Active Allocations</CardTitle>
          <CardDescription className="text-slate-300">
            Currently allocated games to TVs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <p className="text-slate-400">No active allocations</p>
          ) : (
            <div className="space-y-4">
              {allocations.map((alloc) => (
                <div
                  key={alloc.allocation.id}
                  className="bg-sportsBar-900/50 p-4 rounded-lg border border-sportsBar-600"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg text-slate-100">
                        {alloc.game.awayTeamName} @ {alloc.game.homeTeamName}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {alloc.game.broadcastNetworks.join(', ')}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Allocated: {formatTime(alloc.allocation.allocatedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm font-medium inline-block">
                        {alloc.allocation.status}
                      </div>
                      <p className="text-sm text-slate-400 mt-2">{alloc.inputSource.name}</p>
                      <p className="text-xs text-slate-500">{alloc.allocation.tvCount} TVs</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input Sources Status */}
      <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Input Sources</CardTitle>
          <CardDescription className="text-slate-300">
            Available input sources and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inputSources.map((source) => (
              <div
                key={source.id}
                className="bg-sportsBar-900/50 p-4 rounded-lg border border-sportsBar-600"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-slate-100">{source.name}</h3>
                  <div className="flex gap-2">
                    {source.isActive && (
                      <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                        Active
                      </span>
                    )}
                    {source.currentlyAllocated && (
                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                        In Use
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-400 mb-2">{source.type.toUpperCase()}</p>
                <p className="text-xs text-slate-500">
                  {source.availableNetworks.length} networks available
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Games */}
      <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Upcoming Games</CardTitle>
          <CardDescription className="text-slate-300">
            Next {upcomingGames.length} scheduled games
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {upcomingGames.slice(0, 10).map((game) => (
              <div
                key={game.id}
                className="flex justify-between items-center p-3 bg-sportsBar-900/30 rounded-lg hover:bg-sportsBar-900/50 transition-colors"
              >
                <div>
                  <h4 className="font-medium text-slate-100">
                    {game.awayTeamName} @ {game.homeTeamName}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {game.broadcastNetworks.join(', ') || 'Network TBD'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-300">{formatTime(game.scheduledStart)}</p>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      game.status === 'scheduled'
                        ? 'bg-blue-600/20 text-blue-400'
                        : game.status === 'in_progress'
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-slate-600/20 text-slate-400'
                    }`}
                  >
                    {game.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="tournaments" className="mt-6">
          <TournamentBracket autoRefresh={true} refreshInterval={30000} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
