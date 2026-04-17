/**
 * Bridge file for dbx ZonePRO control service
 * Re-exports from @sports-bar/dbx-zonepro package
 */
export {
  DbxControlService,
  getDbxControlService,
  disconnectDbxService,
  disconnectAllDbxServices,
  listDbxServices,
  type DbxControlServiceConfig,
  type DbxControlEvents,
  type ZoneState,
} from '@sports-bar/dbx-zonepro'
