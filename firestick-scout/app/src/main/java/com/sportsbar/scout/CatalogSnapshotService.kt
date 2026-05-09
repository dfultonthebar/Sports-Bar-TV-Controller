package com.sportsbar.scout

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sportsbar.scout.api.ScoutApiClient
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * v2.2.0 — Active periodic catalog extraction. Replaces the brittle
 * server-side TypeScript walker for apps Scout's AccessibilityService
 * can read.
 *
 * First-iteration scope: ON-DEMAND ONLY via SNAPSHOT_NOW broadcast.
 * No 6h periodic schedule yet — easier to iterate in early development.
 * Once the navigation lands cleanly on PVFTV-320, add AlarmManager
 * scheduling.
 *
 * Flow per snapshot (triggered by SnapshotCommandReceiver):
 *   1. Pending-click guard — skip if bartender's PLAY_GAME mailbox
 *      has an unsettled command.
 *   2. For each target app:
 *      a. Launch via Intent (in-process, no ADB)
 *      b. Wait for AS to observe TYPE_WINDOW_STATE_CHANGED
 *      c. Detect firebat version, choose nav path
 *      d. Run navigation (LauncherNavigator for PVFTV-320, others
 *         for older firebat / ESPN — only PVFTV-320 path implemented
 *         in this iteration)
 *      e. Snapshot the AccessibilityNodeInfo tree
 *      f. Extract candidate tiles + score
 *      g. Filter sports tiles + post to server
 *
 * Reactive click logic in PlaybackAutomationService.onAccessibilityEvent
 * is untouched. If a click comes in mid-snapshot, the click wins —
 * this service only OBSERVES the tree; it doesn't claim any locks.
 */
class CatalogSnapshotService : Service() {

