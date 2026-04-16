/**
 * DirecTV Guide Service Bridge
 *
 * Re-exports the guide service from @sports-bar/directv and provides
 * app-level helpers that load devices from the centralized device loader.
 */
export {
  fetchDirecTVGuide,
  fetchChannelProgramInfo,
  fetchMultipleChannelProgramInfo,
  type DirecTVProgramInfo,
  type DirecTVDevice,
  type DirecTVGuideResult,
  type DirecTVGuideOptions
} from '@sports-bar/directv'

export {
  getDirecTVDeviceFromConfig,
  getAllDirecTVDevices,
  loadDirecTVDevices,
  type DirecTVDeviceConfig
} from '@/lib/directv-device-loader'
