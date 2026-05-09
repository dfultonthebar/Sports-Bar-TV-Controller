package com.sportsbar.scout

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo

/**
 * v2.2.1 — Navigator for PVFTV-320+ launcher home, where the redesigned
 * 2026 Fire TV launcher places aggregated content tabs (Home / Movies /
 * TV Shows / Sports / Live / News / Subscriptions) directly in the top
 * navigation bar. The Sports tab aggregates content from Prime Video,
 * ESPN+, Paramount+, etc. — no need to launch the Prime Video app
 * first like we used to on PVFTV-215 and earlier.
 *
 * Strategy stack (tries each in order until one succeeds):
 *
 *   1. Find a top-nav node (y < 200) whose text/desc equals or contains
 *      "Sports" — try ACTION_FOCUS, then ACTION_CLICK, then a synthetic
 *      gesture tap at the node's bounds center via dispatchGesture.
 *      The gesture path is THE one that drives Compose UIs (real touch
 *      event reaches View.onTouchEvent / pointerInput modifiers; this
 *      is different from ACTION_CLICK which only fires AS handlers).
 *
 *   2. If no top-nav "Sports" node found, look for a horizontal
 *      RecyclerView at y < 200 (the tab strip itself) and dispatchGesture
 *      a left-to-right swipe to expose tabs that may be off-screen.
 *
 *   3. Find the bounds-contained clickable ancestor with implausibly-
 *      large rejection (h<200, w<600) — avoids hitting unrelated parent
 *      containers in the same Compose tree.
 *
 *   4. Last resort: ACTION_ACCESSIBILITY_FOCUS chain ("TalkBack-style"
 *      virtual focus traversal). Some Compose builds activate on
 *      accessibility focus.
 *
 * Verify gate (HARD): after the click, the focused/selected tab must
 * say "Sports" — not Home/Movies/TV/etc. We REJECT the launcher home's
 * default "Home, Tab, Selected, ..." pattern. Soft gates: known sports
 * section headers ("Live now", "Sports for you", "NBA on Prime") OR
 * count of `vs.` patterns >= 2.
 */
class LauncherHomeNavigator(private val ctx: Context) {

    private val service: AccessibilityService?
        get() = PlaybackAutomationService.instanceForNav()

    fun gotoSportsTab(): Boolean {
        val svc = service ?: run {
            Log.w(TAG, "AS not connected — can't navigate")
            return false
        }
        Log.i(TAG, "PVFTV-320 launcher home → Sports tab navigation begin")

        // Wait for the launcher to settle — the redesigned home renders
        // top tabs first (~400ms after window state change) then
        // hydrates content rows over the next 2-3s.
        sleep(POST_SETTLE_DELAY_MS)

        // Strategy 1: direct text match in top-nav region
        val sportsNode = findTopNavSportsNode(svc)
        if (sportsNode != null) {
            val r = Rect()
            sportsNode.getBoundsInScreen(r)
            Log.i(TAG, "S1: Found Sports tab in top nav at bounds=[${r.left},${r.top}][${r.right},${r.bottom}] (cls=${sportsNode.className}, click=${sportsNode.isClickable}, focus=${sportsNode.isFocusable})")

            // Try in order: ACTION_FOCUS, ACTION_CLICK on node, ancestor walk, gesture tap
            if (tryAllClickStrategies(svc, sportsNode)) {
                sleep(SPORTS_TAB_RENDER_DELAY_MS)
                if (verifySportsActive(svc)) {
                    Log.i(TAG, "S1: Sports tab navigation succeeded.")
                    return true
                }
                Log.w(TAG, "S1: clicks fired but verify gate rejected — Sports tab not active.")
            } else {
                Log.w(TAG, "S1: All click strategies failed for Sports node.")
            }
        } else {
            Log.w(TAG, "S1: no top-nav Sports node visible.")
        }

        // Strategy 2: horizontal scroll the tab RecyclerView in case
        // Sports is off-screen in a paginated tab strip.
        if (tryScrollTabStripRight(svc)) {
            sleep(800)
            val sportsNodeAfterScroll = findTopNavSportsNode(svc)
            if (sportsNodeAfterScroll != null) {
                Log.i(TAG, "S2: Sports node revealed after scroll; clicking…")
                if (tryAllClickStrategies(svc, sportsNodeAfterScroll)) {
                    sleep(SPORTS_TAB_RENDER_DELAY_MS)
                    if (verifySportsActive(svc)) {
                        Log.i(TAG, "S2: Sports tab navigation succeeded after scroll.")
                        return true
                    }
                }
            }
        }

        // Strategy 3: try the Sports text-search fallback ANYWHERE in
        // tree (not just top-nav) — some launcher builds may put the
        // tab strip outside our y<200 cutoff at smaller resolutions.
        val anywhereSports = findAnywhereSportsTab(svc)
        if (anywhereSports != null) {
            val r = Rect()
            anywhereSports.getBoundsInScreen(r)
            Log.i(TAG, "S3: Found Sports candidate anywhere in tree at bounds=[${r.left},${r.top}][${r.right},${r.bottom}]")
            if (tryAllClickStrategies(svc, anywhereSports)) {
                sleep(SPORTS_TAB_RENDER_DELAY_MS)
                if (verifySportsActive(svc)) {
                    Log.i(TAG, "S3: Sports tab navigation succeeded.")
                    return true
                }
            }
        }

        dumpTopOfTree(svc, "All strategies exhausted; no Sports tab activation.")
        return false
    }

