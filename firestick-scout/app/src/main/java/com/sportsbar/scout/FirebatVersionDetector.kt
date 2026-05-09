package com.sportsbar.scout

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log

/**
 * Detects the firebat / launcher major version on this Cube and
 * decides which navigation path the catalog snapshotter should use.
 *
 * Why: PVFTV-320+ Cubes (Lucky's 1+2 confirmed) have firebat as the
 * launcher itself — there's no separate Prime Video activity to land
 * on. PVFTV-215 and below have firebat as a normal app with its own
 * Sports tab. The two need different navigation.
 *
 * Cached so we don't hammer PackageManager every cycle.
 */
object FirebatVersionDetector {

    private val cache = mutableMapOf<String, Int?>()

    /**
     * Returns the major version number (e.g. 320 for PVFTV-320.0001-L)
     * or null if not installed / unreadable.
     */
    fun versionCodeFor(ctx: Context, pkg: String): Int? {
        cache[pkg]?.let { return it }
        val direct = readMajor(ctx, pkg)
        if (direct != null) {
            cache[pkg] = direct
            return direct
        }
        // For com.amazon.firebat: if the package itself doesn't reveal a
        // version (some PVFTV-320 builds have sparse firebat metadata),
        // fall back to com.amazon.tv.launcher's version — same release.
        if (pkg == "com.amazon.firebat") {
            val launcher = readMajor(ctx, "com.amazon.tv.launcher")
            if (launcher != null) {
                Log.i(TAG, "$pkg version unreadable; using launcher major=$launcher as proxy")
                cache[pkg] = launcher
                return launcher
            }
        }
        cache[pkg] = null
        return null
    }

    private fun readMajor(ctx: Context, pkg: String): Int? = try {
        val pi = ctx.packageManager.getPackageInfo(pkg, 0)
        val name = pi.versionName ?: ""
        Regex("""PVFTV-(\d{3})""").find(name)?.groupValues?.get(1)?.toIntOrNull()
            ?: Regex("""PVFLR-(\d{3})""").find(name)?.groupValues?.get(1)?.toIntOrNull()
            ?: (pi.longVersionCode / 100_000L).toInt().takeIf { it in 1..9999 }
    } catch (e: PackageManager.NameNotFoundException) {
        null
    } catch (t: Throwable) {
        Log.w(TAG, "readMajor($pkg) crashed: ${t.message}")
        null
    }

    fun choosePath(pkg: String, major: Int?): NavPath = when {
        // PVFTV-320+ Cubes: redesigned launcher with aggregated content
        // tabs (Home/Movies/TV/Sports/Live/News) directly on the home
        // screen. Sports tab pulls from Prime Video, ESPN+, etc. — no
        // need to launch the Prime Video app first. Use LauncherHome-
        // Navigator.
        pkg == "com.amazon.firebat" && major != null && major >= 300 -> NavPath.LAUNCHER_HOME_SPORTS_TAB
        pkg == "com.amazon.tv.launcher" && major != null && major >= 300 -> NavPath.LAUNCHER_HOME_SPORTS_TAB

        // v2.33.12 — PVFTV-104/107/115 (Stoneyard Appleton + Greenville
        // mix) lacks the Prime Video Sports tab entirely. The walker
        // never reaches a Sports row; AppNavigator's PRIME_APP_HOSTED
        // path always returns nav_failed. Skip the target outright on
        // firebat < 200 to avoid the wasted ~10s nav attempt + bogus
        // status=nav_failed entries cluttering the diagnostic logs.
        pkg == "com.amazon.firebat" && major != null && major < 200  -> NavPath.NONE

        // PVFTV-215 / 213 / 214: Prime Video opens its own app with a
        // top-tab strip. Sports lives under that. AppNavigator handles
        // (still doesn't drive Compose tabs reliably, but at least it
        // doesn't waste cycles on cubes where the tab can't exist).
        pkg == "com.amazon.firebat"                                  -> NavPath.PRIME_APP_HOSTED

        // ESPN: home tab IS the live-sports landing.
        pkg == "com.espn.gtv"                                        -> NavPath.ESPN_LIVE

        else                                                          -> NavPath.NONE
    }

    private const val TAG = "FirebatVersion"
}

/**
 * NavPath enum — chosen per (pkg, version) by FirebatVersionDetector.
 *
 * - LAUNCHER_HOME_SPORTS_TAB → PVFTV-320+ launcher home, Sports tab
 *   directly in top nav (LauncherHomeNavigator)
 * - PRIME_LAUNCHER_HOSTED    → DEPRECATED. Used to mean "PVFTV-320+
 *   launcher-hosted Prime Video, click Live tab" — but that selector
 *   never worked (see V2_2_0_PVFTV320_FINDINGS.md iters 1-5). Keep the
 *   enum value to avoid breaking compilation of deprecated code paths,
 *   but new code should use LAUNCHER_HOME_SPORTS_TAB instead.
 * - PRIME_APP_HOSTED         → PVFTV-215 and below, open Prime Video
 *   then click Sports top-tab. Doesn't work either (Compose tabs don't
 *   respond to AS clicks); kept enabled for the version range so the
 *   navigator gets to log diagnostics, but production filter strips
 *   the empty result via `status=nav_failed`.
 * - ESPN_LIVE                → No nav, ESPN home is already the
 *   live-sports landing.
 * - NONE                     → Skip this app entirely.
 */
enum class NavPath { LAUNCHER_HOME_SPORTS_TAB, PRIME_LAUNCHER_HOSTED, PRIME_APP_HOSTED, ESPN_LIVE, NONE }
