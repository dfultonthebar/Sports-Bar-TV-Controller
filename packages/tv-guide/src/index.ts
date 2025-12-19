/**
 * @sports-bar/tv-guide - TV Guide Service Integrations
 *
 * Professional TV guide data from multiple providers:
 * - Gracenote (Nielsen) - Comprehensive metadata and sports-focused features
 * - Spectrum Business - Direct integration with Spectrum Business TV services
 * - Unified Service - Combines all providers into a single interface
 */

// Gracenote Service
export {
  gracenoteService,
  type GracenoteChannel,
  type GracenoteProgram,
  type GracenoteGuideData,
  type GracenoteConfig
} from './gracenote-service'

// Spectrum Business Service
export {
  spectrumBusinessApiService,
  type SpectrumBusinessChannel,
  type SpectrumBusinessProgram,
  type SpectrumBusinessGuideData,
  type SpectrumServicePackage,
  type SpectrumBusinessConfig
} from './spectrum-business-api'

// Unified TV Guide Service - Combines all providers
export {
  unifiedTVGuideService,
  type UnifiedChannel,
  type UnifiedProgram,
  type UnifiedGuideData
} from './unified-tv-guide-service'