    // ─── click strategy stack ─────────────────────────────────────

    private fun tryAllClickStrategies(svc: AccessibilityService, node: AccessibilityNodeInfo): Boolean {
        val r = Rect()
        node.getBoundsInScreen(r)

        // 1a. ACTION_FOCUS on node — Compose tab's focus listener may activate it
        if (node.isFocusable && node.performAction(AccessibilityNodeInfo.ACTION_FOCUS)) {
            sleep(150)
            if (isSportsSelected(svc)) {
                Log.i(TAG, "click: ACTION_FOCUS on node activated tab")
                return true
            }
        }

        // 1b. ACTION_CLICK on node directly
        if (node.isClickable && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            sleep(200)
            if (isSportsSelected(svc)) {
                Log.i(TAG, "click: ACTION_CLICK on node activated tab")
                return true
            }
        }

        // 1c. Bounds-contained clickable ancestor
        val ancestor = findBoundsContainedClickableAncestor(node, r, maxHeight = 200, maxWidth = 600)
        if (ancestor != null && ancestor.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            sleep(200)
            if (isSportsSelected(svc)) {
                Log.i(TAG, "click: bounds-contained ancestor ACTION_CLICK activated tab")
                return true
            }
        }

        // 1d. Synthetic gesture tap at bounds center — THIS is what drives
        // Compose pointerInput / View.onTouchEvent. Different code path
        // from ACTION_CLICK. Requires canPerformGestures="true" in
        // service config (already declared).
        if (Build.VERSION.SDK_INT >= 24 && r.width() > 0 && r.height() > 0) {
            val cx = r.exactCenterX()
            val cy = r.exactCenterY()
            if (dispatchTap(svc, cx, cy)) {
                sleep(250)
                if (isSportsSelected(svc)) {
                    Log.i(TAG, "click: dispatchGesture tap at ($cx, $cy) activated tab")
                    return true
                }
            }
        }

        // 1e. ACTION_ACCESSIBILITY_FOCUS (TalkBack-style) — last resort
        if (node.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS)) {
            sleep(200)
            if (node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                sleep(200)
                if (isSportsSelected(svc)) {
                    Log.i(TAG, "click: a11y-focus + ACTION_CLICK activated tab")
                    return true
                }
            }
        }

