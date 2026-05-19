# @sports-bar/soundtrack

**Purpose:** Soundtrack Your Brand API integration — commercial music streaming designed for licensed venue playback. Drives play/pause + now-playing display on the bartender remote Music tab.

**Key exports** (`src/index.ts`):
- `SoundtrackYourBrandAPI` — main client (`src/soundtrack-your-brand.ts`)
- `getSoundtrackAPI` — process-wide singleton accessor
- `setSoundtrackAPIToken` — runtime token swap
- `clearSoundtrackAPI` — reset singleton (testing / re-init)
- Types: `SoundtrackAccount`, `SoundtrackStation`, `SoundtrackSoundZone`, `NowPlaying`

**Protocol / port:** HTTPS GraphQL against **`https://api.soundtrackyourbrand.com/v2`** (per `src/soundtrack-your-brand.ts:112`). Auth via API token (Bearer header). Docs: <https://api.soundtrackyourbrand.com/v2/docs>.

**Used by:** `apps/web` `/api/soundtrack/*` routes; bartender-remote Music tab (now-playing + playlist tiles with album art).

**Gotchas:**
- GraphQL only — no REST. Queries are built in `src/soundtrack-your-brand.ts` and sent via the private `graphql(query, variables)` helper.
- Singleton holds the API token — call `setSoundtrackAPIToken(...)` before first use, `clearSoundtrackAPI()` to reset for tests.
- Requires a valid Soundtrack Your Brand commercial account (per-location). Licensing is per sound-zone.

**See also:**
- `docs/SOUNDTRACK_INTEGRATION_GUIDE.md`
- CLAUDE.md → "Audio Control & Soundtrack Integration"
