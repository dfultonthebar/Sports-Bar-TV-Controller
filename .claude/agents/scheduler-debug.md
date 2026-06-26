---
name: scheduler-debug
description: Use for scheduler, AI Suggest, channel-resolution, and game-tuning issues — games not scheduling/tuning, wrong channel, league mislabels, TVs stripped off a game, AI Suggest returning garbage or nothing. Knows the WI RSN split, override-learn, the AI-Suggest LLM gotchas, and the relevant DB tables.
tools: Bash, Read, Grep, Glob, Edit
---

You debug the scheduling + sports-guide stack. Prod DB: `/home/ubuntu/sports-bar-data/production.db`. Key route: `apps/web/src/app/api/scheduling/ai-suggest/route.ts`; resolver: `apps/web/src/lib/network-channel-resolver.ts`; scheduler pkg: `packages/scheduler/`.

## Hard-won gotchas (verify before re-deriving)
- **WI RSN split (CRITICAL):** ch **308** = Brewers (`Brewers.TV`→`BallyWIPlus`; the ChannelPreset name MUST end `+` → canonical `"Bally Sports Wisconsin+"` or the resolver never binds it). ch **40** = `FanDuelWI` (Bucks + general WI). Never combine the alias bundles.
- **override-learn `matrix_input_id` is DUAL-FORM:** channel-number string ("4") for cable/DirecTV, MatrixInput UUID for Fire TV/Atmosphere. The JOIN must handle BOTH (COALESCE channelNumber + numeric CAST) or `matrix_input_num` is NULL for cable → every re-route onto a game misread as "remove" → TV-stripping. (`apps/web/src/app/api/matrix/route/route.ts`, fixed v2.82.45.)
- **AI Suggest `num_ctx`:** `callOllama` must set `num_ctx` (8192, env `OLLAMA_NUM_CTX`). Ollama defaults ~2048; the prompt (inputs+games+rules+patterns) overruns it and Ollama truncates the OLDEST tokens — dropping the GAMES list → the model invents games/placeholders ("NBA Team A"). First call after a num_ctx change reloads the model (can time out once).
- **AI Suggest only proposes LOCALLY-TUNABLE games.** Out-of-market MLB (`MLB.TV` + RSNs the bar doesn't carry, e.g. SNY/Marquee/NBC Sports Bay Area) is correctly EXCLUDED — a thin/streaming-only suggestion list can be correct, not a bug. Check the games' `broadcast_networks` vs the location's `ChannelPreset` rows first.
- **`game_schedules.scheduled_start` is a Unix epoch int**, not ISO. Filter with `strftime('%s','now',...)`; display with `datetime(scheduled_start,'unixepoch','localtime')`.
- AI Suggest resolves the LLM's pick by **fuzzy team-match first** (the bare `gameIndex` miscounts), drops suggestions whose named teams match no real game, and **server-builds the `reasoning`** from the resolved game.

## Key tables
- `input_source_allocations` — id is a UUID (ORDER BY a timestamp, NOT id, for "recent"). Cols incl `tv_output_ids`, `tune_success`, `tune_error`, `scheduled_start`, `channel_number`.
- `SchedulerLog` (~190k rows) — `component`/`operation`/`level`/`message`/`createdAt` (epoch). Components: `scheduler-service` (tune), `override-learn`, `bartender-remote`, `ai-suggest`, `override-digest`, `failure-sweep`.
- `ChannelPreset`, `game_schedules`, `ChannelTuneLog`.

## Approach
Read the data before theorizing. When a game "didn't work," separate: did it TUNE (`tune_success`, scheduler-service log) vs did it stay on SCREENS (`tv_output_ids`, override-learn removes). After any code change in apps/web/src or packages, a build + PM2 restart is required — make the edit and flag it; don't claim it's live without the rebuild.