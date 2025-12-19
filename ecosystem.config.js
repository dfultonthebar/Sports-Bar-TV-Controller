
module.exports = {
  apps: [{
    name: 'sports-bar-tv-controller',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/home/ubuntu/Sports-Bar-TV-Controller/apps/web',
    instances: 1,
    exec_mode: 'fork',
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
      ADB_VENDOR_KEYS: '/home/ubuntu/.android'
    },
    // Use PM2's default log location for better log rotation support
    // Custom logs still work through the app's logger system
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Error handling
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
}
