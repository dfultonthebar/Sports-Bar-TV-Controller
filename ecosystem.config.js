
module.exports = {
  apps: [{
    name: 'sports-bar-tv-controller',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-error.log',
    out_file: '/home/ubuntu/Sports-Bar-TV-Controller/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
}
