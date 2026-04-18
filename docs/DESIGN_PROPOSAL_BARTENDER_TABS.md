# Design Proposal: Bartender Tab Bar Redesign

**Branch:** `location/holmgren-way`  
**Date:** 2026-04-18  
**Status:** Awaiting direction pick — do NOT implement until A or B is chosen.

---

## Problems Being Solved

| Problem | Current state |
|---|---|
| Duplicate icon | `Calendar` used for both Guide and Schedule |
| Wrong metaphor | `Gamepad2` for cable-box IR remote |
| Sub-44px touch targets | `w-4 h-4` icon + `text-xs` in `px-2 py-2` ≈ 30×40px on iPad |
| Rainbow accents | 9 different color tints with no hierarchy signal |
| No active-state depth | Only a background tint shift; no border, ring, or scale |

---

## Shared Constraints (both directions)

- Dark theme only. `bg-slate-900/95` shell, `border-slate-700` dividers — no white, no Card.
- 44×44px minimum touch target (Apple HIG / CLAUDE.md requirement).
- `text-sm` minimum for interactive labels on core tabs.
- Single accent color for all active states.
- **Icon replacements (both directions):**
  - Guide: `ListVideo` — program-list metaphor, no calendar
  - Remote: `Radio` — IR/cable-box signal, not a game controller
  - Schedule: `Clock` — time concept, removes Calendar duplicate

---

## Direction A — "Amber Tier"

**Concept:** Hard two-tier visibility. Four core tabs dominate; three ambient tabs are visibly smaller but still tappable; admin tabs (Schedule, DJ, Power) live in a `More` overflow slide-up sheet. Bartenders muscle-memory four buttons at full size; everything else is reachable in one more tap.

### Single Accent: `amber-400`

Warm gold reads clearly in a dim bar without triggering "error" associations (red), "police siren" energy (blue flashing), or TV-news authority (broadcast blue). At 2am under amber bar lighting it contrasts maximally against the dark slate background while feeling calm, not alarming.

### Active-State Treatment

```tsx
// Core tab — active
className="bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg"

// Core tab — inactive
className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg"
```

The explicit `border` adds visual depth over a pure background tint — it gives the pressed tile a "lit panel" quality without scale transforms that stutter on older iPads under load.

### Tab Layout & Sizing

| Tier | Tabs | Height | Icon | Label |
|---|---|---|---|---|
| **Primary (Core)** | Video, Guide, Routing, Remote | `min-h-[52px] min-w-[72px] px-3 py-3` | `h-5 w-5` | `text-sm font-semibold` |
| **Secondary (Ambient)** | Audio, Music, Lighting (conditional) | `min-h-[44px] min-w-[56px] px-2 py-2` | `h-4 w-4` | `text-xs font-medium` |
| **Overflow** | More → Schedule, DJ, Power | `min-h-[44px] min-w-[48px] px-2 py-2` | `h-4 w-4` | `text-xs font-medium` |

A `border-l border-slate-700/60 mx-1` separator visually groups core vs. ambient vs. overflow.

### 768px Landscape iPad — Text Mockup

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          BARTENDER REMOTE                                │
├──────────────────────────────────────────────────────────────────────────┤
│  [content area]                                                          │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  ╔══Video══╗  ╔══Guide══╗  ╔═Routing═╗  ╔══Remote══╗  │  Audio  Music  Lighting  ⋯More  │
│  ║ 52px h ║  ║ 52px h  ║  ║ 52px h  ║  ║  52px h  ║  │  44px   44px    44px      44px  │
│  ╚═══════╝  ╚═════════╝  ╚═════════╝  ╚══════════╝  │                                 │
│  amber border when active; slate-400 text when inactive                  │
└──────────────────────────────────────────────────────────────────────────┘
More sheet (slide-up):  [ 🕐 Schedule ]  [ 🎚 DJ Mode ]  [ ⏻ Power ]
```

### Tailwind Active State (exact classes)

```tsx
// Primary core — active
"min-h-[52px] min-w-[72px] flex flex-col items-center justify-center gap-1.5 px-3 py-3
 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg transition-colors"

// Primary core — inactive
"min-h-[52px] min-w-[72px] flex flex-col items-center justify-center gap-1.5 px-3 py-3
 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"

// Secondary ambient — active
"min-h-[44px] min-w-[56px] flex flex-col items-center justify-center gap-1 px-2 py-2
 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg transition-colors"
