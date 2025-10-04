'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Brain,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap
} from 'lucide-react';
import type { MultiAIResult, AIResponse, DisagreementFlag } from '@/lib/multi-ai-consultant';

interface MultiAIResponseProps {
  result: MultiAIResult;
}

export default function MultiAIResponse({ result }: MultiAIResponseProps) {
  const [activeTab, setActiveTab] = useState<'consensus' | 'individual' | 'analysis'>('consensus');
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

  const toggleProvider = (provider: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider);
    } else {
      newExpanded.add(provider);
    }
    setExpandedProviders(newExpanded);
  };

  const getAgreementColor = (level: string) => {
    switch (level) {
      case 'unanimous': return 'text-green-600 bg-green-50 border-green-200';
      case 'majority': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'split': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'no-consensus': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getAgreementIcon = (level: string) => {
    switch (level) {
      case 'unanimous': return <CheckCircle2 className="w-5 h-5" />;
      case 'majority': return <TrendingUp className="w-5 h-5" />;
      case 'split': return <AlertTriangle className="w-5 h-5" />;
      case 'no-consensus': return <AlertTriangle className="w-5 h-5" />;
      default: return <Brain className="w-5 h-5" />;
    }
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      'OpenAI': 'bg-emerald-100 text-emerald-800 border-emerald-300',
      'Anthropic': 'bg-purple-100 text-purple-800 border-purple-300',
      'Google': 'bg-blue-100 text-blue-800 border-blue-300',
      'Grok': 'bg-orange-100 text-orange-800 border-orange-300'
    };
    return colors[provider] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'significant': return 'text-red-600 bg-red-50';
      case 'moderate': return 'text-yellow-600 bg-yellow-50';
      case 'minor': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
            <Users className="w-4 h-4" />
            <span>AI Models</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {result.summary.successfulResponses}/{result.summary.totalProviders}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
            <Brain className="w-4 h-4" />
            <span>Confidence</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {Math.round(result.summary.averageConfidence * 100)}%
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
            <Clock className="w-4 h-4" />
            <span>Response Time</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {(result.summary.processingTime / 1000).toFixed(1)}s
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Disagreements</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {result.disagreements.length}
          </div>
        </div>
      </div>

      {/* Agreement Level Badge */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${getAgreementColor(result.consensus.agreementLevel)}`}>
        {getAgreementIcon(result.consensus.agreementLevel)}
        <div>
          <div className="font-semibold capitalize">
            {result.consensus.agreementLevel.replace('-', ' ')} Agreement
          </div>
          <div className="text-sm opacity-80">
            Consensus confidence: {Math.round(result.consensus.confidence * 100)}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('consensus')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'consensus'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Consensus
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'individual'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Individual Responses ({result.responses.length})
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'analysis'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Analysis
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'consensus' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-600" />
                Synthesized Consensus
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {result.consensus.consensus}
              </div>
            </div>

            {/* Voting Results */}
            {result.voting && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Voting Results
                </h3>
                <div className="space-y-3">
                  {result.voting.options.map((option, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{option.option}</span>
                        <span className="text-sm text-gray-600">
                          {option.votes.length} vote{option.votes.length !== 1 ? 's' : ''} ({Math.round(option.percentage)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            idx === 0 ? 'bg-green-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${option.percentage}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {option.votes.map((voter, vIdx) => (
                          <span
                            key={vIdx}
                            className={`text-xs px-2 py-1 rounded border ${getProviderColor(voter)}`}
                          >
                            {voter}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {result.voting.winnerVotes > result.voting.totalVotes / 2 && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">
                        Majority Decision: {result.voting.winner}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Disagreements */}
            {result.disagreements.length > 0 && (
              <div className="bg-white border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Disagreements Detected
                </h3>
                <div className="space-y-4">
                  {result.disagreements.map((disagreement, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${getSeverityColor(disagreement.severity)}`}>
                      <div className="font-medium mb-2">
                        {disagreement.topic} ({disagreement.severity} disagreement)
                      </div>
                      <div className="space-y-2">
                        {disagreement.positions.map((position, pIdx) => (
                          <div key={pIdx} className="flex items-start gap-2">
                            <span className={`text-xs px-2 py-1 rounded border ${getProviderColor(position.provider)}`}>
                              {position.provider}
                            </span>
                            <span className="text-sm flex-1">{position.stance}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'individual' && (
          <div className="space-y-4">
            {result.responses.map((response, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleProvider(response.provider)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getProviderColor(response.provider)}`}>
                      {response.provider}
                    </span>
                    <span className="text-sm text-gray-600">{response.model}</span>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Brain className="w-4 h-4" />
                      <span>{Math.round(response.confidence * 100)}%</span>
                    </div>
                  </div>
                  {expandedProviders.has(response.provider) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                
                {expandedProviders.has(response.provider) && (
                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    {response.error ? (
                      <div className="text-red-600 text-sm">
                        Error: {response.error}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                        {response.response}
                      </div>
                    )}
                    <div className="mt-3 text-xs text-gray-500">
                      Response time: {response.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Analysis</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Agreement Level</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          result.consensus.agreementLevel === 'unanimous' ? 'bg-green-600' :
                          result.consensus.agreementLevel === 'majority' ? 'bg-blue-600' :
                          result.consensus.agreementLevel === 'split' ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}
                        style={{ width: `${result.consensus.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {Math.round(result.consensus.confidence * 100)}%
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Provider Performance</div>
                  <div className="space-y-2">
                    {result.responses.map((response, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded border ${getProviderColor(response.provider)}`}>
                          {response.provider}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${response.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12 text-right">
                            {Math.round(response.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Response Statistics</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600">Total Providers</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {result.summary.totalProviders}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600">Successful</div>
                      <div className="text-lg font-semibold text-green-600">
                        {result.summary.successfulResponses}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600">Failed</div>
                      <div className="text-lg font-semibold text-red-600">
                        {result.summary.failedResponses}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600">Processing Time</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {(result.summary.processingTime / 1000).toFixed(2)}s
                      </div>
                    </div>
                  </div>
                </div>

                {result.disagreements.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Disagreement Summary</div>
                    <div className="space-y-2">
                      {result.disagreements.map((disagreement, idx) => (
                        <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">{disagreement.topic}</span>
                            <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(disagreement.severity)}`}>
                              {disagreement.severity}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {disagreement.positions.length} different positions
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
