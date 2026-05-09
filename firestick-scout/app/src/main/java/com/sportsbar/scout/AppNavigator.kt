package com.sportsbar.scout

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo

/**
 * v2.2.0 — Navigates within an app's own UI to reach its sports/live
 * content. Used for apps that have a separate Activity (NOT launcher-
 * hosted firebat).
 *
 * For Prime Video PVFTV-215.x firebat: the app opens its own UI with a
 * top-tab strip (Home / Movies / TV shows / Sports / Live). DPAD nav
 * UP×2 + RIGHT×3 + CENTER reliably lands on the Sports tab. This
 * mirrors the server-side TypeScript walker's APP_WALK_RULES['Prime
 * Video'].navigation.keyevents = [19,19,22,22,22,23].
 *
 * For ESPN: no navigation needed — com.espn.gtv's first screen IS the
 * live-sports landing.
 *
 * Verification gate after navigation: same as LauncherNavigator —
 * confirm the focused-tab text or visible content matches expected
 * before letting the extractor walk the tree.
 */
class AppNavigator(private val ctx: Context) {

    private val service: AccessibilityService?
        get() = PlaybackAutomationService.instanceForNav()

    fun gotoPrimeVideoSports(): Boolean {
        val svc = service ?: run {
            Log.w(TAG, "AS not connected — can't navigate")
            return false
        }
        Log.i(TAG, "Prime Video PVFTV-215 path: nav to Sports tab via direct node click")

        // Wait for the app to settle before nav. PVFTV-215 firebat home
        // tab takes ~6s to render content rows.
        sleep(POST_LAUNCH_DELAY_MS)

        // v2.2.0 iter#7 — DON'T use performGlobalAction(GLOBAL_ACTION_DPAD_*).
        // Those constants were added in API 33 (Android 13). Fire OS 7.7
        // Cubes run API 28 (Android 9 base) — the calls are silently
        // ignored. Instead, find the "Sports" tab node directly in the
        // tree (y<200, matches text/desc) and click it via ancestor walk.
        //
        // PVFTV-215 firebat (Holmgren probe 2026-05-09): top nav strip
        // at y=54-100 with tabs Home / Movies / TV shows / Sports / News
        // / Live TV / Subscriptions.
        var sportsTab: AccessibilityNodeInfo? = null
        for (attempt in 1..ROOT_FETCH_RETRIES) {
            val root = freshRoot(svc) ?: run { sleep(800); null }
            if (root != null) {
                sportsTab = findFirstMatching(root) { n ->
                    if (!nodeTextOrDescEquals(n, "Sports")) return@findFirstMatching false
                    val r = android.graphics.Rect()
                    n.getBoundsInScreen(r)
                    r.top < TOP_NAV_Y_MAX && r.height() < 250
                }
                if (sportsTab != null) break
            }
            sleep(700)
        }
        if (sportsTab == null) {
            dumpTopOfTree(svc, "no Sports tab node found in top nav (y<$TOP_NAV_Y_MAX)")
            return false
        }
        val r = android.graphics.Rect()
        sportsTab.getBoundsInScreen(r)
        Log.i(TAG, "Found Sports tab — bounds=[${r.left},${r.top}][${r.right},${r.bottom}]")

        // Click via clickable ancestor walk
        if (!clickWithAncestorWalk(sportsTab)) {
            dumpTopOfTree(svc, "Sports tab found but no clickable ancestor")
            return false
        }
        sleep(SPORTS_TAB_RENDER_DELAY_MS)

        val ok = verifySportsTabContent(svc)
        if (!ok) {
            dumpTopOfTree(svc, "Sports tab clicked but content doesn't look right")
            return false
        }
        Log.i(TAG, "Successfully navigated to Prime Video Sports tab")
        return true
    }

