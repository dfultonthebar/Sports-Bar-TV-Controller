/**
 * Multi-AI Consultation System
 * Queries multiple AI models in parallel, compares responses, synthesizes consensus,
 * and flags disagreements for both interactive chatbot and automated diagnostics.
 */

import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Types
export interface AIResponse {
  provider: string;
  model: string;
  response: string;
  confidence: number;
  timestamp: Date;
  error?: string;
}

export interface ConsensusResult {
  consensus: string;
  confidence: number;
  agreementLevel: 'unanimous' | 'majority' | 'split' | 'no-consensus';
}

export interface DisagreementFlag {
  topic: string;
  positions: Array<{
    provider: string;
    stance: string;
  }>;
  severity: 'minor' | 'moderate' | 'significant';
}

export interface VotingResult {
  question: string;
  options: Array<{
    option: string;
    votes: string[];
    percentage: number;
  }>;
  winner: string;
  winnerVotes: number;
  totalVotes: number;
}

export interface MultiAIResult {
  query: string;
  timestamp: Date;
  responses: AIResponse[];
  consensus: ConsensusResult;
  disagreements: DisagreementFlag[];
  voting?: VotingResult;
  summary: {
    totalProviders: number;
    successfulResponses: number;
    failedResponses: number;
    averageConfidence: number;
    processingTime: number;
  };
}

// Configuration
interface AIProviderConfig {
  enabled: boolean;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface MultiAIConfig {
  openai?: AIProviderConfig;
  anthropic?: AIProviderConfig;
  google?: AIProviderConfig;
  grok?: AIProviderConfig;
}

export class MultiAIConsultant {
  private config: MultiAIConfig;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private googleClient?: GoogleGenerativeAI;
  private grokClient?: OpenAI; // Grok uses OpenAI-compatible API

  constructor() {
    this.config = this.loadConfig();
    this.initializeClients();
  }

  private loadConfig(): MultiAIConfig {
    const config: MultiAIConfig = {};

    // OpenAI Configuration
    if (process.env.OPENAI_API_KEY) {
      config.openai = {
        enabled: true,
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxTokens: 2000,
        temperature: 0.7
      };
    }

    // Anthropic (Claude) Configuration
    if (process.env.ANTHROPIC_API_KEY) {
      config.anthropic = {
        enabled: true,
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        maxTokens: 2000,
        temperature: 0.7
      };
    }

    // Google (Gemini) Configuration
    if (process.env.GOOGLE_API_KEY) {
      config.google = {
        enabled: true,
        apiKey: process.env.GOOGLE_API_KEY,
        model: process.env.GOOGLE_MODEL || 'gemini-1.5-pro',
        maxTokens: 2000,
        temperature: 0.7
      };
    }

    // xAI (Grok) Configuration
    if (process.env.GROK_API_KEY) {
      config.grok = {
        enabled: true,
        apiKey: process.env.GROK_API_KEY,
        model: process.env.GROK_MODEL || 'grok-beta',
        maxTokens: 2000,
        temperature: 0.7
      };
    }

    return config;
  }

  private initializeClients(): void {
    if (this.config.openai?.enabled) {
      this.openaiClient = new OpenAI({
        apiKey: this.config.openai.apiKey
      });
    }

    if (this.config.anthropic?.enabled) {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.anthropic.apiKey
      });
    }

    if (this.config.google?.enabled) {
      this.googleClient = new GoogleGenerativeAI(this.config.google.apiKey!);
    }