```

---

## Direction B — "Sky Signal"

**Concept:** Soft three-tier visibility via size + opacity alone — no hard dividers, no overflow for Lighting or Audio. All seven operational tabs stay in view; Power always visible for emergency access; Schedule and DJ move to overflow. Hierarchy is communicated through sizing and inactive-text weight rather than grouping brackets. Feels more like a native iPad app, less like a tool panel.

### Single Accent: `sky-400`

Sky blue is maximally distant from the warm-amber bar lighting ambience, creating high perceptual contrast without harshness. It reads as "system acknowledged" — calm, professional, neither alarming (red) nor noisy (bright green). Against `bg-slate-900` it pops cleanly even on iPad screens with Auto-Brightness cranked down.

### Active-State Treatment

```tsx
// All tiers — active
className="ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 rounded-xl scale-[1.03] transition-all"

// All tiers — inactive (core)
className="text-slate-400 hover:text-slate-200 rounded-xl transition-all"

// Inactive (ambient) — slightly more receded
className="text-slate-500 hover:text-slate-300 rounded-xl transition-all"
```

`ring-1` sits outside the element's box-model so adjacent tabs don't shift on activation. `scale-[1.03]` provides physical press feedback at a magnitude that renders smoothly at 60fps on iPad A-series chips.

### Tab Layout & Sizing

| Tier | Tabs | Height | Icon | Label |
|---|---|---|---|---|
| **Core** | Video, Guide, Routing, Remote | `min-h-[52px] min-w-[60px] px-2.5 py-3` | `h-5 w-5` | `text-sm font-medium` |
| **Ambient** | Audio, Music, Lighting (conditional) | `min-h-[44px] min-w-[52px] px-2 py-2` | `h-4 w-4` | `text-xs font-medium` |
| **Emergency** | Power | `min-h-[44px] min-w-[44px] px-2 py-2` | `h-4 w-4` | `text-xs font-medium` |
| **Overflow** | ⋯More → Schedule, DJ | `min-h-[44px] min-w-[44px] px-2 py-2` | `h-4 w-4` | `text-xs font-medium` |

No divider — hierarchy lives entirely in size ratios and `text-slate-400` vs `text-slate-500` inactive contrast.

### 768px Landscape iPad — Text Mockup

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          BARTENDER REMOTE                                │
├──────────────────────────────────────────────────────────────────────────┤
│  [content area]                                                          │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  ╔═Video═╗  ╔═Guide═╗  ╔Routing╗  ╔Remote╗   Audio   Music  Lighting   ⏻     ⋯      │
│  52px h    52px h    52px h    52px h    44px    44px   44px      44px   44px  │
│  (sky ring + scale when active; no dividers between groups)              │
└──────────────────────────────────────────────────────────────────────────┘
More sheet (slide-up):  [ 🕐 Schedule ]  [ 🎚 DJ Mode ]
```

### Tailwind Active State (exact classes)

```tsx
// Core — active
"min-h-[52px] min-w-[60px] flex flex-col items-center justify-center gap-1.5 px-2.5 py-3
 ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 rounded-xl scale-[1.03] transition-all"

// Core — inactive
"min-h-[52px] min-w-[60px] flex flex-col items-center justify-center gap-1.5 px-2.5 py-3
 text-slate-400 hover:text-slate-200 rounded-xl transition-all"

// Ambient — active
"min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-1 px-2 py-2
 ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 rounded-xl scale-[1.03] transition-all"

// Ambient — inactive
"min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-1 px-2 py-2
 text-slate-500 hover:text-slate-300 rounded-xl transition-all"
```

---

## Comparison Table

| | Direction A — Amber Tier | Direction B — Sky Signal |
|---|---|---|
| **Accent color** | `amber-400` — warm gold | `sky-400` — cool blue |
| **Active signal** | Bordered tile (lit panel) | Ring + subtle scale (physical press) |
| **Visible tabs** | 7 (4 core + 3 ambient + More) | 8–9 (4 core + 3 ambient + Power + More) |
| **Admin tabs** | Schedule, DJ, Power all in More | Schedule, DJ in More; Power always visible |
| **Hierarchy method** | Hard size difference + divider | Size + opacity gradient, no divider |
| **iPad feel** | Tool panel / professional dashboard | Native app / tactile |
| **Risk** | More sheet adds one tap for Power (emergency) | 9 items is dense at 768px |
| **Best fit if…** | Bar prefers clean separation, minimal clutter | Bar uses DJ/Power frequently enough to need visibility |

---

## Icon Reference (both directions)

| Tab | Replace | With | Lucide import |
|---|---|---|---|
| Guide | `Calendar` | `ListVideo` | `import { ListVideo } from 'lucide-react'` |
| Remote | `Gamepad2` | `Radio` | `import { Radio } from 'lucide-react'` |
| Schedule | `Calendar` (duplicate) | `Clock` | `import { Clock } from 'lucide-react'` |
| More (overflow) | n/a | `MoreHorizontal` | `import { MoreHorizontal } from 'lucide-react'` |

All other icons (Tv, Volume2, Music2, Zap, Music, Lightbulb, Power) stay unchanged.

---

*Implementation happens in a follow-up session after direction is chosen. No changes to `apps/web/` in this commit.*
