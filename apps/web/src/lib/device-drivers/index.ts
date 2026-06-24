/**
 * Per-manufacturer / per-model device drivers for Android-TV-class streaming devices.
 *
 * Fire TV and NVIDIA Shield share the same ADB transport (connect, sendKey, getCurrentApp,
 * launchAppWithDeepLink, etc. in @sports-bar/firecube) but differ in (a) which PACKAGE an app
 * ships as, and (b) which LAUNCH SEQUENCE works. This module encapsulates those differences so
 * each manufacturer/model is one driver. First two: Amazon Fire TV (the installed base) and the
 * NVIDIA Shield. Designed to start small — the generic Android-TV behavior is the base class,
 * Fire TV just preserves today's behavior, and new devices register a driver instead of adding
 * another hardcoded `if`.
 */

/** Minimal shape of a catalog app (from @sports-bar/streaming getStreamingAppById). */
export interface AppLike {
  id: string
  packageName: string
  packageAliases?: string[]
  deepLinkSupport?: boolean
}

export interface DeviceDriver {
  /** Lowercase manufacturer key, e.g. 'amazon', 'nvidia', 'generic'. */
  readonly manufacturer: string
  /** Model codenames this driver handles, or ['*'] for any model of the manufacturer. */
  readonly models: string[]
  /**
   * Package candidates to try for an app, best-first (includes manufacturer-specific builds).
   * The caller checks which is actually installed.
   */
  appPackages(app: AppLike): string[]
  /**
   * Whether this device uses the Fire-TV DPAD autoplay sequences (Prime search→play,
   * ESPN rail navigation, Scout broadcast). False = use generic deep-link / launcher launch.
   */
  readonly usesFireTvAutoplay: boolean
}

/** Generic Android TV: catalog package + aliases, no special autoplay. */
class BaseAndroidTVDriver implements DeviceDriver {
  manufacturer = 'generic'
  models = ['*']
  usesFireTvAutoplay = false
  appPackages(app: AppLike): string[] {
    return [app.packageName, ...(app.packageAliases || [])].filter(Boolean)
  }
}

/** Amazon Fire TV — preserves today's behavior exactly (catalog packages + Fire-TV autoplay). */
class FireTVDriver extends BaseAndroidTVDriver {
  manufacturer = 'amazon'
  models = ['*']
  usesFireTvAutoplay = true
}

/**
 * NVIDIA Shield (Android TV, e.g. 2019 "mdarcy"). Manufacturer-specific app builds; generic
 * deep-link / launcher launch (the Fire-TV DPAD-autoplay dance does not apply — different
 * launcher + app UIs). Confirmed installed on the Holmgren-fleet Shield, 2026-06-24.
 */
const SHIELD_PACKAGES: Record<string, string> = {
  'espn-plus': 'com.espn.score_center', // NOT com.espn.gtv (Fire TV)
  espn: 'com.espn.score_center',
  'amazon-prime': 'com.amazon.amazonvideo.livingroom.nvidia', // NVIDIA Prime build, not firebat
  netflix: 'com.netflix.ninja',
  youtube: 'com.google.android.youtube.tv',
  'youtube-tv': 'com.google.android.youtube.tv',
  plex: 'com.plexapp.android',
  // Verified installed on the Lime Kiln Shield 2026-06-24 (probed live):
  'hulu-live': 'com.hulu.livingroomplus', // NOT com.hulu.plus (Fire/mobile)
  hulu: 'com.hulu.livingroomplus',
  'paramount-plus': 'com.cbs.ott',
  peacock: 'com.peacocktv.peacockandroid',
  'nfhs-network': 'com.playon.nfhslive.googletv', // .googletv Android-TV build (catalog has the Fire one)
}
class NvidiaShieldDriver extends BaseAndroidTVDriver {
  manufacturer = 'nvidia'
  models = ['*']
  usesFireTvAutoplay = false
  appPackages(app: AppLike): string[] {
    const shieldPkg = SHIELD_PACKAGES[app.id]
    // Shield-specific build first, then the catalog candidates as fallback.
    return [shieldPkg, app.packageName, ...(app.packageAliases || [])].filter(Boolean) as string[]
  }
}

const DRIVERS: DeviceDriver[] = [new FireTVDriver(), new NvidiaShieldDriver()]
const GENERIC: DeviceDriver = new BaseAndroidTVDriver()

/**
 * Resolve the driver for a device. Defaults to Amazon/Fire TV when manufacturer is unset —
 * the entire installed base is Fire TV with no `manufacturer` recorded, so this keeps their
 * behavior identical. The model arg is accepted now for future per-model drivers.
 */
export function getDriver(manufacturer?: string | null, _model?: string | null): DeviceDriver {
  const m = (manufacturer || 'amazon').toLowerCase()
  return DRIVERS.find((d) => d.manufacturer === m) || GENERIC
}
