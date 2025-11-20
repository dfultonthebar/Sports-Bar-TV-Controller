'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ConflictGame {
  id: string;
  awayTeamName: string;
  homeTeamName: string;
  scheduledStart: number;
  calculatedPriority: number;
  primaryNetwork: string | null;
}

interface SchedulingConflict {
  id: string;
  timeWindow: {
    start: number;
    end: number;
  };
  conflictingGames: ConflictGame[];
  availableInputs: number;
  requiredInputs: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  canBeResolved: boolean;
}

interface ConflictAlertsProps {
  lookAheadHours?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

export default function ConflictAlerts({
  lookAheadHours = 24,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
}: ConflictAlertsProps) {
  const [conflicts, setConflicts] = useState<SchedulingConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalConflicts, setTotalConflicts] = useState(0);
  const [criticalConflicts, setCriticalConflicts] = useState(0);

  const fetchConflicts = async () => {
    try {
      const response = await fetch(
        `/api/scheduling/conflicts?lookAheadHours=${lookAheadHours}`
      );
      const data = await response.json();

      if (data.success) {
        setConflicts(data.conflicts || []);
        setTotalConflicts(data.totalConflicts || 0);
        setCriticalConflicts(data.criticalConflicts || 0);
      }
    } catch (error) {
      console.error('Error fetching conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();

    if (autoRefresh) {
      const interval = setInterval(fetchConflicts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [lookAheadHours, autoRefresh, refreshInterval]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'low':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-500/10';
      case 'high':
        return 'border-orange-500 bg-orange-500/10';
      case 'medium':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'low':
        return 'border-green-500 bg-green-500/10';
      default:
        return 'border-sportsBar-600 bg-sportsBar-900/30';
    }
  };

  const getSummaryColor = () => {
    if (criticalConflicts > 0) return 'text-red-500';
    if (totalConflicts > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (loading) {
    return (
      <Card className="bg-sportsBar-800/50 border-sportsBar-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Scheduling Conflicts</CardTitle>
          <CardDescription className="text-slate-300">
            Checking for conflicts...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-sportsBar-800/50 border-sportsBar-700">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Scheduling Conflicts
        </CardTitle>
        <CardDescription className="text-slate-300">
          <span className={getSummaryColor()}>
            {totalConflicts === 0
              ? 'No conflicts detected'
              : `${totalConflicts} conflict${totalConflicts > 1 ? 's' : ''} detected${criticalConflicts > 0 ? ` (${criticalConflicts} critical)` : ''}`}
          </span>
          {' '}- Next {lookAheadHours} hours
        </CardDescription>
      </CardHeader>

      {conflicts.length > 0 && (
        <CardContent>
          <div className="space-y-4">
            {conflicts.map(conflict => (
              <div
                key={conflict.id}
                className={`p-4 rounded-lg border ${getSeverityColor(conflict.severity)}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  {getSeverityIcon(conflict.severity)}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-slate-100 capitalize">
                        {conflict.severity} Severity Conflict
                      </h4>
                      <span className="text-xs text-slate-400">
                        {formatTime(conflict.timeWindow.start)} -{' '}
                        {formatTime(conflict.timeWindow.end)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 mb-3">
                      {conflict.requiredInputs} games overlap, but only{' '}
                      {conflict.availableInputs} input source
                      {conflict.availableInputs !== 1 ? 's' : ''} available
                    </p>

                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-slate-400">
                        Conflicting Games:
                      </p>
                      {conflict.conflictingGames.map(game => (
                        <div
                          key={game.id}
                          className="text-sm bg-sportsBar-900/50 p-2 rounded"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-slate-100">
                              {game.awayTeamName} @ {game.homeTeamName}
                            </span>
                            <div className="flex gap-2 items-center">
                              <span className="text-xs text-slate-400">
                                {game.primaryNetwork || 'Network TBD'}
                              </span>
                              <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded">
                                Priority: {game.calculatedPriority}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {conflict.recommendations.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400">
                          Recommendations:
                        </p>
                        <ul className="space-y-1">
                          {conflict.recommendations.map((rec, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-slate-300 flex items-start gap-2"
                            >
                              <span className="text-slate-500">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
