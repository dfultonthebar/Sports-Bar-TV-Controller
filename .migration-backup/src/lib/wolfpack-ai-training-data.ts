
// Wolfpack Matrix AI Training Data - Pattern recognition and optimization data

export interface WolfpackTrainingPattern {
  id: string;
  category: 'connection' | 'routing' | 'configuration' | 'performance' | 'layout' | 'audio';
  pattern: string;
  indicators: string[];
  commonCauses: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export const wolfpackTrainingData: WolfpackTrainingPattern[] = [
  // Connection Patterns
  {
    id: 'conn_001',
    category: 'connection',
    pattern: 'Repeated connection failures with timeout errors',
    indicators: ['Connection timeout', 'Network unreachable', 'ERR responses'],
    commonCauses: [
      'Incorrect IP address configuration',
      'Network connectivity issues',
      'Matrix power state problems',
      'Firewall blocking control ports'
    ],
    recommendations: [
      'Verify matrix IP address with network scan',
      'Test basic network connectivity with ping',
      'Check physical network cable connections',
      'Confirm matrix power status and startup sequence',
      'Review firewall rules for ports 4000 and 5000'
    ],
    severity: 'critical',
    confidence: 95
  },

  {
    id: 'conn_002',
    category: 'connection',
    pattern: 'Intermittent connection drops during operation',
    indicators: ['Occasional timeouts', 'Connection resets', 'Partial command execution'],
    commonCauses: [
      'Network instability',
      'WiFi interference',
      'IP address conflicts',
      'Power supply fluctuations'
    ],
    recommendations: [
      'Switch to wired network connection',
      'Check for IP address conflicts on network',
      'Monitor power supply stability',
      'Implement connection retry mechanism',
      'Consider TCP protocol for better reliability'
    ],
    severity: 'high',
    confidence: 85
  },

  // Routing Patterns
  {
    id: 'rout_001',
    category: 'routing',
    pattern: 'High command failure rate with ERR responses',
    indicators: ['Frequent ERR responses', 'Commands not executing', 'Invalid syntax errors'],
    commonCauses: [
      'Malformed command syntax',
      'Out-of-range input/output values',
      'Missing command termination periods',
      'Case sensitivity issues'
    ],
    recommendations: [
      'Validate all commands end with period (.)',
      'Verify input/output ranges (1-36 for 36x36 matrix)',
      'Check command case formatting',
      'Test with basic commands first (1X1.)',
      'Implement command validation before sending'
    ],
    severity: 'high',
    confidence: 90
  },

  {
    id: 'rout_002',
    category: 'routing',
    pattern: 'Slow switching response times',
    indicators: ['Response times >500ms', 'Delayed switching', 'Performance degradation'],
    commonCauses: [
      'Network congestion',
      'UDP packet loss',
      'Matrix system overload',
      'Inefficient command sequencing'
    ],
    recommendations: [
      'Switch from UDP to TCP protocol',
      'Reduce network traffic during switching operations',
      'Implement command queuing to avoid overload',
      'Use multi-output commands when possible (1X2&3&4.)',
      'Monitor matrix CPU and memory usage'
    ],
    severity: 'medium',
    confidence: 80
  },

  // Configuration Patterns
  {
    id: 'conf_001',
    category: 'configuration',
    pattern: 'Duplicate channel labels causing confusion',
    indicators: ['Multiple channels with same name', 'Operator confusion', 'Wrong routing'],
    commonCauses: [
      'Copy-paste configuration errors',
      'Lack of naming conventions',
      'Incomplete configuration setup'
    ],
    recommendations: [
      'Implement unique naming convention for all channels',
      'Use descriptive labels (Main Bar Left, Side Area 1)',
      'Validate label uniqueness before saving',
      'Create standardized naming templates',
      'Document label meanings for operators'
    ],
    severity: 'medium',
    confidence: 95
  },

  {
    id: 'conf_002',
    category: 'configuration',
    pattern: 'Low channel utilization with many unused ports',
    indicators: ['<30% active inputs', '<25% active outputs', 'Many "unused" labels'],
    commonCauses: [
      'Over-provisioned matrix size',
      'Incomplete system deployment',
      'Changed requirements after installation'
    ],
    recommendations: [
      'Mark unused channels as "unused" or "N/A"',
      'Review actual system requirements',
      'Consider consolidating to smaller matrix if appropriate',
      'Plan for future expansion needs',
      'Update documentation to reflect actual usage'
    ],
    severity: 'low',
    confidence: 75
  },

  // Layout Integration Patterns
  {
    id: 'layout_001',
    category: 'layout',
    pattern: 'No physical location mapping for outputs',
    indicators: ['Generic output labels', 'No layout integration', 'Manual TV identification'],
    commonCauses: [
      'Missing layout analysis',
      'No TV position documentation',
      'Incomplete integration with layout system'
    ],
    recommendations: [
      'Import TV positions from layout analysis',
      'Use location-based labels (Main Bar Center, Side Wall)',
      'Map outputs to actual TV positions',
      'Create visual layout diagram with output numbers',
      'Sync with bartender interface layout'
    ],
    severity: 'medium',
    confidence: 85
  },

  // Audio Routing Patterns
  {
    id: 'audio_001',
    category: 'audio',
    pattern: 'Multiple outputs routed to same audio channel',
    indicators: ['Duplicate audio assignments', 'Audio conflicts', 'Sound mixing issues'],
    commonCauses: [
      'Configuration oversight',
      'Copy-paste errors',
      'Misunderstanding of audio routing'
    ],
    recommendations: [
      'Assign unique audio channels to each output needing sound',
      'Use Matrix Audio 1-4 for different zones',
      'Document audio routing strategy',
      'Consider audio-follow-video logic',
      'Test audio routing after changes'
    ],
    severity: 'medium',
    confidence: 90
  },

  {
    id: 'audio_002',
    category: 'audio',
    pattern: 'No audio routing configured for any outputs',
    indicators: ['All audio outputs empty', 'No Atlas integration', 'Silent operation'],
    commonCauses: [
      'Missing audio system integration',
      'Incomplete configuration',
      'Audio system not connected'
    ],
    recommendations: [
      'Configure audio routing for outputs requiring sound',
      'Map to Atlas audio matrix inputs',
      'Set up zone-based audio distribution',
      'Test audio path from source to speakers',
      'Document audio routing configuration'
    ],
    severity: 'medium',
    confidence: 80
  },

  // Performance Patterns
  {
    id: 'perf_001',
    category: 'performance',
    pattern: 'Consistently high response latency',
    indicators: ['Response times >1000ms', 'Slow switching', 'Network timeouts'],
    commonCauses: [
      'Network congestion',
      'Matrix hardware limitations',
      'Protocol inefficiencies',
      'System resource constraints'
    ],
    recommendations: [
      'Upgrade to gigabit network connection',
      'Switch to TCP for reliability or UDP for speed',
      'Check matrix firmware version for updates',
      'Monitor network utilization during peak usage',
      'Implement connection pooling and keepalives'
    ],
    severity: 'high',
    confidence: 85
  },

  {
    id: 'perf_002',
    category: 'performance',
    pattern: 'Optimal performance indicators',
    indicators: ['Response times <100ms', '100% command success', 'Stable connections'],
    commonCauses: [
      'Proper network configuration',
      'Optimal protocol selection',
      'Good system maintenance',
      'Adequate hardware resources'
    ],
    recommendations: [
      'Continue current configuration approach',
      'Document successful setup for future reference',
      'Monitor performance trends over time',
      'Consider this setup as template for other installations'
    ],
    severity: 'low',
    confidence: 95
  }
];

// Pattern Matching Functions
export class WolfpackPatternMatcher {
  static matchConnectionIssues(indicators: string[]): WolfpackTrainingPattern[] {
    return wolfpackTrainingData
      .filter(pattern => pattern.category === 'connection')
      .filter(pattern => 
        pattern.indicators.some(indicator => 
          indicators.some(userIndicator => 
            userIndicator.toLowerCase().includes(indicator.toLowerCase())
          )
        )
      )
      .sort((a, b) => b.confidence - a.confidence);
  }

