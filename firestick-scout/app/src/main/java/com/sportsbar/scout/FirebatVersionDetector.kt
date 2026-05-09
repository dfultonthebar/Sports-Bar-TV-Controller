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
        pkg == "com.amazon.firebat" && major != null && major >= 300 -> NavPath.PRIME_LAUNCHER_HOSTED
        pkg == "com.amazon.firebat"                                  -> NavPath.PRIME_APP_HOSTED
        pkg == "com.espn.gtv"                                        -> NavPath.ESPN_LIVE
        else                                                          -> NavPath.NONE
    }

    private const val TAG = "FirebatVersion"
}

enum class NavPath { PRIME_LAUNCHER_HOSTED, PRIME_APP_HOSTED, ESPN_LIVE, NONE }