    private fun clickWithAncestorWalk(node: AccessibilityNodeInfo): Boolean {
        // v2.2.0 iter#9: For Compose top-nav tabs (Prime Video PVFTV-215),
        // the visible "Sports" TextView is wrapped in a Compose tab
        // container that is NOT registered as isClickable=true. Walking
        // up parents looking for isClickable hits the WRONG container
        // (the side-menu's clickable parent instead of the top-nav's).
        // So we try multiple actions in order:
        //   1. ACTION_ACCESSIBILITY_FOCUS on the node itself + click — TalkBack emulation
        //   2. ACTION_FOCUS on the node — most Compose tabs activate on focus
        //   3. Nearest clickable ancestor whose bounds CONTAIN the node's bounds
        //   4. Bare ancestor walk (legacy fallback)
        val nodeBounds = android.graphics.Rect()
        node.getBoundsInScreen(nodeBounds)

        // 1. Accessibility-focus + click (TalkBack-style)
        if (node.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS)) {
            sleep(200)
            if (node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
        }

        // 2. Focus alone
        if (node.isFocusable && node.performAction(AccessibilityNodeInfo.ACTION_FOCUS)) {
            return true
        }

        // 3. Bounds-contained clickable ancestor (avoids hitting unrelated
        //    side-menu containers in the same Compose tree)
        var cur: AccessibilityNodeInfo? = node.parent
        var hops = 0
        while (cur != null && hops < 8) {
            if (cur.isClickable) {
                val cb = android.graphics.Rect()
                cur.getBoundsInScreen(cb)
                // Reject ancestors with implausibly large bounds (full
                // screen or wider than the top-nav strip) — those are
                // almost certainly the wrong clickable.
                if (cb.contains(nodeBounds) && cb.height() < 200 && cb.width() < 600) {
                    if (cur.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
                }
            }
            cur = cur.parent
            hops++
        }

        // 4. Legacy bare walk (last resort — known to misfire on Compose)
        cur = node.parent
        hops = 0
        while (cur != null && hops < 12) {
            if (cur.isClickable) {
                if (cur.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
            }
            cur = cur.parent
            hops++
        }
        return false
    }

    fun gotoEspnLive(): Boolean {
        val svc = service ?: run {
            Log.w(TAG, "AS not connected — can't navigate")
            return false
        }
        Log.i(TAG, "ESPN: home tab is the live-sports landing — no navigation needed")
        sleep(ESPN_RENDER_DELAY_MS)

        val ok = verifyEspnContent(svc)
        if (!ok) {
            dumpTopOfTree(svc, "ESPN home doesn't show expected live-sports content")
            return false
        }
        Log.i(TAG, "ESPN ready for extraction")
        return true
    }

    // ─── Verification ────────────────────────────────────────────────

    private fun verifySportsTabContent(svc: AccessibilityService): Boolean {
        val root = freshRoot(svc) ?: return false

        // First gate (HARD requirement): the focused/selected tab in the
        // top nav strip must say "Sports" — not "Home". Iter#7 found that
        // ACTION_CLICK on the Sports tab text node didn't actually fire
        // the tab change on PVFTV-215 firebat (Compose tab containers
        // don't always honor accessibility clicks); the previous lenient
        // verify happily reported success because some deep node had a
        // matching keyword. So we explicitly REJECT the "Home, Tab,
        // Selected, ..." pattern.
        val focusedSelectedText = findFirstMatching(root) { n ->
            val d = (n.contentDescription?.toString() ?: "")
            d.contains("Tab, Selected", ignoreCase = true) ||
            d.contains("Selected, Tab", ignoreCase = true)
        }?.contentDescription?.toString() ?: ""
        if (focusedSelectedText.isNotEmpty()) {
            Log.i(TAG, "verify: focused selected tab = '$focusedSelectedText'")
            if (focusedSelectedText.startsWith("Home", ignoreCase = true) ||
                focusedSelectedText.startsWith("Movies", ignoreCase = true) ||
                focusedSelectedText.startsWith("TV shows", ignoreCase = true) ||
                focusedSelectedText.startsWith("News", ignoreCase = true) ||
                focusedSelectedText.startsWith("Live TV", ignoreCase = true) ||
                focusedSelectedText.startsWith("Subscriptions", ignoreCase = true)) {
                Log.w(TAG, "verify: still on $focusedSelectedText — tab click didn't take")
                return false
            }
            if (focusedSelectedText.startsWith("Sports", ignoreCase = true)) {
                Log.i(TAG, "verify: Sports tab IS the selected tab — clean")
                return true
            }
        }

        // Second gate (soft, only if focused-tab pattern wasn't found):
        // require KNOWN sports-section headers in the tree — not loose
        // keyword matches that can hit anywhere on the Home tab.
        val knownHeaders = listOf("Sports for you", "Live now", "Live and upcoming",
            "Live & upcoming", "NBA on Prime", "MLB on Prime", "NHL on Prime",
            "NFL on Prime", "Thursday Night Football")
        return knownHeaders.any { hdr ->
            findFirstMatching(root) { n -> nodeTextOrDescContains(n, hdr) } != null
        }
    }

    private fun verifyEspnContent(svc: AccessibilityService): Boolean {
        val root = freshRoot(svc) ?: return false
        // ESPN home tab has tile content-descs like:
        //   "Mariners vs. White Sox, MLB, Live Now"
        //   "ESPN+ • NCAA Softball Live"
        // Verify by counting nodes with "Live" or "vs" patterns.
        var hits = 0
        traverseLimited(root, 2000) { n ->
            val t = nodeTextOrDesc(n).lowercase()
            if (t.isEmpty()) return@traverseLimited
            if (Regex("""\bvs\.?\b""").containsMatchIn(t)) hits++
            else if (Regex("""\blive(\s+now)?\b""").containsMatchIn(t) && hits == 0) hits++
        }
        return hits >= 1
    }

    // ─── Helpers (mirror LauncherNavigator's pattern) ────────────────

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

    private fun dumpTopOfTree(svc: AccessibilityService, why: String) {
        val root = freshRoot(svc)
        Log.w(TAG, "[DIAG] $why")
        Log.w(TAG, "[DIAG] activeWindow=${root?.packageName} className=${root?.className}")
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
        private const val TAG = "AppNav"
        private const val POST_LAUNCH_DELAY_MS = 6_000L
        private const val SPORTS_TAB_RENDER_DELAY_MS = 4_500L
        private const val ESPN_RENDER_DELAY_MS = 8_000L
        private const val ROOT_FETCH_RETRIES = 4
        private const val TOP_NAV_Y_MAX = 200
    }
}
