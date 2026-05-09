# Scout APK Enhancement Proposal — extending beyond ESPN + Prime Video

**Question from user 2026-05-09:** "how do we make our APK stronger for pulling information and controlling the other apps like Hulu and Peacock"

**Short answer:** Scout's current AccessibilityService approach is BLIND to WebView, Cobalt, and custom-GPU rendered apps (Peacock, Hulu, fuboTV, Sling, Apple TV+, YouTube TV) because none of them populate Android's accessibility tree with content data. To extend Scout's reach, we need a different mechanism — not a smarter AccessibilityService.

This doc lays out the four real options ranked by effort + impact + risk, and recommends ONE for the next dev cycle.

---

## What Scout v2.1.5 can and can't do today

**Can:**
- AccessibilityService listening on packageNames `com.espn.gtv,com.playon.nfhslive,com.amazon.firebat`
- Reads `AccessibilityNodeInfo` trees (text, content-desc, bounds, isClickable)
- Performs clicks via `performAction(ACTION_CLICK)` or `dispatchGesture(GestureDescription)`
- Receives `PLAY_GAME` broadcasts → matches a tile by token overlap → clicks it
- Receives `CONFIG` broadcasts → updates server URL

**Can't (the gap):**
- Extract content from WebView render: 1 single `WebView` node with no text children (Peacock, Hulu, fuboTV)
- Extract content from Cobalt runtime: OpenGL surfaces, 0 accessibility nodes (YouTube TV, YouTube)
- Extract content from custom GPU pipelines: lunaRenderView, accessibility-blind even though "native" (Apple TV+)
- Inject input into apps that ignore synthetic touch (ESPN's Watch button — currently mitigated host-side via DPAD_CENTER)
- See the actual rendered pixels — only the abstract accessibility tree

The gap is fundamental, not incremental. Adding more `packageNames` to the AS config doesn't help — the tree is still empty.

---

## Four paths to make Scout stronger

### Path 1 — MediaProjection screen capture + server-side OCR/Vision

**Concept:** Scout takes screenshots when a target app is foreground, sends frames to the host server, server runs OCR (Tesseract) or sends to a Vision LLM (e.g. Claude Vision, GPT-4V, Gemini) which returns structured tile data. Tiles get inserted into `firetv_streaming_catalog` same as walker output.

**Android API:** `MediaProjection` + `VirtualDisplay` + `ImageReader`. Standard since API 21. Requires user consent on first use (one-time `Intent` prompt → user approves "Allow Scout to capture screen?"). After approval, the consent token is stored in app data; subsequent captures don't prompt.

**What it captures:** the actual rendered pixels — works regardless of how the app renders. WebView, Cobalt, custom GPU, native — they all draw to the screen.

**Pros:**
- App-agnostic. ONE mechanism handles every streaming service.
- Catches dynamic content (current scores, "LIVE NOW" badges, time slots).
- Scales: new apps just need their package name added to Scout's foreground watch list.

**Cons:**
- Requires user consent on first launch per Cube. Not a server-side install — operator at each location has to approve once via TV remote.
- OCR has its own error rate (~5-10% on stylized fonts; sports tiles often have logo-text overlays).
- Vision LLM calls cost money: ~$0.01-0.05 per frame at current Anthropic/OpenAI pricing. A 30s walk × 5 apps × 16 Cubes = 80 frames per walk × 3x daily = 240 frames/day per Cube × 16 Cubes = 3840 frames/day fleet-wide. At $0.02/frame that's ~$76/day = $2300/mo. Tesseract local OCR is free but lower accuracy.
- Image transfer over LAN is small (each PNG ~200-500KB), but the round-trip pipeline (capture → encode → POST → OCR/Vision → DB write) is ~3-5s per frame.
- Privacy/compliance: operator-visible recording. Some staff may be concerned even though the captures only happen during walker runs.

**Effort estimate:** 5-7 days for an MVP using local Tesseract OCR. Add 2-3 days if going to a Vision LLM (better accuracy, recurring cost).

**Risk profile:** MEDIUM. Standard Android API. Vision-LLM accuracy on sports tiles is unknown — would need a calibration pass per app's tile design.

---

### Path 2 — VpnService network traffic capture

**Concept:** Scout runs as a VpnService on the Cube. Routes ALL Cube network traffic through Scout's local proxy. Scout intercepts API calls each streaming app makes to its backend (e.g. Peacock's content-list calls), parses the JSON, extracts tile data. No screen capture needed — you're reading the actual data the app received.