        return false
    }

    private fun dispatchTap(svc: AccessibilityService, x: Float, y: Float): Boolean {
        return try {
            val path = Path().apply { moveTo(x, y) }
            val stroke = GestureDescription.StrokeDescription(path, /*startTime*/ 0L, /*duration*/ 80L)
            val gesture = GestureDescription.Builder().addStroke(stroke).build()
            val latch = Object()
            var result = false
            svc.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(g: GestureDescription?) {
                    synchronized(latch) { result = true; latch.notifyAll() }
                }
                override fun onCancelled(g: GestureDescription?) {
                    synchronized(latch) { result = false; latch.notifyAll() }
                }
            }, Handler(Looper.getMainLooper()))
            synchronized(latch) {
                try { latch.wait(2_000L) } catch (_: InterruptedException) {}
            }
            result
        } catch (t: Throwable) {
            Log.w(TAG, "dispatchTap crashed: ${t.message}")
            false
        }
    }

    // ─── tab discovery ────────────────────────────────────────────

    private fun findTopNavSportsNode(svc: AccessibilityService): AccessibilityNodeInfo? {
        // v2.2.1 (Holmgren Cube 2 PVFTV-215 dump 2026-05-09):
        // Launcher tabs aren't always at y<200 — Holmgren's are at y=532
        // (Find / Home / Live / News on a horizontal strip). PVFTV-320
        // may place them differently again. So we walk the WHOLE tree
        // and collect every focusable+clickable node whose text/desc is
        // exactly "Sports", then return the best candidate by:
        //   - prefer focusable AND clickable
        //   - prefer height < 200 (a tile is taller; a tab is shorter)
        //   - prefer leftmost-and-topmost position (tabs are usually
        //     in the upper half of the screen)
        for (attempt in 1..ROOT_RETRIES) {
            val root = freshRoot(svc)
            if (root != null) {
                val candidates = mutableListOf<Pair<AccessibilityNodeInfo, Rect>>()
                traverseLimited(root, 4000) { n ->
                    if (!hasTextExact(n, "Sports")) return@traverseLimited
                    val r = Rect()
                    n.getBoundsInScreen(r)
                    if (r.width() <= 0 || r.height() <= 0) return@traverseLimited
                    if (r.height() > 250) return@traverseLimited  // too tall = a content card
                    candidates.add(n to r)
                }
                if (candidates.isNotEmpty()) {
                    val best = candidates.maxByOrNull { (n, r) ->
                        var score = 0.0
                        if (n.isFocusable) score += 5.0
                        if (n.isClickable) score += 5.0
                        if (n.isVisibleToUser) score += 2.0
                        // Topmost & leftmost = tab strip (most launchers put tabs in upper half)
                        score -= r.top * 0.001
                        score -= r.left * 0.0005
                        score
                    }!!
                    Log.i(TAG, "Sports tab candidate: ${candidates.size} match(es), best at bounds=[${best.second.left},${best.second.top}][${best.second.right},${best.second.bottom}] (focus=${best.first.isFocusable} click=${best.first.isClickable})")
                    return best.first
                }
            }
            sleep(700)
        }
        return null
    }

    private fun hasTextExact(n: AccessibilityNodeInfo, target: String): Boolean {
        val t = (n.text?.toString() ?: "").trim()
        val d = (n.contentDescription?.toString() ?: "").trim()
        return t.equals(target, ignoreCase = true) || d.equals(target, ignoreCase = true)
    }

    private fun findAnywhereSportsTab(svc: AccessibilityService): AccessibilityNodeInfo? {
        val root = freshRoot(svc) ?: return null
        // Prefer the Sports candidate that's MOST LIKELY a tab vs a
        // content card: focusable, not too tall (<200), not in the
        // bottom half of the screen.
        var best: AccessibilityNodeInfo? = null
        var bestScore = -1.0
        traverseLimited(root, 3000) { n ->
            if (!hasText(n, "Sports")) return@traverseLimited
            val r = Rect()
            n.getBoundsInScreen(r)
            if (r.height() <= 0 || r.height() > 250) return@traverseLimited
            // Score: lower is better for top placement, focusable bonus
            var score = 1.0 / (r.top + 1.0)
            if (n.isFocusable) score += 0.5
            if (n.isClickable) score += 0.3
            if (n.isSelected) score += 1.0  // already-selected? not what we want; demote
            if (score > bestScore) { best = n; bestScore = score }
        }
        return best
    }

    private fun tryScrollTabStripRight(svc: AccessibilityService): Boolean {
        val root = freshRoot(svc) ?: return false
        // Same Y-range relaxation as findTopNavSportsNode — PVFTV-215
        // tabs sit at y=532. Look for a wide+thin scrollable strip
        // anywhere in the upper 2/3 of the screen.
        val tabStrip = findFirstMatching(root) { n ->
            if (!n.isScrollable) return@findFirstMatching false
            val r = Rect()
            n.getBoundsInScreen(r)
            r.top < 750 && r.width() > 600 && r.height() < 200
        }
        if (tabStrip != null) {
            val ok = tabStrip.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
            Log.i(TAG, "S2: scrolled tab strip via SCROLL_FORWARD = $ok")
            return ok
        }
        return false
    }

    // ─── verify ───────────────────────────────────────────────────

    private fun verifySportsActive(svc: AccessibilityService): Boolean {
        val root = freshRoot(svc) ?: return false

        // Hard gate 1: the focused/selected tab text must say "Sports".
        // Reject "Home" / "Movies" / "TV shows" / "News" / "Live TV" /
        // "Subscriptions" / "For you" — those mean the click didn't
        // take the tab.
        // Y-range loosened to 750 (Holmgren PVFTV-215 has tabs at y=532).
        val selectedTab = findFirstMatching(root) { n ->
            val d = (n.contentDescription?.toString() ?: "")
            (d.contains("Tab, Selected", ignoreCase = true) ||
             d.contains("Selected, Tab", ignoreCase = true) ||
             (n.isSelected && n.isFocusable && nodeNearTop(n, 750)))
        }
        if (selectedTab != null) {
            val sel = selectedTab.contentDescription?.toString()
                ?: selectedTab.text?.toString() ?: ""
            Log.i(TAG, "verify: selected tab desc='${sel.take(80)}'")
            if (sel.contains("Sports", ignoreCase = true)) {
                return true
            }
            // Explicitly listed REJECT patterns
            val rejectStarts = listOf("Home", "Movies", "TV shows", "TV", "News",
                "Live TV", "Live", "Subscriptions", "For you", "Find")
            if (rejectStarts.any { sel.startsWith(it, ignoreCase = true) }) {
                Log.w(TAG, "verify: still on '$sel' — Sports activation didn't take")
                return false
            }
        } else {
            Log.i(TAG, "verify: no Selected-tab pattern found in tree")
        }

        // Soft gate: known Sports section headers
        val sportsHeaders = listOf(
            "Live now", "Live & Upcoming", "Live and upcoming",
            "Sports for you", "Live sports", "Today's games", "Today's matchups",
            "NBA on Prime", "MLB on Prime", "NHL on Prime", "NFL on Prime",
            "Thursday Night Football", "Sports highlights", "Top sports picks",
            "By League", "By Sport"
        )
        if (sportsHeaders.any { hdr ->
            findFirstMatching(root) { n -> hasText(n, hdr) } != null
        }) {
            return true
        }

        // Last resort: count `vs.` / `@` patterns. Aggregated launcher
        // sports tab should have at least 3 matchup tiles visible.
        var matchups = 0
        traverseLimited(root, 2000) { n ->
            val t = (n.text?.toString() ?: "") + " " + (n.contentDescription?.toString() ?: "")
            val l = t.lowercase()
            if (Regex("""\bvs\.?\s+\b""").containsMatchIn(l)) matchups++
        }
        Log.i(TAG, "verify: matchup count = $matchups (need >= 3 for soft accept)")
        return matchups >= 3
    }

    /** Quick check used between click attempts (cheaper than verify). */
    private fun isSportsSelected(svc: AccessibilityService): Boolean {
        val root = freshRoot(svc) ?: return false
        val sel = findFirstMatching(root) { n ->
            val d = (n.contentDescription?.toString() ?: "")
            (d.contains("Tab, Selected", ignoreCase = true) ||
             d.contains("Selected, Tab", ignoreCase = true)) &&
                d.contains("Sports", ignoreCase = true)
        }
        return sel != null
    }

    // ─── tree helpers ─────────────────────────────────────────────

    private fun freshRoot(svc: AccessibilityService): AccessibilityNodeInfo? {
        val root = svc.rootInActiveWindow ?: return null
        try { root.refresh() } catch (_: Throwable) {}
        return root
    }

    private fun findFirstMatching(
        root: AccessibilityNodeInfo?,
        pred: (AccessibilityNodeInfo) -> Boolean,
    ): AccessibilityNodeInfo? {
        if (root == null) return null
        if (pred(root)) return root
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            findFirstMatching(child, pred)?.let { return it }
        }
        return null
    }

    private fun traverseLimited(
        root: AccessibilityNodeInfo?,
        maxNodes: Int,
        visitor: (AccessibilityNodeInfo) -> Unit,
    ) {
        if (root == null) return
        val q = ArrayDeque<AccessibilityNodeInfo>()
        q.add(root)
        var visited = 0
        while (q.isNotEmpty() && visited < maxNodes) {
            val n = q.removeFirst()
            visitor(n); visited++
            for (i in 0 until n.childCount) {
                n.getChild(i)?.let { q.add(it) }
            }
        }
    }

    private fun findBoundsContainedClickableAncestor(
        start: AccessibilityNodeInfo,
        startBounds: Rect,
        maxHeight: Int,
        maxWidth: Int,
    ): AccessibilityNodeInfo? {
        var cur: AccessibilityNodeInfo? = start.parent
        var hops = 0
        while (cur != null && hops < 10) {
            if (cur.isClickable) {
                val cb = Rect()
                cur.getBoundsInScreen(cb)
                if (cb.contains(startBounds) && cb.height() < maxHeight && cb.width() < maxWidth) {
                    return cur
                }
            }
            cur = cur.parent
            hops++
        }
        return null
    }

    private fun hasText(n: AccessibilityNodeInfo, target: String): Boolean {
        val t = n.text?.toString() ?: ""
        val d = n.contentDescription?.toString() ?: ""
        return t.equals(target, ignoreCase = true) ||
                d.equals(target, ignoreCase = true) ||
                t.contains(target, ignoreCase = true) ||
                d.contains(target, ignoreCase = true)
    }

    private fun nodeNearTop(n: AccessibilityNodeInfo, maxY: Int): Boolean {
        val r = Rect()
        n.getBoundsInScreen(r)
        return r.top < maxY
    }

    private fun dumpTopOfTree(svc: AccessibilityService, why: String) {
        val root = freshRoot(svc)
        Log.w(TAG, "[DIAG] $why")
        Log.w(TAG, "[DIAG] activeWindow=${root?.packageName} className=${root?.className}")
        var i = 0
        traverseLimited(root, 25) { n ->
            val cls = n.className?.toString()?.takeLast(28) ?: "?"
            val rid = n.viewIdResourceName?.takeLast(35) ?: ""
            val text = n.text?.toString() ?: ""
            val desc = n.contentDescription?.toString() ?: ""
            val combined = if (text.isNotEmpty() && desc.isNotEmpty()) "$text|$desc" else (text.ifEmpty { desc })
            val r = Rect()
            n.getBoundsInScreen(r)
            Log.w(TAG, "[DIAG] node[$i] cls=$cls id=$rid bounds=[${r.left},${r.top}][${r.right},${r.bottom}] click=${n.isClickable} sel=${n.isSelected} text='${combined.take(50)}'")
            i++
        }
    }

    private fun sleep(ms: Long) = try { Thread.sleep(ms) } catch (_: InterruptedException) {}

    companion object {
        private const val TAG = "LauncherHomeNav"
        private const val POST_SETTLE_DELAY_MS = 3_000L
        private const val SPORTS_TAB_RENDER_DELAY_MS = 4_000L
        private const val ROOT_RETRIES = 4
    }
}
