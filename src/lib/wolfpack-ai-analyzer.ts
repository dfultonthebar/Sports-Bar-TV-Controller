
// Wolfpack Matrix AI Analyzer - Advanced AI system for matrix switcher monitoring and optimization

export interface WolfpackMatrixData {
  config?: {
    name: string;
    ipAddress: string;
    port: number;
    tcpPort: number;
    udpPort: number;
    protocol: string;
    connectionStatus?: string;
    lastTested?: string;
    isActive: boolean;
  };
  inputs?: Array<{
    channelNumber: number;
    label: string;
    inputType: string;
    deviceType: string;
    status: 'active' | 'unused' | 'no' | 'na';
    isActive?: boolean;
  }>;
  outputs?: Array<{
    channelNumber: number;
    label: string;
    resolution: string;
    status: 'active' | 'unused' | 'no' | 'na';
    audioOutput?: string;
    isActive?: boolean;
  }>;
  routing?: Array<{
    input: number;
    output: number;
    timestamp: string;
    command?: string;
    success?: boolean;
  }>;
  systemHealth?: {
    connectionStable: boolean;
    commandLatency: number;
    errorRate: number;
    lastError?: string;
  };
}

export interface WolfpackAIInsight {
  type: 'info' | 'warning' | 'error' | 'optimization' | 'success';
  category: 'connection' | 'routing' | 'configuration' | 'performance' | 'layout' | 'audio';
  title: string;
  message: string;
  recommendation?: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  affectedChannels?: number[];
  timestamp: string;
}

export class WolfpackMatrixAIAnalyzer {
  private knowledgeBase: WolfpackKnowledgeBase;
  
  constructor() {
    this.knowledgeBase = new WolfpackKnowledgeBase();
  }

