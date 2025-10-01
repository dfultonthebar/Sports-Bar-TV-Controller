
#!/bin/bash

echo "Installing CEC Bridge for Pulse-Eight USB CEC Adapter..."

# Install libCEC
sudo apt-get update
sudo apt-get install -y cec-utils libcec6 libcec-dev nodejs npm

# Create CEC bridge directory
mkdir -p /home/ubuntu/cec-bridge
cd /home/ubuntu/cec-bridge

# Create package.json
cat > package.json << 'EOF'
{
  "name": "cec-http-bridge",
  "version": "1.0.0",
  "description": "HTTP bridge for Pulse-Eight CEC adapter",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
EOF

# Install dependencies
npm install

# Create CEC HTTP bridge server
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'CEC HTTP Bridge', timestamp: new Date().toISOString() });
});

// CEC command endpoint
app.post('/api/command', (req, res) => {
  const { command, targets = [], broadcast = false } = req.body;
  
  console.log(`CEC Command received: ${command}, targets: ${targets}, broadcast: ${broadcast}`);
  
  if (!command || !['on', 'standby'].includes(command)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid command. Use "on" or "standby"' 
    });
  }
  
  if (broadcast || targets.length === 0) {
    // Broadcast to all devices
    const cecCmd = `echo "${command} 0" | cec-client -s -d 1`;
    exec(cecCmd, { timeout: 10000 }, (error, stdout, stderr) => {
      console.log(`CEC broadcast response: ${stdout}`);
      res.json({ 
        success: !error, 
        command,
        broadcast: true,
        output: stdout, 
        error: error ? stderr : null 
      });
    });
  } else {
    // Send to specific targets
    const results = [];
    let completed = 0;
    
    targets.forEach((target, index) => {
      const cecCmd = `echo "${command} ${target}" | cec-client -s -d 1`;
      exec(cecCmd, { timeout: 10000 }, (error, stdout, stderr) => {
        results[index] = { 
          target, 
          success: !error, 
          output: stdout, 
          error: error ? stderr : null 
        };
        completed++;
        
        if (completed === targets.length) {
          console.log(`CEC individual commands completed:`, results);
          res.json({ 
            success: results.every(r => r.success), 
            command,
            results 
          });
        }
      });
    });
  }
});

// Get CEC device scan
app.get('/api/scan', (req, res) => {
  exec('echo "scan" | cec-client -s -d 1', { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      res.json({ success: false, error: stderr });
    } else {
      res.json({ success: true, devices: stdout });
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CEC HTTP Bridge running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
EOF

echo "CEC Bridge installation complete!"
echo ""
echo "To start the service manually:"
echo "cd /home/ubuntu/cec-bridge && node server.js"
echo ""
echo "Test the service:"
echo "curl http://localhost:8080/health"
