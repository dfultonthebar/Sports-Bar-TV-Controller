package com.sportsbar.scout

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * v1.5.0 — In-app navigator for ESPN / NFHS playback.
 *
 * Why this exists: every off-device approach (uiautomator-via-ADB,
 * deep links, Comrade) has one or more fatal limits:
 *   - PlayerActivity not exported → direct `am start` blocked.
 *   - sportscenter:// schemes Comrade-gated → all collapse to home.
 *   - uiautomator dumps return "could not get idle state" once a
 *     video is rendering, so we can't read overlays during playback.
 *
 * An on-device AccessibilityService bypasses all of those: we get the
 * live AccessibilityNodeInfo tree at any moment, can findAccessibility-
 * NodeInfosByText() in O(tree size), and can performAction(ACTION_CLICK)
 * on a node without DPAD coordinate guessing.
 *
 * Lifecycle:
 *   - PlayCommandReceiver writes a "play X" command to SharedPreferences.
 *   - The host launches the target app via ADB (am start LEANBACK_LAUNCHER).
 *   - Target app's window comes to the foreground → Android fires
 *     TYPE_WINDOW_STATE_CHANGED. We see it and start polling for a
 *     matching tile.
 *   - On match → click + write success to mailbox + clear pending.
 *   - On timeout (max_attempts ticks) → write failure + clear pending.
 *
 * IMPORTANT: This service NEVER reads UI tree from packages outside
 * its `packageNames` filter (declared in res/xml/playback_automation
 * _service_config.xml). The framework enforces this at the OS level.
 */
class PlaybackAutomationService : AccessibilityService() {

    @Volatile private var attemptsRemaining = 0

    // v1.5.0 — Track the queued_at timestamp of the command this loop is
    // working on. When we settle (click or timeout), we stamp a "session_id"
    // value into a private field so subsequent events for the SAME queued_at
    // are ignored. This prevents the post-click event flurry from overwriting
    // a successful result with a "no_match [null]" timeout.
    @Volatile private var settledSessionId = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val targetPackage = pendingTargetPackage() ?: return
        val eventPackage = event.packageName?.toString().orEmpty()
        if (eventPackage != targetPackage) return

        // If the mailbox no longer matches the session we're tracking, the
        // command was already settled. The mailbox status will read "settled"
        // after a click+clear; that path also bumps settledSessionId past the
        // current queued_at. Skip silently — the next legitimate command will
        // arrive with a fresh queued_at.
        val currentQueuedAt = pendingQueuedAt()
        if (currentQueuedAt == 0L || currentQueuedAt <= settledSessionId) return

