// Load per-location .env so LOCATION_ID (and any other location-specific env
// vars) reach the PM2-managed process. Each location branch has its own .env
// at the repo root. PM2's cwd is apps/web/, so Next.js's built-in dotenv
// doesn't pick up the repo-root .env — we load it here explicitly.
try {
  require('dotenv').config({ path: __dirname + '/.env' })
} catch (e) {
  console.warn('[ecosystem] dotenv not available:', e && e.message)
}

module.exports = {
  apps: [
    {
      name: 'sports-bar-tv-controller',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/home/ubuntu/Sports-Bar-TV-Controller/apps/web',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=2048',
      autorestart: true,
      watch: false,
      max_memory_restart: '3G',
      min_uptime: '30s',  // Increased from 10s to prevent rapid restart cycles
      max_restarts: 15,   // Increased from 10 to handle transient failures
      restart_delay: 5000, // Increased from 4000ms to 5000ms for stability
      exp_backoff_restart_delay: 1000, // Exponential backoff starting at 1s
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        ADB_VENDOR_KEYS: '/home/ubuntu/.android',
        // Wave 3c: closed-loop matrix route verify (opt-in per location, default off).
        ROUTE_VERIFY_ENABLED: process.env.ROUTE_VERIFY_ENABLED,
        // Sports Guide API (The Rail Media) — per-location values from .env
        SPORTS_GUIDE_API_KEY: process.env.SPORTS_GUIDE_API_KEY,
        SPORTS_GUIDE_USER_ID: process.env.SPORTS_GUIDE_USER_ID,
        SPORTS_GUIDE_API_URL: 'https://guide.thedailyrail.com/api/v1',
        // Feature B1 (opt-in, default off): pull ESPN game schedules from the
        // central hub instead of every box hitting ESPN's 24 leagues every 10
        // min. On ANY hub failure the box falls back to its local ESPN sync, so
        // the bartender guide never depends on the hub.
        ESPN_HUB_ENABLED: process.env.ESPN_HUB_ENABLED || 'false',
        HUB_GAME_URL: process.env.HUB_GAME_URL || 'http://100.124.165.26:3010',
        // Feature B2 (opt-in, default off): pull the Rail Media guide via the hub
        // (cached per-market by this box's SPORTS_GUIDE_USER_ID). On ANY hub
        // failure the box fetches Rail directly. The box sends its own Rail key;
        // the hub never stores it.
        RAIL_HUB_ENABLED: process.env.RAIL_HUB_ENABLED || 'false',
        // Auth system — bind to the location row in the DB. Without this,
        // validatePIN() falls back to AUTH_CONFIG.LOCATION_ID='default-location'
        // and every login fails with "Invalid PIN".
        LOCATION_ID: process.env.LOCATION_ID || 'default-location',
        // Logger minimum level. Defaults to INFO in production, set
        // LOG_LEVEL=DEBUG in .env to surface verbose traces from
        // [CHANNEL_RESOLVER], [AUTO_UPDATE_API], and other component tags.
        LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
        // SDR watcher tunables (v2.52.9 fix: ecosystem only forwarded
        // SDR_ENABLED so all other SDR_* env vars were stuck at hardcoded
        // defaults — operator setting SDR_GAIN_DB=14 in .env was being
        // silently ignored, hence Holmgren's signals saturating in red).
        SDR_ENABLED: process.env.SDR_ENABLED,
        SDR_GAIN_DB: process.env.SDR_GAIN_DB,
        SDR_RESOLUTION_KHZ: process.env.SDR_RESOLUTION_KHZ,
        SDR_SWEEP_INTERVAL_SEC: process.env.SDR_SWEEP_INTERVAL_SEC,
        SDR_BAND_PRESET: process.env.SDR_BAND_PRESET,
        SDR_BAND_START_MHZ: process.env.SDR_BAND_START_MHZ,
        SDR_BAND_END_MHZ: process.env.SDR_BAND_END_MHZ,
        SDR_BAND_BUFFER_MHZ: process.env.SDR_BAND_BUFFER_MHZ,
        SDR_BAND_REEVAL_MS: process.env.SDR_BAND_REEVAL_MS,
        SDR_CARRIER_THRESHOLD_DBM: process.env.SDR_CARRIER_THRESHOLD_DBM,
        SDR_CARRIER_DETECT_SAMPLES: process.env.SDR_CARRIER_DETECT_SAMPLES,
        SDR_CARRIER_CLEAR_SAMPLES: process.env.SDR_CARRIER_CLEAR_SAMPLES,
        // v2.52.10: rtl_power outputs uncalibrated dBFS. The watcher
        // applies this offset at ingest so readings match true antenna-
        // port dBm (per the research digest). Default -55 dB in the
        // watcher; set this env to override per location.
        SDR_DBM_OFFSET: process.env.SDR_DBM_OFFSET,
        // RAG cross-encoder reranking (v2.53.0+, task #138). Default OFF;
        // set RAG_RERANK_ENABLED=true in .env to opt in. Quant defaults to
        // int8 (~300MB on disk / ~600MB resident). Candidates is the wider
        // pool pulled from hybrid search before rerank; topK is the final
        // slice handed to the LLM after rerank.
        RAG_RERANK_ENABLED: process.env.RAG_RERANK_ENABLED || 'false',
        RAG_RERANK_QUANT: process.env.RAG_RERANK_QUANT || 'int8',
        RAG_RERANK_CANDIDATES: process.env.RAG_RERANK_CANDIDATES || '30',
        RAG_RERANK_TOPK: process.env.RAG_RERANK_TOPK || '8',
        // Channel-guide per-game drop detail (Wave 1b-i, v2.55.61). Default OFF;
        // set CHANNEL_GUIDE_DROP_DEBUG=true in .env to emit the per-game
        // [GUIDE-RECON] detail fleet-wide (e.g. to gather Wave-4 data on which
        // broadcast_networks fail to resolve). ?debugDrops=1 works per-request
        // without this. Audit (wf_0e9838db) Blue MED: PM2 only forwards env vars
        // listed here (Gotcha #2 / SDR_* precedent), so this line is required
        // for the env path to work at all. Needs pm2 delete+start to take effect.
        CHANNEL_GUIDE_DROP_DEBUG: process.env.CHANNEL_GUIDE_DROP_DEBUG || 'false',
        // Wave 2 (v2.55.62): AI Suggest deterministic-solver mode. off (default)
        // = LLM only; shadow = also run the engine + log a diff (no output change);
        // primary (later) = engine plan is the answer. Needs pm2 delete+start.
        AI_SUGGEST_SOLVER: process.env.AI_SUGGEST_SOLVER || 'off',
        // Hermes Layer 1 — error-watch diagnose enrichment (#359). Default OFF;
        // when off the detect→TODO path is byte-for-byte unchanged. When 'true',
        // /api/error-watch/todo runs a RAG lookup (+ a stubbed LLM call landing
        // on T4-day) before filing the TODO and appends "Relevant docs:". PM2
        // only forwards env vars listed here (Gotcha #2 / SDR_* precedent), so
        // this line is required. Needs pm2 delete+start to take effect.
        DIAGNOSE_ENABLED: process.env.DIAGNOSE_ENABLED || 'false',
        // v2.68.0 — @sports-bar/ollama-client remote base. UNSET/empty ⇒ every
        // policy resolves to the local Ollama (localhost:11434) = today's exact
        // behavior; AI Suggest + RAG answer-gen already route through the client.
        // On T4-day (#358) set this in .env to the shared GPU Ollama URL and
        // pm2 delete+start — that single env flip moves those LLM calls to the
        // T4 with automatic local fallback. PM2 only forwards listed vars
        // (Gotcha #2), so this line is required for the flip to take effect.
        OLLAMA_REMOTE_BASE: process.env.OLLAMA_REMOTE_BASE || '',
        // #349 Wave 6 (Piece B) — deterministic DistributionEngine learning loop.
        // Default 'off' ⇒ engine behavior is byte-for-byte unchanged (no
        // scheduling_patterns query, no bias). Set 'on' in .env to make the engine
        // bias toward bartender-override-learned team→input/output preferences,
        // strictly as a LAST tie-breaker (never changes the home-team minTV floor
        // or removes any candidate). Holmgren is the canary. PM2 only forwards env
        // vars listed here (Gotcha #2), so flipping this requires
        // `pm2 delete && pm2 start ecosystem.config.js` (a plain restart will NOT
        // pick up the new value).
        DISTRIBUTION_ENGINE_LEARNING: process.env.DISTRIBUTION_ENGINE_LEARNING || 'off',
        // #364 — T4 offload for the interactive AI Hub chat ONLY (/api/chat).
        // Default 'false' ⇒ chat is byte-for-byte today's behavior: local iGPU,
        // qwen2.5:14b for tool calls / llama3.1:8b for plain chat. Set 'true' in
        // .env (alongside OLLAMA_REMOTE_BASE) to offload chat to the shared T4 GPU
        // with automatic local fallback. The T4 path FORCES the small model
        // (OLLAMA_TOOLS_MODEL_T4, default llama3.2:3b) so it never evicts the
        // trading bot's resident phi4-trader ("Phil") on the ~15GB VRAM budget.
        // VERIFIED 2026-06-19: llama3.1:8b (5.3GB) DOES evict Phil (9.3GB); only
        // llama3.2:3b (2.6GB) co-resides — so the default is the 3b model.
        // PM2 only forwards env vars listed here (Gotcha #2 / SDR_* precedent),
        // so flipping this requires `pm2 delete && pm2 start ecosystem.config.js`
        // (a plain restart will NOT pick up the new value).
        AI_HUB_T4_ENABLED: process.env.AI_HUB_T4_ENABLED || 'false',
        OLLAMA_TOOLS_MODEL_T4: process.env.OLLAMA_TOOLS_MODEL_T4 || 'llama3.2:3b',
        // "qwen is the model for EVERYTHING sports-bar" (operator rule 2026-06-23). These
        // must be forwarded or a .env value never reaches the process (Gotcha #2). Per-box
        // value via .env: Holmgren=qwen-trader (via the T4, where it IS the resident trade
        // validator → no eviction, shared model); location boxes=qwen2.5:14b on their own
        // iGPU. Unset/empty ⇒ the route's own default (back-compat). The old "force a tiny
        // T4 model to not evict Phil" note above is pre-consolidation — qwen-trader is now
        // the validator itself, so bar AI on it shares the resident model.
        OLLAMA_MODEL: process.env.OLLAMA_MODEL || '',
        OLLAMA_TOOLS_MODEL: process.env.OLLAMA_TOOLS_MODEL || '',
        OLLAMA_MODEL_SHURE: process.env.OLLAMA_MODEL_SHURE || '',
        RF_DIGEST_MODEL: process.env.RF_DIGEST_MODEL || '',
        OLLAMA_MODEL_NEIGHBORHOOD: process.env.OLLAMA_MODEL_NEIGHBORHOOD || '',
        // Per-box AI tuning (#339). MUST be forwarded here or a value set only in
        // .env never reaches the process (Gotcha #2 / SDR_* precedent). ai-suggest
        // reads OLLAMA_NUM_PREDICT (cap, default 2048 via hardware-config.ts) and
        // OLLAMA_TIMEOUT_MS (floor 300s). Slow local-iGPU boxes (e.g. Graystone
        // ~6.7 tok/s) set OLLAMA_NUM_PREDICT=1100 in their .env so a long
        // suggestion can't exceed the 300s timeout; T4-routed boxes leave default.
        OLLAMA_NUM_PREDICT: process.env.OLLAMA_NUM_PREDICT || '',
        OLLAMA_TIMEOUT_MS: process.env.OLLAMA_TIMEOUT_MS || '',
        // Persistent Server Actions encryption key (v2.52.6). Generated by
        // scripts/ensure-server-actions-key.sh on first run. Stays stable
        // across builds so client bundles' encrypted refs remain valid
        // after PM2 restart.
        NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
        // v2.53.1 — Ticketmaster Discovery API ingestion (task #161).
        // Default OFF: if TICKETMASTER_API_KEY is empty/unset, scraper
        // logs "disabled" and returns []. NEIGHBORHOOD_LATLONG is shared
        // with the SDR neighborhood scrape so the two stay in sync.
        TICKETMASTER_API_KEY: process.env.TICKETMASTER_API_KEY || '',
        TICKETMASTER_RADIUS_MILES: process.env.TICKETMASTER_RADIUS_MILES || '30',
        TICKETMASTER_LOOKAHEAD_DAYS: process.env.TICKETMASTER_LOOKAHEAD_DAYS || '14',
        NEIGHBORHOOD_LATLONG: process.env.NEIGHBORHOOD_LATLONG || '44.5012,-88.0626'
      },
      // Use PM2's default log location for better log rotation support
      // Custom logs still work through the app's logger system
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Error handling
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      // Bartender proxy — restricts access to bartender-facing routes only
      // (blocks /device-config, /matrix-control, /system-admin, etc.) so
      // iPads behind the bar can hit http://<host>:3002 without seeing
      // the admin UI. Zero-config: pure Node, no deps beyond the stdlib,
      // proxies to the main app on 127.0.0.1:3001.
      //
      // See apps/web/bartender-proxy.js for the allow/block list. Runs
      // as a second PM2-managed app so `pm2 start ecosystem.config.js`
      // brings both up together. verify-install.sh's bartender_proxy
      // layer is what confirms this is up after an auto-update restart.
      name: 'bartender-proxy',
      script: 'bartender-proxy.js',
      cwd: '/home/ubuntu/Sports-Bar-TV-Controller/apps/web',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      min_uptime: '10s',
      max_restarts: 15,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000
    }
  ]
}
