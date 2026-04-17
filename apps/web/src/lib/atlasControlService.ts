/**
 * Bridge file for backwards compatibility
 * Re-exports from @sports-bar/atlas package
 */
import { AtlasControlService as AtlasControlServiceImpl } from '@sports-bar/atlas'

export {
  AtlasControlService,
  getAtlasControlService,
  disconnectAtlasControlService,
  disconnectAllServices,
  type AtlasControlConfig,
  type AtlasControlCommand as AtlasCommand,
  type MeterUpdate
} from '@sports-bar/atlas'

export default AtlasControlServiceImpl
