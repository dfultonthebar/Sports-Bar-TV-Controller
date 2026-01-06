/**
 * Bridge file for backwards compatibility
 * Re-exports from @sports-bar/atlas package
 */
export {
  AtlasControlService,
  getAtlasControlService,
  disconnectAtlasControlService,
  disconnectAllServices,
  type AtlasControlConfig,
  type AtlasCommand,
  type MeterUpdate
} from '@sports-bar/atlas'

export default AtlasControlService
