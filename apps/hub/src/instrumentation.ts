/**
 * Hub instrumentation — runs the central ESPN sync (Feature B1) so every
 * location can pull game schedules from here instead of each box hitting ESPN's
 * 26 leagues every 10 min independently.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { syncAllLeaguesToHub } = await import('./lib/espn-sync')
  // Initial sync shortly after boot (let the server settle), then every 10 min.
  setTimeout(() => void syncAllLeaguesToHub().catch((e) => console.error('[HUB] initial ESPN sync failed:', e)), 10_000)
  setInterval(() => void syncAllLeaguesToHub().catch((e) => console.error('[HUB] ESPN sync failed:', e)), 10 * 60 * 1000)
  console.log('[HUB] central ESPN sync registered (every 10 min)')
}