  static matchRoutingIssues(successRate: number, avgLatency: number): WolfpackTrainingPattern[] {
    const matches: WolfpackTrainingPattern[] = [];
    
    if (successRate < 95) {
      matches.push(...wolfpackTrainingData.filter(p => p.id === 'rout_001'));
    }
    
    if (avgLatency > 500) {
      matches.push(...wolfpackTrainingData.filter(p => p.id === 'rout_002'));
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  static matchConfigurationIssues(
    inputs: any[], 
    outputs: any[]
  ): WolfpackTrainingPattern[] {
    const matches: WolfpackTrainingPattern[] = [];
    
    // Check for duplicate labels
    const inputLabels = inputs.map(i => i.label).filter(l => l && !l.match(/^Input \d+$/));
    const outputLabels = outputs.map(o => o.label).filter(l => l && !l.match(/^Output \d+$/));
    const hasDuplicates = new Set(inputLabels).size !== inputLabels.length || 
                         new Set(outputLabels).size !== outputLabels.length;
    
    if (hasDuplicates) {
      matches.push(...wolfpackTrainingData.filter(p => p.id === 'conf_001'));
    }
    
    // Check utilization
    const activeInputs = inputs.filter(i => i.status === 'active').length;
    const activeOutputs = outputs.filter(o => o.status === 'active').length;
    const inputUtilization = (activeInputs / inputs.length) * 100;
    const outputUtilization = (activeOutputs / outputs.length) * 100;
    
    if (inputUtilization < 30 || outputUtilization < 25) {
      matches.push(...wolfpackTrainingData.filter(p => p.id === 'conf_002'));
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  static matchLayoutIssues(outputs: any[]): WolfpackTrainingPattern[] {
    const layoutMapped = outputs.filter(o => 
      o.status === 'active' && 
      o.label && 
      (o.label.includes('Main Bar') || 
       o.label.includes('Side Area') || 
       o.label.includes('Lower Section'))
    ).length;
    
    const activeOutputs = outputs.filter(o => o.status === 'active').length;
    
    if (layoutMapped === 0 && activeOutputs > 0) {
      return wolfpackTrainingData.filter(p => p.id === 'layout_001');
    }
    
    return [];
  }

  static matchAudioIssues(outputs: any[]): WolfpackTrainingPattern[] {
    const matches: WolfpackTrainingPattern[] = [];
    
    const audioOutputs = outputs.filter(o => 
      o.status === 'active' && 
      o.audioOutput && 
      o.audioOutput.trim() !== ''
    );
    
    const activeOutputs = outputs.filter(o => o.status === 'active');
    
    // No audio routing
    if (audioOutputs.length === 0 && activeOutputs.length > 0) {
      matches.push(...wolfpackTrainingData.filter(p => p.id === 'audio_002'));
    }
    
    // Check for conflicts
    const audioMap = new Map<string, number>();
    audioOutputs.forEach(output => {
      if (output.audioOutput) {
        audioMap.set(output.audioOutput, (audioMap.get(output.audioOutput) || 0) + 1);
      }
    });
    
    const hasConflicts = Array.from(audioMap.values()).some(count => count > 1);
    if (hasConflicts) {
      matches.push(...wolfpackTrainingData.filter(p => p.id === 'audio_001'));
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}

export default wolfpackTrainingData;
