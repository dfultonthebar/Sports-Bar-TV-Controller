
/**
 * Atlas Audio Processor AI Analyzer
 * Specialized AI system for monitoring Atlas audio processors and providing intelligent insights
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

import { logger } from '@sports-bar/logger'
const execAsync = promisify(exec)

export interface AtlasAIAnalysisResult {
  severity: 'optimal' | 'minor' | 'moderate' | 'critical'
  category: 'audio_quality' | 'hardware' | 'configuration' | 'network' | 'performance'
  summary: string
  audioPatterns: string[]
  hardwareRecommendations: string[]
  configurationIssues: string[]
  performanceMetrics: {
    signalQuality: number
    latencyMs: number
    processingLoad: number
    networkStability: number
  }
  audioInsights: string[]
  confidence: number
  timestamp: string
}

export interface AtlasMonitoringData {
  processorId: string
  processorModel: string
  inputLevels: { [inputId: number]: number }
  outputLevels: { [outputId: number]: number }
  networkLatency: number
  cpuLoad: number
  memoryUsage: number
  errorLogs: string[]
  configChanges: any[]
  sceneRecalls: any[]
  lastSeen: string
}

export class AtlasAIAnalyzer {
  private pythonPath = 'python3'
  private scriptsDir = path.join(process.cwd(), 'ai-analysis', 'atlas')
  private modelsDir = path.join(this.scriptsDir, 'models')
  private configDir = path.join(process.cwd(), 'data', 'atlas-configs')
  
  // Audio processing knowledge base
  private audioKnowledge = {
    signalLevels: {
      optimal: { min: -20, max: -6 }, // dBFS
      warning: { min: -35, max: -3 },
      critical: { min: -50, max: 0 }
    },
    latencyThresholds: {
      excellent: 5, // ms
      good: 10,
      acceptable: 20,
      poor: 50
    },
    processingLoad: {
      normal: 75, // percentage
      high: 85,
      critical: 95
    }
  }

  constructor() {
    this.initializeAtlasAI()
  }

  private async initializeAtlasAI() {
    try {
      await fs.mkdir(this.scriptsDir, { recursive: true })
      await fs.mkdir(this.modelsDir, { recursive: true })
      await this.createAtlasAnalysisScript()
      logger.info('Atlas AI analyzer initialized with Python standard library')
    } catch (error) {
      logger.error('Failed to initialize Atlas AI analyzer:', error)
    }
  }

  private async createAtlasAnalysisScript() {
    const scriptContent = `#!/usr/bin/env python3
"""
Atlas Audio Processor AI Analysis Script
Specialized analysis for Atlas audio processing systems
"""

import json
import sys
import re
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict, Counter

class AtlasAudioAnalyzer:
    def __init__(self):
        # Audio-specific error patterns
        self.audio_patterns = {
            'signal_clipping': r'clipping|overload|distortion|peak.*limit',
            'phantom_power': r'phantom.*power|+48v|condenser.*mic',
            'feedback': r'feedback|howl|oscillation|ringing',
            'dropout': r'dropout|silence|no.*signal|mute.*stuck',
            'dante_network': r'dante.*error|network.*audio|sync.*loss|clock.*error',
            'dsp_overload': r'dsp.*overload|processing.*limit|cpu.*high',
            'scene_recall': r'scene.*recall|preset.*load|configuration.*change',
            'eq_saturation': r'eq.*clip|filter.*overload|resonance',
            'compressor_pumping': r'compressor.*pump|dynamics.*issue|gain.*reduce',
            'input_fault': r'input.*fault|mic.*error|line.*problem'
        }
        
        # Audio performance metrics
        self.performance_thresholds = {
            'signal_level': {'optimal': [-20, -6], 'warning': [-35, -3], 'critical': [-50, 0]},
            'thd_percent': {'excellent': 0.01, 'good': 0.1, 'acceptable': 1.0, 'poor': 3.0},
            'latency_ms': {'excellent': 5, 'good': 10, 'acceptable': 20, 'poor': 50},
            'processing_load': {'normal': 75, 'high': 85, 'critical': 95}
        }
        
        # Common Atlas models and their capabilities
        self.atlas_models = {
            'AZM4': {'inputs': 4, 'outputs': 4, 'zones': 4, 'dante_channels': 8},
            'AZM8': {'inputs': 8, 'outputs': 8, 'zones': 8, 'dante_channels': 16},
            'Atmosphere': {'inputs': 12, 'outputs': 8, 'zones': 12, 'dante_channels': 32}
        }

    def analyze_atlas_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Main analysis function for Atlas audio data"""
        try:
            # Parse input data
            processor_data = data.get('processorData', {})
            logs = data.get('logs', [])
            metrics = data.get('metrics', {})
            
            analysis_result = {
                'severity': 'optimal',
                'category': 'performance',
                'summary': '',
                'audioPatterns': [],
                'hardwareRecommendations': [],
                'configurationIssues': [],
                'performanceMetrics': {
                    'signalQuality': 100,
                    'latencyMs': 0,
                    'processingLoad': 0,
                    'networkStability': 100
                },
                'audioInsights': [],
                'confidence': 85,
                'timestamp': datetime.now().isoformat()
            }
            
            # Analyze audio patterns in logs
            audio_issues = self._analyze_audio_patterns(logs)
            analysis_result['audioPatterns'] = audio_issues
            
            # Analyze signal levels
            signal_analysis = self._analyze_signal_levels(metrics.get('inputLevels', {}), metrics.get('outputLevels', {}))
            analysis_result['performanceMetrics']['signalQuality'] = signal_analysis['quality_score']
            
            # Analyze network performance
            network_analysis = self._analyze_network_performance(metrics)
            analysis_result['performanceMetrics']['networkStability'] = network_analysis['stability_score']
            analysis_result['performanceMetrics']['latencyMs'] = network_analysis['latency']
            
            # Analyze DSP load
            dsp_analysis = self._analyze_dsp_performance(metrics)
            analysis_result['performanceMetrics']['processingLoad'] = dsp_analysis['load_percentage']
            
            # Generate recommendations
            recommendations = self._generate_atlas_recommendations(analysis_result)
            analysis_result['hardwareRecommendations'] = recommendations['hardware']
            analysis_result['configurationIssues'] = recommendations['configuration']
            analysis_result['audioInsights'] = recommendations['insights']
            
            # Determine overall severity
            analysis_result['severity'] = self._calculate_severity(analysis_result)
            
            # Generate summary
            analysis_result['summary'] = self._generate_summary(analysis_result)
            
            return analysis_result
            
        except Exception as e:
            return {
                'error': f'Atlas analysis failed: {str(e)}',
                'severity': 'critical',
                'confidence': 0,
                'timestamp': datetime.now().isoformat()
            }

    def _analyze_audio_patterns(self, logs: List[Dict]) -> List[str]:
        """Analyze logs for audio-specific patterns"""
        patterns_found = []
        
        for log_entry in logs:
            message = log_entry.get('message', '').lower()
            
            for pattern_name, pattern_regex in self.audio_patterns.items():
                if re.search(pattern_regex, message, re.IGNORECASE):
                    patterns_found.append(f"{pattern_name}: {pattern_regex}")
        
        return list(set(patterns_found))  # Remove duplicates

    def _analyze_signal_levels(self, input_levels: Dict, output_levels: Dict) -> Dict[str, Any]:
        """Analyze audio signal levels for optimal performance"""
        analysis = {
            'quality_score': 100,
            'issues': [],
            'recommendations': []
        }
        
        # Check input levels
        for input_id, level_db in input_levels.items():
            if level_db > -3:  # Too hot
                analysis['issues'].append(f"Input {input_id}: Signal too hot ({level_db:.1f} dBFS)")
                analysis['quality_score'] -= 15
            elif level_db < -35:  # Too low
                analysis['issues'].append(f"Input {input_id}: Signal too low ({level_db:.1f} dBFS)")
                analysis['quality_score'] -= 10
        
        # Check output levels
        for output_id, level_db in output_levels.items():
            if level_db > -6:  # Potential clipping
                analysis['issues'].append(f"Output {output_id}: Risk of clipping ({level_db:.1f} dBFS)")
                analysis['quality_score'] -= 20
        
        return analysis

    def _analyze_network_performance(self, metrics: Dict) -> Dict[str, Any]:
        """Analyze Dante network performance"""
        analysis = {
            'stability_score': 100,
            'latency': metrics.get('networkLatency', 0),
            'issues': []
        }
        
        latency = metrics.get('networkLatency', 0)
        if latency > 50:
            analysis['stability_score'] = 50
            analysis['issues'].append("High network latency detected")
        elif latency > 20:
            analysis['stability_score'] = 75
            analysis['issues'].append("Moderate network latency")
        
        return analysis

    def _analyze_dsp_performance(self, metrics: Dict) -> Dict[str, Any]:
        """Analyze DSP processing load"""
        load = metrics.get('cpuLoad', 0)
        
        return {
            'load_percentage': load,
            'status': 'critical' if load > 95 else 'high' if load > 85 else 'normal'
        }

    def _generate_atlas_recommendations(self, analysis: Dict) -> Dict[str, List[str]]:
        """Generate Atlas-specific recommendations"""
        recommendations = {
            'hardware': [],
            'configuration': [],
            'insights': []
        }
        
        # Signal quality recommendations
        if analysis['performanceMetrics']['signalQuality'] < 80:
            recommendations['configuration'].append("Review input gain structure - some signals may be too hot or too low")
            recommendations['insights'].append("Proper gain staging is critical for audio quality")
        
        # Network recommendations
        if analysis['performanceMetrics']['networkStability'] < 90:
            recommendations['hardware'].append("Check Dante network configuration and switch settings")
            recommendations['insights'].append("Dante audio requires dedicated gigabit network infrastructure")
        
        # Processing load recommendations  
        if analysis['performanceMetrics']['processingLoad'] > 85:
            recommendations['configuration'].append("Consider reducing DSP processing load or upgrading processor")
            recommendations['insights'].append("High DSP load can cause audio dropouts and latency")
        
        return recommendations

    def _calculate_severity(self, analysis: Dict) -> str:
        """Calculate overall severity based on all metrics"""
        metrics = analysis['performanceMetrics']
        
        if (metrics['signalQuality'] < 60 or 
            metrics['processingLoad'] > 95 or 
            metrics['networkStability'] < 50):
            return 'critical'
        elif (metrics['signalQuality'] < 80 or 
              metrics['processingLoad'] > 85 or 
              metrics['networkStability'] < 80):
            return 'moderate'
        elif (metrics['signalQuality'] < 95 or 
              metrics['processingLoad'] > 75 or 
              metrics['networkStability'] < 95):
            return 'minor'
        else:
            return 'optimal'

    def _generate_summary(self, analysis: Dict) -> str:
        """Generate human-readable summary"""
        severity = analysis['severity']
        metrics = analysis['performanceMetrics']
        
        if severity == 'optimal':
            return f"Atlas system operating optimally. Signal quality: {metrics['signalQuality']:.0f}%, Processing load: {metrics['processingLoad']:.0f}%"
        elif severity == 'minor':
            return f"Atlas system stable with minor issues. Monitor signal levels and processing load."
        elif severity == 'moderate':
            return f"Atlas system requires attention. Signal quality: {metrics['signalQuality']:.0f}%, Processing: {metrics['processingLoad']:.0f}%"
        else:
            return f"CRITICAL: Atlas system issues detected. Immediate attention required."

def main():
    """Main entry point for the analysis script"""
    try:
        # Read JSON data from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Initialize analyzer
        analyzer = AtlasAudioAnalyzer()
        
        # Perform analysis
        result = analyzer.analyze_atlas_data(input_data)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'error': f'Script execution failed: {str(e)}',
            'severity': 'critical',
            'confidence': 0,
            'timestamp': datetime.now().isoformat()
        }
        print(json.dumps(error_result, indent=2))

if __name__ == '__main__':
    main()
`

    await fs.writeFile(path.join(this.scriptsDir, 'atlas_analyzer.py'), scriptContent)
    
    // Make script executable
    try {
      await execAsync(`chmod +x "${path.join(this.scriptsDir, 'atlas_analyzer.py')}"`)
    } catch (error) {
      logger.warn('Could not make script executable:', error)
    }
  }

  /**
   * Analyze Atlas processor data using specialized AI
   */
  async analyzeAtlasData(data: AtlasMonitoringData): Promise<AtlasAIAnalysisResult> {
    try {
      const scriptPath = path.join(this.scriptsDir, 'atlas_analyzer.py')
      
      // Prepare data for analysis
      const analysisInput = {
        processorData: {
          id: data.processorId,
          model: data.processorModel
        },
        metrics: {
          inputLevels: data.inputLevels,
          outputLevels: data.outputLevels,
          networkLatency: data.networkLatency,
          cpuLoad: data.cpuLoad,
          memoryUsage: data.memoryUsage
        },
        logs: data.errorLogs.map(log => ({ message: log, timestamp: new Date().toISOString() })),
        configChanges: data.configChanges,
        sceneRecalls: data.sceneRecalls
      }

      // Execute Python analysis script
      const { stdout, stderr } = await execAsync(
        `echo '${JSON.stringify(analysisInput)}' | "${this.pythonPath}" "${scriptPath}"`,
        { timeout: 30000 }
      )

      if (stderr) {
        logger.warn('Atlas AI analysis warnings:', { data: stderr })
      }

      const result = JSON.parse(stdout)
      
      // Enhance result with Atlas-specific context
      return this.enhanceAnalysisResult(result, data)
      
    } catch (error) {
      logger.error('Atlas AI analysis failed:', error)
      return {
        severity: 'critical',
        category: 'hardware',
        summary: 'Atlas AI analysis failed - system may need attention',
        audioPatterns: [] as any[],
        hardwareRecommendations: ['Verify Atlas processor connectivity'],
        configurationIssues: ['Unable to analyze current configuration'],
        performanceMetrics: {
          signalQuality: 0,
          latencyMs: 999,
          processingLoad: 100,
          networkStability: 0
        },
        audioInsights: ['AI analysis temporarily unavailable'],
        confidence: 0,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Enhance analysis result with additional Atlas context
   */
  private enhanceAnalysisResult(result: any, data: AtlasMonitoringData): AtlasAIAnalysisResult {
    // Add model-specific recommendations
    const modelInfo = this.getModelCapabilities(data.processorModel)
    if (modelInfo) {
      result.audioInsights.unshift(`Atlas ${data.processorModel}: ${modelInfo.inputs} inputs, ${modelInfo.outputs} outputs, ${modelInfo.dante_channels} Dante channels`)
    }

    // Add time-based context
    const lastSeenDate = new Date(data.lastSeen)
    const minutesSinceLastSeen = Math.floor((Date.now() - lastSeenDate.getTime()) / (1000 * 60))
    
    if (minutesSinceLastSeen > 5) {
      result.hardwareRecommendations.push(`Processor last seen ${minutesSinceLastSeen} minutes ago - check network connectivity`)
      result.severity = 'critical'
    }

    return result as AtlasAIAnalysisResult
  }

  /**
   * Get model-specific capabilities and recommendations
   */
  private getModelCapabilities(model: string) {
    const modelMap: { [key: string]: any } = {
      'AZM4': { inputs: 4, outputs: 4, zones: 4, dante_channels: 8 },
      'AZM8': { inputs: 8, outputs: 8, zones: 8, dante_channels: 16 },
      'Atmosphere': { inputs: 12, outputs: 8, zones: 12, dante_channels: 32 }
    }
    
    return modelMap[model] || null
  }

  /**
   * Monitor Atlas processor in real-time
   */
  async startAtlasMonitoring(processorId: string, intervalMs: number = 30000): Promise<void> {
    logger.info(`Starting Atlas monitoring for processor ${processorId}`)
    
    setInterval(async () => {
      try {
        // This would typically fetch real-time data from the Atlas processor
        // For now, we'll create a monitoring framework
        const monitoringData = await this.collectAtlasData(processorId)
        const analysis = await this.analyzeAtlasData(monitoringData)
        
        // Log results for further analysis
        await this.logAtlasAnalysis(processorId, analysis)
        
        // Trigger alerts if needed
        if (analysis.severity === 'critical') {
          await this.triggerAtlasAlert(processorId, analysis)
        }
        
      } catch (error) {
        logger.error(`Atlas monitoring error for processor ${processorId}:`, error)
      }
    }, intervalMs)
  }

  /**
   * Collect real-time data from Atlas processor
   * 
   * This method interfaces with actual Atlas hardware via TCP to collect:
   * - Input/output signal levels (using SourceMeter_X and ZoneMeter_X parameters)
   * - Processor status and configuration
   * - Network latency and connection health
   * 
   * Note: Mock data removed as part of connection fix.
   * Real-time meter data would require UDP subscription as per Atlas protocol.
   * For now, returning minimal structure until meter service is implemented.
   */
  private async collectAtlasData(processorId: string): Promise<AtlasMonitoringData> {
    try {
      // TODO: Implement real-time meter data collection via UDP (port 5321)
      // Atlas protocol supports meter subscriptions via UDP for efficient real-time updates
      // Reference: ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf Section 2.0
      
      // For now, return basic structure - meter collection to be implemented
      // when UDP meter service is set up
      return {
        processorId,
        processorModel: 'Unknown',  // Will be populated from database
        inputLevels: {},  // Will be populated by UDP meter subscription
        outputLevels: {},  // Will be populated by UDP meter subscription
        networkLatency: 0,  // Will be calculated from TCP round-trip time
        cpuLoad: 0,  // Not available via standard Atlas protocol
        memoryUsage: 0,  // Not available via standard Atlas protocol
        errorLogs: [],
        configChanges: [],
        sceneRecalls: [],
        lastSeen: new Date().toISOString()
      }
    } catch (error) {
      logger.error('Error collecting Atlas data:', error)
      throw error
    }
  }

  /**
   * Log Atlas analysis results
   */
  private async logAtlasAnalysis(processorId: string, analysis: AtlasAIAnalysisResult): Promise<void> {
    try {
      const logDir = path.join(process.cwd(), 'logs', 'atlas')
      await fs.mkdir(logDir, { recursive: true })
      
      const logFile = path.join(logDir, `atlas-ai-${new Date().toISOString().split('T')[0]}.json`)
      const logEntry = {
        processorId,
        timestamp: new Date().toISOString(),
        analysis
      }
      
      // Append to daily log file
      const existingLogs = await this.readLogFile(logFile)
      existingLogs.push(logEntry)
      
      await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2))
      
    } catch (error) {
      logger.error('Failed to log Atlas analysis:', error)
    }
  }

  /**
   * Read existing log file
   */
  private async readLogFile(filePath: string): Promise<any[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return []
    }
  }

  /**
   * Trigger Atlas alert for critical issues
   */
  private async triggerAtlasAlert(processorId: string, analysis: AtlasAIAnalysisResult): Promise<void> {
    logger.error(`ATLAS CRITICAL ALERT - Processor ${processorId}:`, { data: analysis.summary })
    
    // Here you could integrate with notification systems:
    // - Send email alerts
    // - SMS notifications  
    // - Slack/Teams integration
    // - Dashboard alerts
  }
}

// Export singleton instance
export const atlasAIAnalyzer = new AtlasAIAnalyzer()