        // Only act on window-state and content-changed events. View focus
        // events are too chatty.
        val type = event.eventType
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            type != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
        ) return

        if (attemptsRemaining <= 0) {
            // Initialize attempt counter on first event after queue.
            attemptsRemaining = pendingMaxAttempts().coerceIn(1, 200)
        }

        attemptsRemaining--
        try {
            tryClickMatchingTile()
        } catch (t: Throwable) {
            Log.w("PlaybackAutomation", "tryClickMatchingTile crashed: ${t.message}", t)
        }
        if (attemptsRemaining <= 0 && pendingQueuedAt() == currentQueuedAt) {
            // Out of attempts without finding a match. Only fire the no_match
            // path if the mailbox still has THIS session — a successful click
            // earlier in this same tick would have already cleared and bumped
            // settledSessionId, in which case this branch is skipped.
            val tokens = pendingMatchTokens()
            writeResult(
                "no_match",
                "Could not find a tile matching tokens [$tokens] within attempt budget",
                matchedText = "",
            )
            clearPending()
            settledSessionId = currentQueuedAt
            attemptsRemaining = 0
        }
    }

    override fun onInterrupt() {
        // Required override; no-op.
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i("PlaybackAutomation", "Connected (Scout v1.5.0). Watching ESPN/NFHS/firebat.")
        // If a command was queued before we connected, kick the loop.
        if (pendingTargetPackage() != null) {
            attemptsRemaining = pendingMaxAttempts()
        }
    }

    private fun tryClickMatchingTile() {
        val tokensCsv = pendingMatchTokens() ?: return
        val tokens = tokensCsv.split(",")
            .map { it.trim().lowercase() }
            .filter { it.length >= 2 }
        if (tokens.isEmpty()) {
            writeResult("bad_tokens", "Token list was empty after parsing", matchedText = "")
            clearPending()
            attemptsRemaining = 0
            return
        }

        val root = rootInActiveWindow ?: return
        // Walk the tree. Score every node by how many tokens appear in
        // its text + content-desc. Keep the highest-scoring one whose
        // node OR an ancestor is clickable (we may need to walk up to
        // find the actual clickable container — ESPN tile content is
        // usually in a non-clickable child of a clickable RecyclerView
        // item).
        var best: ScoredNode? = null
        scoreTree(root, tokens) { candidate ->
            if (best == null || candidate.score > best!!.score) best = candidate
        }
        if (best == null) {
            // No matching node visible in this tick. Will retry on next
            // accessibility event.
            return
        }

        val matchedText = best!!.text.take(160)
        val clickable = findClickableAncestor(best!!.node)
        if (clickable == null) {
            // The matching node is in a tree with no clickable ancestor.
            // Fall back to a synthetic tap at the bounds center via
            // dispatchGesture (canPerformGestures=true is declared in
            // service config). Skipping the gesture path for v1.5.0;
            // ESPN/NFHS tiles consistently have clickable RecyclerView
            // ancestors. If we hit this in production, add the gesture
            // tap.
            Log.w(
                "PlaybackAutomation",
                "Match found but no clickable ancestor: '$matchedText'. Will retry next tick.",
            )
            return
        }
        val ok = clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        Log.i(
            "PlaybackAutomation",
            "Click ${if (ok) "ok" else "FAILED"}: matched='$matchedText' (score=${best!!.score}/${tokens.size})",
        )
        writeResult(
            if (ok) "clicked" else "click_failed",
            if (ok) "Clicked tile matching ${tokens.size}-token query" else "performAction(ACTION_CLICK) returned false",
            matchedText = matchedText,
        )
        // v1.5.0 — Capture the current session's queued_at BEFORE clearing
        // so settledSessionId is set correctly. clearPending() removes the
        // queued_at entry, so we'd read 0 if we read after.
        val sessionId = pendingQueuedAt()
        clearPending()
        settledSessionId = sessionId
        attemptsRemaining = 0
    }

    private data class ScoredNode(val node: AccessibilityNodeInfo, val text: String, val score: Int)

    private fun scoreTree(
        root: AccessibilityNodeInfo,
        tokens: List<String>,
        emit: (ScoredNode) -> Unit,
    ) {
        // BFS — bounded to keep us from pathological trees.
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 5000) {
            val n = queue.removeFirst()
            visited++
            val txt = (n.text?.toString().orEmpty() + " " + n.contentDescription?.toString().orEmpty())
                .lowercase()
                .trim()
            if (txt.isNotEmpty()) {
                val score = tokens.count { txt.contains(it) }
                if (score > 0) {
                    // Only report nodes that are visible on screen.
                    val rect = Rect()
                    n.getBoundsInScreen(rect)
                    if (rect.width() > 50 && rect.height() > 30) {
                        emit(ScoredNode(n, txt, score))
                    }
                }
            }
            for (i in 0 until n.childCount) {
                n.getChild(i)?.let { queue.add(it) }
            }
        }
    }

    private fun findClickableAncestor(start: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var cur: AccessibilityNodeInfo? = start
        var hops = 0
        while (cur != null && hops < 12) {
            if (cur.isClickable) return cur
            cur = cur.parent
            hops++
        }
        return null
    }

    // -------------- mailbox helpers --------------

    private fun mailbox(): android.content.SharedPreferences =
        getSharedPreferences("scout_play_mailbox", Context.MODE_PRIVATE)

    private fun pendingTargetPackage(): String? {
        val p = mailbox().getString("target_package", null)?.trim().orEmpty()
        return if (p.isEmpty()) null else p
    }

    private fun pendingMatchTokens(): String? {
        val t = mailbox().getString("match_tokens", null)?.trim().orEmpty()
        return if (t.isEmpty()) null else t
    }

    private fun pendingMaxAttempts(): Int =
        mailbox().getInt("max_attempts", 30)

    private fun pendingQueuedAt(): Long =
        mailbox().getLong("queued_at", 0L)

    private fun clearPending() {
        mailbox().edit()
            .remove("target_package")
            .remove("game_title")
            .remove("match_tokens")
            .remove("max_attempts")
            .remove("queued_at")
            .putString("status", "settled")
            .apply()
    }

    private fun writeResult(result: String, message: String, matchedText: String) {
        mailbox().edit()
            .putString("last_result", result)
            .putString("last_message", message)
            .putString("last_matched_text", matchedText)
            .putLong("last_result_at", System.currentTimeMillis())
            .apply()
        Log.i(
            "PlaybackAutomation",
            "Result=$result message='$message' matched='$matchedText'",
        )
    }
}
