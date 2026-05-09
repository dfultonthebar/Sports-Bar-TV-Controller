package com.sportsbar.scout

import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Launches a package's leanback launcher activity in-process — no ADB
 * pipe, no shell quoting issues like the server-side walker hits.
 */
object LauncherIntent {
    fun launchPackage(ctx: Context, pkg: String): Boolean {
        return try {
            val intent = ctx.packageManager.getLeanbackLaunchIntentForPackage(pkg)
                ?: ctx.packageManager.getLaunchIntentForPackage(pkg)
                ?: run {
                    Log.w(TAG, "$pkg has no launcher activity")
                    return false
                }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            ctx.startActivity(intent)
            Log.i(TAG, "Launched $pkg → ${intent.component?.flattenToShortString()}")
            true
        } catch (t: Throwable) {
            Log.w(TAG, "Launch $pkg crashed: ${t.message}")
            false
        }
    }

    private const val TAG = "LauncherIntent"
}