**Android API:** `android.net.VpnService`. One-time consent prompt similar to MediaProjection.

**Pros:**
- Lossless, structured data. Direct JSON parsing, no OCR error.
- Catches all apps' data without per-app rules — they all make REST/GraphQL calls eventually.
- Data is exactly what the bartender sees (same source-of-truth as the app's UI).

**Cons:**
- TLS encryption blocks 99% of useful traffic. To inspect HTTPS, Scout must install a custom CA on the Cube (operator-level setup, requires ADB) AND each app must trust the CA. Many apps use certificate pinning that REJECTS even valid CA-signed certs the OS trusts → can't inspect at all without per-app patches.
- Modern apps (Peacock, Netflix, etc.) increasingly use certificate pinning + obfuscated traffic specifically to defeat traffic interception.
- VpnService route conflicts with the existing ADB connection from the host server to the Cube — needs careful split-tunneling to keep ADB working.
- Large ongoing maintenance: each app's API endpoints change frequently, breaking the parser.
- Legal/compliance risk: terms-of-service violations for some apps explicitly forbid traffic interception.

**Effort estimate:** 2-3 weeks for an MVP that handles 1-2 apps. Maintenance is ongoing — figure 1-2 days/month per app to keep parsers current.

**Risk profile:** HIGH. Cert pinning likely defeats this for the most-wanted apps (Peacock, Hulu, fubo). YouTube/Netflix use full obfuscation. The apps where this would help (older / less-popular ones) are also less impactful. Not recommended.

---

### Path 3 — Scout becomes a controller-only, server holds the catalog

**Concept:** Scout doesn't try to extract anything from non-walkable apps. Instead, the server holds the catalog (operator-seeded OR fetched from an external EPG provider — see `STREAMING_PROVIDER_ROADMAP.md` Path B). When the bartender clicks Watch on a tile, Scout receives the PLAY_GAME broadcast, launches the app via deep link, and runs a per-app DPAD navigation sequence (like the existing ESPN/Prime Video sequences in `adb-client.ts`) to reach the specific game.

This is what Scout already does for ESPN's Watch button via host-side DPAD_CENTER (v2.32.99). Extending it to Hulu/Peacock means:
- Catalog source: external (not Scout's job) — operator manual seeding or Gracenote/EPG provider
- Navigation: per-app key sequences. E.g. Peacock = HOME → DPAD_DOWN×3 → DPAD_RIGHT (sports tab) → DPAD_DOWN (first live tile) → DPAD_CENTER (open) → DPAD_CENTER (play)
- Scout's role: receive PLAY_GAME, launch app, run sequence, click target if AS can detect it (ESPN works), or just dispatch DPAD_CENTER and hope the app's auto-focus is on the right tile

**Pros:**
- Smallest engineering effort: 1-2 days per app to nail the DPAD sequence.
- No new permissions, no recurring cost.
- Pairs naturally with Path B from the streaming-provider roadmap (paid EPG provider for the data, Scout for the navigation).

**Cons:**
- Doesn't solve the data-discovery problem — operator still needs an external catalog source.
- DPAD sequences are fragile: app updates that change layout break the navigation. Needs per-app verification per quarter.
- Doesn't help if the bartender wants "see what's on this Cube right now" — Scout has no visibility.

**Effort estimate:** 1-2 days per app for navigation; presumes the catalog comes from elsewhere.

**Risk profile:** LOW. Standard ADB DPAD navigation, well-understood. Same approach already used for ESPN.

---

### Path 4 — Hybrid: MediaProjection + cloud Vision LLM (batched, cost-controlled)

**Concept:** combine Path 1's screen capture with intelligent batching to control cost. Scout captures ONE screenshot per app per walk (not multiple), sends it to a Vision LLM with a prompt like "extract all sports event tiles you see; return JSON with title + sport + isLive + bounds." Server parses the response into catalog rows.

Cost control:
- 1 frame per app per walk = 16 Cubes × 5 apps × 3 walks/day = 240 frames/day fleet-wide. At $0.02/frame Vision-LLM call = $4.80/day = ~$144/mo.
- If we use a smaller multimodal model (e.g. Claude Haiku Vision or GPT-4o-mini with vision), cost drops to ~$30-50/mo fleet-wide.
- Local Tesseract OCR fallback for cubes/apps where the screenshot is text-heavy (lower accuracy but free).

**Pros:**
- Best of Paths 1 + 3. Catalog data IS extracted. Apps don't need per-app extractors.
- Vision LLMs handle stylized fonts + visual layouts much better than Tesseract.
- Extensible: new app added = just include its package in MediaProjection's foreground watch list.

**Cons:**
- One-time MediaProjection consent prompt per Cube (same as Path 1).
- Recurring cost ($30-150/mo fleet-wide depending on model + frame count).
- Vision-LLM accuracy on sports tiles is empirically unknown — would need a calibration pass.

**Effort estimate:** 7-10 days for an MVP. Most of the work is the Scout-side MediaProjection + foreground service plumbing; the LLM prompt + parser is a few hundred lines.

**Risk profile:** MEDIUM-LOW. The Android plumbing is standard. The LLM accuracy is the unknown.

---

## Recommendation

**Pick Path 4 (MediaProjection + cloud Vision LLM, batched).** It's the only path that gets you per-Cube catalog data for ALL streaming apps in a maintainable way.

Sequencing:
1. **Phase 1 — Path 3 (controller-only) for 1-2 apps right now.** Specifically: write DPAD sequences for Peacock + Hulu so the Watch button reaches a specific game when the operator manually adds tiles. ~1 week of work. Pairs with Path C from the streaming-provider roadmap (manual seeding) for an immediate operator unlock.
2. **Phase 2 — Path 4 MVP.** Build the MediaProjection + Vision-LLM pipeline against 1 app (Peacock). Calibrate accuracy on real tiles. ~2 weeks of work + 1 week of tuning. If accuracy is acceptable (>80% tile capture rate), expand to other apps.
3. **Phase 3 — Production rollout.** Roll out Phase 2 fleet-wide once stable. Document the consent flow for operators (they'll need to approve MediaProjection on each Cube once via the TV remote).

**Don't pick Path 2 (VpnService).** Cert pinning defeats it for the most-wanted apps. High effort, low return.

**Don't pick Path 1 alone.** OCR-only without Vision-LLM has too high an error rate on sports tiles (logos, scoreboards, overlapping text). The cost of Path 4's LLM calls is worth the accuracy gain.

---

## Open questions before starting

1. **Budget for recurring LLM costs.** $30-150/mo fleet-wide is the estimated range; need a yes/no.
2. **Operator effort for MediaProjection consent.** Is a one-time per-Cube setup acceptable? (Probably yes — same model as the existing AccessibilityService enable.)
3. **Privacy/compliance.** Even though screen captures are LAN-only and only happen during walker runs, some staff/customers may be concerned about screen recording. Document the data flow for operator transparency.
4. **Phase 1 standalone value.** Is the operator-seeding + DPAD-navigation pairing useful enough on its own to ship without Phase 2/3? (Probably yes for high-stakes weekly games like SNF on Peacock.)

These are decision points for the user, not engineering ones. Once decided, the engineering is well-scoped.

---

## What v2.33.3 leaves us with (current state)

- Walker covers ESPN + Prime Video. Other apps are explicitly marked unwalkable in `APP_WALK_RULES`.
- Watch button works end-to-end for ESPN + Prime Video games (DPAD_CENTER fix in v2.32.99).
- Watch button on non-walked apps opens the app's home screen but doesn't reach a specific game (no catalog tile = no per-event deep link).
- Lucky's specifically had a screensaver issue blocking even ESPN+Prime walks (fixed in v2.33.3 — Cubes now wake before walks).

Until we pick + execute a path from this proposal, that's the limit. The work to extend further is real engineering effort, not configuration.
