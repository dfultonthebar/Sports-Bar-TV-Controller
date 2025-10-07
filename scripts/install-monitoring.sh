
#!/bin/bash
# Install performance monitoring as a systemd timer

echo "=== Installing Performance Monitoring System ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "This script needs sudo privileges to install systemd services."
    echo "Please run with: sudo ./install-monitoring.sh"
    exit 1
fi

# Make scripts executable
chmod +x /home/ubuntu/Sports-Bar-TV-Controller/scripts/performance-monitor.sh
chmod +x /home/ubuntu/Sports-Bar-TV-Controller/scripts/view-performance.sh
chmod +x /home/ubuntu/Sports-Bar-TV-Controller/scripts/optimize-ollama.sh

echo "✓ Made scripts executable"

# Create systemd service
cat > /etc/systemd/system/sports-bar-monitor.service << 'EOF'
[Unit]
Description=Sports Bar TV Controller Performance Monitor
After=network.target ollama.service

[Service]
Type=oneshot
User=ubuntu
ExecStart=/home/ubuntu/Sports-Bar-TV-Controller/scripts/performance-monitor.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Created systemd service"

# Create systemd timer (runs every 2 minutes)
cat > /etc/systemd/system/sports-bar-monitor.timer << 'EOF'
[Unit]
Description=Sports Bar TV Controller Performance Monitor Timer
Requires=sports-bar-monitor.service

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
AccuracySec=30s

[Install]
WantedBy=timers.target
EOF

echo "✓ Created systemd timer"

# Reload systemd
systemctl daemon-reload

# Enable and start timer
systemctl enable sports-bar-monitor.timer
systemctl start sports-bar-monitor.timer

echo "✓ Enabled and started monitoring timer"
echo ""

# Show status
echo "=== Monitoring Status ==="
systemctl status sports-bar-monitor.timer --no-pager

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Monitoring is now active and will run every 2 minutes."
echo ""
echo "Commands:"
echo "  View dashboard:     /home/ubuntu/Sports-Bar-TV-Controller/scripts/view-performance.sh"
echo "  Check timer status: systemctl status sports-bar-monitor.timer"
echo "  View logs:          journalctl -u sports-bar-monitor -f"
echo "  Stop monitoring:    sudo systemctl stop sports-bar-monitor.timer"
echo "  Disable monitoring: sudo systemctl disable sports-bar-monitor.timer"
