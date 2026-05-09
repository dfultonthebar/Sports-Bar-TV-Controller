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
 * v2.2.2 — Navigator for the PVFTV-320 launcher's live-sports content
 * tab. Confirmed via Lucky's Cube 1 dump 2026-05-09: the launcher tab
 * strip on PVFTV-320.0001-L contains:
 *
 *   `My Stuff / Games / Find / Free / Home / Live / [Netflix /
 *   Prime Video / YouTube / Disney+ / Tubi shortcuts] / News /
 *   More Apps / Settings`
 *
 * NO Sports tab exists. The "Live" tab is the sports destination —
 * its content includes "Live Sports" section header, "FOX Sports 1",
 * "CBS Sports", "FOX: Stream live NFL", "Featured live TV apps", and
 * "Free Live Channels" rows.
 *
 * The tab strip lives at y=532-612 (NOT y<200 as initial guess
 * assumed), and tab nodes are accessibility-friendly:
 *   - `isClickable=true`, `isFocusable=true` on the ViewGroup container
 *   - `contentDescription` carries the tab name ("Home", "Live", etc.)
 *   - Inner TextView at y=612 has `text` matching the desc
 *
 * Verify signal: `isFocused=true` on the destination tab node. The
 * `isSelected` flag does NOT track tab activation here, and there are
 * NO `Tab, Selected` desc patterns like Prime Video has internally.
 *
 * Click strategy stack (tries in order, each gated by anyTabFocused):
 *   1a. ACTION_FOCUS on tab node — most launcher builds activate on focus
 *   1b. ACTION_CLICK on tab node directly
 *   1c. Bounds-contained clickable ancestor walk
 *   1d. Synthetic gesture tap via dispatchGesture (real touch event)
 *   1e. ACTION_ACCESSIBILITY_FOCUS + ACTION_CLICK (TalkBack-style)
 *
 * Reference dumps committed under `docs/probes/pvftv320-launcher/`
 * show the exact home-tab vs live-tab tree structure.
 */
class LauncherHomeNavigator(private val ctx: Context) {

    private val service: AccessibilityService?
        get() = PlaybackAutomationService.instanceForNav()

    /**
     * Navigate to the launcher home's sports-content tab. On Lucky's
     * PVFTV-320.0001-L (probed 2026-05-09), the launcher tab strip
     * does NOT contain a "Sports" tab. Visible tabs are:
     * `My Stuff / Games / Find / Free / Home / Live / [Netflix /
     * Prime Video / YouTube / Disney+ / Tubi shortcuts] / News /
     * More Apps / Settings`. The "Live" tab is the actual destination
     * — it contains "Live Sports" section header, FOX Sports 1, CBS
     * Sports, "FOX: Stream live NFL", and other live-channel content.
     *
     * Strategy:
     *   1. Try "Sports" (in case a future PVFTV build adds it).
     *   2. Fall back to "Live" — confirmed working on PVFTV-320.0001-L.
     *
     * Verify gate uses `isFocused=true` on the destination tab node
     * (the reliable signal — `isSelected` and `Tab, Selected` desc
     * patterns are NOT present on PVFTV-320 launcher tabs).
     */
    fun gotoSportsTab(): Boolean {
        val svc = service ?: run {
            Log.w(TAG, "AS not connected — can't navigate")
            return false
        }
        Log.i(TAG, "PVFTV-320 launcher → live-sports content tab navigation begin")

        // v2.2.2 — Always send HOME first to reset launcher state. Without
        // this, firing the snapshot from a Cube with focus on a Prime Video
        // content detail page (e.g. "Watkins Glen Practice & Qualifying")
        // leaves the activeWindow on com.amazon.firebat's detail FrameLayout
        // — no tab strip in tree, navigation immediately fails.
        // GLOBAL_ACTION_HOME has been in AccessibilityService since API 16,
        // so it works on PVFTV-215 + PVFTV-320 alike (unlike GLOBAL_ACTION_DPAD_*
        // which is API 33+ and silently no-ops on Fire OS 7.7).
        svc.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
        sleep(HOME_SETTLE_DELAY_MS)

        // Try "Sports" first (PVFTV-320 may add it in future builds),
        // then "Live" (the actual sports destination on .0001-L).
        for (tabName in TAB_TARGETS) {
            if (tryTab(svc, tabName)) return true
        }

        dumpTopOfTree(svc, "All tab targets exhausted (${TAB_TARGETS.joinToString()})")
        return false
    }

