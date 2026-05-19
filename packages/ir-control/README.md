# @sports-bar/ir-control

**Purpose:** IR blaster control via Global Cache iTach IP2IR. Includes the Global Cache IR Database API client for fetching IR codes by brand/model, plus a Spectrum cable-box model catalog.

**Key exports** (`src/index.ts`):
- `globalCacheAPI` — IR Database API singleton (`src/global-cache-api.ts`)
- `initializeGlobalCacheAPI` — auth + setup
- `searchSpectrumModels`, `getAllSpectrumModels` — Spectrum/Charter cable box catalog lookup
- `SPECTRUM_CABLE_BOX_MODELS` — model → display-name map (Cisco, Motorola, Pace, Arris, Samsung, Humax, Technicolor + Digital Adapter variants)

**Protocol / port:** Global Cache iTach IP2IR — TCP **4998** at runtime (control protocol). This package wraps Global Cache's **IR Database HTTP API** for code lookup; the actual IR emission uses learned codes in the `IRCommand` DB table sent through the iTach.

**Used by:** `apps/web` IR routes (`/api/ir/learn`, `/api/ir/commands/send`), `IRLearningPanel`. Wired into cable-box and other IR-controlled device flows.

**Gotchas:**
- **CEC is dead for cable boxes** — Wolf Pack matrix blocks CEC + Spectrum disables it in firmware. IR is the ONLY path for Spectrum boxes. Don't add new CEC code (CLAUDE.md §5).
- Learned IR codes have **`sendir,1:1,…` hardcoded** — the runtime substitutes the device's `globalCachePortNumber` before transmission. For multi-port iTach devices, port assignment matters or the wrong emitter fires (CLAUDE.md §10 "IR port adjustment").
- IR codes must be **complete** — truncated codes cause `ERR_2:1,010` errors. The learning API properly buffers TCP data for full capture.
- Spectrum cable boxes specifically need a complete model list — `SPECTRUM_CABLE_BOX_MODELS` is the canonical source (`src/global-cache-api.ts`).

**See also:**
- `docs/IR_LEARNING_DEMO_SCRIPT.md`
- `docs/IR_EMITTER_PLACEMENT_GUIDE.md`
- `docs/CEC_TO_IR_MIGRATION_GUIDE.md` (historical context)
- CLAUDE.md §5 + §8 (IR Learning System)
