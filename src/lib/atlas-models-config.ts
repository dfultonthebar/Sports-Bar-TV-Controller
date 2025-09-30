
/**
 * AtlasIED Atmosphere Physical Input/Output Configuration
 * Based on official product specifications and rear panel analysis
 */

export interface AtlasInput {
  id: string
  number: number
  name: string
  type: 'balanced' | 'unbalanced' | 'dante' | 'matrix_audio'
  connector: 'XLR' | 'Phoenix' | 'RCA' | 'RJ45' | 'Internal'
  description: string
  priority?: 'high' | 'normal'
}

export interface AtlasOutput {
  id: string
  number: number
  name: string
  type: 'amplified' | 'line_level' | 'dante'
  connector: 'Phoenix' | 'RJ45' | 'Binding Post'
  powerRating?: string
  description: string
}

export interface AtlasModelSpec {
  model: string
  fullName: string
  zones: number
  inputs: AtlasInput[]
  outputs: AtlasOutput[]
  features: string[]
  networkPorts: {
    control: number
    dante?: number
  }
  powerRating?: string
  rearPanelImage: string
}

/**
 * Complete AtlasIED Atmosphere Model Specifications
 */
export const ATLAS_MODELS: Record<string, AtlasModelSpec> = {
  'AZM4': {
    model: 'AZM4',
    fullName: 'Atmosphere™ 4-Zone Audio Processor',
    zones: 4,
    inputs: [
      {
        id: 'input_1',
        number: 1,
        name: 'Input 1',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input with priority control',
        priority: 'high'
      },
      {
        id: 'input_2',
        number: 2,
        name: 'Input 2',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_3',
        number: 3,
        name: 'Input 3',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_4',
        number: 4,
        name: 'Input 4',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_5',
        number: 5,
        name: 'Input 5',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (L)'
      },
      {
        id: 'input_6',
        number: 6,
        name: 'Input 6',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (R)'
      },
      {
        id: 'matrix_audio_1',
        number: 101,
        name: 'Matrix Audio 1',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 1'
      },
      {
        id: 'matrix_audio_2',
        number: 102,
        name: 'Matrix Audio 2',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 2'
      },
      {
        id: 'matrix_audio_3',
        number: 103,
        name: 'Matrix Audio 3',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 3'
      },
      {
        id: 'matrix_audio_4',
        number: 104,
        name: 'Matrix Audio 4',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 4'
      }
    ],
    outputs: [
      {
        id: 'output_1',
        number: 1,
        name: 'Zone 1 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_2',
        number: 2,
        name: 'Zone 2 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_3',
        number: 3,
        name: 'Zone 3 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_4',
        number: 4,
        name: 'Zone 4 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      }
    ],
    features: [
      '4 audio zones',
      '6 physical inputs (4 balanced + 2 RCA)',
      '4 matrix audio buses',
      'Web-based control interface',
      'RS-232 and TCP/IP control',
      'Priority input (Input 1)',
      'Per-zone EQ and mixing'
    ],
    networkPorts: {
      control: 2
    },
    rearPanelImage: '/atlas-models/azm4-rear.png'
  },
  
  'AZM8': {
    model: 'AZM8',
    fullName: 'Atmosphere™ 8-Zone Audio Processor',
    zones: 8,
    inputs: [
      {
        id: 'input_1',
        number: 1,
        name: 'Input 1',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input with priority control',
        priority: 'high'
      },
      {
        id: 'input_2',
        number: 2,
        name: 'Input 2',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_3',
        number: 3,
        name: 'Input 3',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_4',
        number: 4,
        name: 'Input 4',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_5',
        number: 5,
        name: 'Input 5',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_6',
        number: 6,
        name: 'Input 6',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_7',
        number: 7,
        name: 'Input 7',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (L)'
      },
      {
        id: 'input_8',
        number: 8,
        name: 'Input 8',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (R)'
      },
      {
        id: 'matrix_audio_1',
        number: 101,
        name: 'Matrix Audio 1',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 1'
      },
      {
        id: 'matrix_audio_2',
        number: 102,
        name: 'Matrix Audio 2',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 2'
      },
      {
        id: 'matrix_audio_3',
        number: 103,
        name: 'Matrix Audio 3',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 3'
      },
      {
        id: 'matrix_audio_4',
        number: 104,
        name: 'Matrix Audio 4',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 4'
      }
    ],
    outputs: [
      {
        id: 'output_1',
        number: 1,
        name: 'Zone 1 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_2',
        number: 2,
        name: 'Zone 2 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_3',
        number: 3,
        name: 'Zone 3 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_4',
        number: 4,
        name: 'Zone 4 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_5',
        number: 5,
        name: 'Zone 5 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_6',
        number: 6,
        name: 'Zone 6 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_7',
        number: 7,
        name: 'Zone 7 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_8',
        number: 8,
        name: 'Zone 8 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      }
    ],
    features: [
      '8 audio zones',
      '8 physical inputs (6 balanced + 2 RCA)',
      '4 matrix audio buses',
      'Web-based control interface',
      'RS-232 and TCP/IP control',
      'Priority input (Input 1)',
      'Per-zone EQ and mixing'
    ],
    networkPorts: {
      control: 2
    },
    rearPanelImage: '/atlas-models/azm8-rear.png'
  },

  'AZMP4': {
    model: 'AZMP4',
    fullName: 'Atmosphere™ 4-Zone Signal Processor with 600-Watt Amplifier',
    zones: 4,
    inputs: [
      {
        id: 'input_1',
        number: 1,
        name: 'Input 1',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input with priority control',
        priority: 'high'
      },
      {
        id: 'input_2',
        number: 2,
        name: 'Input 2',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_3',
        number: 3,
        name: 'Input 3',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_4',
        number: 4,
        name: 'Input 4',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_5',
        number: 5,
        name: 'Input 5',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (L)'
      },
      {
        id: 'input_6',
        number: 6,
        name: 'Input 6',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (R)'
      },
      {
        id: 'matrix_audio_1',
        number: 101,
        name: 'Matrix Audio 1',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 1'
      },
      {
        id: 'matrix_audio_2',
        number: 102,
        name: 'Matrix Audio 2',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 2'
      },
      {
        id: 'matrix_audio_3',
        number: 103,
        name: 'Matrix Audio 3',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 3'
      },
      {
        id: 'matrix_audio_4',
        number: 104,
        name: 'Matrix Audio 4',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 4'
      }
    ],
    outputs: [
      {
        id: 'output_1_amp',
        number: 1,
        name: 'Zone 1 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_1_line',
        number: 11,
        name: 'Zone 1 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_2_amp',
        number: 2,
        name: 'Zone 2 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_2_line',
        number: 12,
        name: 'Zone 2 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_3_amp',
        number: 3,
        name: 'Zone 3 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_3_line',
        number: 13,
        name: 'Zone 3 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_4_amp',
        number: 4,
        name: 'Zone 4 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_4_line',
        number: 14,
        name: 'Zone 4 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      }
    ],
    features: [
      '4 audio zones',
      '6 physical inputs (4 balanced + 2 RCA)',
      '4 matrix audio buses',
      '600W total amplification (150W per zone)',
      'Dual outputs per zone (amplified + line-level)',
      'Web-based control interface',
      'RS-232 and TCP/IP control',
      'Priority input (Input 1)'
    ],
    networkPorts: {
      control: 2
    },
    powerRating: '600W (150W per zone @ 70V/100V)',
    rearPanelImage: '/atlas-models/azmp4-rear.png'
  },

  'AZMP8': {
    model: 'AZMP8',
    fullName: 'Atmosphere™ 8-Zone Signal Processor with 1200-Watt Amplifier',
    zones: 8,
    inputs: [
      {
        id: 'input_1',
        number: 1,
        name: 'Input 1',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input with priority control',
        priority: 'high'
      },
      {
        id: 'input_2',
        number: 2,
        name: 'Input 2',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_3',
        number: 3,
        name: 'Input 3',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_4',
        number: 4,
        name: 'Input 4',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_5',
        number: 5,
        name: 'Input 5',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_6',
        number: 6,
        name: 'Input 6',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_7',
        number: 7,
        name: 'Input 7',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (L)'
      },
      {
        id: 'input_8',
        number: 8,
        name: 'Input 8',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (R)'
      },
      {
        id: 'matrix_audio_1',
        number: 101,
        name: 'Matrix Audio 1',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 1'
      },
      {
        id: 'matrix_audio_2',
        number: 102,
        name: 'Matrix Audio 2',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 2'
      },
      {
        id: 'matrix_audio_3',
        number: 103,
        name: 'Matrix Audio 3',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 3'
      },
      {
        id: 'matrix_audio_4',
        number: 104,
        name: 'Matrix Audio 4',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 4'
      }
    ],
    outputs: [
      {
        id: 'output_1_amp',
        number: 1,
        name: 'Zone 1 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_1_line',
        number: 11,
        name: 'Zone 1 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_2_amp',
        number: 2,
        name: 'Zone 2 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_2_line',
        number: 12,
        name: 'Zone 2 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_3_amp',
        number: 3,
        name: 'Zone 3 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_3_line',
        number: 13,
        name: 'Zone 3 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_4_amp',
        number: 4,
        name: 'Zone 4 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_4_line',
        number: 14,
        name: 'Zone 4 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_5_amp',
        number: 5,
        name: 'Zone 5 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_5_line',
        number: 15,
        name: 'Zone 5 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_6_amp',
        number: 6,
        name: 'Zone 6 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_6_line',
        number: 16,
        name: 'Zone 6 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_7_amp',
        number: 7,
        name: 'Zone 7 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_7_line',
        number: 17,
        name: 'Zone 7 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      },
      {
        id: 'output_8_amp',
        number: 8,
        name: 'Zone 8 Amplified',
        type: 'amplified',
        connector: 'Phoenix',
        powerRating: '150W @ 70V/100V',
        description: 'Amplified zone output (150W)'
      },
      {
        id: 'output_8_line',
        number: 18,
        name: 'Zone 8 Line',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output (pre-amp)'
      }
    ],
    features: [
      '8 audio zones',
      '8 physical inputs (6 balanced + 2 RCA)',
      '4 matrix audio buses',
      '1200W total amplification (150W per zone)',
      'Dual outputs per zone (amplified + line-level)',
      'Web-based control interface',
      'RS-232 and TCP/IP control',
      'Priority input (Input 1)'
    ],
    networkPorts: {
      control: 2
    },
    powerRating: '1200W (150W per zone @ 70V/100V)',
    rearPanelImage: '/atlas-models/azmp8-rear.png'
  },

  'AZM4-D': {
    model: 'AZM4-D',
    fullName: 'Atmosphere™ 4-Zone Audio Processor with Dante',
    zones: 4,
    inputs: [
      {
        id: 'input_1',
        number: 1,
        name: 'Input 1',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input with priority control',
        priority: 'high'
      },
      {
        id: 'input_2',
        number: 2,
        name: 'Input 2',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_3',
        number: 3,
        name: 'Input 3',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_4',
        number: 4,
        name: 'Input 4',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_5',
        number: 5,
        name: 'Input 5',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (L)'
      },
      {
        id: 'input_6',
        number: 6,
        name: 'Input 6',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (R)'
      },
      {
        id: 'dante_1',
        number: 201,
        name: 'Dante Input 1',
        type: 'dante',
        connector: 'RJ45',
        description: 'Dante network audio input 1'
      },
      {
        id: 'dante_2',
        number: 202,
        name: 'Dante Input 2',
        type: 'dante',
        connector: 'RJ45',
        description: 'Dante network audio input 2'
      },
      {
        id: 'matrix_audio_1',
        number: 101,
        name: 'Matrix Audio 1',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 1'
      },
      {
        id: 'matrix_audio_2',
        number: 102,
        name: 'Matrix Audio 2',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 2'
      },
      {
        id: 'matrix_audio_3',
        number: 103,
        name: 'Matrix Audio 3',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 3'
      },
      {
        id: 'matrix_audio_4',
        number: 104,
        name: 'Matrix Audio 4',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 4'
      }
    ],
    outputs: [
      {
        id: 'output_1',
        number: 1,
        name: 'Zone 1 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_2',
        number: 2,
        name: 'Zone 2 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_3',
        number: 3,
        name: 'Zone 3 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_4',
        number: 4,
        name: 'Zone 4 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'dante_out_1',
        number: 201,
        name: 'Dante Output 1',
        type: 'dante',
        connector: 'RJ45',
        description: 'Dante network audio output 1'
      },
      {
        id: 'dante_out_2',
        number: 202,
        name: 'Dante Output 2',
        type: 'dante',
        connector: 'RJ45',
        description: 'Dante network audio output 2'
      }
    ],
    features: [
      '4 audio zones',
      '6 physical inputs (4 balanced + 2 RCA)',
      'Dante network audio (2 channels in/out)',
      '4 matrix audio buses',
      'Redundant Dante network ports',
      'Web-based control interface',
      'RS-232 and TCP/IP control',
      'Priority input (Input 1)'
    ],
    networkPorts: {
      control: 2,
      dante: 2
    },
    rearPanelImage: '/atlas-models/azm4-d-rear.png'
  },

  'AZM8-D': {
    model: 'AZM8-D',
    fullName: 'Atmosphere™ 8-Zone Audio Processor with Dante',
    zones: 8,
    inputs: [
      {
        id: 'input_1',
        number: 1,
        name: 'Input 1',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input with priority control',
        priority: 'high'
      },
      {
        id: 'input_2',
        number: 2,
        name: 'Input 2',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_3',
        number: 3,
        name: 'Input 3',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_4',
        number: 4,
        name: 'Input 4',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_5',
        number: 5,
        name: 'Input 5',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_6',
        number: 6,
        name: 'Input 6',
        type: 'balanced',
        connector: 'Phoenix',
        description: 'Balanced mic/line input'
      },
      {
        id: 'input_7',
        number: 7,
        name: 'Input 7',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (L)'
      },
      {
        id: 'input_8',
        number: 8,
        name: 'Input 8',
        type: 'unbalanced',
        connector: 'RCA',
        description: 'Unbalanced stereo RCA input (R)'
      },
      {
        id: 'dante_1',
        number: 201,
        name: 'Dante Input 1',
        type: 'dante',
        connector: 'RJ45',
        description: 'Dante network audio input 1'
      },
      {
        id: 'dante_2',
        number: 202,
        name: 'Dante Input 2',
        type: 'dante',
        connector: 'RJ45',
        description: 'Dante network audio input 2'
      },
      {
        id: 'matrix_audio_1',
        number: 101,
        name: 'Matrix Audio 1',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 1'
      },
      {
        id: 'matrix_audio_2',
        number: 102,
        name: 'Matrix Audio 2',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 2'
      },
      {
        id: 'matrix_audio_3',
        number: 103,
        name: 'Matrix Audio 3',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 3'
      },
      {
        id: 'matrix_audio_4',
        number: 104,
        name: 'Matrix Audio 4',
        type: 'matrix_audio',
        connector: 'Internal',
        description: 'Internal matrix audio bus 4'
      }
    ],
    outputs: [
      {
        id: 'output_1',
        number: 1,
        name: 'Zone 1 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_2',
        number: 2,
        name: 'Zone 2 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_3',
        number: 3,
        name: 'Zone 3 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_4',
        number: 4,
        name: 'Zone 4 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_5',
        number: 5,
        name: 'Zone 5 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_6',
        number: 6,
        name: 'Zone 6 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_7',
        number: 7,
        name: 'Zone 7 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'output_8',
        number: 8,
        name: 'Zone 8 Output',
        type: 'line_level',
        connector: 'Phoenix',
        description: 'Line-level zone output'
      },
      {
        id: 'dante_out_1',
        number: 201,
        name: 'Dante Output 1',
        type: 'dante',
        connector: 'RJ45',
        description: 'Dante network audio output 1'
      },
      {
        id: 'dante_out_2',
        number: 202,
        name: 'Dante Output 2',
        type: 'dante',
        connector: 'RJ45',
        description: 'Dante network audio output 2'
      }
    ],
    features: [
      '8 audio zones',
      '8 physical inputs (6 balanced + 2 RCA)',
      'Dante network audio (2 channels in/out)',
      '4 matrix audio buses',
      'Redundant Dante network ports',
      'Web-based control interface',
      'RS-232 and TCP/IP control',
      'Priority input (Input 1)'
    ],
    networkPorts: {
      control: 2,
      dante: 2
    },
    rearPanelImage: '/atlas-models/azm8-d-rear.png'
  }
}

/**
 * Helper function to get model specs
 */
export function getModelSpec(model: string): AtlasModelSpec | undefined {
  return ATLAS_MODELS[model]
}

/**
 * Helper function to get available input sources for a model
 */
export function getAvailableInputs(model: string): AtlasInput[] {
  const spec = getModelSpec(model)
  return spec?.inputs || []
}

/**
 * Helper function to get available outputs for a model
 */
export function getAvailableOutputs(model: string): AtlasOutput[] {
  const spec = getModelSpec(model)
  return spec?.outputs || []
}

/**
 * Helper function to check if model has Dante
 */
export function hasDanteSupport(model: string): boolean {
  const spec = getModelSpec(model)
  return spec?.model.includes('-D') || false
}

/**
 * Helper function to check if model has amplification
 */
export function hasAmplification(model: string): boolean {
  const spec = getModelSpec(model)
  return spec?.model.includes('AZMP') || false
}

/**
 * Format input name with connector type
 */
export function formatInputName(input: AtlasInput): string {
  const connectorMap = {
    'Phoenix': '⚡',
    'RCA': '🔊',
    'RJ45': '🌐',
    'Internal': '🔄'
  }
  const icon = connectorMap[input.connector] || ''
  return `${icon} ${input.name} (${input.connector}${input.type === 'balanced' ? ' Balanced' : input.type === 'unbalanced' ? ' Unbalanced' : ''})`
}
