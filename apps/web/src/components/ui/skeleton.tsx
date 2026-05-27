import { cn } from '@/lib/utils'

/**
 * Skeleton placeholder primitives.
 *
 * Base building block + two convenience wrappers (row, card). Tailwind-only,
 * no extra deps. Use during initial data fetches so dashboards don't flash
 * a blank pane or "Loading..." text.
 *
 * Pattern: keep the skeleton's outer wrapper dimensions/spacing the same as
 * the real content it stands in for, so the layout doesn't jump when data
 * arrives.
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

/** Base gray-pulse block. Size via className (e.g. "h-4 w-full"). */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-slate-700/50 rounded',
        className
      )}
      {...props}
    />
  )
}

/**
 * Convenience for a table row — 4 skeleton blocks of varying widths in a
 * flex layout. Drop into a tbody/td container or any horizontal row slot.
 */
export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div className={cn('flex items-center gap-3 py-2 px-3', className)}>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

/**
 * Convenience for a card placeholder — heading skeleton + 3 row skeletons,
 * wrapped in the same border + padding as the dashboard cards.
 */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-700 p-6 space-y-4',
        className
      )}
    >
      <Skeleton className="h-6 w-1/3" />
      <div className="space-y-3 pt-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}
