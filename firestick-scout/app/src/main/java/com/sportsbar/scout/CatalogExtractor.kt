package com.sportsbar.scout

import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Tree → list of TileCandidate, each with a sportsScore (0.0-1.0).
 * CatalogSnapshotService filters above SPORTS_SCORE_THRESHOLD before
 * posting to the server.
 *
 * Why a score, not boolean: launcher mixes movies/ads/sports in one
 * row group. A boolean filter either drops legit sports content or
 * accepts "Devil Wears Prada" alongside "Lakers vs Thunder". Score
 * lets the server pick threshold per app + per location.
 */
object CatalogExtractor {

    fun collectCandidateTiles(root: AccessibilityNodeInfo, app: String): List<TileCandidate> {
        val out = mutableListOf<TileCandidate>()
        val seen = HashSet<String>()
        traverse(root, out, seen, app, depth = 0)
        return out
    }

    private fun traverse(
        node: AccessibilityNodeInfo?,
        out: MutableList<TileCandidate>,
        seen: HashSet<String>,
        app: String,
        depth: Int,
    ) {
        if (node == null || depth > 30) return
        val text = (node.text?.toString() ?: "").trim()
        val desc = (node.contentDescription?.toString() ?: "").trim()
        val combined = if (text.isNotEmpty() && desc.isNotEmpty() && text != desc) "$text · $desc"
            else (text.ifEmpty { desc })

        if (combined.isNotEmpty() && combined.length in 4..200) {
            val rect = Rect()
            node.getBoundsInScreen(rect)
            val w = rect.width()
            val h = rect.height()
            // Tile bounds heuristic: real tiles are 100-1400 wide, 40-600 tall.
            // Reject too-small (chrome) and too-large (background containers).
            if (w in 100..1400 && h in 40..600 && !isAccessibilityChrome(combined)) {
                val key = combined.lowercase()
                if (!seen.contains(key)) {
                    seen.add(key)
                    val score = scoreTileForSports(combined, app)
                    out.add(
                        TileCandidate(
                            title = cleanTitle(combined),
                            rawText = combined,
                            sportsScore = score,
                            isLive = looksLive(combined),
                            sportTag = inferSportTag(combined),
                            bounds = rect,
                        )
                    )
                }
            }
        }
        for (i in 0 until node.childCount) {
            traverse(node.getChild(i), out, seen, app, depth + 1)
        }
    }

