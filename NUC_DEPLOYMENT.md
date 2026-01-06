
# 🖥️ Intel NUC Deployment Guide - Sports Bar TV Controller

Complete guide for deploying the Sports Bar TV Controller on Intel NUC systems, specifically optimized for the Intel NUC13ANHi5.

---

## 📋 Table of Contents

1. [Hardware Overview](#hardware-overview)
2. [Initial Setup](#initial-setup)
3. [Operating System Installation](#operating-system-installation)
4. [Network Configuration](#network-configuration)
5. [Application Installation](#application-installation)
6. [Performance Optimization](#performance-optimization)
7. [Remote Access](#remote-access)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [Production Deployment](#production-deployment)

---

## 🖥️ Hardware Overview

### Intel NUC13ANHi5 Specifications

**Processor:**
- Intel Core i5-1340P (13th Gen)
- 12 cores (4 P-cores + 8 E-cores)
- 16 threads
- Base: 1.9 GHz, Turbo: up to 4.6 GHz
- 12MB Intel Smart Cache

**Memory:**
- Supports up to 64GB DDR4-3200 SO-DIMM
- Dual-channel configuration
- **Recommended:** 16GB (2x8GB) or 32GB (2x16GB)

**Storage:**
- M.2 2280 PCIe 4.0 x4 NVMe SSD slot
- M.2 2242/2280 PCIe 3.0 x4 or SATA slot
- **Recommended:** 512GB NVMe SSD minimum

**Connectivity:**
- 2x Thunderbolt 4 (USB-C)
- 4x USB 3.2 Gen 2 (Type-A)
- 2x HDMI 2.1
- 2.5 Gigabit Ethernet
- Wi-Fi 6E (802.11ax)
- Bluetooth 5.3

**Graphics:**
- Intel Iris Xe Graphics
- Supports up to 4 displays
- 4K@60Hz output

**Power:**
- 120W power adapter included
- Low power consumption (~15W idle, ~65W load)

### Why Intel NUC13ANHi5 is Ideal

✅ **Powerful AI Performance:** 12 cores handle Ollama AI models efficiently  
✅ **Compact Form Factor:** Small footprint for behind-bar installation  
✅ **Low Power Consumption:** Energy efficient for 24/7 operation  
✅ **Multiple Display Support:** Can drive matrix switcher and monitoring displays  
✅ **Excellent Connectivity:** Multiple USB ports for CEC adapter and peripherals  
✅ **Quiet Operation:** Fanless or low-noise cooling  
✅ **Enterprise Reliability:** Built for continuous operation  

### Recommended Configuration

**For Sports Bar TV Controller:**

| Component | Specification | Price Range |
|-----------|--------------|-------------|
| **NUC** | Intel NUC13ANHi5 | $500-600 |
| **RAM** | 16GB DDR4-3200 (2x8GB) | $50-70 |
| **Storage** | 512GB NVMe SSD | $50-80 |
| **Total** | | **$600-750** |

**Optional Upgrades:**
- 32GB RAM for heavy AI workloads: +$80-120
- 1TB SSD for more storage: +$30-50
- UPS for power protection: +$100-200

---

## 🔧 Initial Setup

### 1. Hardware Assembly

**What you'll need:**
- Intel NUC13ANHi5 (bare bones)
- DDR4 SO-DIMM RAM (16GB recommended)
- M.2 NVMe SSD (512GB recommended)
- Phillips screwdriver
- USB keyboard and mouse
- HDMI cable and monitor
- Ethernet cable

**Assembly steps:**

1. **Remove bottom cover**
   - Unscrew 4 screws on bottom
   - Slide cover off

2. **Install RAM**
   - Insert RAM at 45° angle
   - Press down until clips engage
   - Install second stick if using dual-channel

3. **Install SSD**
   - Remove M.2 screw
   - Insert SSD at 45° angle into slot
   - Press down and secure with screw

4. **Replace bottom cover**
   - Slide cover back on
   - Secure with 4 screws

5. **Connect peripherals**
   - Connect HDMI to monitor
   - Connect USB keyboard and mouse
   - Connect Ethernet cable
   - Connect power adapter

### 2. BIOS Configuration

**Access BIOS:**
- Power on NUC
- Press F2 repeatedly during boot

**Recommended BIOS settings:**

**Boot Configuration:**
- Boot Order: SSD first
- Fast Boot: Enabled
- Network Boot: Disabled (unless needed)

**Power Management:**
- After Power Failure: Power On (for automatic recovery)
- Wake on LAN: Enabled (for remote management)

**Performance:**
- Intel Turbo Boost: Enabled
- Intel Hyper-Threading: Enabled
- Intel Virtualization: Enabled (if using Docker)

**Security:**
- Secure Boot: Disabled (for Linux compatibility)
- BIOS Password: Set for production environments

**Save and Exit:**
- Press F10 to save changes
- Confirm and reboot

---

## 💿 Operating System Installation

### Recommended OS: Ubuntu Server 22.04 LTS

**Why Ubuntu Server:**
- ✅ Long-term support (5 years)
- ✅ Excellent hardware compatibility
- ✅ Large community and documentation
- ✅ Optimized for server workloads
- ✅ Easy remote management

### 1. Download Ubuntu Server

**Download from:** https://ubuntu.com/download/server

**Version:** Ubuntu Server 22.04.3 LTS (64-bit)

**File:** ubuntu-22.04.3-live-server-amd64.iso

### 2. Create Bootable USB

**On Windows:**
1. Download Rufus: https://rufus.ie/
2. Insert USB drive (8GB minimum)
3. Open Rufus
4. Select Ubuntu ISO
5. Click Start

**On Linux:**
```bash
# Find USB device
lsblk

# Write ISO to USB (replace sdX with your device)
sudo dd if=ubuntu-22.04.3-live-server-amd64.iso of=/dev/sdX bs=4M status=progress
sudo sync
```

**On macOS:**
```bash
# Find USB device
diskutil list

# Unmount USB
diskutil unmountDisk /dev/diskX

# Write ISO to USB
sudo dd if=ubuntu-22.04.3-live-server-amd64.iso of=/dev/rdiskX bs=1m
```

### 3. Install Ubuntu Server

**Boot from USB:**
1. Insert USB into NUC
2. Power on and press F10 for boot menu
3. Select USB drive

**Installation steps:**

1. **Language:** English
2. **Keyboard:** English (US)
3. **Installation type:** Ubuntu Server
4. **Network:** Configure Ethernet (DHCP or static)
5. **Proxy:** Leave blank (unless required)
6. **Mirror:** Default (or closest mirror)
7. **Storage:**
   - Use entire disk
   - Set up LVM: Yes
   - Encrypt: Optional (recommended for production)
8. **Profile:**
   - Your name: sportsbar
   - Server name: sportsbar-nuc
   - Username: sportsbar
   - Password: [secure password]
9. **SSH:** Install OpenSSH server (Yes)
10. **Snaps:** Skip (we'll install manually)
11. **Installation:** Wait for completion
12. **Reboot:** Remove USB and reboot

### 4. First Boot Configuration

**Login:**
```bash
# Username: sportsbar
# Password: [your password]
```

**Update system:**
```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

**Install essential tools:**
```bash
sudo apt install -y \
  curl \
  wget \
  git \
  htop \
  net-tools \
  build-essential \
  software-properties-common
```

---

## 🌐 Network Configuration

### Static IP Configuration

**Why static IP:**
- Consistent access from other devices
- Easier remote management
- Required for production deployment

**Find current network interface:**
```bash
ip addr show
# Look for interface like "enp0s31f6" or "eth0"
```

**Edit netplan configuration:**
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

**Example configuration:**
```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s31f6:  # Replace with your interface name
      dhcp4: no
      addresses:
        - 192.168.1.100/24  # Your desired static IP
      routes:
        - to: default
          via: 192.168.1.1  # Your router IP
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

**Apply configuration:**
```bash
sudo netplan apply
```

**Verify:**
```bash
ip addr show
ping -c 4 google.com
```

### Hostname Configuration

**Set hostname:**
```bash
sudo hostnamectl set-hostname sportsbar-nuc
```

**Update hosts file:**
```bash
sudo nano /etc/hosts
```

Add:
```
127.0.0.1 localhost
127.0.1.1 sportsbar-nuc
192.168.1.100 sportsbar-nuc  # Your static IP
```

### Firewall Configuration

**Enable firewall:**
```bash
sudo ufw enable
```

**Allow SSH:**
```bash
sudo ufw allow 22/tcp
```

**Allow application:**
```bash
sudo ufw allow 3000/tcp
```

**Or allow from local network only:**
```bash
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

**Check status:**
```bash
sudo ufw status
```

---

## 🚀 Application Installation

### One-Line Installation

**Run the installer:**
```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

**Installation time:** 5-10 minutes

**What gets installed:**
- Node.js v22
- Ollama AI platform
- 4 AI models (~15GB)
- Application and dependencies
- Database and knowledge base
- Optional systemd service

### Verify Installation

**Check application:**
```bash
curl http://localhost:3000
```

**Check AI system:**
```bash
curl http://localhost:3000/api/ai/status
```

**Check Ollama:**
```bash
ollama list
systemctl status ollama
```

### Configure Systemd Service

**Enable automatic startup:**
```bash
sudo systemctl enable sportsbar-assistant
sudo systemctl start sportsbar-assistant
```

**Check status:**
```bash
sudo systemctl status sportsbar-assistant
```

**View logs:**
```bash
sudo journalctl -u sportsbar-assistant -f
```

### Test from Network

**From another device:**
```
http://192.168.1.100:3000
```

Replace `192.168.1.100` with your NUC's IP address.

---

## ⚡ Performance Optimization

### CPU Optimization

**Check CPU info:**
```bash
lscpu
cat /proc/cpuinfo | grep "model name" | head -1
```

**Enable performance governor:**
```bash
sudo apt install cpufrequtils -y
sudo cpufreq-set -g performance
```

**Make permanent:**
```bash
sudo nano /etc/default/cpufrequtils
```

Add:
```
GOVERNOR="performance"
```

### Memory Optimization

**Check memory:**
```bash
free -h
```

**Optimize swap:**
```bash
# Reduce swappiness (use RAM more, swap less)
sudo sysctl vm.swappiness=10

# Make permanent
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
```

**Increase swap if needed:**
```bash
# Create 4GB swap file
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Storage Optimization

**Check disk:**
```bash
df -h
sudo hdparm -I /dev/nvme0n1
```

**Enable TRIM for SSD:**
```bash
sudo systemctl enable fstrim.timer
sudo systemctl start fstrim.timer
```

**Optimize database:**
```bash
cd ~/Sports-Bar-TV-Controller
sqlite3 prisma/data/sports_bar.db "VACUUM;"
```

### Network Optimization

**Optimize TCP settings:**
```bash
sudo nano /etc/sysctl.conf
```

Add:
```
# TCP optimization
net.ipv4.tcp_fastopen=3
net.ipv4.tcp_slow_start_after_idle=0
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216
```

**Apply:**
```bash
sudo sysctl -p
```

### Ollama Optimization

**Limit loaded models:**
```bash
sudo systemctl edit ollama
```

Add:
```ini
[Service]
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_NUM_PARALLEL=2"
```

**Restart Ollama:**
```bash
sudo systemctl restart ollama
```

### Application Optimization

**Use production mode:**
```bash
cd ~/Sports-Bar-TV-Controller
nano .env
```

Ensure:
```env
NODE_ENV=production
```

**Optimize Node.js:**
```bash
# Increase Node.js memory limit if needed
export NODE_OPTIONS="--max-old-space-size=4096"
```

---

## 🔐 Remote Access

### SSH Configuration

**Secure SSH:**
```bash
sudo nano /etc/ssh/sshd_config
```

Recommended settings:
```
Port 22
PermitRootLogin no
PasswordAuthentication yes  # Change to 'no' after setting up keys
PubkeyAuthentication yes
X11Forwarding no
```

**Restart SSH:**
```bash
sudo systemctl restart sshd
```

### SSH Key Authentication

**On your local machine:**
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy key to NUC
ssh-copy-id sportsbar@192.168.1.100
```

**Test:**
```bash
ssh sportsbar@192.168.1.100
```

**Disable password authentication (after testing):**
```bash
sudo nano /etc/ssh/sshd_config
```

Change:
```
PasswordAuthentication no
```

**Restart SSH:**
```bash
sudo systemctl restart sshd
```

### VPN Access (Optional)

**For secure remote access from outside network:**

**Install WireGuard:**
```bash
sudo apt install wireguard -y
```

**Configure WireGuard:**
```bash
# Generate keys
wg genkey | sudo tee /etc/wireguard/privatekey | wg pubkey | sudo tee /etc/wireguard/publickey

# Create config
sudo nano /etc/wireguard/wg0.conf
```

Example config:
```ini
[Interface]
PrivateKey = [your-private-key]
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = [client-public-key]
AllowedIPs = 10.0.0.2/32
```

**Enable WireGuard:**
```bash
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

### Remote Desktop (Optional)

**Install xrdp for GUI access:**
```bash
sudo apt install xrdp xfce4 xfce4-goodies -y
sudo systemctl enable xrdp
sudo systemctl start xrdp
```

**Allow RDP through firewall:**
```bash
sudo ufw allow 3389/tcp
```

**Connect from Windows:**
- Open Remote Desktop Connection
- Enter NUC IP: 192.168.1.100
- Login with your credentials

---

## 📊 Monitoring & Maintenance

### System Monitoring

**Install monitoring tools:**
```bash
sudo apt install -y htop iotop nethogs
```

**Monitor CPU and memory:**
```bash
htop
```

**Monitor disk I/O:**
```bash
sudo iotop
```

**Monitor network:**
```bash
sudo nethogs
```

**Check temperatures:**
```bash
sudo apt install lm-sensors -y
sudo sensors-detect  # Answer 'yes' to all
sensors
```

### Application Monitoring

**Check application status:**
```bash
sudo systemctl status sportsbar-assistant
```

**View application logs:**
```bash
sudo journalctl -u sportsbar-assistant -f
```

**Check Ollama status:**
```bash
systemctl status ollama
sudo journalctl -u ollama -f
```

**Monitor application performance:**
```bash
cd ~/Sports-Bar-TV-Controller
./scripts/system-benchmark.sh --quick
```

### Automated Monitoring

**Create monitoring script:**
```bash
nano ~/monitor-sportsbar.sh
```

```bash
#!/bin/bash

# Check if application is running
if ! systemctl is-active --quiet sportsbar-assistant; then
    echo "Application is down! Restarting..."
    sudo systemctl restart sportsbar-assistant
fi

# Check if Ollama is running
if ! systemctl is-active --quiet ollama; then
    echo "Ollama is down! Restarting..."
    sudo systemctl restart ollama
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Warning: Disk usage is at ${DISK_USAGE}%"
fi

# Check memory
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
if [ $MEM_USAGE -gt 90 ]; then
    echo "Warning: Memory usage is at ${MEM_USAGE}%"
fi
```

**Make executable:**
```bash
chmod +x ~/monitor-sportsbar.sh
```

**Add to crontab (run every 5 minutes):**
```bash
crontab -e
```

Add:
```
*/5 * * * * ~/monitor-sportsbar.sh >> ~/monitor.log 2>&1
```

### Log Management

**View logs:**
```bash
# Application logs
tail -f ~/Sports-Bar-TV-Controller/logs/app.log

# System logs
sudo journalctl -f

# Specific service logs
sudo journalctl -u sportsbar-assistant -f
sudo journalctl -u ollama -f
```

**Configure log rotation:**
```bash
sudo nano /etc/logrotate.d/sportsbar
```

```
/home/sportsbar/Sports-Bar-TV-Controller/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 sportsbar sportsbar
}
```

### Backup Procedures

**Automated backup script:**
```bash
nano ~/backup-sportsbar.sh
```

```bash
#!/bin/bash

BACKUP_DIR=~/backups
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
   $BACKUP_DIR/sports_bar.db.$DATE

# Backup configuration
tar -czf $BACKUP_DIR/config.$DATE.tar.gz \
   ~/Sports-Bar-TV-Controller/.env \
   ~/Sports-Bar-TV-Controller/config/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "sports_bar.db.*" -mtime +7 -delete
find $BACKUP_DIR -name "config.*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Make executable:**
```bash
chmod +x ~/backup-sportsbar.sh
```

**Schedule daily backups:**
```bash
crontab -e
```

Add:
```
0 2 * * * ~/backup-sportsbar.sh >> ~/backup.log 2>&1
```

---

## 🔧 Troubleshooting

### NUC-Specific Issues

#### Issue: NUC won't boot

**Solutions:**
1. Check power connection
2. Try different power outlet
3. Reset BIOS (remove CMOS battery for 30 seconds)
4. Check RAM is properly seated
5. Check SSD is properly installed

#### Issue: High temperatures

**Check temperatures:**
```bash
sensors
```

**Solutions:**
1. Clean dust from vents
2. Ensure proper ventilation
3. Check fan is working
4. Apply new thermal paste (advanced)
5. Reduce CPU frequency:
   ```bash
   sudo cpufreq-set -g powersave
   ```

#### Issue: Network not working

**Solutions:**
1. Check Ethernet cable
2. Check router connection
3. Reset network:
   ```bash
   sudo systemctl restart systemd-networkd
   sudo netplan apply
   ```
4. Check network interface:
   ```bash
   ip link show
   sudo ip link set enp0s31f6 up
   ```

#### Issue: USB devices not recognized

**Solutions:**
1. Try different USB port
2. Check USB is enabled in BIOS
3. Update USB drivers:
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```
4. Check dmesg for errors:
   ```bash
   dmesg | grep -i usb
   ```

### Application Issues

#### Issue: Application won't start

**Check logs:**
```bash
sudo journalctl -u sportsbar-assistant -n 50
```

**Solutions:**
1. Check port availability:
   ```bash
   sudo lsof -i :3000
   ```
2. Restart service:
   ```bash
   sudo systemctl restart sportsbar-assistant
   ```
3. Rebuild application:
   ```bash
   cd ~/Sports-Bar-TV-Controller
   npm run build
   ```

#### Issue: Ollama not responding

**Check Ollama:**
```bash
systemctl status ollama
sudo journalctl -u ollama -n 50
```

**Solutions:**
1. Restart Ollama:
   ```bash
   sudo systemctl restart ollama
   ```
2. Check models:
   ```bash
   ollama list
   ```
3. Re-pull models:
   ```bash
   ollama pull llama3.2:latest
   ```

#### Issue: Slow performance

**Check resources:**
```bash
htop
free -h
df -h
```

**Solutions:**
1. Run benchmark:
   ```bash
   cd ~/Sports-Bar-TV-Controller
   ./scripts/system-benchmark.sh --quick
   ```
2. Use faster AI model:
   ```bash
   echo "OLLAMA_MODEL=phi3:mini" >> ~/Sports-Bar-TV-Controller/.env
   ```
3. Limit Ollama models:
   ```bash
   sudo systemctl edit ollama
   ```
   Add:
   ```ini
   [Service]
   Environment="OLLAMA_MAX_LOADED_MODELS=1"
   ```

---

## 🏭 Production Deployment

### Pre-Production Checklist

- [ ] Hardware properly assembled and tested
- [ ] Ubuntu Server installed and updated
- [ ] Static IP configured
- [ ] Firewall configured
- [ ] SSH key authentication set up
- [ ] Application installed and tested
- [ ] Systemd service enabled
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Documentation updated

### Production Configuration

**1. Secure the system:**
```bash
# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no

# Enable automatic security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

**2. Configure reverse proxy (optional):**
```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/sportsbar
```

```nginx
server {
    listen 80;
    server_name sportsbar.local;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sportsbar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**3. Set up UPS monitoring (if using UPS):**
```bash
sudo apt install nut -y
# Configure according to your UPS model
```

**4. Configure email alerts:**
```bash
sudo apt install mailutils -y
# Configure SMTP settings
```

**5. Document configuration:**
- Create network diagram
- Document IP addresses
- List all credentials (securely)
- Create runbook for common tasks

### Production Monitoring

**Set up monitoring dashboard:**
```bash
# Install Grafana (optional)
sudo apt install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt update
sudo apt install grafana -y
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

**Access Grafana:**
```
http://192.168.1.100:3000
```

### Disaster Recovery

**Create recovery plan:**

1. **Backup locations:**
   - Local: `~/backups/`
   - Remote: [specify location]

2. **Recovery steps:**
   ```bash
   # Reinstall OS if needed
   # Run installer
   curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
   
   # Restore database
   cp ~/backups/sports_bar.db.latest ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
   
   # Restore configuration
   tar -xzf ~/backups/config.latest.tar.gz -C ~/
   
   # Restart services
   sudo systemctl restart sportsbar-assistant
   ```

3. **Test recovery procedure quarterly**

---

## 📚 Additional Resources

- **[README.md](./README.md)** - Quick start guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - General deployment guide
- **[UPDATE_PROCESS.md](./UPDATE_PROCESS.md)** - Update procedures
- **[BACKUP_RESTORE_GUIDE.md](./BACKUP_RESTORE_GUIDE.md)** - Backup and restore

---

## ✅ NUC Deployment Checklist

### Hardware Setup
- [ ] NUC assembled with RAM and SSD
- [ ] BIOS configured
- [ ] Peripherals connected
- [ ] Network cable connected
- [ ] Power connected

### OS Installation
- [ ] Ubuntu Server 22.04 LTS installed
- [ ] System updated
- [ ] Essential tools installed
- [ ] Static IP configured
- [ ] Hostname set

### Application Installation
- [ ] One-line installer completed
- [ ] Node.js v22 installed
- [ ] Ollama and models installed
- [ ] Application accessible
- [ ] AI features working

### Configuration
- [ ] Systemd service enabled
- [ ] Firewall configured
- [ ] SSH key authentication set up
- [ ] Environment variables configured
- [ ] Hardware devices configured

### Optimization
- [ ] CPU governor set to performance
- [ ] Swap optimized
- [ ] SSD TRIM enabled
- [ ] Network optimized
- [ ] Ollama optimized

### Monitoring
- [ ] Monitoring tools installed
- [ ] Automated monitoring script created
- [ ] Log rotation configured
- [ ] Backup script created
- [ ] Backup schedule configured

### Production
- [ ] Security hardened
- [ ] Reverse proxy configured (optional)
- [ ] UPS monitoring set up (optional)
- [ ] Email alerts configured
- [ ] Documentation completed

---

**Your Intel NUC is now ready for production deployment!** 🎉

**Performance Expectations:**
- Application startup: ~10 seconds
- AI response time: 2-5 seconds
- Page load time: <1 second
- Concurrent users: 10-20
- Uptime: 99.9%+

**Enjoy your high-performance Sports Bar TV Controller!** 🏈📺
