package com.sportsbar.scout

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * v1.5.0 — Mailbox receiver for "play this game" commands from the
 * Sports Bar Controller server.
 *
 * The host issues this broadcast via ADB whenever the bartender
 * clicks Watch on a streaming game. Example:
 *
 *   adb shell am broadcast -a com.sportsbar.scout.PLAY_GAME \
 *     --es target_package com.espn.gtv \
 *     --es game_title "Houston Texans" \
 *     --es match_tokens "houston,texans" \
 *     -n com.sportsbar.scout/.PlayCommandReceiver
 *
 * We intentionally store the command in SharedPreferences rather than
 * trying to call into the AccessibilityService directly. The service
 * may not be running yet at the moment of the broadcast (e.g. ESPN's
 * window-state-changed event hasn't fired), so the prefs slot acts as
 * a write-once mailbox that the service drains on the next ESPN
 * window event. The service clears the slot after acting.
 *
 * Intent extras:
 *   target_package : Android package of the app to drive (currently
 *                    `com.espn.gtv` or `com.playon.nfhslive`).
 *   game_title     : Bartender-friendly label for logging.
 *   match_tokens   : Comma-separated lowercase tokens to look for in
 *                    on-screen tile accessibility content. The first
 *                    visible tile whose content contains ANY token
 *                    wins (token-overlap match — same policy as
 *                    v2.32.97 host-side text-targeted tap, but now
 *                    running INSIDE the device with full access to
 *                    the live UI tree, including during playback).
 *   max_attempts   : Optional. How many onAccessibilityEvent ticks to
 *                    keep trying before giving up. Default 30
 *                    (~6s at the default notificationTimeout=100ms +
 *                    the typical 100-200ms AS event cadence).
 *
 * Result handshake: PlaybackAutomationService writes back into the
 * same SharedPreferences (key `last_play_result`) so the next
 * heartbeat picks up the outcome and reports it to the host.
 */
class PlayCommandReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val targetPackage = intent.getStringExtra("target_package")?.trim().orEmpty()
        val gameTitle = intent.getStringExtra("game_title")?.trim().orEmpty()
        val matchTokens = intent.getStringExtra("match_tokens")?.trim().orEmpty()
        val maxAttempts = intent.getIntExtra("max_attempts", 30)

        if (targetPackage.isEmpty() || matchTokens.isEmpty()) {
            Log.w(
                "PlayCommandReceiver",
                "PLAY_GAME broadcast missing required extras (target_package=$targetPackage, match_tokens=$matchTokens). Ignoring.",
            )
            return
        }

        val prefs = context.getSharedPreferences("scout_play_mailbox", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("target_package", targetPackage)
            .putString("game_title", gameTitle)
            .putString("match_tokens", matchTokens.lowercase())
            .putInt("max_attempts", maxAttempts)
            .putLong("queued_at", System.currentTimeMillis())
            .putString("status", "queued")
            // Clear any prior result so the next heartbeat doesn't
            // double-report a previous run's outcome as if it were
            // this command's result.
            .remove("last_result")
            .remove("last_result_at")
            .remove("last_matched_text")
            .apply()

        Log.i(
            "PlayCommandReceiver",
            "Queued PLAY_GAME: package=$targetPackage title='$gameTitle' tokens=$matchTokens max_attempts=$maxAttempts",
        )
    }
}