    /**
     * 0.0 = definitely not sports; 1.0 = definitely sports. Sums weighted
     * signals + clamps. App context bumps a couple weights.
     */
    fun scoreTileForSports(text: String, app: String): Double {
        var s = 0.0
        val lower = text.lowercase()

        // Strong matchup signals
        if (Regex("""\bvs\.?\s+\b""").containsMatchIn(lower)) s += 0.55
        if (Regex("""\s@\s""").containsMatchIn(lower)) s += 0.55

        // League / sport name
        val leagues = listOf("nba", "nfl", "mlb", "nhl", "ncaa", "epl", "premier league",
            "champions league", "uefa", "la liga", "f1", "formula 1", "nascar",
            "indycar", "wnba", "ufc", "mma", "boxing", "pga", "lpga", "mls",
            "super rugby", "nrl", "cricket", "tennis", "atp", "wta", "soccer", "football",
            "basketball", "baseball", "hockey", "golf", "racing", "lacrosse", "rugby")
        if (leagues.any { lower.contains(it) }) s += 0.30

        // Live signals
        if (Regex("""\blive(\s+now)?\b""").containsMatchIn(lower)) s += 0.20
        if (lower.contains("upcoming")) s += 0.10
        if (Regex("""\b(q[1-4]|bot \d+\w+|top \d+\w+|halftime|final|ot)\b""").containsMatchIn(lower)) s += 0.20

        // Score patterns: "1 - 3" or "0:00"
        if (Regex("""\b\d{1,3}\s*-\s*\d{1,3}\b""").containsMatchIn(text)) s += 0.15
        if (Regex("""\d{1,2}:\d{2}\s*(am|pm)""", RegexOption.IGNORE_CASE).containsMatchIn(text)) s += 0.05

        // Negative signals — non-sports
        if (Regex("""\bseason\s+\d+""", RegexOption.IGNORE_CASE).containsMatchIn(text)) s -= 0.30
        if (Regex("""\bepisode\s+\d+""", RegexOption.IGNORE_CASE).containsMatchIn(text)) s -= 0.30
        if (lower.contains("4k uhd")) s -= 0.15
        if (Regex("""tv-(ma|14|pg|g|y)""").containsMatchIn(lower)) s -= 0.10
        if (lower.contains("audio language") || lower.contains("subtitle")) s -= 0.40
        if (lower.contains("recently watched") || lower.contains("continue watching")) s -= 0.30
        if (lower.contains("watch trailer")) s -= 0.20

        // App-specific bumps
        if (app == "Prime Video" && lower.contains("on prime")) s += 0.10
        if (app == "ESPN" && Regex("""\b(espn\+?|abc|sec network|acc network|big ten network|fs1|fs2)\b""").containsMatchIn(lower)) s += 0.10

        // v2.2.2 — PVFTV-320 launcher Live tab tile heuristics. The tab
        // shows live-sports CHANNELS (FOX Sports 1, CBS Sports, etc.)
        // by name without ever including a vs/league/score in the title,
        // plus tiles like "FOX: Stream live NFL". Lucky's Cube 1 dump
        // 2026-05-09 confirmed.
        val sportsNetworks = Regex("""\b(fox sports( [12])?|cbs sports|nbc sports|tnt sports|tbs sports|espn(\+|u| 2| deportes)?|big ten network|sec network|acc network|tennis channel|fs1|fs2)\b""")
        if (sportsNetworks.containsMatchIn(lower)) s += 0.45  // strong signal: this IS a sports channel
        // "Stream live NFL" / "Watch live MLB" type tiles
        if (Regex("""\bstream live\b|\bwatch live\b""").containsMatchIn(lower) && leagues.any { lower.contains(it) }) {
            s += 0.30
        }

        // v2.2.1 — Launcher home Sports tab heuristics. The PVFTV-320+
        // launcher Sports tab aggregates tiles from multiple providers;
        // each tile is annotated with its source app/network, and the
        // tab itself filters out non-sports content. So provider hints
        // there are MORE trustworthy than on-app pages.
        if (app == "Sports Tab") {
            // Provider/network suffix indicates launcher-aggregated sports tile
            if (Regex("""\b(prime video|espn\+?|paramount\+?|peacock|max|disney\+|apple tv\+?|fubo|sling|youtube tv)\b""").containsMatchIn(lower)) s += 0.20
            // "Watch with X subscription" badges in the launcher Sports row
            if (Regex("""watch (with|on|via) """).containsMatchIn(lower)) s += 0.15
            // Tile chrome that the Sports tab strips out by design — penalize
            // anything that looks like generic launcher row labels
            if (Regex("""\b(continue watching|recently watched|because you watched)\b""").containsMatchIn(lower)) s -= 0.50
            // The Sports tab puts league-tagged content prominently; bonus
            // when both `vs` AND a league are present (high-confidence game)
            val hasVs = Regex("""\bvs\.?\b""").containsMatchIn(lower)
            val hasLeague = leagues.any { lower.contains(it) }
            if (hasVs && hasLeague) s += 0.15
        }

        return s.coerceIn(0.0, 1.0)
    }

    private fun looksLive(text: String): Boolean =
        Regex("""\blive(\s+now)?\b""", RegexOption.IGNORE_CASE).containsMatchIn(text)

    /**
     * v2.33.10 — Reject TalkBack-style accessibility chrome strings
     * BEFORE they enter the candidate list. Examples seen in real dumps:
     *   "Watch, button 1 of 1", "Search, 2 of 5", "Main menu, Selected, 3 of 5",
     *   "Home, Tab, Selected, 1 of 8", "My Stuff, 4 of 5",
     *   "Settings for Luckys Madison",
     *   "More Apps press select to view all of your apps and channels"
     */
    private fun isAccessibilityChrome(text: String): Boolean {
        val l = text.lowercase().trim()
        if (Regex("""\b\d+\s+of\s+\d+\b""").containsMatchIn(l)) return true
        if (l.contains(", tab, selected,")) return true
        if (l.contains(", tab, ")) return true
        if (l.startsWith("more apps press select")) return true
        if (l.startsWith("settings for ")) return true
        if (l == "main menu" || l == "my stuff" || l == "home" || l == "search") return true
        if (Regex(""", (button|tab|switch|checkbox)\b""").containsMatchIn(l)) return true
        return false
    }

