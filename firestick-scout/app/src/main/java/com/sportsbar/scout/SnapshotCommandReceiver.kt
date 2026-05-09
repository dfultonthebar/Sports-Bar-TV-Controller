package com.sportsbar.scout

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Receives `com.sportsbar.scout.SNAPSHOT_NOW` broadcasts and starts
 * CatalogSnapshotService with EXTRA_RUN_NOW=true.
 *
 * Triggered manually for development:
 *   adb shell "am broadcast -a com.sportsbar.scout.SNAPSHOT_NOW \
 *     -n com.sportsbar.scout/.SnapshotCommandReceiver"
 */
class SnapshotCommandReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != ACTION_SNAPSHOT_NOW) return
        Log.i(TAG, "Received SNAPSHOT_NOW broadcast — starting service")
        val svc = Intent(ctx, CatalogSnapshotService::class.java)
            .putExtra(CatalogSnapshotService.EXTRA_RUN_NOW, true)
        try {
            ContextCompat.startForegroundService(ctx, svc)
        } catch (t: Throwable) {
            Log.w(TAG, "startForegroundService crashed: ${t.message}")
        }
    }

    companion object {
        const val ACTION_SNAPSHOT_NOW = "com.sportsbar.scout.SNAPSHOT_NOW"
        private const val TAG = "SnapshotCmd"
    }
}
