# Documentation Index — Organized by Equipment + Integration

**Purpose:** master catalog of all hardware manuals, integration guides,
operational runbooks, and architecture docs — categorized by what they
control. Complements the role-based `INDEX.md` (which organizes by user
type — bartender / admin / developer).

**Created:** 2026-05-18 (Option-B reorg session)

**File organization rules** (applied 2026-05-18):
- **Per-equipment docs** → `docs/by-equipment/<vendor>/`
- **Per-integration docs** → `docs/by-integration/<service>/`
- **Architecture / design docs** → `docs/architecture/`
- **Operational refs referenced by scripts or CLAUDE.md** stay in
  place at `docs/` root (moving them would break links)
- **Per-location bar refs** stay at `.claude/locations/*.md`
- **Memory/feedback** stays at
  `~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/`

---

## 1. Hardware — by equipment family

### Atlas Atmosphere AZM4 / AZM8 (audio DSP)
- `docs/by-equipment/atlas-azm8/ATLAS_PHYSICAL_CONFIGURATION_PUBLIC.md`
- `docs/by-equipment/atlas-azm8/ATLAS_PHYSICAL_CONFIGURATION_PUBLIC.pdf`
- `docs/by-equipment/atlas-azm8/atlas-ai-knowledge-base.pdf`
- `packages/atlas/README.md` — TCP 5321 JSON-RPC + UDP 3131 meters
- `CLAUDE.md` §7 + §7b — architecture
- Memory: `feedback_atlas_azm8_no_priority_param.md`,
  `feedback_atlas_firmware_4_5_custom_priority_volume.md`

### Shure SLX-D wireless mic
- `packages/shure-slxd/README.md` — full SME protocol briefing
- `CLAUDE.md` §7a — Shure architecture + protocol gotchas
- Memory: `project_shure_sdr_atlas_rf_pipeline.md`

### Shure / NESDR SDR (wide-band RF monitoring)
- `docs/by-equipment/shure-sdr/AI_RF_SME_ROADMAP.md`
- `CLAUDE.md` §7b — SDR watcher architecture
- `scripts/setup-sdr.sh` — one-time hardware install

### Wolf Pack HDMI matrix (HDTVSupply Corio)
- `docs/by-equipment/wolfpack-matrix/wolfpack-ai-knowledge-base.pdf`
- `docs/WOLFPACK_HTTP_API_REFERENCE.md` *(in place — CLAUDE.md refs)*
- `packages/multiview/README.md` — Multi-View Quad-View cards

### Crestron DM matrix
- `packages/crestron/README.md` — Telnet 23 + model list + output offsets

### DirecTV receivers (Genie / clients)
- `docs/by-equipment/directv/DIRECTV_INTEGRATION.pdf` — SHEF API spec

### Amazon Fire TV (Cube + Stick)
- `docs/by-equipment/firetv/FIRETV_QUICK_REFERENCE.md`

### BSS Soundweb London (audio DSP)
- `packages/bss-blu/README.md` — HiQnet TCP 1023

### dbx ZonePRO (audio DSP)
- `packages/dbx-zonepro/README.md` — HiQnet TCP 3804 + scene recall gotcha

### Global Cache iTach IP2IR (IR blaster)
- `docs/IR_LEARNING_DEMO_SCRIPT.md` *(in place — CLAUDE.md refs)*
- `docs/IR_EMITTER_PLACEMENT_GUIDE.md` *(in place — CLAUDE.md refs)*

### Pulse Eight CEC adapter
- `docs/by-equipment/pulse-eight-cec/pulse-eight-integration-guide.pdf`
- `docs/CEC_TO_IR_MIGRATION_GUIDE.md` *(in place — CLAUDE.md refs)*

### Lutron / Hue / DMX / Commercial Lighting
- `packages/commercial-lighting/` + `packages/dmx/` driver code

---

## 2. Third-party integrations — by service

### Soundtrack Your Brand
- `docs/SOUNDTRACK_INTEGRATION_GUIDE.md` *(in place — CLAUDE.md refs)*
- `packages/soundtrack/`

### Rail Media Sports Guide
- `packages/sports-apis/` + `docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md`

### NFHS Network
- `docs/by-integration/nfhs/NFHS_API_INTEGRATION.pdf`
- `docs/NFHS_API_INTEGRATION.md` *(in place — scripts ref)*