    private fun tryTab(svc: AccessibilityService, tabName: String): Boolean {
        val node = findTopNavTabNode(svc, tabName)
        if (node == null) {
            Log.i(TAG, "tab '$tabName': not found in tree")
            return false
        }
        val r = Rect()
        node.getBoundsInScreen(r)
        Log.i(TAG, "tab '$tabName': found at bounds=[${r.left},${r.top}][${r.right},${r.bottom}] (cls=${node.className}, click=${node.isClickable}, focus=${node.isFocusable})")

        if (isTabFocused(svc, tabName)) {
            Log.i(TAG, "tab '$tabName': already focused — skipping click, verify content")
            sleep(SPORTS_TAB_RENDER_DELAY_MS)
            if (verifyLiveSportsContent(svc)) {
                Log.i(TAG, "tab '$tabName': content verified.")
                return true
            }
        }

        if (!tryAllClickStrategies(svc, node)) {
            Log.w(TAG, "tab '$tabName': all click strategies failed")
            return false
        }
        sleep(SPORTS_TAB_RENDER_DELAY_MS)

        if (!isTabFocused(svc, tabName)) {
            Log.w(TAG, "tab '$tabName': click fired but isFocused did not transfer to '$tabName' tab")
            return false
        }
        Log.i(TAG, "tab '$tabName': isFocused=true — click took. Verifying content…")

        if (!verifyLiveSportsContent(svc)) {
            Log.w(TAG, "tab '$tabName': focus moved but live-sports content not visible")
            return false
        }
        Log.i(TAG, "tab '$tabName': content verified. Forcing lazy-row hydration via swipe…")

        // The Live tab's deeper rows ("Featured live TV apps", "Live
        // Sports", "Free Live Channels") render LAZILY — initial post-
        // click tree only has the tab strip + first content row.
        // Lucky's Cube 1 v2.2.2c run captured 8 nodes; manual dump after
        // DPAD navigation captured 100. The difference: real DPAD events
        // through the kernel input pipeline trigger lazy-list rendering;
        // ACTION_FOCUS does not. A synthetic swipe down via dispatchGesture
        // sends a real touch event that triggers the launcher's
        // RecyclerView.onScrolled hydration.
        forceLazyRowHydration(svc)
        sleep(POST_VERIFY_HYDRATION_MS)
        return true
    }