    if (this.config.grok?.enabled) {
      this.grokClient = new OpenAI({
        apiKey: this.config.grok.apiKey,
        baseURL: 'https://api.x.ai/v1'
      });
    }
  }

  /**
   * Query all available AI models in parallel
   */
  async consultAll(
    query: string,
    systemPrompt?: string,
    context?: any
  ): Promise<MultiAIResult> {
    const startTime = Date.now();
    const responses: AIResponse[] = [];

    // Build context-aware prompt
    const fullQuery = this.buildContextualQuery(query, context);

    // Query all providers in parallel
    const promises: Promise<AIResponse>[] = [];

    if (this.config.openai?.enabled && this.openaiClient) {
      promises.push(this.queryOpenAI(fullQuery, systemPrompt));
    }

    if (this.config.anthropic?.enabled && this.anthropicClient) {
      promises.push(this.queryAnthropic(fullQuery, systemPrompt));
    }

    if (this.config.google?.enabled && this.googleClient) {
      promises.push(this.queryGoogle(fullQuery, systemPrompt));
    }

    if (this.config.grok?.enabled && this.grokClient) {
      promises.push(this.queryGrok(fullQuery, systemPrompt));
    }

    // Wait for all responses (or failures)
    const results = await Promise.allSettled(promises);

    // Collect successful responses
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        responses.push(result.value);
      } else {
        console.error('AI provider failed:', result.reason);
      }
    });

    // Analyze responses
    const consensus = this.synthesizeConsensus(responses);
    const disagreements = this.detectDisagreements(responses);
    const voting = this.performVoting(query, responses);

    const processingTime = Date.now() - startTime;

    return {
      query,
      timestamp: new Date(),
      responses,
      consensus,
      disagreements,
      voting,
      summary: {
        totalProviders: promises.length,
        successfulResponses: responses.length,
        failedResponses: promises.length - responses.length,
        averageConfidence: this.calculateAverageConfidence(responses),
        processingTime
      }
    };
  }

  private buildContextualQuery(query: string, context?: any): string {
    if (!context) return query;

    let contextualQuery = query + '\n\nContext:\n';

    if (context.activeIssues && context.activeIssues.length > 0) {
      contextualQuery += `\nActive Issues (${context.activeIssues.length}):\n`;
      context.activeIssues.forEach((issue: any) => {
        contextualQuery += `- [${issue.severity}] ${issue.title}: ${issue.description}\n`;
      });
    }

    if (context.recentChecks && context.recentChecks.length > 0) {
      contextualQuery += `\nRecent Health Checks: ${context.recentChecks.length} completed\n`;
    }

    if (context.recentFixes && context.recentFixes.length > 0) {
      contextualQuery += `\nRecent Fixes: ${context.recentFixes.length} applied\n`;
    }

    if (context.systemMetrics) {
      contextualQuery += `\nSystem Metrics:\n`;
      contextualQuery += `- CPU: ${context.systemMetrics.cpu}%\n`;
      contextualQuery += `- Memory: ${context.systemMetrics.memory}%\n`;
      contextualQuery += `- Disk: ${context.systemMetrics.disk}%\n`;
    }

    return contextualQuery;
  }

  private async queryOpenAI(query: string, systemPrompt?: string): Promise<AIResponse> {
    const startTime = Date.now();
    try {
      const completion = await this.openaiClient!.chat.completions.create({
        model: this.config.openai!.model,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: query }
        ],
        max_tokens: this.config.openai!.maxTokens,
        temperature: this.config.openai!.temperature
      });

      return {
        provider: 'OpenAI',
        model: this.config.openai!.model,
        response: completion.choices[0].message.content || '',
        confidence: this.estimateConfidence(completion.choices[0].message.content || ''),
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        provider: 'OpenAI',
        model: this.config.openai!.model,
        response: '',
        confidence: 0,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  private async queryAnthropic(query: string, systemPrompt?: string): Promise<AIResponse> {
    try {
      const message = await this.anthropicClient!.messages.create({
        model: this.config.anthropic!.model,
        max_tokens: this.config.anthropic!.maxTokens,
        temperature: this.config.anthropic!.temperature,
        system: systemPrompt,
        messages: [
          { role: 'user', content: query }
        ]
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

      return {
        provider: 'Anthropic',
        model: this.config.anthropic!.model,
        response: responseText,
        confidence: this.estimateConfidence(responseText),
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        provider: 'Anthropic',
        model: this.config.anthropic!.model,
        response: '',
        confidence: 0,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  private async queryGoogle(query: string, systemPrompt?: string): Promise<AIResponse> {
    try {
      const model = this.googleClient!.getGenerativeModel({ 
        model: this.config.google!.model 
      });

      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\nUser Query: ${query}`
        : query;

      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const responseText = response.text();

      return {
        provider: 'Google',
        model: this.config.google!.model,
        response: responseText,
        confidence: this.estimateConfidence(responseText),
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        provider: 'Google',
        model: this.config.google!.model,
        response: '',
        confidence: 0,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  private async queryGrok(query: string, systemPrompt?: string): Promise<AIResponse> {
    try {
      const completion = await this.grokClient!.chat.completions.create({
        model: this.config.grok!.model,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: query }
        ],
        max_tokens: this.config.grok!.maxTokens,
        temperature: this.config.grok!.temperature
      });

      return {
        provider: 'Grok',
        model: this.config.grok!.model,
        response: completion.choices[0].message.content || '',
        confidence: this.estimateConfidence(completion.choices[0].message.content || ''),
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        provider: 'Grok',
        model: this.config.grok!.model,
        response: '',
        confidence: 0,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Synthesize consensus from multiple AI responses
   */
  private synthesizeConsensus(responses: AIResponse[]): ConsensusResult {
    if (responses.length === 0) {
      return {
        consensus: 'No AI responses available',
        confidence: 0,
        agreementLevel: 'no-consensus'
      };
    }

    if (responses.length === 1) {
      return {
        consensus: responses[0].response,
        confidence: responses[0].confidence,
        agreementLevel: 'unanimous'
      };
    }

    // Analyze similarity between responses
    const similarities = this.calculateResponseSimilarities(responses);
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;

    let agreementLevel: 'unanimous' | 'majority' | 'split' | 'no-consensus';
    if (avgSimilarity > 0.8) {
      agreementLevel = 'unanimous';
    } else if (avgSimilarity > 0.6) {
      agreementLevel = 'majority';
    } else if (avgSimilarity > 0.4) {
      agreementLevel = 'split';
    } else {
      agreementLevel = 'no-consensus';
    }

    // Build consensus by combining key points
    const consensus = this.buildConsensusText(responses, agreementLevel);
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;

    return {
      consensus,
      confidence: avgConfidence * avgSimilarity, // Adjust confidence by agreement
      agreementLevel
    };
  }

  private buildConsensusText(responses: AIResponse[], agreementLevel: string): string {
    if (agreementLevel === 'unanimous' || agreementLevel === 'majority') {
      // Extract common themes
      const commonPoints = this.extractCommonPoints(responses);
      let consensus = '**Consensus Summary:**\n\n';
      
      if (commonPoints.length > 0) {
        consensus += 'All AIs agree on the following:\n\n';
        commonPoints.forEach((point, idx) => {
          consensus += `${idx + 1}. ${point}\n`;
        });
      } else {
        // Fallback to first response if extraction fails
        consensus += responses[0].response;
      }

      return consensus;
    } else {
      return '**Multiple Perspectives:**\n\nThe AIs provided different perspectives on this question. See individual responses below for details.';
    }
  }

  private extractCommonPoints(responses: AIResponse[]): string[] {
    // Simple extraction: look for common sentences/phrases
    // In production, this could use NLP for better analysis
    const allPoints: string[] = [];
    
    responses.forEach(response => {
      const sentences = response.response.split(/[.!?]+/).filter(s => s.trim().length > 20);
      allPoints.push(...sentences.map(s => s.trim()));
    });

    // Find points that appear in multiple responses
    const pointCounts = new Map<string, number>();
    allPoints.forEach(point => {
      const normalized = point.toLowerCase();
      pointCounts.set(normalized, (pointCounts.get(normalized) || 0) + 1);
    });

    // Return points mentioned by majority
    const threshold = Math.ceil(responses.length / 2);
    return Array.from(pointCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([point, _]) => point)
      .slice(0, 5); // Top 5 common points
  }

  /**
   * Detect disagreements between AI responses
   */
  private detectDisagreements(responses: AIResponse[]): DisagreementFlag[] {
    if (responses.length < 2) return [];

    const disagreements: DisagreementFlag[] = [];

    // Check for contradictory recommendations
    const recommendations = this.extractRecommendations(responses);
    if (recommendations.length > 1) {
      const uniqueRecs = new Set(recommendations.map(r => r.recommendation));
      if (uniqueRecs.size > 1) {
        disagreements.push({
          topic: 'Recommendations',
          positions: recommendations.map(r => ({
            provider: r.provider,
            stance: r.recommendation
          })),
          severity: this.assessDisagreementSeverity(recommendations)
        });
      }
    }

    // Check for contradictory severity assessments
    const severities = this.extractSeverityAssessments(responses);
    if (severities.length > 1) {
      const uniqueSeverities = new Set(severities.map(s => s.severity));
      if (uniqueSeverities.size > 1) {
        disagreements.push({
          topic: 'Severity Assessment',
          positions: severities.map(s => ({
            provider: s.provider,
            stance: s.severity
          })),
          severity: 'moderate'
        });
      }
    }

    return disagreements;
  }

  private extractRecommendations(responses: AIResponse[]): Array<{provider: string, recommendation: string}> {
    const recommendations: Array<{provider: string, recommendation: string}> = [];
    
    responses.forEach(response => {
      // Look for recommendation keywords
      const text = response.response.toLowerCase();
      if (text.includes('recommend') || text.includes('suggest') || text.includes('should')) {
        const sentences = response.response.split(/[.!?]+/);
        const recSentence = sentences.find(s => 
          s.toLowerCase().includes('recommend') || 
          s.toLowerCase().includes('suggest') ||
          s.toLowerCase().includes('should')
        );
        
        if (recSentence) {
          recommendations.push({
            provider: response.provider,
            recommendation: recSentence.trim()
          });
        }
      }
    });

    return recommendations;
  }

  private extractSeverityAssessments(responses: AIResponse[]): Array<{provider: string, severity: string}> {
    const severities: Array<{provider: string, severity: string}> = [];
    const severityKeywords = ['critical', 'high', 'medium', 'low', 'severe', 'minor'];

    responses.forEach(response => {
      const text = response.response.toLowerCase();
      for (const keyword of severityKeywords) {
        if (text.includes(keyword)) {
          severities.push({
            provider: response.provider,
            severity: keyword
          });
          break;
        }
      }
    });

    return severities;
  }

  private assessDisagreementSeverity(recommendations: Array<{provider: string, recommendation: string}>): 'minor' | 'moderate' | 'significant' {
    // Simple heuristic: if recommendations are very different, it's significant
    const uniqueActions = new Set(recommendations.map(r => {
      const lower = r.recommendation.toLowerCase();
      if (lower.includes('restart')) return 'restart';
      if (lower.includes('wait') || lower.includes('monitor')) return 'wait';
      if (lower.includes('fix') || lower.includes('repair')) return 'fix';
      if (lower.includes('ignore')) return 'ignore';
      return 'other';
    }));

    if (uniqueActions.has('restart') && uniqueActions.has('ignore')) return 'significant';
    if (uniqueActions.size > 2) return 'moderate';
    return 'minor';
  }

  /**
   * Perform voting on recommendations
   */
  private performVoting(query: string, responses: AIResponse[]): VotingResult | undefined {
    if (responses.length < 2) return undefined;

    const recommendations = this.extractRecommendations(responses);
    if (recommendations.length === 0) return undefined;

    // Group similar recommendations
    const voteGroups = new Map<string, string[]>();
    
    recommendations.forEach(rec => {
      const action = this.categorizeAction(rec.recommendation);
      if (!voteGroups.has(action)) {
        voteGroups.set(action, []);
      }
      voteGroups.get(action)!.push(rec.provider);
    });

    // Build voting result
    const options = Array.from(voteGroups.entries()).map(([option, votes]) => ({
      option,
      votes,
      percentage: (votes.length / responses.length) * 100
    }));

    options.sort((a, b) => b.votes.length - a.votes.length);

    return {
      question: query,
      options,
      winner: options[0].option,
      winnerVotes: options[0].votes.length,
      totalVotes: responses.length
    };
  }

  private categorizeAction(recommendation: string): string {
    const lower = recommendation.toLowerCase();
    if (lower.includes('restart') || lower.includes('reboot')) return 'Restart System';
    if (lower.includes('wait') || lower.includes('monitor')) return 'Monitor and Wait';
    if (lower.includes('fix') || lower.includes('repair')) return 'Apply Fix';
    if (lower.includes('investigate') || lower.includes('check')) return 'Investigate Further';
    if (lower.includes('ignore') || lower.includes('no action')) return 'No Action Needed';
    if (lower.includes('optimize') || lower.includes('improve')) return 'Optimize';
    return 'Other Action';
  }

  /**
   * Calculate similarity between responses
   */
  private calculateResponseSimilarities(responses: AIResponse[]): number[] {
    const similarities: number[] = [];

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculateTextSimilarity(
          responses[i].response,
          responses[j].response
        );
        similarities.push(similarity);
      }
    }

    return similarities;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word-based similarity (Jaccard similarity)
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private estimateConfidence(response: string): number {
    // Heuristic confidence estimation based on response characteristics
    let confidence = 0.5; // Base confidence

    // Longer, more detailed responses suggest higher confidence
    if (response.length > 500) confidence += 0.1;
    if (response.length > 1000) confidence += 0.1;

    // Presence of specific recommendations suggests confidence
    if (response.toLowerCase().includes('recommend')) confidence += 0.1;
    if (response.toLowerCase().includes('should')) confidence += 0.05;

    // Hedging language reduces confidence
    if (response.toLowerCase().includes('might') || response.toLowerCase().includes('maybe')) {
      confidence -= 0.1;
    }
    if (response.toLowerCase().includes('uncertain') || response.toLowerCase().includes('unclear')) {
      confidence -= 0.15;
    }

    // Presence of data/numbers suggests confidence
    if (/\d+%/.test(response)) confidence += 0.05;

    return Math.max(0, Math.min(1, confidence));
  }

  private calculateAverageConfidence(responses: AIResponse[]): number {
    if (responses.length === 0) return 0;
    return responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
  }

  /**
   * Get list of available AI providers
   */
  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.config.openai?.enabled) providers.push('OpenAI');
    if (this.config.anthropic?.enabled) providers.push('Anthropic');
    if (this.config.google?.enabled) providers.push('Google');
    if (this.config.grok?.enabled) providers.push('Grok');
    return providers;
  }

  /**
   * Check if multi-AI consultation is available
   */
  isAvailable(): boolean {
    return this.getAvailableProviders().length > 0;
  }
}

// Singleton instance
let consultantInstance: MultiAIConsultant | null = null;

export function getMultiAIConsultant(): MultiAIConsultant {
  if (!consultantInstance) {
    consultantInstance = new MultiAIConsultant();
  }
  return consultantInstance;
}
