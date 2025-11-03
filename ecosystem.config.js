
module.exports = {
  apps: [{
    name: 'sports-bar-tv-controller',
    script: '.next/standalone/server.js',
    cwd: '/home/ubuntu/Sports-Bar-TV-Controller',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