    /** Send a synthetic down-swipe via dispatchGesture to trigger
     *  launcher RecyclerView lazy-hydration. After this, nodes for the
     *  deeper content rows (Live Sports / Featured live TV apps / Free
     *  Live Channels) appear in the AS tree where the snapshot
     *  extractor can walk them. */
    private fun forceLazyRowHydration(svc: AccessibilityService) {
        if (Build.VERSION.SDK_INT < 24) return
        try {
            // Swipe upward from y=900 to y=400 in screen center —
            // simulates a "scroll content up" gesture that the launcher
            // typically interprets as "show next row"
            val path = Path().apply {
                moveTo(960f, 900f)
                lineTo(960f, 400f)
            }
            val stroke = GestureDescription.StrokeDescription(path, 0L, 350L)
            val gesture = GestureDescription.Builder().addStroke(stroke).build()
            val latch = Object()
            svc.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(g: GestureDescription?) { synchronized(latch) { latch.notifyAll() } }
                override fun onCancelled(g: GestureDescription?) { synchronized(latch) { latch.notifyAll() } }
            }, Handler(Looper.getMainLooper()))
            synchronized(latch) {
                try { latch.wait(2_000L) } catch (_: InterruptedException) {}
            }
        } catch (t: Throwable) {
            Log.w(TAG, "forceLazyRowHydration crashed: ${t.message}")
        }
    }

    private fun findTopNavTabNode(svc: AccessibilityService, tabName: String): AccessibilityNodeInfo? {
        // Look for a clickable+focusable node with text/desc EXACTLY
        // matching tabName, anywhere in the tree. Score by topmost-
        // leftmost (tabs are in upper region) + clickable/focusable.
        for (attempt in 1..ROOT_RETRIES) {
            val root = freshRoot(svc)
            if (root == null) { sleep(500); continue }
            val candidates = mutableListOf<Pair<AccessibilityNodeInfo, Rect>>()
            traverseLimited(root, 4000) { n ->
                if (!hasTextExact(n, tabName)) return@traverseLimited
                if (!n.isClickable && !n.isFocusable) return@traverseLimited
                val r = Rect()
                n.getBoundsInScreen(r)
                if (r.width() <= 0 || r.height() <= 0 || r.height() > 250) return@traverseLimited
                candidates.add(n to r)
            }
            if (candidates.isNotEmpty()) {
                val best = candidates.maxByOrNull { (n, r) ->
                    var score = 0.0
                    if (n.isClickable) score += 5.0
                    if (n.isFocusable) score += 5.0
                    if (n.isVisibleToUser) score += 2.0
                    score -= r.top * 0.001
                    score -= r.left * 0.0005
                    score
                }!!
                return best.first
            }
            sleep(500)
        }
        return null
    }

    /** True iff a node with text/desc exactly matching tabName is the
     *  currently `isFocused=true` node. This is the PVFTV-320 verify
     *  signal (confirmed via Lucky's Cube 1 home/live tab dumps). */
    private fun isTabFocused(svc: AccessibilityService, tabName: String): Boolean {
        val root = freshRoot(svc) ?: return false
        val focused = findFirstMatching(root) { n -> n.isFocused }
            ?: return false
        return hasTextExact(focused, tabName)
    }

    /** Quick sanity check used between click attempts: did focus land
     *  on ANY tab in the strip (not the original Home/Live default)?
     *  More forgiving than isTabFocused — used as an early "click
     *  worked" signal before the post-render verify. */
    private fun anyTabFocused(svc: AccessibilityService): Boolean {
        val root = freshRoot(svc) ?: return false
        val focused = findFirstMatching(root) { n -> n.isFocused } ?: return false
        // The focused node should be a tab-strip member, not a content tile.
        // Tab-strip nodes are at y=520-620 on PVFTV-320 launcher.
        val r = Rect()
        focused.getBoundsInScreen(r)
        return r.top in 480..640 && r.height() in 30..200
    }

    // ─── click strategy stack ─────────────────────────────────────

    private fun tryAllClickStrategies(svc: AccessibilityService, node: AccessibilityNodeInfo): Boolean {
        val r = Rect()
        node.getBoundsInScreen(r)

        // 1a. ACTION_FOCUS on node — Compose tab's focus listener may activate it
        if (node.isFocusable && node.performAction(AccessibilityNodeInfo.ACTION_FOCUS)) {
            sleep(150)
            if (anyTabFocused(svc)) {
                Log.i(TAG, "click: ACTION_FOCUS on node activated tab")
                return true
            }
        }

        // 1b. ACTION_CLICK on node directly
        if (node.isClickable && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            sleep(200)
            if (anyTabFocused(svc)) {
                Log.i(TAG, "click: ACTION_CLICK on node activated tab")
                return true
            }
        }

        // 1c. Bounds-contained clickable ancestor
        val ancestor = findBoundsContainedClickableAncestor(node, r, maxHeight = 200, maxWidth = 600)
        if (ancestor != null && ancestor.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            sleep(200)
            if (anyTabFocused(svc)) {
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
                if (anyTabFocused(svc)) {
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
                if (anyTabFocused(svc)) {
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

    private fun hasTextExact(n: AccessibilityNodeInfo, target: String): Boolean {
        val t = (n.text?.toString() ?: "").trim()
        val d = (n.contentDescription?.toString() ?: "").trim()
        return t.equals(target, ignoreCase = true) || d.equals(target, ignoreCase = true)
    }

    // ─── verify ───────────────────────────────────────────────────

    /** Verify the destination tab is now showing live-sports content.
     *  Confirmed signals from Lucky's PVFTV-320.0001-L Live tab dump:
     *  "Live Sports" section header, "Featured live TV apps" header,
     *  "Free Live Channels" header, FOX Sports 1, CBS Sports, "Stream
     *  live NFL". Soft fallback: ≥3 LIVE-badge nodes visible. */
    private fun verifyLiveSportsContent(svc: AccessibilityService): Boolean {
        val root = freshRoot(svc) ?: return false

        // Strong signal: known section headers on Live / Sports tabs
        val knownHeaders = listOf(
            "Live Sports", "Featured live TV apps", "Free Live Channels",
            "Sports for you", "Live and upcoming", "Live & Upcoming",
            "By League", "By Sport", "Today's games", "NBA on Prime",
            "MLB on Prime", "NHL on Prime", "NFL on Prime",
            "Thursday Night Football"
        )
        if (knownHeaders.any { hdr ->
            findFirstMatching(root) { n -> hasText(n, hdr) } != null
        }) {
            return true
        }

        // Medium signal: known live-sports network names visible on the tab
        val knownNetworks = listOf("FOX Sports 1", "FOX Sports 2", "CBS Sports",
            "NBC Sports", "ESPN", "ESPN+", "TNT Sports", "TBS Sports",
            "Big Ten Network", "SEC Network", "Tennis Channel")
        if (knownNetworks.any { net ->
            findFirstMatching(root) { n -> hasText(n, net) } != null
        }) {
            return true
        }

        // Soft signal: ≥3 LIVE badges (TextView with text="LIVE")
        var liveBadges = 0
        traverseLimited(root, 1500) { n ->
            val t = (n.text?.toString() ?: "").trim()
            if (t.equals("LIVE", ignoreCase = true)) liveBadges++
        }
        Log.i(TAG, "verify: LIVE-badge count = $liveBadges (need ≥3)")
        return liveBadges >= 3
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
        private const val HOME_SETTLE_DELAY_MS = 4_000L
        private const val POST_SETTLE_DELAY_MS = 3_000L
        private const val SPORTS_TAB_RENDER_DELAY_MS = 4_000L
        private const val POST_VERIFY_HYDRATION_MS = 5_000L
        private const val ROOT_RETRIES = 4

        // Tab labels to look for in the launcher tab strip, in order.
        // "Sports" comes first in case a future PVFTV build adds it; if
        // not present, fall back to "Live" (the actual destination on
        // Lucky's PVFTV-320.0001-L per 2026-05-09 dump).
        private val TAB_TARGETS = listOf("Sports", "Live")
    }
}
