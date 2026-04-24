/**
 * Streaming Apps Database Bridge - Re-exports from @sports-bar/streaming
 */
export {
  type StreamingApp,
  STREAMING_APPS_DATABASE,
  getStreamingAppById,
  getStreamingAppsByCategory,
  getAppsWithPublicApi,
  getStreamingAppsBySport,
  searchStreamingApps,
  getPackageNameByAppId,
  // v2.32.9 — display-name + package-name lookup helpers (single source
  // of truth, replaces the inline DISPLAY_NAME_TO_CATALOG_ID +
  // PACKAGE_TO_DISPLAY_NAME maps that lived in channel-guide and
  // firetv-app-sync respectively)
  findStreamingAppByDisplayName,
  findStreamingAppByPackageName,
  getDisplayNameForPackage,
} from '@sports-bar/streaming'
