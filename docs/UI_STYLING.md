# UI Styling Guide — Location Tab Style (Dark Theme)

**Status:** Recommended pattern for new dashboard components, not a hard rule. Existing components mix patterns; reference implementation is `apps/web/src/components/SchedulerLogsDashboard.tsx`.

## Core Principles

- **NO `Card` components** — use bordered `div`s instead.
- **NO white backgrounds** — all backgrounds are dark slate variants.
- **Borders:** `border-slate-700` for sections.
- **Backgrounds:** semi-transparent like `bg-slate-800/50`.

## Section Container

```tsx
<div className="rounded-lg border border-slate-700 p-6">
  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
    <IconName className="h-5 w-5 text-blue-400" />
    Section Title
  </h3>
  {/* Content */}
</div>
```

## Summary Stats

```tsx
<div className="grid grid-cols-4 gap-4 mb-6">
  <div className="rounded-lg bg-slate-800/50 p-4 flex items-center gap-3">
    <IconName className="h-8 w-8 text-blue-400" />
    <div>
      <p className="text-xs text-slate-400">Label</p>
      <p className="text-2xl font-bold text-white">Value</p>
    </div>
  </div>
</div>
```

## Form Inputs

```tsx
<SelectTrigger className="bg-slate-800 border-slate-600">
<Input className="bg-slate-800 border-slate-600" placeholder="..." />
<Button variant="outline" className="border-slate-600 hover:bg-slate-700">
```

## Color-Coded Badges

```tsx
const COMPONENT_COLORS: Record<string, string> = {
  'scheduler-service':  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'auto-reallocator':   'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'distribution-engine':'bg-green-500/20 text-green-400 border-green-500/30',
}

const OPERATION_COLORS: Record<string, string> = {
  'tune':    'bg-green-500/20 text-green-400 border-green-500/30',
  'recover': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'check':   'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'startup': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}
```

## Level Badges

| Level | Classes | Icon |
|---|---|---|
| Error | `bg-red-500/20 text-red-400` | `XCircle` |
| Warning | `bg-amber-500/20 text-amber-400` | `AlertTriangle` |
| Info | `bg-blue-500/20 text-blue-400` | `Activity` |
| Debug | `bg-slate-500/20 text-slate-400` | `Search` |

## Tables

```tsx
<thead className="bg-slate-800">
  <tr><th className="text-left p-3 text-slate-300 font-medium">...</th></tr>
</thead>

// Alternating rows
<tr className={index % 2 === 0 ? "bg-slate-800/30" : "bg-slate-800/50"}>

// Error/warning row backgrounds
className="bg-red-950/30"    // Error rows
className="bg-amber-950/20"  // Warning rows
```

## Filter Labels

```tsx
<div className="space-y-2">
  <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
    <Calendar className="h-3 w-3" /> Time Range
  </label>
  <Select>
    <SelectTrigger className="bg-slate-800 border-slate-600">
      <SelectValue placeholder="Select..." />
    </SelectTrigger>
    ...
  </Select>
</div>
```

## Reference

`apps/web/src/components/SchedulerLogsDashboard.tsx` — complete implementation of this pattern.
