
// Run this in your browser console (F12 → Console tab → paste & enter)
console.log('🔄 Clearing cached data and reloading...')

// Clear local storage
localStorage.clear()
sessionStorage.clear()

// Clear all caches
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name))
  })
}

// Force reload without cache
window.location.reload(true)

console.log('✅ Cache cleared, page should reload with fresh data')
