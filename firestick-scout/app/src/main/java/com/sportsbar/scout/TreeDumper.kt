package com.sportsbar.scout

import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * v2.2.1 — Walks an AccessibilityNodeInfo tree → JSON for diagnostic
 * capture. Logs to logcat AND returns a JSONObject ready for HTTP POST.
 *
 * Used by TreeDumpReceiver (ACTION_DUMP_LAUNCHER_TREE broadcast) so we
 * can capture ground truth from a real PVFTV-320 launcher and write
 * pixel-perfect node selectors instead of guessing.
 *
 * Output structure:
 *   {
 *     "scoutVersion": "2.2.1",
 *     "deviceId": "...",
 *     "deviceName": "...",
 *     "takenAtUnix": 1715250000,
 *     "trigger": "ACTION_DUMP_LAUNCHER_TREE",
 *     "rootPackage": "com.amazon.tv.launcher",
 *     "rootClassName": "android.widget.FrameLayout",
 *     "screenSize": "1920x1080",
 *     "nodeCount": 412,
 *     "nodes": [
 *       {
 *         "depth": 0,
 *         "idx": 0,                  // ordinal in DFS order
 *         "parentIdx": -1,
 *         "package": "...",
 *         "className": "...",
 *         "viewId": "com.amazon.tv.launcher:id/...",
 *         "text": "...",
 *         "desc": "...",
 *         "bounds": "L,T,R,B",
 *         "isClickable": true,
 *         "isFocusable": true,
 *         "isFocused": false,
 *         "isSelected": false,
 *         "isCheckable": false,
 *         "isVisible": true,
 *         "childCount": 3
 *       },
 *       ...
 *     ]
 *   }
 */
object TreeDumper {

    private const val TAG = "TreeDumper"
    private const val MAX_NODES = 4000   // safety cap; PVFTV-320 launcher home is ~400 nodes
    private const val MAX_DEPTH = 50     // safety cap

    fun dumpTree(root: AccessibilityNodeInfo?, trigger: String): JSONObject {
        val payload = JSONObject()
        payload.put("scoutVersion", MainActivity.VERSION)
        payload.put("deviceId", MainActivity.deviceId)
        payload.put("deviceName", MainActivity.deviceName)
        payload.put("takenAtUnix", System.currentTimeMillis() / 1000)
        payload.put("trigger", trigger)

        if (root == null) {
            payload.put("error", "no_root_in_active_window")
            payload.put("nodes", JSONArray())
            payload.put("nodeCount", 0)
            Log.w(TAG, "dumpTree: rootInActiveWindow is null — AS not connected or no foreground window")
            return payload
        }

        try { root.refresh() } catch (_: Throwable) {}

        payload.put("rootPackage", root.packageName?.toString() ?: "")
        payload.put("rootClassName", root.className?.toString() ?: "")
        val rootBounds = Rect()
        root.getBoundsInScreen(rootBounds)
        payload.put("screenSize", "${rootBounds.width()}x${rootBounds.height()}")

        val nodes = JSONArray()
        val visitedCount = intArrayOf(0)
        traverse(root, depth = 0, parentIdx = -1, nodes = nodes, visitedCount = visitedCount)
        payload.put("nodes", nodes)
        payload.put("nodeCount", visitedCount[0])

        Log.i(TAG, "dumpTree: trigger=$trigger root=${root.packageName} nodes=${visitedCount[0]}")
        // Also log the first 30 interesting nodes to logcat so we can grab
        // them via `adb logcat -d -s TreeDumper:*` even if the HTTP POST
        // fails or no network is available.
        logInterestingNodes(nodes)
        return payload
    }

    private fun traverse(
        node: AccessibilityNodeInfo?,
        depth: Int,
        parentIdx: Int,
        nodes: JSONArray,
        visitedCount: IntArray,
    ) {
        if (node == null) return
        if (depth > MAX_DEPTH) return
        if (visitedCount[0] >= MAX_NODES) return

        val idx = visitedCount[0]
        visitedCount[0] = idx + 1

        val bounds = Rect()
        node.getBoundsInScreen(bounds)

        val obj = JSONObject()
        obj.put("idx", idx)
        obj.put("parentIdx", parentIdx)
        obj.put("depth", depth)
        obj.put("package", node.packageName?.toString() ?: "")
        obj.put("className", node.className?.toString() ?: "")
        obj.put("viewId", node.viewIdResourceName ?: "")
        obj.put("text", node.text?.toString() ?: "")
        obj.put("desc", node.contentDescription?.toString() ?: "")
        obj.put("bounds", "${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}")
        obj.put("isClickable", node.isClickable)
        obj.put("isFocusable", node.isFocusable)
        obj.put("isFocused", node.isFocused)
        obj.put("isSelected", node.isSelected)
        obj.put("isCheckable", node.isCheckable)
        obj.put("isChecked", node.isChecked)
        obj.put("isEnabled", node.isEnabled)
        obj.put("isVisible", node.isVisibleToUser)
        obj.put("isAccessibilityFocused", node.isAccessibilityFocused)
        obj.put("isLongClickable", node.isLongClickable)
        obj.put("isScrollable", node.isScrollable)
        obj.put("childCount", node.childCount)
        nodes.put(obj)

        for (i in 0 until node.childCount) {
            traverse(node.getChild(i), depth + 1, idx, nodes, visitedCount)
        }
    }

    /** Spit out the most likely-relevant nodes to logcat as a quick
     *  triage — top-nav strip (y < 200) + anything with text/desc that
     *  contains "Sports", "Live", "Movies", "TV", "Home", "News". */
    private fun logInterestingNodes(nodes: JSONArray) {
        val keywords = listOf("sports", "live", "movies", "tv shows", "home", "news",
            "subscriptions", "find", "library", "apps", "for you", "search")
        Log.i(TAG, "[INTERESTING] top-nav region (y<200) + keyword matches:")
        var emitted = 0
        for (i in 0 until nodes.length()) {
            if (emitted >= 60) break
            val n = nodes.getJSONObject(i)
            val bounds = n.optString("bounds", "0,0,0,0")
            val parts = bounds.split(",")
            val top = parts.getOrNull(1)?.toIntOrNull() ?: continue
            val text = n.optString("text", "")
            val desc = n.optString("desc", "")
            val combined = "$text|$desc".lowercase()
            val inTopNav = top < 200
            val hasKeyword = keywords.any { combined.contains(it) }
            if (!inTopNav && !hasKeyword) continue
            val prefix = if (inTopNav) "TN" else "KW"
            Log.i(TAG, "[INTERESTING] [$prefix] idx=${n.optInt("idx")} cls=${shortClass(n.optString("className"))} id=${shortId(n.optString("viewId"))} text='${truncate(text, 40)}' desc='${truncate(desc, 40)}' bounds=${bounds} click=${n.optBoolean("isClickable")} focus=${n.optBoolean("isFocusable")} sel=${n.optBoolean("isSelected")}")
            emitted++
        }
    }

    private fun shortClass(c: String): String {
        val dot = c.lastIndexOf('.')
        return if (dot >= 0 && dot < c.length - 1) c.substring(dot + 1) else c
    }

    private fun shortId(viewId: String): String {
        val slash = viewId.lastIndexOf('/')
        return if (slash >= 0 && slash < viewId.length - 1) viewId.substring(slash + 1) else viewId
    }

    private fun truncate(s: String, max: Int): String =
        if (s.length <= max) s else s.substring(0, max - 1) + "…"
}
