# Sports Bar TV Controller - Minimal ISO Quick Reference

**TL;DR:** Remove 7.6GB of bloat, reduce boot time by 70%, cut services from 55 to 15.

---

## Size Reduction Summary

| Category | Current | Optimized | Savings |
|----------|---------|-----------|---------|
| **Total Disk** | 38GB | 8-10GB | **28-30GB** |
| **Packages** | 1,188 | 300-400 | **~800 packages** |
| **Services** | 55 enabled | 15 enabled | **40 services** |
| **Boot Time** | ~40s | ~12s | **28s faster** |
| **ISO Size** | 8GB | 2-3GB | **5-6GB** |

---

## Top Removals (by size)

1. **Snap storage** - 2,300MB (snapd + packages)
2. **Linux firmware** - 988MB (keep only network/USB/storage)
3. **Old kernels** - 673MB (3 old kernel versions)
4. **Desktop GUI** - 500MB (Xfce + X11 + GTK)
5. **Google Chrome** - 379MB
6. **Journal logs** - 436MB (536MB → 100MB)
7. **Documentation** - 176MB (man pages + docs + locales)
8. **Development headers** - 80MB (gcc, build tools)

**Total: ~5.5GB immediate savings**

---

## One-Command Cleanup (DANGER: Test on clone first!)

```bash
# Create backup first!
sudo dd if=/dev/sda of=/backup/system-backup.img bs=4M status=progress

# Run cleanup (see full script in main report)
sudo bash /home/ubuntu/Sports-Bar-TV-Controller/sports-bar-minimal-cleanup.sh
```

---

## Services to Disable

### Safe to disable now:
```bash
sudo systemctl disable --now avahi-daemon ModemManager multipathd \
  cloud-init cloud-config pollinate xrdp udisks2 packagekit
```

### Must keep running:
```bash
# DO NOT DISABLE THESE!
pm2-ubuntu.service          # Sports Bar app
ssh.service                 # Remote access
systemd-networkd.service    # Network
ufw.service                 # Firewall
cron.service                # Scheduled tasks
rsyslog.service             # Logging
```

---

## Recommended Build Process

### Quick Approach (2-3 days)
1. **Clone system** to VM
2. **Run cleanup script** (see Appendix A in main report)
3. **Test Sports Bar Controller** works
4. **Use Cubic** to create ISO from cleaned system
5. **Test ISO** on physical hardware

### Production Approach (1-2 weeks)
1. **Analyze** package dependencies (see main report Section 5)
2. **Debootstrap** minimal Ubuntu 22.04
3. **Add only required packages** (~300 packages)
4. **Pre-configure** network, PM2, services
5. **Bundle** Sports Bar Controller app
6. **Create ISO** with live-build
7. **Test extensively** before deployment

---

## Packages to Keep (Essential)

### Core (10 packages)
```
systemd dbus cron rsyslog ufw
openssh-server netplan.io curl wget git
```

### Node.js Stack (3 items)
```
nodejs (20.x from nodesource)
sqlite3
pm2 (npm global package)
```

### Hardware (5 packages)
```
libusb-1.0-0 usbutils     # USB support
cec-utils libcec6         # CEC control
```

### Utilities (5 packages)
```
vim-tiny python3-minimal tar gzip unzip
```

**Total: ~300 packages** (vs current 1,188)

---

## Packages to Remove (High Priority)

### Desktop Environment (141 packages)
```bash
apt purge -y xfce4 xfce4-goodies xorg xserver-xorg* \
  gnome-* gtk-* libgtk* libx11-* xdg-* desktop-*
```

### Browsers (2 packages, 467MB)
```bash
apt purge -y google-chrome-stable firefox
```

### Snap (114MB + 2.3GB storage)
```bash
systemctl stop snapd snapd.socket
apt purge -y snapd
rm -rf /var/lib/snapd /snap
```

### Cloud-init (7 services)
```bash
apt purge -y cloud-init cloud-initramfs-* pollinate ubuntu-advantage-tools
```

### Unnecessary Hardware (20+ packages)
```bash
apt purge -y modemmanager avahi-daemon bluez bluetooth \
  cups* printer-driver-* sane-* ipp-usb
```

### Old Kernels (673MB)
```bash
apt purge -y $(dpkg -l 'linux-*' | grep '^ii' | awk '{print $2}' | \
  grep -vE '5.15.0-161')
```

---

## Before/After Comparison

### System Resources
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Disk used | 38GB | 8-10GB | **-74%** |
| Packages | 1,188 | ~350 | **-71%** |
| Services | 55 | 15 | **-73%** |
| Boot time | 40s | 12s | **-70%** |
| Mem available | 13GB | 13.6GB | **+600MB** |

### Application Performance
- **No change** - Sports Bar Controller runs identically
- **Faster startup** due to fewer systemd services
- **More RAM** available for Node.js
- **Faster disk I/O** less filesystem clutter

---

## Risk Assessment

### Low Risk Removals
✅ Desktop GUI (xfce4, X11)
✅ Browsers (Chrome, Firefox)
✅ Snap packages
✅ Cloud-init (if static network config)
✅ Bluetooth, printers, scanners
✅ Avahi/mDNS
✅ Old kernels

