
# CEC Bridge Setup for Pulse-Eight USB CEC Adapter

## Option 1: Using libCEC with HTTP Bridge

### Install libCEC
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install cec-utils libcec4 libcec-dev

# Verify installation
echo "scan" | cec-client -s
```

### Create HTTP Bridge Service
```javascript
// cec-http-bridge.js
const express = require('express');
const { exec } = require('child_process');
const app = express();
const PORT = 8080;

app.use(express.json());

app.post('/api/command', (req, res) => {
  const { command, targets, broadcast } = req.body;
  
  if (broadcast) {
    // Broadcast to all devices
    exec(`echo "${command} 0" | cec-client -s -d 1`, (error, stdout, stderr) => {
      res.json({ success: !error, output: stdout, error: stderr });
    });
  } else {
    // Send to specific targets
    const promises = targets.map(target => {
      return new Promise((resolve) => {
        exec(`echo "${command} ${target}" | cec-client -s -d 1`, (error, stdout, stderr) => {
          resolve({ target, success: !error, output: stdout, error: stderr });
        });
      });
    });
    
    Promise.all(promises).then(results => {
      res.json({ success: true, results });
    });
  }
});

app.listen(PORT, () => {
  console.log(`CEC HTTP Bridge running on port ${PORT}`);
});
```

## Option 2: Using Node-CEC Library

### Install Node-CEC
```bash
npm install @senzil/cec-monitor
```

### CEC Control Service
```javascript
// cec-service.js
const CecMonitor = require('@senzil/cec-monitor');
const express = require('express');

const monitor = new CecMonitor();
const app = express();

app.use(express.json());

monitor.once(CecMonitor.EVENTS.READY, () => {
  console.log('CEC Monitor ready');
});

app.post('/api/command', (req, res) => {
  const { command, targets } = req.body;
  
  try {
    if (command === 'on') {
      targets.forEach(target => {
        monitor.WriteRawMessage(`44:04:${target.toString(16).padStart(2, '0')}`);
      });
    } else if (command === 'standby') {
      targets.forEach(target => {
        monitor.WriteRawMessage(`44:36:${target.toString(16).padStart(2, '0')}`);
      });
    }
    
    res.json({ success: true, command, targets });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(8080, () => {
  console.log('CEC Service running on port 8080');
});
```

## SystemD Service Setup

```ini
# /etc/systemd/system/cec-bridge.service
[Unit]
Description=CEC HTTP Bridge Service
After=network.target

[Service]
Type=simple
User=sports-bar
WorkingDirectory=/home/sports-bar/cec-bridge
ExecStart=/usr/bin/node cec-http-bridge.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable service:
```bash
sudo systemctl enable cec-bridge
sudo systemctl start cec-bridge
sudo systemctl status cec-bridge
```