    // v2.2.1 — Re-add Prime Video target via the new LauncherHomeNavigator
    // path for PVFTV-320+ Cubes (firebat resolves to launcher home, Sports
    // tab is directly in the top nav). On PVFTV-215 the navigator falls
    // back to the previous PRIME_APP_HOSTED path (which doesn't work but
    // logs diagnostics — server filter drops nav_failed payloads).
    //
    // Unlike v2.2.0 ESPN-only ship, this version uses dispatchGesture
    // (synthetic touch events that drive Compose pointerInput) as one
    // click strategy — different from ACTION_CLICK which only fires AS
    // handlers. May actually drive Compose tabs.
    //
    // ESPN remains the most-reliable target — its tile tree is AS-friendly.
    private val targets = listOf(
        SnapshotTarget("Sports Tab",  "com.amazon.firebat",      postSettleHydrationMs = 4_000L),
        SnapshotTarget("ESPN",        "com.espn.gtv",            postSettleHydrationMs = 4_000L),
    )

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification("Idle — awaiting trigger"))
        Log.i(TAG, "CatalogSnapshotService started")
        if (intent?.getBooleanExtra(EXTRA_RUN_NOW, false) == true) {
            Log.i(TAG, "Trigger: SNAPSHOT_NOW")
            Thread { runOneSnapshotCycle() }.start()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun runOneSnapshotCycle() {
        if (PlaybackAutomationService.hasPendingClickCommand()) {
            Log.i(TAG, "Skipping snapshot — bartender click in progress")
            return
        }

        val results = mutableListOf<AppSnapshotResult>()
        for (target in targets) {
            updateNotification("Snapshotting ${target.displayName}...")
            Log.i(TAG, "▶ ${target.displayName}")
            val r = snapshotOneApp(target)
            results.add(r)
            Log.i(TAG, "◀ ${target.displayName}: status=${r.status} tiles=${r.tiles.size}/${r.allTilesScanned}")
            try { Thread.sleep(2_000) } catch (_: InterruptedException) {}
        }
        postResultsWithRetry(results)
        updateNotification("Idle — last cycle ${java.time.Instant.now()}")
    }

    private fun snapshotOneApp(target: SnapshotTarget): AppSnapshotResult {
        val started = System.currentTimeMillis()

        val launched = LauncherIntent.launchPackage(this, target.pkg)
        if (!launched) {
            return AppSnapshotResult(target, "launch_failed", emptyList(), 0, started)
        }

        // Wait for the AS to see the new window. On PVFTV-320 the firebat
        // launch resolves to com.amazon.tv.launcher — accept either.
        val settledFirebat = PlaybackAutomationService.awaitWindowSettled(
            forPackage = target.pkg,
            timeoutMs = WINDOW_SETTLE_TIMEOUT_PRIME_MS,
        )
        val settledLauncher = if (!settledFirebat) {
            PlaybackAutomationService.awaitWindowSettled(
                forPackage = "com.amazon.tv.launcher",
                timeoutMs = 3_000L,
            )
        } else true
        if (!settledFirebat && !settledLauncher) {
            return AppSnapshotResult(target, "no_window_event", emptyList(), 0, started)
        }
        try { Thread.sleep(target.postSettleHydrationMs) } catch (_: InterruptedException) {}

        val fbVersion = FirebatVersionDetector.versionCodeFor(this, target.pkg)
        val navPath = FirebatVersionDetector.choosePath(target.pkg, fbVersion)
        Log.i(TAG, "${target.displayName}: firebat=${fbVersion ?: "?"} navPath=$navPath")

        val navOk = when (navPath) {
            NavPath.LAUNCHER_HOME_SPORTS_TAB -> LauncherHomeNavigator(this).gotoSportsTab()
            NavPath.PRIME_LAUNCHER_HOSTED    -> LauncherNavigator(this).gotoLiveTab()
            NavPath.PRIME_APP_HOSTED         -> AppNavigator(this).gotoPrimeVideoSports()
            NavPath.ESPN_LIVE                -> AppNavigator(this).gotoEspnLive()
            NavPath.NONE                     -> true
        }
        if (!navOk) {
            return AppSnapshotResult(target, "nav_failed", emptyList(), 0, started)
        }

        val root = PlaybackAutomationService.snapshotCurrentTree()
            ?: return AppSnapshotResult(target, "no_as_tree", emptyList(), 0, started)

        // v2.2.3 — Verify the active window's package actually matches the
        // target before extracting. Without this, when ESPN's launch fails
        // but the AS observes any other window-state event (e.g. Prime
        // Video sitting in foreground from a prior session), the snapshot
        // walks Prime Video's tree but POSTs it as ESPN — mislabeled
        // catalog rows. Greenville Cube 2026-05-09 v2.33.10 caught this.
        val activePkg = root.packageName?.toString() ?: ""
        val acceptedPkgs = when (navPath) {
            // The "Sports Tab" target's pkg is com.amazon.firebat which on
            // PVFTV-320 routes through the launcher; accept either.
            NavPath.LAUNCHER_HOME_SPORTS_TAB -> setOf(target.pkg, "com.amazon.tv.launcher")
            NavPath.PRIME_LAUNCHER_HOSTED    -> setOf(target.pkg, "com.amazon.tv.launcher")
            else -> setOf(target.pkg)
        }
        if (activePkg !in acceptedPkgs) {
            Log.w(TAG, "${target.displayName}: window package mismatch — expected ${acceptedPkgs.joinToString("|")}, got $activePkg. Skipping extraction (don't write mislabeled rows).")
            return AppSnapshotResult(target, "wrong_window", emptyList(), 0, started)
        }

        val tiles = CatalogExtractor.collectCandidateTiles(root, target.displayName)
        CatalogExtractor.dumpTopCandidates(tiles, target.displayName, top = 8)
        val sportsTiles = tiles.filter { it.sportsScore >= SPORTS_SCORE_THRESHOLD }

        return AppSnapshotResult(
            target = target,
            status = "ok",
            tiles = sportsTiles,
            allTilesScanned = tiles.size,
            startedAtMs = started,
        )
    }

    private fun postResultsWithRetry(results: List<AppSnapshotResult>) {
        val payload = buildPayloadJson(results)
        val url = MainActivity.getServerUrl(this) + "/snapshot"
        val backoffsMs = longArrayOf(1_000L, 3_000L, 9_000L)
        for ((attempt, backoff) in backoffsMs.withIndex()) {
            if (postJson(url, payload)) {
                Log.i(TAG, "Snapshot POST ok (attempt ${attempt + 1}) → $url")
                return
            }
            Log.w(TAG, "Snapshot POST !ok (attempt ${attempt + 1}); will retry in ${backoff}ms")
            if (attempt < backoffsMs.lastIndex) {
                try { Thread.sleep(backoff) } catch (_: InterruptedException) {}
            }
        }
        Log.e(TAG, "Snapshot POST failed after ${backoffsMs.size} attempts")
    }

    private fun buildPayloadJson(results: List<AppSnapshotResult>): String {
        val apps = JSONArray()
        for (r in results) {
            val tilesJson = JSONArray()
            for (t in r.tiles) {
                tilesJson.put(JSONObject(t.toJson()))
            }
            apps.put(JSONObject(mapOf(
                "app" to r.target.displayName,
                "pkg" to r.target.pkg,
                "status" to r.status,
                "tiles" to tilesJson,
                "allTilesScanned" to r.allTilesScanned,
                "durationMs" to (System.currentTimeMillis() - r.startedAtMs),
            )))
        }
        return JSONObject(mapOf(
            "scoutVersion" to MainActivity.VERSION,
            "deviceId" to MainActivity.deviceId,
            "deviceName" to MainActivity.deviceName,
            "takenAtUnix" to (System.currentTimeMillis() / 1000),
            "apps" to apps,
        )).toString()
    }

    private fun postJson(urlStr: String, body: String): Boolean = try {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 5_000
            readTimeout = 10_000
            setRequestProperty("Content-Type", "application/json")
        }
        conn.outputStream.use { it.write(body.toByteArray()) }
        val code = conn.responseCode
        conn.disconnect()
        code in 200..299
    } catch (t: Throwable) {
        Log.w(TAG, "postJson($urlStr) crashed: ${t.message}")
        false
    }

    // ─── Foreground notification UX ─────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID, "Scout Catalog",
                NotificationManager.IMPORTANCE_MIN
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun buildNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Scout Catalog")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()

    private fun updateNotification(text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        const val EXTRA_RUN_NOW = "RUN_NOW"
        private const val TAG = "CatalogSnapshot"
        private const val CHANNEL_ID = "scout_catalog_channel"
        private const val NOTIFICATION_ID = 2  // ScoutService uses 1
        private const val WINDOW_SETTLE_TIMEOUT_PRIME_MS = 18_000L
        private const val SPORTS_SCORE_THRESHOLD = 0.30
    }
}

data class SnapshotTarget(
    val displayName: String,
    val pkg: String,
    val postSettleHydrationMs: Long = 4_000L,
)

data class AppSnapshotResult(
    val target: SnapshotTarget,
    val status: String,
    val tiles: List<TileCandidate>,
    val allTilesScanned: Int,
    val startedAtMs: Long,
)