### N8N automation
- `docs/by-integration/n8n/N8N_INTEGRATION.md`

### ESPN / TheSportsDB
- `packages/sports-apis/`

### Ollama (local LLM, Intel iGPU)
- `CLAUDE.md` §9 — IPEX-LLM portable build (v2.32.57+)
- Memory: `feedback_ipex_llm_sycl_quirks.md`

### Global Cache IR Database (cloud)
- `irdb.globalcache.com:8081` — cable box IR codes

---

## 3. Architecture + design docs

- `CLAUDE.md` — master conventions + standing rules
- `docs/architecture/AI_OPERATIONS_HUB_DESIGN.md` — two-agent system plan
- `docs/AUTO_UPDATE_SYSTEM_PLAN.md`
- `docs/CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md`
- `docs/NETWORK_ARCHITECTURE_DECISION.md`
- `docs/OBSBOT_TAIL_2_PLAN.md`
- `docs/SPORTS_GUIDE_ADMIN_CONSOLIDATION.md`

---

## 4. Operational runbooks (stay in place — script/CLAUDE.md refs)

### Install / Setup
- `INSTALLATION.md`, `DEPLOYMENT.md`, `ssh.md`
- `docs/NEW_LOCATION_SETUP.md`
- `docs/VERSION_SETUP_GUIDE.md` — per-version manual steps
- `docs/OS_UPGRADE_RUNBOOK.md`

### Day-to-day ops
- `docs/OPERATIONS_PLAYBOOK.md`
- `docs/TROUBLESHOOTING_GUIDE.md`, `docs/FAQ.md`
- `docs/SYSTEM_ADMIN_GUIDE.md`
- `docs/FLEET_STATUS.md`, `docs/FLEET_TRIGGER_RUNBOOK.md`
- `docs/HARDWARE_CONFIGURATION.md`, `docs/HARDWARE_CONNECTIVITY_REPORT.md`
- `docs/BARTENDER_QUICK_START.md`
- `docs/MEMORY_MONITORING.md`

### Auto-update / version history
- `docs/LOCATION_UPDATE_NOTES.md`
- `docs/VERSION_SETUP_GUIDE.md`
- `docs/AUTO_UPDATE_SETUP.md`
- `docs/AUTO_UPDATE_SYSTEM_PLAN.md`

### Auth + UI
- `docs/AUTHENTICATION_GUIDE.md`
- `docs/UI_STYLING.md`

### API
- `docs/API_REFERENCE.md`, `docs/API_QUICK_REFERENCE.md`

---

## 5. Per-location bar references

All at `.claude/locations/*.md` — hardware IPs + channel maps + quirks per bar:

| Location | File |
|---|---|
| Holmgren Way (Green Bay, near Lambeau) | `.claude/locations/holmgren-way.md` |
| Graystone (Green Bay) | `.claude/locations/graystone.md` |
| Lucky's 1313 | `.claude/locations/lucky-s-1313.md` |
| Stoneyard Greenville | `.claude/locations/stoneyard-greenville.md` |
| Stoneyard Appleton | `.claude/locations/stoneyard-appleton.md` |
| Leg Lamp | `.claude/locations/leg-lamp.md` |

---

## 6. Memory / gotchas (auto-memory)

Path: `~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/`

46+ feedback + project memory files documenting operator preferences,
hardware-specific gotchas, build/deploy workflow gotchas, React/Next.js
gotchas. All indexed into RAG — reachable via `/api/rag/query` and
the AI Hub chat (once Option B unification ships).

---

## 7. Archived / historical

- `docs/archive/pdfs/` — 200+ historical implementation records
- `docs/archive/scheduling-features/`

---

## How this catalog stays current

When adding new equipment or integration:

1. Create a subdir under `docs/by-equipment/<vendor>/` or `docs/by-integration/<service>/`
2. Drop vendor manuals + integration docs there
3. Add a section to this file
4. Run `npx tsx scripts/scan-system-docs.ts --clear` to refresh RAG

The RAG ingestion picks up everything under `docs/`, `packages/*/README.md`,
`.claude/locations/`, `ai-assistant/`, and all auto-memory files
automatically — no script changes needed for new doc additions.
