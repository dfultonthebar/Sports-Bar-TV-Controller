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

    // v2.2.0 — Track most-recent window-state events so an active extractor
    // (CatalogSnapshotService) can wait for an Intent.startActivity to
    // actually render before walking the tree. Filled by onAccessibilityEvent
    // for ANY package in our packageNames filter, regardless of whether a
    // PLAY_GAME mailbox command is pending.
    @Volatile private var lastWindowSettledAtMs = 0L
    @Volatile private var lastWindowPackage: String = ""

    // v2.2.6 — After a successful tile click, ESPN / MLB.TV / Prime Video
    // sometimes show a "Watch Live" vs "Watch from the Beginning" sheet
    // for in-progress live events. Bartender always wants "Watch Live"
    // (operator: 2026-05-11 reported the prompt sitting unanswered).
    // Set this to (now + 12s) after a successful tile click; window
    // during which onAccessibilityEvent looks for live-vs-replay buttons
    // and clicks "Watch Live" / "Resume" / "Continue Watching".
    @Volatile private var watchLivePromptUntilMs = 0L

    // v2.2.9 — Scrolling state for tile-visibility. When the target tile
    // isn't visible on the current screen, we swipe horizontally (right-
    // to-left, surfacing tiles further down a rail) and retry. Track how
    // many swipes we've already attempted for the current session so we
    // bound the search and don't loop forever.
    @Volatile private var scrollAttempts = 0
    private val MAX_SCROLL_ATTEMPTS = 4
    // Only swipe every Nth event tick — gives the rail time to settle
    // between swipes so the AS tree refreshes with the new tiles.
    @Volatile private var ticksSinceLastScroll = 0
    private val TICKS_BETWEEN_SCROLLS = 5

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // v2.2.0 — record window-settle events for ANY watched package
        // (independent of whether a PLAY_GAME mailbox command is pending).
        // Active-extraction service uses this to wait for app launches.
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            event.eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED
        ) {
            lastWindowSettledAtMs = System.currentTimeMillis()
            lastWindowPackage = event.packageName?.toString().orEmpty()
        }

        // v2.2.6 + v2.2.8 + v2.2.10 — Watch-Live prompt handler. Two
        // arm paths now:
        //   (a) Recent tile-click (12-30s window via watchLivePromptUntilMs)
        //   (b) Passive detect: when both a "Watch live"-like label AND
        //       a sibling co-label (Watchlist/Start Over/From Beginning/
        //       Resume) are visible, it's an in-progress-live prompt
        //       regardless of how the app got launched.
        // Path (b) catches Prime Video launches that go through the
        // server's launchStreamingAppByCatalog flow instead of Scout's
        // PLAY_GAME mailbox (operator-reported 2026-05-11 ATP/WTA case).
        val t = event.eventType
        val isRelevantEvent = t == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            t == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
            t == AccessibilityEvent.TYPE_VIEW_FOCUSED ||
            t == AccessibilityEvent.TYPE_VIEW_SELECTED
        if (isRelevantEvent) {
            val withinArmedWindow = System.currentTimeMillis() < watchLivePromptUntilMs
            val passivePromptDetected = !withinArmedWindow && isLiveVsResumePromptVisible()
            if (withinArmedWindow || passivePromptDetected) {
                try { tryClickWatchLiveButton() } catch (e: Throwable) {
                    Log.w("PlaybackAutomation", "tryClickWatchLiveButton crashed: ${e.message}")
                }
            }
        }

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
            // v2.2.9 — Reset scroll state for the new session
            scrollAttempts = 0
            ticksSinceLastScroll = 0
        }

        attemptsRemaining--
        ticksSinceLastScroll++
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
        instance = this
        Log.i("PlaybackAutomation", "Connected (Scout v2.2.0). Watching ESPN/NFHS/firebat/launcher. instance attached for snapshot use.")
        // If a command was queued before we connected, kick the loop.
        if (pendingTargetPackage() != null) {
            attemptsRemaining = pendingMaxAttempts()
        }
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        if (instance === this) instance = null
        return super.onUnbind(intent)
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

        // v2.2.7 — Reject low-confidence matches. Operator caught this
        // 2026-05-11: Scout was clicking "Films & Shows" navigation tile
        // (score 2/9) for a Pat McAfee Show query, then ESPN navigated
        // to the wrong section showing "Where It Lies" docs. Require at
        // least 50% of tokens matched OR absolute >= 3 matches, whichever
        // is higher. Below that, retry — the right tile may not have
        // rendered yet, and clicking a wrong tile is worse than waiting.
        val minMatchScore = maxOf(3, (tokens.size + 1) / 2)
        if (best!!.score < minMatchScore) {
            // v2.2.9 — Confidence below threshold. Maybe the right tile is
            // off-screen in a horizontal rail. Try swiping right-to-left
            // every TICKS_BETWEEN_SCROLLS attempts to expose more tiles.
            if (scrollAttempts < MAX_SCROLL_ATTEMPTS &&
                ticksSinceLastScroll >= TICKS_BETWEEN_SCROLLS) {
                scrollAttempts++
                ticksSinceLastScroll = 0
                Log.i(
                    "PlaybackAutomation",
                    "Low-confidence match (${best!!.score}/${tokens.size}). Swiping right-to-left to expose more tiles (attempt $scrollAttempts/$MAX_SCROLL_ATTEMPTS)",
                )
                dispatchHorizontalSwipe()
            } else {
                Log.d(
                    "PlaybackAutomation",
                    "Skipping low-confidence match: '${best!!.text.take(60)}' (score=${best!!.score}/${tokens.size}, need >= $minMatchScore)",
                )
            }
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

        // v2.2.6 — After a successful tile click, arm the watch-live
        // prompt handler. ESPN typically takes 1-3s to render the live-vs-
        // beginning sheet; give it a 12s window to appear and we'll auto-
        // click "Watch Live".
        if (ok) {
            // v2.2.8 — Extended from 12s to 30s. ESPN's resume sheet can
            // take 5-15s to render after the tile click (live stream
            // probing, manifest fetch, etc.). The 12s window was
            // sometimes expiring before the sheet appeared, especially
            // on PVFTV-320 Cubes. 30s covers the slow-render case.
            watchLivePromptUntilMs = System.currentTimeMillis() + 30_000L
            Log.i("PlaybackAutomation", "Watch-Live prompt handler armed for 30s post-click")
        }
    }

    /**
     * v2.2.10 — Passive detection of in-progress-live prompt pages.
     * Returns true when the visible AS tree contains BOTH a "Watch
     * Live" label AND at least one sibling co-label (Watchlist /
     * Start Over / Watch from the Beginning / From Beginning /
     * Restart / Resume / Continue Watching). That co-occurrence is
     * a strong signal we're on a live-event detail / resume sheet
     * — common to ESPN, Prime Video, Peacock, MLB.TV.
     *
     * Avoids false-positives where a screen has a bare "Watch live"
     * banner ad or marketing copy: those screens lack the sibling
     * "Watchlist" / "Start over" buttons.
     */
    private fun isLiveVsResumePromptVisible(): Boolean {
        val root = rootInActiveWindow ?: return false
        // Only run for our target packages — packageNames in the AS
        // config restricts events to those, but rootInActiveWindow
        // could be something else briefly during transitions.
        val pkg = root.packageName?.toString().orEmpty()
        if (pkg !in setOf("com.espn.gtv", "com.amazon.firebat", "com.amazon.tv.launcher", "com.playon.nfhslive")) {
            return false
        }
        var sawWatchLive = false
        var sawCoLabel = false
        val coLabels = listOf("watchlist", "start over", "from the beginning",
            "from beginning", "restart", "resume", "continue watching")
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000 && (!sawWatchLive || !sawCoLabel)) {
            val n = queue.removeFirst()
            visited++
            val text = ((n.text?.toString() ?: "") + " " + (n.contentDescription?.toString() ?: ""))
                .trim().lowercase()
            if (text.isNotEmpty()) {
                if (!sawWatchLive && (text.contains("watch live") ||
                                       text.contains("join live") ||
                                       text.contains("go live"))) {
                    sawWatchLive = true
                }
                if (!sawCoLabel && coLabels.any { text.contains(it) }) {
                    sawCoLabel = true
                }
            }
            for (i in 0 until n.childCount) {
                n.getChild(i)?.let { queue.add(it) }
            }
        }
        return sawWatchLive && sawCoLabel
    }

    /**
     * v2.2.9 — Swipe horizontally right-to-left across the active
     * rail to expose tiles that are off-screen. Used when the
     * tile-match's best score is below the confidence threshold —
     * the right tile may be further down the rail.
     *
     * Swipe path: from (right edge - 200) to (left edge + 200) at
     * mid-screen height. Duration 300ms — fast enough to be a "fling"
     * gesture that scrolls one rail-page, slow enough that Compose
     * recognizes it as a horizontal scroll vs a flick-click.
     */
    private fun dispatchHorizontalSwipe() {
        val rootBounds = android.graphics.Rect()
        rootInActiveWindow?.getBoundsInScreen(rootBounds) ?: return
        if (rootBounds.width() <= 400 || rootBounds.height() <= 200) return

        // Find the FOCUSED row to swipe inside its bounds. Otherwise
        // swipe at mid-screen which is usually a content rail on
        // Fire TV apps.
        val focused = findFocusedNode(rootInActiveWindow)
        val focusedRow = focused?.let { walkToHorizontalRowAncestor(it) }
        val rowRect = if (focusedRow != null) {
            val r = android.graphics.Rect()
            focusedRow.getBoundsInScreen(r); r
        } else {
            android.graphics.Rect(0, rootBounds.height() / 2 - 100, rootBounds.width(), rootBounds.height() / 2 + 100)
        }
        val cy = rowRect.exactCenterY()
        val startX = (rootBounds.right - 200).toFloat().coerceAtLeast(0f)
        val endX = (rootBounds.left + 200).toFloat()
        try {
            val path = android.graphics.Path().apply {
                moveTo(startX, cy)
                lineTo(endX, cy)
            }
            val stroke = android.accessibilityservice.GestureDescription.StrokeDescription(path, 0L, 300L)
            val gesture = android.accessibilityservice.GestureDescription.Builder().addStroke(stroke).build()
            dispatchGesture(gesture, null, null)
        } catch (t: Throwable) {
            Log.w("PlaybackAutomation", "dispatchHorizontalSwipe crashed: ${t.message}")
        }
    }

    private fun findFocusedNode(root: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (root == null) return null
        if (root.isFocused) return root
        for (i in 0 until root.childCount) {
            root.getChild(i)?.let { findFocusedNode(it)?.let { f -> return f } }
        }
        return null
    }

    /** Walk up parents to find a node likely to be a horizontal rail
     *  (wide and short). Used to scope the swipe gesture so we scroll
     *  within the row that has focus, not the whole screen. */
    private fun walkToHorizontalRowAncestor(start: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var cur: AccessibilityNodeInfo? = start
        var hops = 0
        while (cur != null && hops < 8) {
            val r = android.graphics.Rect()
            cur.getBoundsInScreen(r)
            if (r.width() > 1000 && r.height() < 500) return cur
            cur = cur.parent
            hops++
        }
        return null
    }

    /**
     * v2.2.6 — After a successful tile click, the streaming app may show
     * a "Watch Live" vs "Watch from the Beginning" sheet. Find the
     * "Watch Live" button and tap it.
     *
     * v2.2.8 — ESPN built these as Compose buttons with isClickable=false
     * AND isFocusable=false on every node (the buttons accept DPAD CENTER
     * when focused, but no accessibility-clickable flags). Strategy now:
     *
     *   1. Find a node (any node) whose text/desc matches "Watch Live"
     *      (or fallback labels), regardless of clickable/focusable flags
     *   2. Try ACTION_CLICK on it AND its ancestors (fast no-op for Compose)
     *   3. Use dispatchGesture to send a synthetic touch tap at the
     *      button's bounds center — this drives Compose's pointerInput
     *      modifier and reliably activates the button
     *
     * Strategy: BFS the active tree, find the first node whose text/desc
     * matches a preferred-button label. Preferred order:
     * "Watch Live" > "Resume" > "Continue Watching" > bare "Live".
     * Avoid "Watch from the Beginning" / "Start Over" / "From Beginning".
     */
    private fun tryClickWatchLiveButton() {
        val root = rootInActiveWindow ?: return

        val preferred = listOf(
            "watch live",
            "continue watching live",
            "resume live",
            "continue watching",
            "resume",
            "join live",
            "go live",
        )
        val rejected = listOf(
            "watch from the beginning",
            "from the beginning",
            "start over",
            "from beginning",
            "start from beginning",
        )

        // BFS — v2.2.8 now collects ALL matching nodes regardless of
        // clickable/focusable flags. ESPN's Compose buttons set both
        // to false; the click happens via dispatchGesture tap, not
        // ACTION_CLICK.
        val candidates = mutableListOf<Pair<AccessibilityNodeInfo, String>>()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < 3000) {
            val n = queue.removeFirst()
            visited++
            val text = ((n.text?.toString() ?: "") + " " + (n.contentDescription?.toString() ?: ""))
                .trim().lowercase()
            if (text.isNotEmpty()) {
                if (rejected.any { text.contains(it) }) {
                    // skip
                } else if (preferred.any { text.contains(it) }) {
                    candidates.add(n to text)
                }
            }
            for (i in 0 until n.childCount) {
                n.getChild(i)?.let { queue.add(it) }
            }
        }
        if (candidates.isEmpty()) return

        var best: AccessibilityNodeInfo? = null
        var bestPriority = preferred.size
        var bestText = ""
        for ((node, text) in candidates) {
            for ((i, p) in preferred.withIndex()) {
                if (text.contains(p) && i < bestPriority) {
                    best = node
                    bestPriority = i
                    bestText = text
                }
            }
        }
        if (best == null) return

        // Try fast path: ACTION_CLICK on node or any clickable ancestor.
        if (best!!.isClickable) {
            if (best!!.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                Log.i("PlaybackAutomation", "Watch-Live ACTION_CLICK ok: '$bestText'")
                watchLivePromptUntilMs = 0L
                return
            }
        }
        val clickAncestor = findClickableAncestor(best!!)
        if (clickAncestor != null && clickAncestor.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            Log.i("PlaybackAutomation", "Watch-Live ancestor ACTION_CLICK ok: '$bestText'")
            watchLivePromptUntilMs = 0L
            return
        }

        // Fallback: dispatchGesture tap at the matched node's bounds
        // center. This is what makes ESPN's Compose buttons actually
        // activate. Required canPerformGestures=true (declared in
        // service config).
        val bounds = android.graphics.Rect()
        best!!.getBoundsInScreen(bounds)
        if (bounds.width() <= 0 || bounds.height() <= 0) {
            Log.w("PlaybackAutomation", "Watch-Live match '$bestText' has zero bounds — can't tap")
            return
        }
        val cx = bounds.exactCenterX()
        val cy = bounds.exactCenterY()
        try {
            val path = android.graphics.Path().apply { moveTo(cx, cy) }
            val stroke = android.accessibilityservice.GestureDescription.StrokeDescription(
                path, 0L, 100L
            )
            val gesture = android.accessibilityservice.GestureDescription.Builder()
                .addStroke(stroke).build()
            val ok = dispatchGesture(gesture, null, null)
            Log.i(
                "PlaybackAutomation",
                "Watch-Live dispatchGesture tap at ($cx,$cy) ${if (ok) "ok" else "FAILED"}: '$bestText'",
            )
            if (ok) watchLivePromptUntilMs = 0L
        } catch (t: Throwable) {
            Log.w("PlaybackAutomation", "Watch-Live dispatchGesture crashed: ${t.message}")
        }
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

    // ─── v2.2.0: companion entry points for active extraction ────────

    companion object {
        @Volatile private var instance: PlaybackAutomationService? = null

        /** AccessibilityService instance for navigators that need
         *  performGlobalAction / findFocus access. Null when AS isn't
         *  currently bound (e.g. operator hasn't toggled accessibility
         *  on after install). */
        fun instanceForNav(): AccessibilityService? = instance

        /**
         * Block until we observe a TYPE_WINDOW_STATE_CHANGED event
         * for [forPackage], or timeoutMs elapses. Used by the snapshot
         * service to know when an Intent.startActivity has actually
         * rendered before we try to walk the tree.
         *
         * Returns true if the package was observed within the window;
         * false on timeout or AS not connected.
         */
        fun awaitWindowSettled(forPackage: String, timeoutMs: Long): Boolean {
            val deadline = System.currentTimeMillis() + timeoutMs
            val startedAt = System.currentTimeMillis()
            while (System.currentTimeMillis() < deadline) {
                val svc = instance ?: return false
                if (svc.lastWindowPackage == forPackage &&
                    svc.lastWindowSettledAtMs >= startedAt
                ) {
                    return true
                }
                try { Thread.sleep(150) } catch (_: InterruptedException) {}
            }
            return false
        }

        /**
         * Snapshot the current accessibility tree. Calls refresh() on
         * the root before returning so callers get current state — without
         * this, focus/text checks done milliseconds after a navigation
         * event return stale data and verify-gates flap.
         *
         * Returns null when AS isn't connected.
         */
        fun snapshotCurrentTree(): AccessibilityNodeInfo? {
            val root = instance?.rootInActiveWindow ?: return null
            try { root.refresh() } catch (_: Throwable) {}
            return root
        }

        /**
         * True if a bartender PLAY_GAME mailbox command is pending +
         * unsettled. CatalogSnapshotService checks this before starting
         * a cycle so the snapshot loop doesn't fight a real bartender
         * click for the screen.
         */
        fun hasPendingClickCommand(): Boolean {
            val svc = instance ?: return false
            val pending = svc.pendingTargetPackage()
            val queuedAt = svc.pendingQueuedAt()
            return pending != null && queuedAt > svc.settledSessionId
        }
    }
}
