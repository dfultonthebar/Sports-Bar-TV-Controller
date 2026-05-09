package com.sportsbar.scout

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Navigates the PVFTV-320 Fire TV launcher (com.amazon.tv.launcher)
 * to extract Prime Video sports content.
 *
 * Strategy 1 (preferred): target the "Live" top tab.
 *   The 2026 PVFTV-320 launcher has 3 top tabs: Home / Find / Live.
 *   "Live" aggregates live content from Prime Video + other providers.
 *   No "Sports" tab exists on PVFTV-320 (was 5 tabs including Sports
 *   on older builds; merged in 2026 redesign).
 *
 * Verified resource IDs (from Lucky's Cube 1 probe 2026-05-09, dumps
 * at docs/probes/pvftv320-launcher/):
 *   - fragment_horizontal_nav   → top nav row container
 *   - menu_apps_gridview        → apps grid (Prime Video tile)
 *   - featured_item_rotator     → hero carousel (skip; rotates promos)
 *
 * No blind DPAD counts — Amazon redesigns focus order ~quarterly.
 * Always find by content-desc / viewId, then ACTION_FOCUS or
 * DPAD-walk-until-on-target.
 */
class LauncherNavigator(private val ctx: Context) {

    private val service: AccessibilityService?
        get() = PlaybackAutomationService.instanceForNav()

    /**
     * Navigate from launcher home to the Live tab + verify rendered.
     * Returns true when the snapshot service should walk the current
     * tree to extract tiles.
     */
    fun gotoLiveTab(): Boolean {
        val svc = service ?: run {
            Log.w(TAG, "AS not connected — can't navigate")
            return false
        }
        Log.i(TAG, "Strategy 1: navigate to Live tab")

        // Step 0 — Press HOME to ensure we're on the launcher's
        // HomeActivity_vNext view (which has the top-nav strip with
        // Home/Find/Live tabs). On PVFTV-320, launching firebat via
        // Intent lands on com.amazon.firebat/IgnitionActivity (a sparse
        // bouncer activity with no top nav). HOME forces the launcher
        // home view to come foreground.
        Log.i(TAG, "Sending HOME to surface launcher home view")
        svc.performGlobalActionSafe(AccessibilityService.GLOBAL_ACTION_HOME)
        sleep(HOME_TRANSITION_DELAY_MS)

        // Step 1 — find the Live tab node by content-desc.
        // Retry the freshRoot lookup — observed 2026-05-09 that on the
        // 2nd+ snapshot in a row, rootInActiveWindow can return null
        // briefly during the HOME transition. Retry settles within ~2s.
        var root: AccessibilityNodeInfo? = null
        for (attempt in 1..ROOT_FETCH_RETRIES) {
            root = freshRoot(svc)
            if (root != null) break
            Log.w(TAG, "freshRoot returned null (attempt $attempt/$ROOT_FETCH_RETRIES) — retrying")
            sleep(1_000)
        }
        if (root == null) {
            Log.w(TAG, "[DIAG] freshRoot returned null after $ROOT_FETCH_RETRIES retries — AS may be unbound or window transition stuck")
            return false
        }
        Log.i(TAG, "Got root after HOME — package=${root.packageName} class=${root.className}")

        // Find the Live TAB specifically — must be in the top nav strip
        // (y < TOP_NAV_Y_MAX). Iteration #4 (2026-05-09) found a content-
        // card "Live" at y=532 that blind findFirstMatching latched onto
        // first; clicking it triggered firebat IgnitionActivity, NOT the
        // Live-tab content view.
        val liveNode = findFirstMatching(root) { n ->
            if (!nodeTextOrDescEquals(n, "Live")) return@findFirstMatching false
            val rect = android.graphics.Rect()
            n.getBoundsInScreen(rect)
            rect.top < TOP_NAV_Y_MAX && rect.height() < 200
        }
        if (liveNode == null) {
            // Fallback: if no top-nav Live found, check whether ANY Live
            // node exists (helps diagnose if the tree shape changed).
            val anyLive = findFirstMatching(root) { nodeTextOrDescEquals(it, "Live") }
            if (anyLive != null) {
                val r = android.graphics.Rect()
                anyLive.getBoundsInScreen(r)
                Log.w(TAG, "[DIAG] Found 'Live' node but at y=${r.top} (need y < $TOP_NAV_Y_MAX) — likely a content card not top-nav tab")
            }
            dumpTopOfTree(svc, "no top-nav Live tab found in launcher home")
            return false
        }
        Log.i(TAG, "Found Live tab node — class=${liveNode.className} viewId=${liveNode.viewIdResourceName} bounds=${nodeBounds(liveNode)}")

        // Step 2 — focus the tab.
        if (!focusNode(svc, liveNode)) {
            dumpTopOfTree(svc, "failed to focus Live tab")
            return false
        }
        sleep(600)

        // Step 3 — verify focus actually landed on Live before clicking.
        if (!focusedTextContains(svc, "Live")) {
            dumpTopOfTree(svc, "focus did not move to Live tab")
            return false
        }

        // Step 4 — activate via DPAD CENTER.
        svc.performGlobalActionSafe(AccessibilityService.GLOBAL_ACTION_DPAD_CENTER)
        sleep(LIVE_TAB_RENDER_DELAY_MS)

        // Step 5 — Scroll DOWN to surface the actual sports content rows.
        // Iteration #3 finding (2026-05-09): landing on Live tab dumps app
        // shortcuts (Netflix/Disney+/Prime/YouTube) at the top — those are
        // app launcher tiles, not games. The "Live now" / "Sports" rows are
        // BELOW the fold. DPAD_DOWN×N scrolls the RecyclerView to load them.
        Log.i(TAG, "Scrolling down to find sports rows past the app shortcuts row")
        for (i in 1..LIVE_TAB_SCROLL_HOPS) {
            svc.performGlobalActionSafe(AccessibilityService.GLOBAL_ACTION_DPAD_DOWN)
            sleep(450)
        }
        sleep(LIVE_TAB_POST_SCROLL_DELAY_MS)

        // Step 6 — verify content rendered. Live tab should show at
        // least one row with "Live now" / "Live & upcoming" / sports tiles.
        if (!verifyLiveTabContent(svc)) {
            // Soft-fail: still let the extractor try. Even non-ideal
            // content gets dumped + scored; if zero tiles score above
            // threshold, snapshot status will be "ok" but tiles=0 — better
            // than nav_failed (which prevents extraction entirely).
            Log.w(TAG, "Live tab content check did NOT find clear sports row, but proceeding to extract anyway")
            dumpTopOfTree(svc, "Live tab content unclear — extractor will see what's here")
        } else {
            Log.i(TAG, "Successfully navigated to Live tab WITH visible sports content")
        }
        return true
    }

