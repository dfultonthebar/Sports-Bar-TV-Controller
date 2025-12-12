'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, Calendar, TrendingUp } from 'lucide-react';

interface TournamentGame {
  id: string;
  espnEventId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamAbbr: string | null;
  awayTeamAbbr: string | null;
  homeScore: number | null;
  awayScore: number | null;
  scheduledStart: number;
  status: string;
  statusDetail: string | null;
  primaryNetwork: string | null;
  broadcastNetworks: string[];
  playoffRound: string | null;
  seasonType: number;
  isPriorityGame: boolean;
}

interface TournamentBracket {
  id: string;
  tournamentName: string;
  shortName: string | null;
  seasonYear: number;
  sport: string;
  league: string;
  totalTeams: number | null;
  totalRounds: number | null;
  currentRound: number | null;
  roundName: string | null;
  totalGames: number | null;
  gamesScheduled: number | null;
  gamesInProgress: number | null;
  gamesCompleted: number | null;
  tournamentStart: number | null;
  tournamentEnd: number | null;
  status: string | null;
  lastSynced: number | null;
}

interface TournamentData {
  bracket: TournamentBracket;
  games: TournamentGame[];
  gamesByRound: Record<string, TournamentGame[]>;
}

interface TournamentBracketProps {
  league?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function TournamentBracket({
  league,
  autoRefresh = true,
  refreshInterval = 30000,
}: TournamentBracketProps) {
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<number>(0);

  const fetchTournaments = async () => {
    try {
      const url = league
        ? `/api/scheduling/tournaments?league=${encodeURIComponent(league)}`
        : '/api/scheduling/tournaments';

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setTournaments(data.tournaments || []);
        setError(null);
      } else {
        setError(data.error || 'Failed to load tournaments');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tournament data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();

    if (autoRefresh) {
      const interval = setInterval(fetchTournaments, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [league, autoRefresh, refreshInterval]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_progress':
      case 'halftime':
        return 'bg-green-600/20 text-green-400 border-green-600/30';
      case 'scheduled':
        return 'bg-blue-600/20 text-blue-400 border-blue-600/30';
      case 'final':
        return 'bg-slate-600/20 text-slate-400 border-slate-600/30';
      case 'postponed':
      case 'cancelled':
        return 'bg-red-600/20 text-red-400 border-red-600/30';
      default:
        return 'bg-slate-600/20 text-slate-400 border-slate-600/30';
    }
  };

  const getTournamentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'in_progress':
        return 'bg-green-600/20 text-green-400';
      case 'upcoming':
        return 'bg-blue-600/20 text-blue-400';
      case 'completed':
        return 'bg-slate-600/20 text-slate-400';
      default:
        return 'bg-slate-600/20 text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-sportsBar-400" />
        <span className="ml-3 text-slate-400">Loading tournaments...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
        <p className="text-red-400">Error: {error}</p>
        <Button onClick={fetchTournaments} variant="outline" size="sm" className="mt-3">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardContent className="p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p className="text-slate-400 mb-2">No active tournaments found</p>
          <p className="text-sm text-slate-500">
            Playoff and tournament brackets will appear here during the postseason
          </p>
          <Button onClick={fetchTournaments} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentTournament = tournaments[selectedTournament];
  const { bracket, games, gamesByRound } = currentTournament;

  return (
    <div className="space-y-6">
      {/* Tournament Selector */}
      {tournaments.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tournaments.map((t, index) => (
            <Button
              key={t.bracket.id}
              onClick={() => setSelectedTournament(index)}
              variant={selectedTournament === index ? 'default' : 'outline'}
              className="flex-shrink-0"
            >
              <Trophy className="w-4 h-4 mr-2" />
              {t.bracket.shortName || t.bracket.tournamentName}
            </Button>
          ))}
        </div>
      )}

      {/* Tournament Overview */}
      <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-100 flex items-center gap-3">
                <Trophy className="w-7 h-7 text-yellow-500" />
                {bracket.tournamentName}
              </CardTitle>
              <CardDescription className="text-slate-300 mt-2">
                {bracket.league} {bracket.sport} · {bracket.seasonYear}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {bracket.status && (
                <Badge className={getTournamentStatusColor(bracket.status)}>
                  {bracket.status.replace('_', ' ').toUpperCase()}
                </Badge>
              )}
              <Button onClick={fetchTournaments} variant="ghost" size="sm">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Current Round */}
            {bracket.roundName && (
              <div className="bg-sportsBar-900/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Current Round
                </div>
                <div className="text-2xl font-bold text-slate-100">{bracket.roundName}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Round {bracket.currentRound} of {bracket.totalRounds}
                </div>
              </div>
            )}

            {/* Games Progress */}
            <div className="bg-sportsBar-900/50 p-4 rounded-lg">
              <div className="text-slate-400 text-sm mb-1">Games Progress</div>
              <div className="text-2xl font-bold text-slate-100">
                {bracket.gamesCompleted || 0}/{bracket.totalGames || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {bracket.gamesInProgress || 0} in progress
              </div>
            </div>

            {/* Tournament Dates */}
            {bracket.tournamentStart && bracket.tournamentEnd && (
              <div className="bg-sportsBar-900/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                  <Calendar className="w-4 h-4" />
                  Tournament Period
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {formatDate(bracket.tournamentStart)}
                </div>
                <div className="text-xs text-slate-500">to {formatDate(bracket.tournamentEnd)}</div>
              </div>
            )}

            {/* Total Teams */}
            {bracket.totalTeams && (
              <div className="bg-sportsBar-900/50 p-4 rounded-lg">
                <div className="text-slate-400 text-sm mb-1">Total Teams</div>
                <div className="text-2xl font-bold text-slate-100">{bracket.totalTeams}</div>
                <div className="text-xs text-slate-500 mt-1">{bracket.totalRounds} rounds</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Games by Round */}
      <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Tournament Games</CardTitle>
          <CardDescription className="text-slate-300">
            All games organized by playoff round
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(gamesByRound).length === 0 ? (
            <p className="text-slate-400 text-center py-8">No games scheduled yet</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(gamesByRound)
                .sort((a, b) => {
                  // Sort by the first game's scheduled start time in each round
                  const aTime = a[1][0]?.scheduledStart || 0;
                  const bTime = b[1][0]?.scheduledStart || 0;
                  return aTime - bTime;
                })
                .map(([round, roundGames]) => (
                  <div key={round}>
                    <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-sportsBar-500 rounded" />
                      {round || 'Round TBD'}
                      <Badge variant="outline" className="ml-2">
                        {roundGames.length} {roundGames.length === 1 ? 'game' : 'games'}
                      </Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {roundGames
                        .sort((a, b) => a.scheduledStart - b.scheduledStart)
                        .map((game) => (
                          <div
                            key={game.id}
                            className={`bg-sportsBar-900/40 p-4 rounded-lg border transition-all ${
                              game.status.toLowerCase() === 'in_progress' ||
                              game.status.toLowerCase() === 'halftime'
                                ? 'border-green-600/50 shadow-lg shadow-green-900/20'
                                : 'border-sportsBar-600 hover:border-sportsBar-500'
                            }`}
                          >
                            {/* Game Header */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge className={`${getStatusColor(game.status)} text-xs`}>
                                    {game.statusDetail || game.status.replace('_', ' ')}
                                  </Badge>
                                  {game.isPriorityGame && (
                                    <Badge variant="outline" className="text-yellow-500 border-yellow-600/30">
                                      Priority
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {formatTime(game.scheduledStart)}
                                </div>
                              </div>
                              {game.primaryNetwork && (
                                <Badge variant="outline" className="text-xs">
                                  {game.primaryNetwork}
                                </Badge>
                              )}
                            </div>

                            {/* Teams and Scores */}
                            <div className="space-y-2">
                              {/* Away Team */}
                              <div className="flex items-center justify-between p-2 rounded bg-sportsBar-800/40">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 w-8">Away</span>
                                  <span className="font-semibold text-slate-100">
                                    {game.awayTeamAbbr || game.awayTeamName}
                                  </span>
                                </div>
                                {game.awayScore !== null && (
                                  <span
                                    className={`text-xl font-bold ${
                                      game.status === 'final' &&
                                      game.awayScore > (game.homeScore || 0)
                                        ? 'text-green-400'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {game.awayScore}
                                  </span>
                                )}
                              </div>

                              {/* Home Team */}
                              <div className="flex items-center justify-between p-2 rounded bg-sportsBar-800/40">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 w-8">Home</span>
                                  <span className="font-semibold text-slate-100">
                                    {game.homeTeamAbbr || game.homeTeamName}
                                  </span>
                                </div>
                                {game.homeScore !== null && (
                                  <span
                                    className={`text-xl font-bold ${
                                      game.status === 'final' &&
                                      game.homeScore > (game.awayScore || 0)
                                        ? 'text-green-400'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {game.homeScore}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Additional Networks */}
                            {game.broadcastNetworks.length > 1 && (
                              <div className="mt-3 pt-2 border-t border-sportsBar-700">
                                <p className="text-xs text-slate-500">
                                  Also on: {game.broadcastNetworks.slice(1).join(', ')}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