  async analyzeMatrixSystem(data: WolfpackMatrixData): Promise<WolfpackAIInsight[]> {
    const insights: WolfpackAIInsight[] = [];
    
    try {
      // Connection & Network Analysis
      insights.push(...this.analyzeConnection(data));
      
      // Configuration Analysis
      insights.push(...this.analyzeConfiguration(data));
      
      // Routing Analysis
      insights.push(...this.analyzeRouting(data));
      
      // Layout & Mapping Analysis
      insights.push(...this.analyzeLayoutMapping(data));
      
      // Audio Routing Analysis
      insights.push(...this.analyzeAudioRouting(data));
      
      // Performance Analysis
      insights.push(...this.analyzePerformance(data));
      
      // System Health Check
      insights.push(...this.analyzeSystemHealth(data));
      
      // Channel Utilization Analysis
      insights.push(...this.analyzeChannelUtilization(data));

      // Sort by priority and confidence
      return insights
        .sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.confidence - a.confidence;
        })
        .slice(0, 20); // Limit to top 20 insights
        
    } catch (error) {
      console.error('Wolfpack AI Analysis Error:', error);
      return [{
        type: 'error',
        category: 'performance',
        title: 'AI Analysis Error',
        message: `Matrix AI analysis encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 95,
        priority: 'medium',
        timestamp: new Date().toISOString()
      }];
    }
  }

  private analyzeConnection(data: WolfpackMatrixData): WolfpackAIInsight[] {
    const insights: WolfpackAIInsight[] = [];
    
    if (!data.config?.ipAddress) {
      insights.push({
        type: 'warning',
        category: 'connection',
        title: 'No IP Address Configured',
        message: 'Matrix switcher IP address is not configured. Connection testing and control will not work.',
        recommendation: 'Enter the IP address of your Wolfpack matrix switcher in the connection settings.',
        confidence: 100,
        priority: 'high',
        timestamp: new Date().toISOString()
      });
      return insights;
    }

    // Connection Status Analysis
    if (data.config.connectionStatus === 'error') {
      insights.push({
        type: 'error',
        category: 'connection',
        title: 'Connection Failed',
        message: `Cannot connect to Wolfpack matrix at ${data.config.ipAddress}:${data.config.port}`,
        recommendation: 'Verify IP address, check network connectivity, ensure matrix power is on, and confirm firewall settings.',
        confidence: 95,
        priority: 'critical',
        timestamp: new Date().toISOString()
      });
    } else if (data.config.connectionStatus === 'connected') {
      insights.push({
        type: 'success',
        category: 'connection',
        title: 'Connection Established',
        message: `Successfully connected to Wolfpack matrix at ${data.config.ipAddress}`,
        confidence: 100,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    // Protocol Analysis
    if (data.config.protocol) {
      const protocolAdvice = this.knowledgeBase.getProtocolRecommendation(data.config.protocol);
      if (protocolAdvice) {
        insights.push({
          type: 'info',
          category: 'connection',
          title: `${data.config.protocol} Protocol Selected`,
          message: protocolAdvice.description,
          recommendation: protocolAdvice.recommendation,
          confidence: 85,
          priority: 'medium',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Port Configuration Analysis
    if (data.config.protocol === 'TCP' && data.config.port !== 5000) {
      insights.push({
        type: 'warning',
        category: 'connection',
        title: 'Non-Standard TCP Port',
        message: `TCP port ${data.config.port} configured, but Wolfpack standard is 5000`,
        recommendation: 'Consider using port 5000 for TCP control unless your specific setup requires a different port.',
        confidence: 80,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    if (data.config.protocol === 'UDP' && data.config.port !== 4000) {
      insights.push({
        type: 'warning',
        category: 'connection',
        title: 'Non-Standard UDP Port',
        message: `UDP port ${data.config.port} configured, but Wolfpack standard is 4000`,
        recommendation: 'Consider using port 4000 for UDP control unless your specific setup requires a different port.',
        confidence: 80,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    return insights;
  }

  private analyzeConfiguration(data: WolfpackMatrixData): WolfpackAIInsight[] {
    const insights: WolfpackAIInsight[] = [];
    
    if (!data.inputs || !data.outputs) return insights;

    // Input Configuration Analysis
    const activeInputs = data.inputs.filter(i => i.status === 'active');
    const duplicateLabels = this.findDuplicateLabels(data.inputs.map(i => i.label));
    
    if (duplicateLabels.length > 0) {
      insights.push({
        type: 'warning',
        category: 'configuration',
        title: 'Duplicate Input Labels',
        message: `Found duplicate labels: ${duplicateLabels.join(', ')}`,
        recommendation: 'Use unique labels for each input to avoid confusion during routing operations.',
        confidence: 100,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    // Output Configuration Analysis
    const activeOutputs = data.outputs.filter(o => o.status === 'active');
    const outputDuplicates = this.findDuplicateLabels(data.outputs.map(o => o.label));
    
    if (outputDuplicates.length > 0) {
      insights.push({
        type: 'warning',
        category: 'configuration',
        title: 'Duplicate Output Labels',
        message: `Found duplicate labels: ${outputDuplicates.join(', ')}`,
        recommendation: 'Use unique labels for each output to identify TVs clearly during operations.',
        confidence: 100,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    // Channel Utilization
    const totalInputs = data.inputs.length;
    const totalOutputs = data.outputs.length;
    const inputUtilization = (activeInputs.length / totalInputs) * 100;
    const outputUtilization = (activeOutputs.length / totalOutputs) * 100;

    if (inputUtilization < 25) {
      insights.push({
        type: 'info',
        category: 'configuration',
        title: 'Low Input Utilization',
        message: `Only ${inputUtilization.toFixed(1)}% of inputs are active (${activeInputs.length}/${totalInputs})`,
        recommendation: 'Consider marking unused inputs as "unused" to optimize system performance and clarity.',
        confidence: 90,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    if (outputUtilization < 30) {
      insights.push({
        type: 'info',
        category: 'configuration',
        title: 'Low Output Utilization',
        message: `Only ${outputUtilization.toFixed(1)}% of outputs are active (${activeOutputs.length}/${totalOutputs})`,
        recommendation: 'Mark unused outputs as "unused" to focus control operations on active TV displays.',
        confidence: 90,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    return insights;
  }

  private analyzeRouting(data: WolfpackMatrixData): WolfpackAIInsight[] {
    const insights: WolfpackAIInsight[] = [];
    
    if (!data.routing || data.routing.length === 0) {
      insights.push({
        type: 'info',
        category: 'routing',
        title: 'No Recent Routing Activity',
        message: 'No recent matrix switching operations detected',
        recommendation: 'Test matrix functionality by performing a few routing operations to ensure proper functionality.',
        confidence: 75,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
      return insights;
    }

    // Command Success Rate Analysis
    const totalCommands = data.routing.length;
    const successfulCommands = data.routing.filter(r => r.success === true).length;
    const successRate = (successfulCommands / totalCommands) * 100;

    if (successRate < 95) {
      insights.push({
        type: 'warning',
        category: 'routing',
        title: 'Low Command Success Rate',
        message: `Matrix command success rate is ${successRate.toFixed(1)}% (${successfulCommands}/${totalCommands})`,
        recommendation: 'Check network stability, verify matrix connectivity, and ensure proper command formatting.',
        confidence: 95,
        priority: 'high',
        timestamp: new Date().toISOString()
      });
    } else if (successRate === 100) {
      insights.push({
        type: 'success',
        category: 'routing',
        title: 'Perfect Command Success',
        message: `All ${totalCommands} recent matrix commands executed successfully`,
        confidence: 100,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    // Recent Activity Analysis
    const recentCommands = data.routing
      .filter(r => new Date(r.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .length;

    if (recentCommands > 100) {
      insights.push({
        type: 'info',
        category: 'routing',
        title: 'High Activity Volume',
        message: `${recentCommands} routing operations in the last 24 hours`,
        recommendation: 'Consider setting up automated routing scenarios to reduce manual switching operations.',
        confidence: 85,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    return insights;
  }

  private analyzeLayoutMapping(data: WolfpackMatrixData): WolfpackAIInsight[] {
    const insights: WolfpackAIInsight[] = [];
    
    if (!data.outputs) return insights;

    const layoutMappedOutputs = data.outputs.filter(o => 
      o.status === 'active' && 
      o.label && 
      !o.label.match(/^Output \d+$/) && 
      (o.label.includes('Main Bar') || 
       o.label.includes('Side Area') || 
       o.label.includes('Lower Section') ||
       o.label.includes('TV'))
    );

    const customLabelOutputs = data.outputs.filter(o => 
      o.status === 'active' && 
      o.label && 
      !o.label.match(/^Output \d+$/)
    );

    const activeOutputs = data.outputs.filter(o => o.status === 'active');

    if (layoutMappedOutputs.length === 0 && activeOutputs.length > 0) {
      insights.push({
        type: 'warning',
        category: 'layout',
        title: 'No Layout Mapping',
        message: 'Active outputs are not mapped to physical TV locations',
        recommendation: 'Use descriptive labels like "Main Bar Left", "Side Area 1" to map outputs to actual TV positions.',
        confidence: 90,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    if (customLabelOutputs.length > layoutMappedOutputs.length) {
      const unmappedCount = customLabelOutputs.length - layoutMappedOutputs.length;
      insights.push({
        type: 'info',
        category: 'layout',
        title: 'Partial Layout Mapping',
        message: `${layoutMappedOutputs.length} outputs mapped to layout, ${unmappedCount} have custom labels but no location mapping`,
        recommendation: 'Complete layout mapping by importing TV positions or using location-based labels.',
        confidence: 85,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    if (layoutMappedOutputs.length > 0) {
      insights.push({
        type: 'success',
        category: 'layout',
        title: 'Layout Integration Active',
        message: `${layoutMappedOutputs.length} outputs successfully mapped to bar layout positions`,
        confidence: 95,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    return insights;
  }

  private analyzeAudioRouting(data: WolfpackMatrixData): WolfpackAIInsight[] {
    const insights: WolfpackAIInsight[] = [];
    
    if (!data.outputs) return insights;

    const audioOutputs = data.outputs.filter(o => 
      o.status === 'active' && 
      o.audioOutput && 
      o.audioOutput.trim() !== ''
    );

    const activeOutputs = data.outputs.filter(o => o.status === 'active');

    if (audioOutputs.length === 0 && activeOutputs.length > 0) {
      insights.push({
        type: 'info',
        category: 'audio',
        title: 'No Audio Routing Configured',
        message: 'None of your active outputs have audio routing to the Atlas system configured',
        recommendation: 'Configure audio routing for outputs that need sound by selecting "Matrix Audio 1-4" options.',
        confidence: 85,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    } else if (audioOutputs.length > 0) {
      // Check for audio routing conflicts
      const audioRoutingMap = new Map<string, number[]>();
      audioOutputs.forEach(output => {
        if (output.audioOutput) {
          if (!audioRoutingMap.has(output.audioOutput)) {
            audioRoutingMap.set(output.audioOutput, []);
          }
          audioRoutingMap.get(output.audioOutput)!.push(output.channelNumber);
        }
      });

      audioRoutingMap.forEach((outputs, audioChannel) => {
        if (outputs.length > 1) {
          insights.push({
            type: 'warning',
            category: 'audio',
            title: 'Multiple Outputs to Same Audio Channel',
            message: `${audioChannel} is receiving audio from outputs: ${outputs.join(', ')}`,
            recommendation: 'Consider using different audio channels for each output to avoid audio conflicts.',
            confidence: 90,
            priority: 'medium',
            affectedChannels: outputs,
            timestamp: new Date().toISOString()
          });
        }
      });

      insights.push({
        type: 'success',
        category: 'audio',
        title: 'Audio Routing Configured',
        message: `${audioOutputs.length} outputs configured with audio routing to Atlas system`,
        confidence: 95,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    return insights;
  }

  private analyzePerformance(data: WolfpackMatrixData): WolfpackAIInsight[] {
    const insights: WolfpackAIInsight[] = [];
    
    if (!data.systemHealth) return insights;

    const { connectionStable, commandLatency, errorRate, lastError } = data.systemHealth;

    if (!connectionStable) {
      insights.push({
        type: 'error',
        category: 'performance',
        title: 'Unstable Connection',
        message: 'Matrix connection is experiencing stability issues',
        recommendation: 'Check network stability, switch to wired connection if using WiFi, or restart the matrix switcher.',
        confidence: 95,
        priority: 'critical',
        timestamp: new Date().toISOString()
      });
    }

    if (commandLatency > 1000) {
      insights.push({
        type: 'warning',
        category: 'performance',
        title: 'High Command Latency',
        message: `Matrix command response time is ${commandLatency}ms`,
        recommendation: 'Check network congestion, consider using TCP instead of UDP, or verify matrix processing capacity.',
        confidence: 90,
        priority: 'high',
        timestamp: new Date().toISOString()
      });
    } else if (commandLatency < 100) {
      insights.push({
        type: 'success',
        category: 'performance',
        title: 'Excellent Response Time',
        message: `Matrix responding in ${commandLatency}ms - optimal performance`,
        confidence: 95,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    if (errorRate > 5) {
      insights.push({
        type: 'warning',
        category: 'performance',
        title: 'Elevated Error Rate',
        message: `Matrix error rate is ${errorRate.toFixed(1)}%`,
        recommendation: 'Monitor for network issues, verify command formatting, and check matrix firmware version.',
        confidence: 90,
        priority: 'high',
        timestamp: new Date().toISOString()
      });
    }

    if (lastError) {
      insights.push({
        type: 'info',
        category: 'performance',
        title: 'Recent Error Detected',
        message: `Last error: ${lastError}`,
        recommendation: 'Review error pattern and consider implementing retry logic for failed commands.',
        confidence: 85,
        priority: 'medium',
        timestamp: new Date().toISOString()
      });
    }

    return insights;
  }

  private analyzeSystemHealth(data: WolfpackMatrixData): WolfpackAIInsight[] {
    const insights: WolfpackAIInsight[] = [];
    
    if (!data.config) return insights;

    // Check if configuration is complete
    const configComplete = !!(
      data.config.name &&
      data.config.ipAddress &&
      data.config.port &&
      data.config.protocol
    );

    if (!configComplete) {
      insights.push({
        type: 'warning',
        category: 'configuration',
        title: 'Incomplete Configuration',
        message: 'Matrix configuration is missing required settings',
        recommendation: 'Complete all configuration fields: name, IP address, port, and protocol selection.',
        confidence: 100,
        priority: 'high',
        timestamp: new Date().toISOString()
      });
    }

    // Last tested analysis
    if (data.config.lastTested) {
      const lastTestedDate = new Date(data.config.lastTested);
      const daysSinceTest = (Date.now() - lastTestedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceTest > 7) {
        insights.push({
          type: 'info',
          category: 'configuration',
          title: 'Connection Test Overdue',
          message: `Matrix connection last tested ${Math.floor(daysSinceTest)} days ago`,
          recommendation: 'Run a connection test to verify current matrix status and functionality.',
          confidence: 80,
          priority: 'low',
          timestamp: new Date().toISOString()
        });
      }
    }

    return insights;
  }

  private analyzeChannelUtilization(data: WolfpackMatrixData): WolfpackAIInsight[] {
    const insights: WolfpackAIInsight[] = [];
    
    if (!data.inputs || !data.outputs) return insights;

    // Input device type analysis
    const deviceTypeCounts = data.inputs
      .filter(i => i.status === 'active')
      .reduce((acc, input) => {
        acc[input.deviceType] = (acc[input.deviceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const totalActiveInputs = data.inputs.filter(i => i.status === 'active').length;

    // Check for good device diversity
    if (Object.keys(deviceTypeCounts).length >= 3 && totalActiveInputs >= 5) {
      insights.push({
        type: 'success',
        category: 'configuration',
        title: 'Good Input Diversity',
        message: `${Object.keys(deviceTypeCounts).length} different device types configured across ${totalActiveInputs} inputs`,
        confidence: 85,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    // Resolution analysis
    const resolutionCounts = data.outputs
      .filter(o => o.status === 'active')
      .reduce((acc, output) => {
        acc[output.resolution] = (acc[output.resolution] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const has4K = resolutionCounts['4K'] > 0;
    const totalActiveOutputs = data.outputs.filter(o => o.status === 'active').length;

    if (has4K) {
      insights.push({
        type: 'success',
        category: 'configuration',
        title: '4K Support Configured',
        message: `${resolutionCounts['4K']} outputs configured for 4K resolution`,
        recommendation: 'Ensure input sources support 4K output for optimal video quality.',
        confidence: 90,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    // Mixed resolution warning
    if (Object.keys(resolutionCounts).length > 2) {
      insights.push({
        type: 'info',
        category: 'configuration',
        title: 'Mixed Resolution Setup',
        message: `Multiple resolutions in use: ${Object.keys(resolutionCounts).join(', ')}`,
        recommendation: 'Consider standardizing on fewer resolutions for better signal management and quality consistency.',
        confidence: 75,
        priority: 'low',
        timestamp: new Date().toISOString()
      });
    }

    return insights;
  }

  private findDuplicateLabels(labels: string[]): string[] {
    const labelCounts: Record<string, number> = {};
    const duplicates: string[] = [];
    
    labels.forEach(label => {
      if (label && !label.match(/^(Input|Output) \d+$/)) {
        labelCounts[label] = (labelCounts[label] || 0) + 1;
      }
    });
    
    Object.entries(labelCounts).forEach(([label, count]) => {
      if (count > 1) {
        duplicates.push(label);
      }
    });
    
    return duplicates;
  }
}

// Wolfpack Matrix Knowledge Base
class WolfpackKnowledgeBase {
  getProtocolRecommendation(protocol: string): { description: string; recommendation: string } | null {
    switch (protocol.toUpperCase()) {
      case 'TCP':
        return {
          description: 'TCP provides reliable, ordered delivery with error checking',
          recommendation: 'Best for critical routing operations where command delivery must be guaranteed. Use port 5000.'
        };
      case 'UDP':
        return {
          description: 'UDP offers faster transmission with lower latency but no delivery guarantee',
          recommendation: 'Best for real-time applications where speed is more important than reliability. Use port 4000.'
        };
      default:
        return null;
    }
  }

  getCommandReference(): Record<string, { description: string; example: string; notes?: string }> {
    return {
      'YAll.': {
        description: 'Switch Input Y to all outputs',
        example: '1ALL. (switches input 1 to all outputs)'
      },
      'All1.': {
        description: 'Switch all channels to one-to-one mapping',
        example: 'All1. (1→1, 2→2, 3→3, etc.)'
      },
      'YXZ.': {
        description: 'Switch Input Y to Output Z',
        example: '1X2. (switches input 1 to output 2)'
      },
      'YXZ&Q&W.': {
        description: 'Switch Input Y to multiple outputs',
        example: '1X2&3&4. (switches input 1 to outputs 2, 3, and 4)'
      },
      'SaveY.': {
        description: 'Save current routing state to scene Y',
        example: 'Save2. (saves current state to scene 2)'
      },
      'RecallY.': {
        description: 'Recall saved scene Y',
        example: 'Recall2. (recalls saved scene 2)'
      },
      'BeepON./BeepOFF.': {
        description: 'Control buzzer/beep sound',
        example: 'BeepON. or BeepOFF.'
      },
      'Y?.': {
        description: 'Check routing status for input Y',
        example: '1?. (check where input 1 is routed)'
      }
    };
  }
}

export default WolfpackMatrixAIAnalyzer;
