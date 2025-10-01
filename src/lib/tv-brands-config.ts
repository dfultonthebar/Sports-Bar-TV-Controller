
// TV Brand-specific timing configurations and quirks

export interface BrandTiming {
  brand: string
  cecPowerOnDelay: number
  cecPowerOffDelay: number
  cecVolumeDelay: number
  cecInputSwitchDelay: number
  supportsWakeOnCec: boolean
  supportsCecVolumeControl: boolean
  preferredControlMethod: 'CEC' | 'IR' | 'HYBRID'
  quirks: string[]
  irCodesetIds?: string[]
}

export const TV_BRAND_CONFIGS: Record<string, BrandTiming> = {
  'Sony': {
    brand: 'Sony',
    cecPowerOnDelay: 3000,
    cecPowerOffDelay: 1500,
    cecVolumeDelay: 200,
    cecInputSwitchDelay: 2000,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: true,
    preferredControlMethod: 'CEC',
    quirks: [
      'BRAVIA Sync must be enabled in TV settings',
      'May require 2-3 second delay for power on',
      'Excellent CEC compliance'
    ],
    irCodesetIds: ['sony', 'sony_bravia', 'sony_android_tv']
  },
  'Samsung': {
    brand: 'Samsung',
    cecPowerOnDelay: 2500,
    cecPowerOffDelay: 1000,
    cecVolumeDelay: 150,
    cecInputSwitchDelay: 1500,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: true,
    preferredControlMethod: 'CEC',
    quirks: [
      'Anynet+ (HDMI-CEC) must be enabled',
      'Some older models may not wake from standby via CEC',
      'Frame TVs may have Art Mode considerations'
    ],
    irCodesetIds: ['samsung', 'samsung_smart_tv', 'samsung_qled']
  },
  'LG': {
    brand: 'LG',
    cecPowerOnDelay: 3500,
    cecPowerOffDelay: 1200,
    cecVolumeDelay: 250,
    cecInputSwitchDelay: 2500,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: true,
    preferredControlMethod: 'CEC',
    quirks: [
      'SimpLink must be enabled in settings',
      'WebOS TVs have excellent CEC support',
      'OLED models may take longer to power on'
    ],
    irCodesetIds: ['lg', 'lg_webos', 'lg_oled']
  },
  'TCL': {
    brand: 'TCL',
    cecPowerOnDelay: 2000,
    cecPowerOffDelay: 1000,
    cecVolumeDelay: 200,
    cecInputSwitchDelay: 1500,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: true,
    preferredControlMethod: 'CEC',
    quirks: [
      'T-Link (CEC) should be enabled',
      'Roku TVs have good CEC support',
      'Budget-friendly with reliable CEC'
    ],
    irCodesetIds: ['tcl', 'tcl_roku_tv']
  },
  'Vizio': {
    brand: 'Vizio',
    cecPowerOnDelay: 2500,
    cecPowerOffDelay: 1500,
    cecVolumeDelay: 300,
    cecInputSwitchDelay: 2000,
    supportsWakeOnCec: false,
    supportsCecVolumeControl: false,
    preferredControlMethod: 'HYBRID',
    quirks: [
      'CEC support can be inconsistent',
      'Older models may not support wake via CEC',
      'Recommend IR for volume control',
      'SmartCast TVs have limited CEC features'
    ],
    irCodesetIds: ['vizio', 'vizio_smartcast']
  },
  'Sharp': {
    brand: 'Sharp',
    cecPowerOnDelay: 3000,
    cecPowerOffDelay: 1500,
    cecVolumeDelay: 250,
    cecInputSwitchDelay: 2000,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: false,
    preferredControlMethod: 'HYBRID',
    quirks: [
      'Aquos Link for CEC functionality',
      'Volume control better via IR',
      'Power control via CEC is reliable'
    ],
    irCodesetIds: ['sharp', 'sharp_aquos']
  },
  'Panasonic': {
    brand: 'Panasonic',
    cecPowerOnDelay: 3000,
    cecPowerOffDelay: 1200,
    cecVolumeDelay: 200,
    cecInputSwitchDelay: 2000,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: true,
    preferredControlMethod: 'CEC',
    quirks: [
      'VIERA Link or HDAVI Control must be enabled',
      'Good CEC compliance',
      'Commercial displays may have limited CEC'
    ],
    irCodesetIds: ['panasonic', 'panasonic_viera']
  },
  'Philips': {
    brand: 'Philips',
    cecPowerOnDelay: 2500,
    cecPowerOffDelay: 1000,
    cecVolumeDelay: 200,
    cecInputSwitchDelay: 1500,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: true,
    preferredControlMethod: 'CEC',
    quirks: [
      'EasyLink provides CEC functionality',
      'European models have excellent CEC support',
      'Android TV models work well with CEC'
    ],
    irCodesetIds: ['philips', 'philips_android_tv']
  },
  'Toshiba': {
    brand: 'Toshiba',
    cecPowerOnDelay: 2500,
    cecPowerOffDelay: 1500,
    cecVolumeDelay: 250,
    cecInputSwitchDelay: 2000,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: false,
    preferredControlMethod: 'HYBRID',
    quirks: [
      'CE-Link or Regza Link for CEC',
      'Newer Fire TV models have better CEC support',
      'Use IR for volume control'
    ],
    irCodesetIds: ['toshiba', 'toshiba_fire_tv']
  },
  'Hisense': {
    brand: 'Hisense',
    cecPowerOnDelay: 2000,
    cecPowerOffDelay: 1000,
    cecVolumeDelay: 200,
    cecInputSwitchDelay: 1500,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: true,
    preferredControlMethod: 'CEC',
    quirks: [
      'CEC must be enabled in settings',
      'Budget-friendly with decent CEC support',
      'Android TV and Roku TV variants'
    ],
    irCodesetIds: ['hisense', 'hisense_roku_tv']
  },
  'Insignia': {
    brand: 'Insignia',
    cecPowerOnDelay: 2000,
    cecPowerOffDelay: 1000,
    cecVolumeDelay: 200,
    cecInputSwitchDelay: 1500,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: true,
    preferredControlMethod: 'CEC',
    quirks: [
      'Fire TV Edition has good CEC support',
      'Best Buy house brand',
      'Reliable for basic CEC functions'
    ],
    irCodesetIds: ['insignia', 'insignia_fire_tv']
  },
  'Element': {
    brand: 'Element',
    cecPowerOnDelay: 2500,
    cecPowerOffDelay: 1500,
    cecVolumeDelay: 300,
    cecInputSwitchDelay: 2000,
    supportsWakeOnCec: false,
    supportsCecVolumeControl: false,
    preferredControlMethod: 'IR',
    quirks: [
      'Budget brand with limited CEC support',
      'Recommend IR control for reliability',
      'Power on via CEC may not work'
    ],
    irCodesetIds: ['element']
  },
  'Westinghouse': {
    brand: 'Westinghouse',
    cecPowerOnDelay: 2500,
    cecPowerOffDelay: 1500,
    cecVolumeDelay: 300,
    cecInputSwitchDelay: 2000,
    supportsWakeOnCec: false,
    supportsCecVolumeControl: false,
    preferredControlMethod: 'IR',
    quirks: [
      'Minimal CEC support',
      'IR control recommended',
      'Basic functionality only'
    ],
    irCodesetIds: ['westinghouse']
  },
  'Generic': {
    brand: 'Generic',
    cecPowerOnDelay: 2500,
    cecPowerOffDelay: 1500,
    cecVolumeDelay: 250,
    cecInputSwitchDelay: 2000,
    supportsWakeOnCec: true,
    supportsCecVolumeControl: false,
    preferredControlMethod: 'HYBRID',
    quirks: [
      'Test CEC functionality before relying on it',
      'Fall back to IR if CEC doesn\'t work',
      'Generic/Unknown brand'
    ],
    irCodesetIds: ['generic']
  }
}

export const getBrandConfig = (brand: string): BrandTiming => {
  return TV_BRAND_CONFIGS[brand] || TV_BRAND_CONFIGS['Generic']
}

export const getAllBrands = (): string[] => {
  return Object.keys(TV_BRAND_CONFIGS).filter(b => b !== 'Generic')
}

export const getRecommendedMethod = (brand: string): 'CEC' | 'IR' | 'HYBRID' => {
  const config = getBrandConfig(brand)
  return config.preferredControlMethod
}
