/**
 * Fire TV Subscription Polling
 *
 * Simple ADB-based subscription detection for Fire TV devices.
 * Detects installed streaming apps via ADB package listing.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '@sports-bar/logger'

const execAsync = promisify(exec)

export interface Subscription {
  id: string
  name: string
  type: 'streaming' | 'premium' | 'sports' | 'addon'
  status: 'active' | 'inactive' | 'expired'
  provider?: string
  packageName?: string
  subscriptionDate?: string
  expirationDate?: string
  cost?: number
  description?: string
  logoUrl?: string
}

export interface FireTVDeviceInfo {
  id: string
  name: string
  ipAddress: string
  port?: number
}

/**
 * Poll real Fire TV subscriptions via ADB
 */
export async function pollRealFireTVSubscriptions(
  device: FireTVDeviceInfo
): Promise<Subscription[]> {
  const subscriptions: Subscription[] = []
  const deviceSerial = `${device.ipAddress}:5555`

  try {
    // Connect to Fire TV via ADB
    await execAsync(`adb connect ${deviceSerial}`)

    // Get list of installed packages - IMPORTANT: Use -s flag to target specific device
    const { stdout } = await execAsync(`adb -s ${deviceSerial} shell pm list packages`)
    const packages = stdout.split('\n').filter(line => line.startsWith('package:'))

    // Known streaming app package names
    // Dictionary of known streaming / sports / music apps keyed by the package
    // name we actually see on Fire TV Cubes at our locations. Verified against
    // `adb shell pm list packages` output on Stoneyard Greenville Fire TVs.
    //
    // Note: some keys differ from the Android-TV equivalents. For example:
    //   - YouTube on Fire TV is `com.amazon.firetv.youtube`, NOT
    //     `com.google.android.youtube.tv`.
    //   - Apple TV+ on Fire TV is `com.apple.atve.amazon.appletv`, NOT
    //     `com.apple.atve.androidtv.appletv`.
    //   - Paramount+ on Fire TV is often `com.cbs.ott` (post 2022 rebrand),
    //     not `com.cbs.app`.
    // Both legacy and current keys are included where we've seen both.
    const streamingApps: Record<string, {
      name: string
      type: 'streaming' | 'sports' | 'music'
      provider: string
    }> = {
      // --- Big streaming ---
      'com.amazon.avod':                         { name: 'Amazon Prime Video', type: 'streaming', provider: 'Amazon' },
      'com.amazon.avod.thirdpartyclient':        { name: 'Amazon Prime Video', type: 'streaming', provider: 'Amazon' },
      'com.netflix.ninja':                       { name: 'Netflix',            type: 'streaming', provider: 'Netflix' },
      'com.hulu.plus':                           { name: 'Hulu',               type: 'streaming', provider: 'Hulu' },
      'com.disney.disneyplus':                   { name: 'Disney+',            type: 'streaming', provider: 'Disney' },
      'com.peacock.peacockfiretv':               { name: 'Peacock',            type: 'streaming', provider: 'NBCUniversal' },
      'com.peacocktv.peacockandroid':            { name: 'Peacock',            type: 'streaming', provider: 'NBCUniversal' },
      'com.cbs.ott':                             { name: 'Paramount+',         type: 'streaming', provider: 'Paramount' },
      'com.cbs.app':                             { name: 'Paramount+',         type: 'streaming', provider: 'Paramount' },
      'com.wbd.stream':                          { name: 'Max',                type: 'streaming', provider: 'Warner Bros Discovery' },
      'com.hbo.hbonow':                          { name: 'Max (legacy HBO)',   type: 'streaming', provider: 'Warner Bros Discovery' },
      'com.apple.atve.amazon.appletv':           { name: 'Apple TV+',          type: 'streaming', provider: 'Apple' },
      'com.apple.atve.androidtv.appletv':        { name: 'Apple TV+',          type: 'streaming', provider: 'Apple' },
      'com.amazon.firetv.youtube':               { name: 'YouTube',            type: 'streaming', provider: 'Google' },
      'com.google.android.youtube.tv':           { name: 'YouTube TV',         type: 'streaming', provider: 'Google' },
      'com.google.android.youtube.tvunplugged':  { name: 'YouTube TV',         type: 'streaming', provider: 'Google' },
      'com.tubitv.ott':                          { name: 'Tubi',               type: 'streaming', provider: 'Fox' },
      'com.tubitv.firetv':                       { name: 'Tubi',               type: 'streaming', provider: 'Fox' },
      'tv.pluto.android':                        { name: 'Pluto TV',           type: 'streaming', provider: 'Paramount' },
      'tv.pluto.firetv':                         { name: 'Pluto TV',           type: 'streaming', provider: 'Paramount' },

      // --- Live TV / vMVPDs ---
      'com.fubo.firetv.screen':                  { name: 'fuboTV',             type: 'streaming', provider: 'Fubo' },
      'com.fubo.mobile':                         { name: 'fuboTV',             type: 'streaming', provider: 'Fubo' },
      'com.sling':                               { name: 'Sling TV',           type: 'streaming', provider: 'Dish Network' },
      'com.att.tv':                              { name: 'DirecTV Stream',     type: 'streaming', provider: 'DirecTV' },
      'com.philo.philo':                         { name: 'Philo',              type: 'streaming', provider: 'Philo' },

      // --- Sports ---
      'com.espn.score_center':                   { name: 'ESPN',               type: 'sports',    provider: 'Disney' },
      'com.espn.gtv':                            { name: 'ESPN',               type: 'sports',    provider: 'Disney' },
      'com.foxsports.mobile':                    { name: 'Fox Sports',         type: 'sports',    provider: 'Fox' },
      'com.nbcuni.nbc.liveextra':                { name: 'NBC Sports',         type: 'sports',    provider: 'NBCUniversal' },
      'com.dazn':                                { name: 'DAZN',               type: 'sports',    provider: 'DAZN' },
      'com.bamnetworks.mobile.android.gameday.atbat': { name: 'MLB.TV',        type: 'sports',    provider: 'MLB' },
      'com.nbaimd.gametime.nba2011':             { name: 'NBA League Pass',    type: 'sports',    provider: 'NBA' },
      'com.nhl.gc1112.free':                     { name: 'NHL.TV',             type: 'sports',    provider: 'NHL' },
      'com.gotv.nflgamecenter.us.lite':          { name: 'NFL+',               type: 'sports',    provider: 'NFL' },
      'com.playon.nfhslive':                     { name: 'NFHS Network',       type: 'sports',    provider: 'NFHS' },
      'com.premiumfighter.ppvufc':               { name: 'UFC Fight Pass',     type: 'sports',    provider: 'UFC' },

      // --- Music ---
      'com.pandora.android.gtv':                 { name: 'Pandora',            type: 'music',     provider: 'SiriusXM' },
      'com.pandora.android':                     { name: 'Pandora',            type: 'music',     provider: 'SiriusXM' },
      'com.spotify.tv.android':                  { name: 'Spotify',            type: 'music',     provider: 'Spotify' },
      'com.iheartradio.tv':                      { name: 'iHeartRadio',        type: 'music',     provider: 'iHeartMedia' },

      // --- Commercial music / bar specific ---
      'com.soundtrackyourbrand.player':          { name: 'Soundtrack Your Brand', type: 'music',  provider: 'Soundtrack' },
      'tv.atmosphere.atmosphere':                { name: 'Atmosphere TV',      type: 'streaming', provider: 'Atmosphere' },
      'com.atmosphere.atmosphere':               { name: 'Atmosphere TV',      type: 'streaming', provider: 'Atmosphere' },
      'com.everpass.firetv':                     { name: 'EverPass',           type: 'streaming', provider: 'EverPass' },
    }

    // Check which streaming apps are installed
    for (const packageLine of packages) {
      const packageName = packageLine.replace('package:', '').trim()

      if (streamingApps[packageName]) {
        const app = streamingApps[packageName]

        subscriptions.push({
          id: `firetv-${packageName}`,
          name: app.name,
          type: app.type,
          status: 'active',
          provider: app.provider,
          packageName: packageName,
          description: `Installed on ${device.name}`
        })
      }
    }

    // Disconnect ADB from specific device
    await execAsync(`adb disconnect ${deviceSerial}`)

  } catch (error) {
    // Log error with full context for debugging
    logger.error(`[FireTV] Subscription poll failed for ${device.name || 'Unknown'} (${deviceSerial})`, {
      error,
      data: {
        deviceId: device.id || 'unknown',
        deviceName: device.name || 'Unknown',
        deviceSerial,
        ipAddress: device.ipAddress,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    })
    throw new Error('Unable to connect to Fire TV device via ADB')
  }

  return subscriptions
}