### Medium Risk (Test First)
⚠️ Development tools (if building .next on device)
⚠️ Python packages (audit which are used)
⚠️ Ollama service (if using RAG features)
⚠️ XRDP (if used for remote desktop debugging)

### High Risk (DO NOT REMOVE)
❌ Node.js, npm
❌ sqlite3
❌ systemd, dbus
❌ openssh-server
❌ libusb, cec-utils
❌ Current kernel

---

## ISO Creation Tools

### Cubic (GUI - Easiest)
```bash
sudo apt install cubic
# Launch GUI, select Ubuntu 22.04 server ISO
# Customize in terminal
# Build new ISO
```

### live-build (CLI - Advanced)
```bash
sudo apt install live-build
lb config
lb build
```

### Debootstrap (Expert - Full Control)
```bash
debootstrap --arch=amd64 jammy /mnt/chroot
chroot /mnt/chroot
# Install packages...
# Configure...
# Create ISO
```

---

## Testing Checklist

### Functional Tests
- [ ] Node.js runs (`node -v`)
- [ ] PM2 runs Sports Bar Controller
- [ ] Database accessible (`sqlite3 /home/ubuntu/sports-bar-data/production.db`)
- [ ] CEC adapter detected (`ls /dev/ttyACM0`)
- [ ] Network connectivity (`curl https://google.com`)
- [ ] SSH access works
- [ ] Web interface loads (http://IP:3001)

### Performance Tests
- [ ] Boot time < 15s (`systemd-analyze`)
- [ ] Service count ≤ 20 (`systemctl --type=service --state=running | wc -l`)
- [ ] Package count < 500 (`dpkg --list | grep "^ii" | wc -l`)
- [ ] Disk usage < 12GB (`df -h /`)

### Hardware Tests
- [ ] CEC command successful (`echo "scan" | cec-client -s -d 1`)
- [ ] IR blaster connectivity (iTach ping)
- [ ] USB devices visible (`lsusb`)

---

## Deployment Strategy

### For 10+ Sites (Build Custom ISO)
1. **Effort:** 60 hours (1-2 weeks)
2. **Payoff:** 2-3x faster deployments, easier maintenance
3. **ROI:** Break-even after 10 deployments

### For < 5 Sites (Optimize In-Place)
1. **Effort:** 8 hours (1 day)
2. **Action:** Run cleanup script on existing systems
3. **ROI:** Immediate, less risk

---

## Emergency Rollback

### If cleanup breaks system:

**Option 1: Restore from backup**
```bash
sudo dd if=/backup/system-backup.img of=/dev/sda bs=4M status=progress
```

**Option 2: Reinstall removed packages**
```bash
# Compare package lists
diff /tmp/pre-cleanup-packages.txt <(dpkg --get-selections)

# Reinstall missing packages
sudo apt install <package-name>
```

**Option 3: Fresh Ubuntu install**
- Restore `/home/ubuntu/Sports-Bar-TV-Controller`
- Restore `/home/ubuntu/sports-bar-data/production.db`
- Reinstall Node.js, PM2
- Restart application

---

## Key Files to Backup Before Cleanup

```bash
# Application
/home/ubuntu/Sports-Bar-TV-Controller/
/home/ubuntu/sports-bar-data/production.db

# Configuration
/etc/netplan/
/etc/systemd/system/pm2-ubuntu.service
/home/ubuntu/.pm2/
/etc/ufw/
/etc/ssh/sshd_config

# Package list
dpkg --get-selections > /backup/packages.txt
apt-mark showmanual > /backup/manual-packages.txt
```

---

## Next Steps

1. **Read main report:** `/home/ubuntu/Sports-Bar-TV-Controller/MINIMAL_ISO_ANALYSIS_REPORT.md`
2. **Backup system:** `dd` image or VM snapshot
3. **Clone to test VM**
4. **Run cleanup script** (Appendix A)
5. **Test thoroughly**
6. **Build ISO** with Cubic
7. **Deploy to pilot site**
8. **Monitor for 1-2 weeks**
9. **Rollout to production**

---

## Quick Reference Commands

```bash
# Check boot time
systemd-analyze

# Count packages
dpkg --list | grep "^ii" | wc -l

# Count services
systemctl --type=service --state=running | wc -l

# Disk usage
df -h / && du -sh /var/lib/snapd /snap

# Large packages
dpkg-query -W -f='${Installed-Size}\t${Package}\n' | sort -rn | head -20

# Service list
systemctl list-unit-files --type=service --state=enabled

# Clean package cache
sudo apt clean && sudo apt autoclean

# Remove orphaned packages
sudo apt autoremove -y --purge
```

---

## Support & Documentation

- **Full Report:** `MINIMAL_ISO_ANALYSIS_REPORT.md`
- **Main Docs:** `CLAUDE.md`
- **Hardware Setup:** `docs/HARDWARE_CONFIGURATION.md`
- **API Reference:** `docs/API_REFERENCE.md`

---

**Questions?** See full report for detailed explanations, risk analysis, and step-by-step procedures.
