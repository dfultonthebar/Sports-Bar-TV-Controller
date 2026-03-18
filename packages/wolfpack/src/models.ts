/**
 * Wolf Pack Matrix Model Profiles
 *
 * Shared model definitions for all Wolf Pack matrix sizes.
 * Previously duplicated in MatrixControl.tsx — now the single source of truth.
 */

export interface WolfpackModelProfile {
  value: string
  label: string
  inputs: number
  outputs: number
  series: 'Fixed' | 'Modular-18' | 'Modular-36' | 'Enterprise'
  resolution: string
}

export const WOLFPACK_MODELS: WolfpackModelProfile[] = [
  // Fixed Size Matrices (Non-Modular)
  { value: 'WP-4X4', label: '4x4 HDMI Matrix', inputs: 4, outputs: 4, series: 'Fixed', resolution: '4K@60Hz' },
  { value: 'WP-4X6', label: '4x6 HDMI Matrix w/Video Wall', inputs: 4, outputs: 6, series: 'Fixed', resolution: '4K@60Hz' },
  { value: 'WP-8X4', label: '8x4 HDMI Matrix w/Scaling', inputs: 8, outputs: 4, series: 'Fixed', resolution: '4K@60Hz' },
  { value: 'WP-8X8', label: '8x8 HDMI Matrix w/Video Wall', inputs: 8, outputs: 8, series: 'Fixed', resolution: '4K@30Hz' },
  { value: 'WP-8X18', label: '8x18 HDMI Matrix w/Dual Monitors', inputs: 8, outputs: 18, series: 'Fixed', resolution: '4K@30Hz' },
  // Modular Chassis - 18x18
  { value: 'WP-18X18', label: '18x18 Modular Chassis (4U)', inputs: 18, outputs: 18, series: 'Modular-18', resolution: '4K@30Hz' },
  { value: 'WP-16X16-18', label: '16x16 in 18x18 Chassis', inputs: 16, outputs: 16, series: 'Modular-18', resolution: '4K@30Hz' },
  { value: 'WP-8X8-18', label: '8x8 in 18x18 Chassis w/Touchscreen', inputs: 8, outputs: 8, series: 'Modular-18', resolution: '4K@30Hz' },
  // Modular Chassis - 36x36
  { value: 'WP-36X36', label: '36x36 Modular Chassis (8U)', inputs: 36, outputs: 36, series: 'Modular-36', resolution: '4K@30Hz' },
  { value: 'WP-32X32-36', label: '32x32 in 36x36 Chassis', inputs: 32, outputs: 32, series: 'Modular-36', resolution: '4K@30Hz' },
  { value: 'WP-24X24-36', label: '24x24 in 36x36 Chassis', inputs: 24, outputs: 24, series: 'Modular-36', resolution: '4K@30Hz' },
  // Large Enterprise
  { value: 'WP-64X64', label: '64x64 Modular Matrix', inputs: 64, outputs: 64, series: 'Enterprise', resolution: '4K@30Hz' },
  { value: 'WP-80X80', label: '80x80 Modular Matrix', inputs: 80, outputs: 80, series: 'Enterprise', resolution: '4K@30Hz' },
]

/**
 * Look up a model by its value string.
 * Falls back to WP-36X36 if not found.
 */
export function getWolfpackModel(modelValue: string): WolfpackModelProfile {
  return WOLFPACK_MODELS.find(m => m.value === modelValue)
    || WOLFPACK_MODELS.find(m => m.value === 'WP-36X36')!
}
