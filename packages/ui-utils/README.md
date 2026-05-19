# @sports-bar/ui-utils

**Purpose:** Shared UI utility functions — currently just the `cn(...)` Tailwind class-merging helper. Every component file that conditionally composes classes imports from here.

**Key exports** (`src/index.ts`):
- `cn(...inputs: ClassValue[]): string` — combines `clsx` for conditional class names with `tailwind-merge` for Tailwind conflict resolution. Example:
  ```ts
  cn('px-2 py-1', 'px-4')                    // → 'py-1 px-4' (px-4 overrides px-2)
  cn('text-red-500', condition && 'text-blue-500')
  ```
- `ClassValue` — re-exported from `clsx` for convenience

**Protocol / port:** N/A — pure utility.

**Used by:** Practically every React component in `apps/web/src/components/` for class composition. Wraps two npm deps so consumers only need to import one symbol.

**Gotchas:**
- This is the canonical `cn` — don't reinvent it locally or import `clsx` / `tailwind-merge` directly.
- Last-class-wins for conflicting Tailwind utilities (that's the whole point of `tailwind-merge`).
- Adding new helpers here? Keep them framework-agnostic — this package has no React dep.

**See also:**
- `docs/UI_STYLING.md` (dark-theme + general UI patterns)
- CLAUDE.md → "Frontend Component Architecture"
