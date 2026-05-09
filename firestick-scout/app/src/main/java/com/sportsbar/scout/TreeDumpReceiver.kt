package com.sportsbar.scout

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * v2.2.1 — Diagnostic broadcast receiver: dumps the current
 * AccessibilityNodeInfo tree to logcat AND POSTs the JSON payload to
 * scoutServerUrl/tree-dump.
 *
 * Why: PVFTV-320 launcher's Sports tab navigation is the unknown.
 * Instead of guessing selectors, capture ONE real tree dump from a
 * Lucky's Cube, paste it into the next session, and write perfect
 * selectors from ground truth.
 *
 * Trigger:
 *   adb shell "am broadcast -a com.sportsbar.scout.ACTION_DUMP_LAUNCHER_TREE \
 *     -n com.sportsbar.scout/.TreeDumpReceiver"
 *
 * Optional extras:
 *   --es trigger "manual_lucky_cube_1"  → string label appears in JSON.trigger
 *
 * The receiver does work asynchronously via goAsync() so the broadcast
 * completes immediately; the actual dump + HTTP POST runs on a worker
 * thread (broadcast receivers can do up to ~10s of background work
 * before the OS kills them).
 */
class TreeDumpReceiver : BroadcastReceiver() {

    private val TAG = "TreeDumpReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_DUMP_LAUNCHER_TREE &&
            intent.action != ACTION_DUMP_AS_TREE) {
            Log.w(TAG, "Unknown action: ${intent.action}")
            return
        }
        val trigger = intent.getStringExtra("trigger") ?: intent.action ?: "unknown"
        val pendingResult = goAsync()

        // Snapshot the current AS tree on a worker thread. Broadcast
        // receivers run on the main thread by default — must NOT block
        // it with an HTTP POST.
        Thread {
            try {
                val root = PlaybackAutomationService.snapshotCurrentTree()
                if (root == null) {
                    Log.w(TAG, "Cannot dump: AS not connected. Enable accessibility for Scout: " +
                        "adb shell settings put secure enabled_accessibility_services " +
                        "com.sportsbar.scout/com.sportsbar.scout.PlaybackAutomationService; " +
                        "adb shell settings put secure accessibility_enabled 1")
                }
                val payload = TreeDumper.dumpTree(root, trigger)
                postDump(context, payload)
            } catch (t: Throwable) {
                Log.e(TAG, "TreeDumpReceiver crashed: ${t.message}", t)
            } finally {
                pendingResult.finish()
            }
        }.start()
    }

    private fun postDump(context: Context, payload: JSONObject) {
        val baseUrl = MainActivity.getServerUrl(context)
        if (baseUrl.isEmpty()) {
            Log.w(TAG, "scoutServerUrl not configured — skipping POST. JSON dumped to logcat only.")
            return
        }
        val url = "$baseUrl/tree-dump"
        try {
            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 5_000
                readTimeout = 15_000
                setRequestProperty("Content-Type", "application/json")
            }
            val body = payload.toString()
            conn.outputStream.use { it.write(body.toByteArray()) }
            val code = conn.responseCode
            conn.disconnect()
            if (code in 200..299) {
                Log.i(TAG, "Tree dump POST ok ($code) → $url (bytes=${body.length} nodes=${payload.optInt("nodeCount")})")
            } else {
                Log.w(TAG, "Tree dump POST returned $code → $url")
            }
        } catch (t: Throwable) {
            Log.w(TAG, "Tree dump POST crashed: ${t.message} → $url")
        }
    }

    companion object {
        const val ACTION_DUMP_LAUNCHER_TREE = "com.sportsbar.scout.ACTION_DUMP_LAUNCHER_TREE"
        const val ACTION_DUMP_AS_TREE = "com.sportsbar.scout.ACTION_DUMP_AS_TREE"
    }
}