    // ─── Verification helpers ────────────────────────────────────────

    private fun verifyLiveTabContent(svc: AccessibilityService): Boolean {
        val root = freshRoot(svc) ?: return false

        // Look for known Live-tab section headers
        val knownHeaders = listOf("Live now", "Live & upcoming", "Sports for you", "Featured", "Live on Prime", "Live TV")
        if (knownHeaders.any { hdr ->
            findFirstMatching(root) { n -> nodeTextOrDescContains(n, hdr) } != null
        }) {
            return true
        }

        // Or count tiles that look like sports content
        var sportsLikeTiles = 0
        traverseLimited(root, 1500) { n ->
            val t = nodeTextOrDesc(n).lowercase()
            if (t.isNotEmpty() && (
                Regex("""\bvs\.?\b""").containsMatchIn(t) ||
                Regex("""\bnba|nfl|mlb|nhl|premier league|f1|grand prix\b""").containsMatchIn(t)
            )) sportsLikeTiles++
        }
        return sportsLikeTiles >= 2
    }

    // ─── Node ops ────────────────────────────────────────────────────

    private fun freshRoot(svc: AccessibilityService): AccessibilityNodeInfo? {
        val root = svc.rootInActiveWindow ?: return null
        try { root.refresh() } catch (_: Throwable) {}
        return root
    }

