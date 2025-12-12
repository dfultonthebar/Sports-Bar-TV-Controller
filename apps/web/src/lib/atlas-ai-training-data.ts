
/**
 * Atlas AI Training Data and Pattern Recognition
 * This module contains training data and pattern recognition algorithms specifically for Atlas audio processors
 */

export interface AtlasTrainingPattern {
  id: string
  name: string
  description: string
  symptoms: string[]
  causes: string[]
  solutions: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
}

export const atlasTrainingPatterns: AtlasTrainingPattern[] = [
  {
    id: 'signal_clipping',
    name: 'Signal Clipping',
    description: 'Audio signal exceeding maximum headroom causing distortion',
    symptoms: [
      'Input levels > -3dBFS',
      'Distortion in audio output',
      'Peak limiting activation',
      'Customer complaints about harsh sound'
    ],
    causes: [
      'Excessive input gain',
      'Hot signal from source device',
      'Improper gain staging',
      'EQ boost causing saturation'
    ],
    solutions: [
      'Reduce input gain by 6dB',
      'Check source device output level',
      'Adjust EQ to reduce boost',
      'Verify proper gain structure throughout chain'
    ],
    severity: 'high',
    confidence: 95
  },
  {
    id: 'dante_sync_loss',
    name: 'Dante Synchronization Loss',
    description: 'Network audio synchronization issues causing dropouts',
    symptoms: [
      'Audio dropouts or clicks',
      'Clock drift warnings',
      'Network latency spikes',
      'Dante status indicators showing errors'
    ],
    causes: [
      'Network switch configuration issues',
      'Inadequate network bandwidth',
      'Cable quality problems',
      'Multiple Dante domains'
    ],
    solutions: [
      'Check network switch QoS settings',
      'Verify dedicated Dante VLAN',
      'Test cable integrity',
      'Ensure single Dante domain configuration'
    ],
    severity: 'critical',
    confidence: 90
  },
  {
    id: 'thermal_protection',
    name: 'Thermal Protection Activation',
    description: 'Amplifier thermal protection limiting power output',
    symptoms: [
      'Reduced audio output power',
      'Thermal protection LED active',
      'High internal temperature readings',
      'Intermittent audio dropouts'
    ],
    causes: [
      'Blocked air vents',
      'High ambient temperature',
      'Continuous high power operation',
      'Fan malfunction'
    ],
    solutions: [
      'Clean air filters and vents',
      'Improve rack ventilation',
      'Reduce sustained power levels',
      'Check cooling fan operation'
    ],
    severity: 'high',
    confidence: 85
  },
  {
    id: 'feedback_oscillation',
    name: 'Audio Feedback',
    description: 'Microphone feedback causing oscillation and howling',
    symptoms: [
      'High-pitched squealing or howling',
      'Oscillation in frequency response',
      'Sudden volume spikes',
      'Customer discomfort'
    ],
    causes: [
      'Microphone too close to speakers',
      'Excessive microphone gain',
      'Poor microphone placement',
      'Room acoustic issues'
    ],
    solutions: [
      'Reduce microphone gain',
      'Relocate microphone or speakers',
      'Apply notch filtering at feedback frequency',
      'Use directional microphones'
    ],
    severity: 'medium',
    confidence: 88
  },
  {
    id: 'zone_imbalance',
    name: 'Zone Audio Imbalance',
    description: 'Uneven audio levels between different zones',
    symptoms: [
      '>6dB difference between zones',
      'Customer complaints about uneven volume',
      'Some zones too quiet or too loud',
      'Difficulty in overall level control'
    ],
    causes: [
      'Different speaker sensitivities',
      'Varying acoustic environments',
      'Inconsistent amplifier settings',
      'Cable loss variations'
    ],
    solutions: [
      'Calibrate zone levels using SPL meter',
      'Adjust output gains for consistency',
      'Document optimal settings for each zone',
      'Consider room acoustic treatments'
    ],
    severity: 'low',
    confidence: 75
  },
  {
    id: 'dsp_overload',
    name: 'DSP Processing Overload',
    description: 'Digital signal processor exceeding capacity',
    symptoms: [
      'DSP load > 95%',
      'Audio processing artifacts',
      'Increased latency',
      'System instability'
    ],
    causes: [
      'Too many active processing blocks',
      'Complex EQ and dynamics settings',
      'High sample rate processing',
      'Insufficient processing power for configuration'
    ],
    solutions: [
      'Reduce number of active EQ bands',
      'Simplify dynamics processing',
      'Lower internal sample rate if possible',
      'Remove unnecessary processing blocks'
    ],
    severity: 'medium',
    confidence: 92
  },
  {
    id: 'scene_recall_failure',
    name: 'Scene Recall Failure',
    description: 'Preset configurations not loading correctly',
    symptoms: [
      'Settings not changing when recalling scenes',
      'Partial parameter loading',
      'Error messages during scene recall',
      'Inconsistent behavior between recalls'
    ],
    causes: [
      'Corrupted scene data',
      'Firmware compatibility issues',
      'Hardware communication errors',
      'Memory limitations'
    ],
    solutions: [
      'Reload scene from backup',
      'Update processor firmware',
      'Clear and rebuild scene presets',
      'Check system memory usage'
    ],
    severity: 'medium',
    confidence: 80
  },
  {
    id: 'phantom_power_issue',
    name: 'Phantom Power Problems',
    description: 'Issues with +48V phantom power for condenser microphones',
    symptoms: [
      'Condenser microphones not working',
      'Low output from phantom-powered devices',
      'Phantom power LED not illuminated',
      'Intermittent microphone operation'
    ],
    causes: [
      'Phantom power circuit failure',
      'Cable wiring issues (pin 1 grounding)',
      'Overloaded phantom power supply',
      'Incompatible microphone requirements'
    ],
    solutions: [
      'Check phantom power switch activation',
      'Verify balanced cable wiring',
      'Test with different microphone',
      'Check power supply capacity vs. connected devices'
    ],
    severity: 'medium',
    confidence: 83
  }
]

