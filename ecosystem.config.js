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
      node_args: '--max-old-space-size=512',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '30s',  // Increased from 10s to prevent rapid restart cycles
      max_restarts: 15,   // Increased from 10 to handle transient failures
      restart_delay: 5000, // Increased from 4000ms to 5000ms for stability
      exp_backoff_restart_delay: 1000, // Exponential backoff starting at 1s
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        ADB_VENDOR_KEYS: '/home/ubuntu/.android',
        // Sports Guide API (The Rail Media)
        SPORTS_GUIDE_API_KEY: '12548RK0000000d2bb701f55b82bfa192e680985919',
        SPORTS_GUIDE_USER_ID: '258351',
        SPORTS_GUIDE_API_URL: 'https://guide.thedailyrail.com/api/v1',
        // Auth system — bind to the location row in the DB. Without this,
        // validatePIN() falls back to AUTH_CONFIG.LOCATION_ID='default-location'
        // and every login fails with "Invalid PIN".
        LOCATION_ID: process.env.LOCATION_ID || 'default-location',
        // Logger minimum level. Defaults to INFO in production, set
        // LOG_LEVEL=DEBUG in .env to surface verbose traces from
        // [CHANNEL_RESOLVER], [AUTO_UPDATE_API], and other component tags.
        LOG_LEVEL: process.env.LOG_LEVEL || 'INFO'
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