    private fun focusNode(svc: AccessibilityService, node: AccessibilityNodeInfo): Boolean {
        // Try direct ACTION_FOCUS
        if (node.isFocusable && node.performAction(AccessibilityNodeInfo.ACTION_FOCUS)) {
            return true
        }
        // Walk to a focusable ancestor
        var cur: AccessibilityNodeInfo? = node
        var hops = 0
        while (cur != null && hops < 8) {
            if (cur.isFocusable) {
                if (cur.performAction(AccessibilityNodeInfo.ACTION_FOCUS)) return true
            }
            cur = cur.parent
            hops++
        }
        // Fallback: walk DPAD UP/RIGHT until focused contains target text
        val targetText = nodeTextOrDesc(node)
        Log.i(TAG, "focusNode: ACTION_FOCUS chain failed; trying DPAD walk to '$targetText'")
        repeat(3) {
            svc.performGlobalActionSafe(AccessibilityService.GLOBAL_ACTION_DPAD_UP)
            sleep(350)
        }
        for (i in 0 until 8) {
            if (focusedTextOrDesc(svc).contains(targetText, ignoreCase = true)) return true
            svc.performGlobalActionSafe(AccessibilityService.GLOBAL_ACTION_DPAD_RIGHT)
            sleep(400)
        }
        return false
    }

    // ─── Tree traversal ──────────────────────────────────────────────

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

    // ─── Text helpers ────────────────────────────────────────────────

    private fun nodeTextOrDesc(n: AccessibilityNodeInfo?): String {
        if (n == null) return ""
        val text = n.text?.toString() ?: ""
        val desc = n.contentDescription?.toString() ?: ""
        return if (text.isNotEmpty() && desc.isNotEmpty() && text != desc) "$text | $desc"
            else text.ifEmpty { desc }
    }

    private fun nodeTextOrDescEquals(n: AccessibilityNodeInfo, target: String): Boolean {
        val t = n.text?.toString() ?: ""
        val d = n.contentDescription?.toString() ?: ""
        return t.equals(target, ignoreCase = true) || d.equals(target, ignoreCase = true)
    }

    private fun nodeTextOrDescContains(n: AccessibilityNodeInfo, sub: String): Boolean =
        ((n.text?.toString() ?: "") + " " + (n.contentDescription?.toString() ?: ""))
            .contains(sub, ignoreCase = true)

    private fun focusedTextOrDesc(svc: AccessibilityService): String {
        val root = freshRoot(svc) ?: return ""
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return ""
        return nodeTextOrDesc(focused)
    }

    private fun focusedTextContains(svc: AccessibilityService, sub: String): Boolean =
        focusedTextOrDesc(svc).contains(sub, ignoreCase = true)

    private fun nodeBounds(n: AccessibilityNodeInfo): String {
        val r = android.graphics.Rect()
        n.getBoundsInScreen(r)
        return "[${r.left},${r.top}][${r.right},${r.bottom}]"
    }

    /**
     * Diagnostic: dump first 12 nodes (BFS) to pm2 logs. Called from
     * any failure point — remote diagnosis without re-shipping APK.
     */
    private fun dumpTopOfTree(svc: AccessibilityService, why: String) {
        val root = freshRoot(svc)
        Log.w(TAG, "[DIAG] $why")
        Log.w(TAG, "[DIAG] activeWindow=${root?.packageName} className=${root?.className}")
        val focused = root?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        Log.w(TAG, "[DIAG] focused=${nodeTextOrDesc(focused)}")
        var i = 0
        traverseLimited(root, 12) { n ->
            val cls = n.className?.toString()?.takeLast(28) ?: "?"
            val rid = n.viewIdResourceName?.takeLast(35) ?: ""
            val txt = nodeTextOrDesc(n).take(50)
            Log.w(TAG, "[DIAG] node[$i] cls=$cls id=$rid text='$txt'")
            i++
        }
    }

    private fun sleep(ms: Long) = try { Thread.sleep(ms) } catch (_: InterruptedException) {}

    companion object {
        private const val TAG = "LauncherNav"
        private const val LIVE_TAB_RENDER_DELAY_MS = 5_000L
        private const val HOME_TRANSITION_DELAY_MS = 2_500L
        private const val LIVE_TAB_SCROLL_HOPS = 3
        private const val LIVE_TAB_POST_SCROLL_DELAY_MS = 2_500L
        private const val ROOT_FETCH_RETRIES = 4
        // Top nav strip is in the upper ~100-200px of a 1080p screen.
        // Use 200 as the cutoff to be safe across launcher revisions.
        private const val TOP_NAV_Y_MAX = 200
    }
}

/** Extension to silence performGlobalAction return-value at call site. */
fun AccessibilityService.performGlobalActionSafe(action: Int) {
    try { performGlobalAction(action) } catch (t: Throwable) {
        Log.w("AS", "performGlobalAction($action) crashed: ${t.message}")
    }
}