export interface AtlasLearningData {
  timestamp: string
  processorId: string
  model: string
  environment: 'quiet' | 'moderate' | 'busy' | 'peak'
  metrics: {
    inputLevels: { [key: number]: number }
    outputLevels: { [key: number]: number }
    dspLoad: number
    temperature: number
    networkLatency: number
  }
  incidents: string[]
  resolutions: string[]
  effectiveness: number // 0-100 scale
}

/**
 * Atlas AI Pattern Matcher
 * Matches current conditions against known patterns to provide recommendations
 */
export class AtlasPatternMatcher {
  private patterns: AtlasTrainingPattern[]
  private learningHistory: AtlasLearningData[]

  constructor() {
    this.patterns = atlasTrainingPatterns
    this.learningHistory = []
  }

  /**
   * Analyze current Atlas state against known patterns
   */
  matchPatterns(currentState: any): AtlasTrainingPattern[] {
    const matches: AtlasTrainingPattern[] = []

    for (const pattern of this.patterns) {
      const matchScore = this.calculatePatternMatch(currentState, pattern)
      
      if (matchScore > 0.7) { // 70% confidence threshold
        matches.push({
          ...pattern,
          confidence: Math.round(matchScore * pattern.confidence)
        })
      }
    }

    // Sort by confidence level
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate how well current state matches a specific pattern
   */
  private calculatePatternMatch(state: any, pattern: AtlasTrainingPattern): number {
    let matchScore = 0
    let totalChecks = 0

    // Check for symptom indicators in the state
    for (const symptom of pattern.symptoms) {
      totalChecks++
      
      if (symptom.includes('> -3dBFS') && this.hasHighSignalLevels(state)) {
        matchScore++
      } else if (symptom.includes('Clock drift') && this.hasNetworkIssues(state)) {
        matchScore++
      } else if (symptom.includes('Thermal protection') && this.hasThermalIssues(state)) {
        matchScore++
      } else if (symptom.includes('DSP load > 95%') && this.hasHighDSPLoad(state)) {
        matchScore++
      }
      // Add more symptom matching logic as needed
    }

    return totalChecks > 0 ? matchScore / totalChecks : 0
  }

  /**
   * Helper methods for pattern matching
   */
  private hasHighSignalLevels(state: any): boolean {
    const inputLevels = state.inputLevels || {}
    return Object.values(inputLevels).some((level: any) => level > -3)
  }

  private hasNetworkIssues(state: any): boolean {
    return (state.networkLatency || 0) > 20
  }

  private hasThermalIssues(state: any): boolean {
    return (state.temperature || 0) > 75
  }

  private hasHighDSPLoad(state: any): boolean {
    return (state.cpuLoad || 0) > 95
  }

  /**
   * Learn from resolution effectiveness
   */
  recordLearningData(data: AtlasLearningData): void {
    this.learningHistory.push(data)
    this.updatePatternConfidence(data)
  }

  /**
   * Update pattern confidence based on resolution effectiveness
   */
  private updatePatternConfidence(data: AtlasLearningData): void {
    // Find patterns that match the incident
    const matchingPatterns = this.patterns.filter(pattern =>
      data.incidents.some(incident =>
        pattern.symptoms.some(symptom =>
          incident.toLowerCase().includes(symptom.toLowerCase().split(' ')[0])
        )
      )
    )

    // Adjust confidence based on resolution effectiveness
    for (const pattern of matchingPatterns) {
      if (data.effectiveness > 80) {
        pattern.confidence = Math.min(100, pattern.confidence + 1)
      } else if (data.effectiveness < 40) {
        pattern.confidence = Math.max(50, pattern.confidence - 1)
      }
    }
  }

  /**
   * Get learning insights from historical data
   */
  getLearningInsights(): any {
    if (this.learningHistory.length === 0) {
      return { message: 'No learning data available yet' }
    }

    const recentData = this.learningHistory.slice(-50) // Last 50 incidents
    
    return {
      totalIncidents: this.learningHistory.length,
      recentIncidents: recentData.length,
      averageResolutionEffectiveness: this.calculateAverageEffectiveness(recentData),
      mostCommonIssues: this.getMostCommonIssues(recentData),
      improvementTrends: this.calculateTrends(recentData)
    }
  }

  private calculateAverageEffectiveness(data: AtlasLearningData[]): number {
    if (data.length === 0) return 0
    const sum = data.reduce((acc, item) => acc + item.effectiveness, 0)
    return Math.round(sum / data.length)
  }

  private getMostCommonIssues(data: AtlasLearningData[]): string[] {
    const issueCounts: { [key: string]: number } = {}
    
    data.forEach(item => {
      item.incidents.forEach(incident => {
        issueCounts[incident] = (issueCounts[incident] || 0) + 1
      })
    })

    return Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue)
  }

  private calculateTrends(data: AtlasLearningData[]): string {
    if (data.length < 2) return 'insufficient_data'
    
    const recent = data.slice(-10)
    const older = data.slice(-20, -10)
    
    const recentAvg = this.calculateAverageEffectiveness(recent)
    const olderAvg = this.calculateAverageEffectiveness(older)
    
    if (recentAvg > olderAvg + 5) return 'improving'
    if (recentAvg < olderAvg - 5) return 'declining'
    return 'stable'
  }
}

// Export singleton instance
export const atlasPatternMatcher = new AtlasPatternMatcher()