    private fun inferSportTag(text: String): String? {
        // v2.33.12 — WNBA must be checked BEFORE NBA because "nba" is a
        // substring of "wnba". Greenville Cube 2026-05-09 caught WNBA
        // games being mis-tagged as NBA. LinkedHashMap preserves order
        // so the iterator in firstOrNull below sees WNBA first.
        val tags = linkedMapOf(
            "WNBA" to listOf("wnba"),
            "NCAAF" to listOf("college football", "ncaaf"),
            "NCAAB" to listOf("college basketball", "ncaab"),
            "MLB" to listOf("mlb", "baseball", "world series"),
            "NBA" to listOf("nba"),
            "NFL" to listOf("nfl", "thursday night football", "sunday night football", "monday night football"),
            "NHL" to listOf("nhl", "hockey"),
            "MLS" to listOf("mls"),
            "EPL" to listOf("premier league", "epl"),
            "LALIGA" to listOf("la liga", "laliga", "spanish la liga"),
            "Bundesliga" to listOf("bundesliga", "german bundesliga"),
            "ChampionsLeague" to listOf("champions league", "uefa champions"),
            "F1" to listOf("formula 1", " f1 ", "grand prix"),
            "NASCAR" to listOf("nascar"),
            "PGA" to listOf("pga tour", "pga", "lpga", "championship golf", "the masters", "u.s. open"),
            "UFC" to listOf("ufc", "mma"),
            "Boxing" to listOf("boxing", "wba ", "wbo ", "wbc "),
            "PLL" to listOf("premier lacrosse", "pll"),
            "Rugby" to listOf("rugby"),
            "Tennis" to listOf("atp", "wta", "wimbledon", "roland garros", "australian open", "u.s. open tennis"),
        )
        val l = text.lowercase()
        tags.entries.firstOrNull { (_, kws) -> kws.any { l.contains(it) } }?.let { return it.key }

        // v2.33.10 — Network-name pattern fallback. Tiles like "FOX Sports 1"
        // or "ESPN+ • PGA TOUR" or "ESPN on ABC • WNBA" carry the league
        // name AFTER a network suffix; if the keyword pass missed it, try
        // splitting on bullet/dash/middot separators and re-matching.
        val parts = l.split(Regex("""\s*[•·–—-]\s*"""))
        for (part in parts) {
            for ((tag, kws) in tags) {
                if (kws.any { part.contains(it) }) return tag
            }
        }
        return null
    }

    private fun cleanTitle(s: String): String {
        return s
            .replace(Regex("""\s+(ESPN(\+| Unlimited|U|2)?|ABC|FS1|FS2|FOX|NBC|CBS|TBS|TNT)\s*$""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""\s+(LIVE NOW|LIVE|UPCOMING|Free trial|Watch now|Subscribe)\s*$""", RegexOption.IGNORE_CASE), "")
            .trim()
            .take(120)
    }

    /**
     * Diagnostic: log top-N candidates by score. Always-on INFO so it
     * shows in pm2 logs without enabling debug.
     */
    fun dumpTopCandidates(tiles: List<TileCandidate>, app: String, top: Int = 8) {
        val sorted = tiles.sortedByDescending { it.sportsScore }.take(top)
        Log.i(TAG, "[DIAG] $app candidates (top $top of ${tiles.size}):")
        sorted.forEachIndexed { i, t ->
            Log.i(TAG, "[DIAG]   #${i+1} score=${"%.2f".format(t.sportsScore)} live=${t.isLive} sport=${t.sportTag ?: "?"} title='${t.title.take(60)}'")
        }
    }

    private const val TAG = "CatalogExtractor"
}

data class TileCandidate(
    val title: String,
    val rawText: String,
    val sportsScore: Double,
    val isLive: Boolean,
    val sportTag: String?,
    val bounds: Rect,
) {
    fun toJson(): Map<String, Any?> = mapOf(
        "title" to title,
        "isLive" to isLive,
        "sportTag" to sportTag,
        "sportsScore" to sportsScore,
        "nodeBounds" to "${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}",
    )
}
