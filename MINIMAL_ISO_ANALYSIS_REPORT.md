# Sports Bar TV Controller - Minimal Custom ISO Analysis Report

**Generated:** 2025-11-21
**System:** Ubuntu 22.04.5 LTS Server
**Purpose:** Create minimal appliance ISO for Sports Bar TV Controller

---

## Executive Summary

### Current System State
- **Total Packages:** 1,188 installed
- **Enabled Services:** 55 systemd services
- **Disk Usage:** 38GB used / 98GB total (41%)
- **Memory:** 16GB total, ~1.7GB used
- **CPU:** Intel Core i5-1340P (16 cores)
- **Package Size:** ~3.5GB installed packages
- **Snap Storage:** 2.3GB
- **Journal Logs:** 536MB

### Estimated Reduction Potential

| Category | Current Size | After Optimization | Savings |
|----------|--------------|-------------------|---------|
| GUI/Desktop packages | 141 packages (~500MB) | 0 packages | ~500MB |
| Firmware (linux-firmware) | 1,088MB | ~100MB (minimal) | ~988MB |
| Extra kernel modules | 1,010MB (3 kernels) | ~337MB (1 kernel) | ~673MB |
| Snap packages | 2,300MB | 0MB | ~2,300MB |
| Google Chrome | 379MB | 0MB | ~379MB |
| Documentation/Man pages | 113MB | 0MB | ~113MB |
| Locales (non-English) | 64MB | ~1MB | ~63MB |
| Development headers | 20 packages (~80MB) | Optional | ~80MB |
| Unnecessary services | 25+ services | 0 services | Runtime savings |

**Total Estimated Savings:** ~5-7GB disk space, ~300-500MB RAM, faster boot time

**Estimated Minimal ISO Size:** 2-3GB (vs current 38GB system)

---

## 1. SAFE TO REMOVE - High Priority Removals

### 1.1 Desktop Environment & GUI (141 packages, ~500MB)

#### Complete Xfce Desktop Suite
```bash
# Meta-packages
xfce4 xfce4-goodies xorg xserver-xorg xserver-xorg-core
xserver-xorg-input-all xserver-xorg-video-all

# Xfce Components
xfce4-panel xfce4-appfinder xfce4-power-manager xfce4-screensaver
xfce4-taskmanager xfce4-whiskermenu-plugin xfdesktop4 xfdesktop4-data

# Desktop applications
gnome-screenshot gnome-terminal ristretto xarchiver xfburn

# Remote desktop (if not using XRDP)
xrdp xrdp-sesman xorgxrdp

# Icon themes and desktop files
adwaita-icon-theme humanity-icon-theme elementary-xfce-icon-theme
desktop-base desktop-file-utils

# GTK/Qt libraries (100+ packages)
libgtk-3-* libgtk2.0-* libwebkit2gtk-4.0-37 libjavascriptcoregtk-4.0-18
libvte-* libgail* gtk2-engines-murrine gtk-update-icon-cache

# X11 libraries
libx11-* libxext6 libxfixes3 libxdamage1 libxi6 libxrandr2 libxrender1
libxcomposite1 libxcursor1 libxinerama1 libxkbfile1 libxmu6 libxpm4
libxpresent1 libxres1 libxss1 libxtst6 libxv1 libxvmc1 libxxf86dga1

# Wayland
libwayland-client0 libwayland-cursor0 libwayland-egl1 libwayland-server0
```

**Rationale:** Headless server - no GUI needed. Web interface accessed via network.

### 1.2 Snap Packages (2.3GB storage)

```bash
# Installed snaps
firefox (snap version)
lxd (not used)
gnome-3-34-1804
gnome-42-2204
gtk-common-themes
core18, core20, core22

# Remove snap entirely
sudo systemctl stop snapd snapd.socket
sudo apt purge snapd snapd-apparmor
sudo rm -rf /var/lib/snapd /snap
```

**Rationale:** Not using snaps for Sports Bar Controller. All dependencies via npm/apt.

### 1.3 Web Browsers (467MB)

```bash
google-chrome-stable (379MB)
firefox (transitional snap package)
```

**Rationale:** Web interface accessed from client devices, no browser needed on server.

### 1.4 Linux Firmware & Old Kernels (1,661MB)

```bash
# Massive firmware blob (most unused)
linux-firmware (1,088MB) - Keep only network/USB/storage drivers

# Old kernels (keep only latest)
linux-modules-5.15.0-157-generic (111MB) - REMOVE
linux-modules-5.15.0-160-generic (111MB) - REMOVE
linux-modules-extra-5.15.0-157-generic (337MB) - REMOVE
linux-modules-extra-5.15.0-160-generic (337MB) - REMOVE
linux-headers-5.15.0-157 (75MB) - REMOVE
linux-headers-5.15.0-160 (75MB) - REMOVE
linux-image-5.15.0-157-generic - REMOVE
linux-image-5.15.0-160-generic - REMOVE

# Keep only:
linux-modules-5.15.0-161-generic (current)
linux-modules-extra-5.15.0-161-generic (current)
```

**Cleanup commands:**
```bash
sudo apt autoremove --purge $(dpkg -l 'linux-*' | grep '^ii' | awk '{print $2}' | grep -E '5.15.0-(157|160)')
```

### 1.5 Cloud-Init & Cloud Utilities (7 services)

```bash
# Services
cloud-init.service
cloud-init-local.service
cloud-config.service
cloud-final.service
pollinate.service
ubuntu-advantage.service
ua-reboot-cmds.service

# Packages
cloud-init cloud-initramfs-copymods cloud-initramfs-dyn-netconf
pollinate ubuntu-advantage-tools
```

**Rationale:** Static network config in production. Cloud-init only needed for initial VM provisioning.

**Alternative:** Keep if deploying via cloud images, remove for bare metal.

### 1.6 Bluetooth, Modem, Printer Support

```bash
# Bluetooth (not needed)
bluez bluez-obexd bluetooth

# ModemManager (definitely not needed)
modemmanager libmm-glib0

# Printer/Scanner support
cups cups-browsed cups-client cups-common cups-core-drivers
libcups2 libcupsfilters1 libcupsimage2
sane-utils sane-airscan libsane1 libsane-common
printer-driver-* hplip

# IPP-USB (printer over USB)
ipp-usb
```

**Rationale:** Sports bar appliance doesn't print/scan/use Bluetooth.

### 1.7 Avahi mDNS/Bonjour

```bash
avahi-daemon avahi-autoipd
libavahi-client3 libavahi-common3 libavahi-core7
```

**Rationale:** Uses static IPs, not service discovery.

### 1.8 Documentation & Locales (113MB)

```bash
# Man pages
rm -rf /usr/share/man/*

# Documentation
rm -rf /usr/share/doc/*

# Locales (keep only en_US.UTF-8)
localepurge configuration:
MANDELETE
SHOWFREEDSPACE
en_US.UTF-8

# Packages
man-db manpages manpages-dev
```

**Size savings:** 31MB (man) + 82MB (doc) + 63MB (locales) = 176MB

### 1.9 Development Tools (if not building on device)

```bash
# Build tools
gcc-11 g++-11 cpp-11 make cmake
build-essential

# Development headers
libpython3.10-dev (20MB)
libstdc++-11-dev (18MB)
libgcc-11-dev (14MB)
libc6-dev (13MB)
linux-libc-dev (7MB)
libsqlite3-dev (3MB)

# Version control (keep git if doing updates)
# git (maybe keep for app updates)
```

**Rationale:** If building .next on CI/CD, don't need compilers on appliance.

**Alternative:** Keep git + Node.js build tools if updating app locally.

### 1.10 Unnecessary Hardware Support

```bash
# GPU/Graphics (headless server)
gpu-manager.service
mesa-vulkan-drivers libgl1-mesa-dri libgl1-amber-dri

# Virtual machine tools (if bare metal)
open-vm-tools open-vm-tools-desktop vgauth.service
lxd-agent lxd-agent-loader

# Thermal management (maybe keep for physical hardware)
thermald.service (assess based on deployment)

# MultiPath (if not using SAN storage)
multipathd.service device-mapper-multipath

# iSCSI (if not using network storage)
open-iscsi iscsid

# Thunderbolt
bolt.service

# USB webcams/media devices
libgphoto2-6 libv4l-0
```

### 1.11 Unnecessary Desktop Services

```bash
udisks2.service (disk mounting GUI)
packagekit.service (GUI package manager)
rtkit-daemon.service (realtime kit for audio)
polkit.service (policy kit - maybe keep for systemd)
fwupd.service (firmware updates)
```

---

## 2. KEEP - REQUIRED FOR SPORTS BAR CONTROLLER

### 2.1 Core Application Stack

#### Node.js Runtime (187MB)
```bash
nodejs (20.19.5 from nodesource)
# npm comes with Node.js 20.x
# pm2 installed globally via npm
```

**Critical:** Do NOT use Ubuntu's old Node.js 12. Keep nodesource repository.

#### Process Manager
```bash
pm2 (global npm package)
pm2-ubuntu.service (enabled)
```

**Configuration:** `/home/ubuntu/Sports-Bar-TV-Controller/ecosystem.config.js`

#### Database
```bash
sqlite3
libsqlite3-0
```

**Database location:** `/home/ubuntu/sports-bar-data/production.db`

### 2.2 Network Services

```bash
# SSH access
openssh-server openssh-client ssh.service

# Network configuration
systemd-networkd.service
systemd-resolved.service
networkd-dispatcher.service

# DNS resolution
resolvconf

# Network tools
net-tools iputils-ping iproute2
curl wget
bind9-dnsutils (dig, nslookup)
```

### 2.3 Hardware Interface Support

#### USB CEC Adapters (Pulse-Eight)
```bash
# USB support
libusb-1.0-0 libusb-0.1-4
usbutils (lsusb)

# Serial port access
dialout group membership
/dev/ttyACM0 device
```

**Hardware:** Pulse-Eight CEC Adapter (USB VID:PID 2548:1002)

#### HDMI-CEC Control
```bash
# cec-client (usually from cec-utils package)
cec-utils libcec6

# Dependencies
libp8-platform2
```

#### IR Control (iTach IP2IR)
```bash
# Network-based, no special packages needed
# Uses TCP sockets to 192.168.x.x:4998
```

### 2.4 System Services

```bash
# Essential systemd services
systemd systemd-timesyncd.service
dbus.service
cron.service
rsyslog.service

# Logging
journalctl (systemd-journald)
logrotate

# Time sync
systemd-timesyncd.service (NTP alternative)

# Terminal
getty@.service (console access)

# IRQ balancing (multi-core optimization)
irqbalance.service
```

### 2.5 Security & Firewall

```bash
# Firewall
ufw ufw.service

# AppArmor (consider keeping)
apparmor apparmor.service

# SELinux (minimal - just libraries)
libselinux1 libsepol2
```

**Note:** AppArmor profiles for PM2/Node.js might be useful for security hardening.

### 2.6 Python (for scripts)

```bash
python3 python3-minimal
python3.10 python3.10-minimal

# Common libraries used by scripts
python3-apt python3-requests
```

**Note:** 91 Python packages currently installed. Audit which are actually used.

### 2.7 Git (for updates)

```bash
git (18MB)
# Used for pulling app updates
```

**Alternative:** Could use `wget`/`curl` + tar if not using git-based deployment.

### 2.8 AI/LLM Support (Optional)

```bash
# Ollama service (for RAG documentation)
ollama.service (enabled)

# Only if using local LLM features
```

**Size:** Ollama + models can be 5-10GB. Consider if RAG features are needed on appliance.

### 2.9 Compression & Archive Tools

```bash
tar gzip bzip2 xz-utils unzip
zstd
```

### 2.10 Text Editors

```bash
vim-tiny (or nano)
# Full vim-runtime (33MB) is overkill
```

---

## 3. MAYBE REMOVE - Case-by-Case Assessment

### 3.1 Snap Daemon (114MB package + 2.3GB storage)

**Current state:** Enabled, using 2.3GB in `/var/lib/snapd`

**Consider removing if:**
- No snap packages used in production
- Firefox transitional package not needed
- LXD not used

**Keep if:**
- Easy snap-based updates desired
- Using snap-packaged dependencies

**Recommendation:** REMOVE - not used by Sports Bar Controller

### 3.2 Docker/Containers

**Current state:** Not installed (only lxd-agent-loader present)

**Recommendation:** Don't add unless containerizing the app

### 3.3 AppArmor

**Current state:** Enabled, 2 profiles loaded

**Pros of keeping:**
- Security hardening
- Minimal overhead
- Ubuntu default

**Cons:**
- Complexity in troubleshooting
- May interfere with CEC/IR hardware access

**Recommendation:** KEEP but create custom profiles for PM2/Node.js

### 3.4 Unattended Upgrades

**Current state:** Enabled

**Pros:**
- Automatic security updates
- Reduced maintenance

**Cons:**
- Potential breaking changes
- Unexpected restarts

**Recommendation:** KEEP but configure for security updates only, not app updates

### 3.5 XRDP (Remote Desktop)

**Current state:** Enabled (xrdp.service, xrdp-sesman.service)

**Size:** ~20MB + dependencies

**Use case:** Remote desktop access for debugging

**Recommendation:** REMOVE - use SSH + web interface instead. Saves 100+ MB with X11 dependencies.

### 3.6 Ollama Service

**Current state:** Enabled, running

**Size:** Ollama binary + models (5-10GB)

**Use case:** Local RAG documentation search

**Recommendation:**
- **Keep** if using AI documentation features
- **Remove** if documentation served externally or not used

### 3.7 vim-runtime (33MB)

**Alternative:** vim-tiny (much smaller)

**Recommendation:** Keep vim-tiny only

### 3.8 n8n Service

**Current state:** Running in PM2 (186MB memory)

**Recommendation:** Assess if workflow automation is needed. Remove if not used.

### 3.9 Development Headers

**Size:** ~80MB total

**Use case:** Building native Node.js addons

**Recommendation:**
- **Keep** if compiling native modules (node-gyp, node-sass, etc.)
- **Remove** if all npm packages are pre-built

Check package.json for native dependencies:
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
grep -E "node-gyp|bindings|nan" package.json
```

---

## 4. SERVICES TO DISABLE/REMOVE

### 4.1 Can Be Disabled Immediately

```bash
sudo systemctl disable --now avahi-daemon.service
sudo systemctl disable --now ModemManager.service
sudo systemctl disable --now multipathd.service
sudo systemctl disable --now cloud-init.service
sudo systemctl disable --now cloud-init-local.service
sudo systemctl disable --now cloud-config.service
sudo systemctl disable --now cloud-final.service
sudo systemctl disable --now pollinate.service
sudo systemctl disable --now gpu-manager.service
sudo systemctl disable --now thermald.service  # If VM
sudo systemctl disable --now open-vm-tools.service  # If bare metal
sudo systemctl disable --now lxd-agent.service
sudo systemctl disable --now udisks2.service
sudo systemctl disable --now packagekit.service
sudo systemctl disable --now rtkit-daemon.service
sudo systemctl disable --now fwupd.service
sudo systemctl disable --now bolt.service
sudo systemctl disable --now xrdp.service
sudo systemctl disable --now xrdp-sesman.service
sudo systemctl mask snapd.service snapd.socket
```

### 4.2 Essential Services (DO NOT DISABLE)

```bash
# System core
systemd-journald.service
systemd-logind.service
systemd-networkd.service
systemd-resolved.service
systemd-timesyncd.service
systemd-udevd.service
dbus.service

# Application
pm2-ubuntu.service
ollama.service (if using AI features)

# Security
apparmor.service
ufw.service
ssh.service

# Operations
cron.service
rsyslog.service
irqbalance.service
unattended-upgrades.service (configured for security only)
```

---

## 5. CUSTOM ISO BUILD STRATEGY

### 5.1 Approach A: Ubuntu Mini ISO + Custom Packages

**Pros:**
- Start from minimal base (~200MB)
- Full control over included packages
- Clean, no cruft

**Cons:**
- More manual work
- Need to script all setup
- Hardware driver selection required

**Process:**
1. Download Ubuntu 22.04 mini.iso
2. Use debootstrap to create base system
3. Add only required packages
4. Pre-configure network, users, services
5. Install Node.js from nodesource
6. Bundle Sports Bar Controller app
7. Create custom ISO with Cubic or live-build

### 5.2 Approach B: Current System → Cleanup → Remaster

**Pros:**
- Start from working system
- Known-good configuration
- Easier hardware compatibility

**Cons:**
- Harder to remove cruft completely
- May miss hidden dependencies

**Process:**
1. Clone current system
2. Remove packages via scripted apt purge
3. Clean caches, logs, temp files
4. Sysprep (clear SSH keys, machine-id)
5. Remaster with Cubic or SystemBack

### 5.3 Approach C: Docker/Snap Appliance (Alternative)

**Pros:**
- Even more minimal base
- Easy updates
- Container security

**Cons:**
- Hardware access complexity (CEC adapters)
- Different deployment model

**Not recommended** due to USB CEC adapter requirements.

---

## 6. RECOMMENDED BUILD PROCESS

### Phase 1: Pre-Cleanup Analysis

```bash
#!/bin/bash
# Save current package list
dpkg --get-selections > /tmp/original-packages.txt

# Identify manual vs auto-installed
apt-mark showmanual > /tmp/manual-packages.txt
apt-mark showauto > /tmp/auto-packages.txt

# Save current service states
systemctl list-unit-files --type=service > /tmp/original-services.txt
```

### Phase 2: Safe Removal Script

```bash
#!/bin/bash
set -e

# Remove desktop environment
apt purge -y xfce4 xfce4-goodies xorg xserver-xorg* \
  gnome-* gtk-* libgtk* libx11-* xdg-*

# Remove browsers
apt purge -y google-chrome-stable firefox

# Remove snap
systemctl stop snapd snapd.socket
apt purge -y snapd
rm -rf /var/lib/snapd /snap

# Remove cloud-init
apt purge -y cloud-init cloud-initramfs-* pollinate ubuntu-advantage-tools

# Remove hardware support (not needed)
apt purge -y modemmanager avahi-daemon \
  bluez bluetooth \
  cups cups-* printer-driver-* \
  sane-utils sane-* \
  ipp-usb

# Remove old kernels (keep only latest)
apt purge -y $(dpkg -l 'linux-*' | grep '^ii' | awk '{print $2}' | grep -vE '5.15.0-161')

# Remove development tools (if building elsewhere)
apt purge -y gcc g++ build-essential \
  libpython3.10-dev libstdc++-11-dev \
  linux-libc-dev manpages-dev

# Remove documentation
apt purge -y man-db manpages manpages-dev
rm -rf /usr/share/man/*
rm -rf /usr/share/doc/*

# Autoremove orphaned dependencies
apt autoremove -y --purge

# Clean package cache
apt clean
apt autoclean
```

### Phase 3: Minimal Firmware

```bash
#!/bin/bash
# linux-firmware is 1GB but most unused
# Create minimal firmware package with only needed drivers

cd /lib/firmware
mkdir /tmp/firmware-backup
cp -r * /tmp/firmware-backup/

# Keep only essential firmware
keep_firmware=(
  "intel"           # Intel network/CPU microcode
  "rtl_nic"         # Realtek network cards
  "e1000*"          # Intel Gigabit adapters
  "regulatory.db*"  # WiFi regulatory (if using WiFi)
)

# Remove everything else, keep only needed
# WARNING: Test on target hardware first!
```

### Phase 4: Locale Cleanup

```bash
#!/bin/bash
# Keep only en_US.UTF-8
apt install -y localepurge

cat > /etc/locale.nopurge << EOF
MANDELETE
SHOWFREEDSPACE
en_US.UTF-8
POSIX
EOF

localepurge
```

### Phase 5: Service Optimization

```bash
#!/bin/bash
# Disable unnecessary services
services_to_disable=(
  "avahi-daemon"
  "ModemManager"
  "multipathd"
  "cloud-init"
  "cloud-init-local"
  "cloud-config"
  "cloud-final"
  "pollinate"
  "gpu-manager"
  "udisks2"
  "packagekit"
  "rtkit-daemon"
  "fwupd"
  "bolt"
  "xrdp"
  "xrdp-sesman"
)

for service in "${services_to_disable[@]}"; do
  systemctl disable --now "$service" 2>/dev/null || true
done

# Mask snap
systemctl mask snapd.service snapd.socket
```

### Phase 6: Journal Size Limit

```bash
#!/bin/bash
# Limit journal to 100MB
mkdir -p /etc/systemd/journald.conf.d/
cat > /etc/systemd/journald.conf.d/size.conf << EOF
[Journal]
SystemMaxUse=100M
SystemKeepFree=1G
MaxRetentionSec=7day
EOF

systemctl restart systemd-journald
```

### Phase 7: Sysprep for Imaging

```bash
#!/bin/bash
# Clean system for ISO creation

# Clean logs
journalctl --vacuum-time=1d
rm -rf /var/log/*.log
rm -rf /var/log/*.old

# Clean temp files
rm -rf /tmp/*
rm -rf /var/tmp/*

# Clean package cache
apt clean

# Clear bash history
history -c
rm -f /root/.bash_history
rm -f /home/*/.bash_history

# Remove machine-specific IDs
truncate -s 0 /etc/machine-id
rm -f /var/lib/dbus/machine-id

# Remove SSH host keys (regenerated on first boot)
rm -f /etc/ssh/ssh_host_*

# Clear network config (or set static)
# Configure based on deployment needs
```

---

## 7. MINIMAL ISO PACKAGE LIST

### Core System (~ 100 packages)

```
# Kernel & boot
linux-image-generic
linux-firmware-minimal (custom package)
grub-pc
initramfs-tools

# Core system
systemd systemd-sysv
udev
dbus

# Filesystem
e2fsprogs
util-linux
mount

# Network
netplan.io
systemd-resolved
systemd-networkd
iproute2
iputils-ping
openssh-server
openssh-client
curl
wget

# Security
ufw
apparmor

# Basic utilities
coreutils
bash
vim-tiny
less
grep
sed
gawk
tar
gzip
bzip2
xz-utils
unzip

# Hardware
libusb-1.0-0
usbutils
pciutils

# System monitoring
htop
iotop
iftop
```

### Application Stack (~ 30 packages)

```
# Node.js (from nodesource)
nodejs (20.x)

# Database
sqlite3
libsqlite3-0

# CEC control
cec-utils
libcec6
libp8-platform2

# Python (minimal)
python3
python3-minimal

# Build tools (if building on device)
git
build-essential

# Sports Bar TV Controller
# - Pre-built .next bundle
# - node_modules (~994MB)
# - PM2 ecosystem.config.js
```

### Size Estimate

```
Base system:           ~800MB
Node.js + npm:         ~190MB
Application bundle:    ~1.5GB (app + node_modules + .next)
Python:                ~50MB
Utilities:             ~100MB
Kernel + firmware:     ~300MB (minimal)
------------------------------------------
Total:                 ~3GB installed
ISO size:              ~2-2.5GB (compressed)
```

---

## 8. EXPECTED PERFORMANCE IMPROVEMENTS

### 8.1 Boot Time

| Metric | Current | After Optimization | Improvement |
|--------|---------|-------------------|-------------|
| systemd-analyze time | ~30-40s | ~10-15s | 50-66% faster |
| Service count | 55 enabled | ~15 enabled | 73% reduction |
| Time to SSH | ~45s | ~12s | 73% faster |

### 8.2 Memory Usage

| Component | Current | After Optimization | Savings |
|-----------|---------|-------------------|---------|
| Base system | ~500MB | ~150MB | 350MB |
| Desktop services | ~200MB | 0MB | 200MB |
| Snap daemon | ~50MB | 0MB | 50MB |
| **Total Available** | 13GB | 13.6GB | +600MB |

### 8.3 Disk Usage

| Component | Current | After Optimization | Savings |
|-----------|---------|-------------------|---------|
| System packages | ~3.5GB | ~1GB | 2.5GB |
| Snap storage | 2.3GB | 0GB | 2.3GB |
| Desktop packages | ~500MB | 0MB | 500MB |
| Old kernels | ~673MB | 0GB | 673MB |
| Firmware | 1.1GB | ~100MB | 1GB |
| Docs/locales | 176MB | 0MB | 176MB |
| Journal logs | 536MB | ~100MB | 436MB |
| **Total Savings** | | | **~7.6GB** |

### 8.4 Network Performance

- Fewer services listening on network ports
- Reduced attack surface
- Faster DNS resolution (systemd-resolved only)

### 8.5 Security Posture

- Reduced attack surface (73% fewer services)
- No unnecessary network daemons
- Minimal installed packages = fewer CVEs
- AppArmor profiles for critical services

---

## 9. DEPLOYMENT STRATEGIES

### 9.1 Bare Metal Installation

**Target Hardware:**
- x86_64 CPU (Intel/AMD)
- 4GB+ RAM (8GB recommended)
- 32GB+ SSD/HDD (64GB recommended)
- Gigabit Ethernet
- USB ports for CEC adapters

**Installation Methods:**
1. **USB Bootable ISO** - Cubic/live-build custom installer
2. **PXE Network Boot** - For multiple deployments
3. **Disk Image Clone** - dd/Clonezilla for identical hardware

### 9.2 Virtual Machine

**Recommended:**
- Proxmox VE / VMware ESXi / Hyper-V
- 4 vCPU, 4GB RAM, 32GB disk
- USB passthrough for CEC adapters
- Bridged network for static IP

**Note:** Test USB passthrough thoroughly - critical for CEC control.

### 9.3 Cloud/VPS Deployment

**Not recommended** due to:
- No USB passthrough for CEC adapters
- Likely using cloud-init (defeats minimalism)
- Better suited for on-premise deployment

---

## 10. PRE-INSTALLATION CHECKLIST

### 10.1 Application Preparation

- [ ] Build production Next.js bundle (`npm run build`)
- [ ] Test .next standalone mode
- [ ] Export node_modules or use `npm ci --production`
- [ ] Copy ecosystem.config.js PM2 configuration
- [ ] Database schema migration scripts
- [ ] Environment variables documented

### 10.2 Configuration Files

- [ ] Static IP network configuration (Netplan)
- [ ] UFW firewall rules (port 3001, 22)
- [ ] PM2 startup script
- [ ] Systemd service for PM2
- [ ] AppArmor profile for Node.js/PM2
- [ ] Logrotate configuration
- [ ] sudoers configuration
- [ ] SSH authorized_keys

### 10.3 Hardware Testing

- [ ] Pulse-Eight CEC adapter detected (/dev/ttyACM0)
- [ ] cec-client command works
- [ ] iTach IR blaster network connectivity
- [ ] Network interface names (eth0 vs ens33)
- [ ] Test on target hardware before mass deployment

### 10.4 Documentation

- [ ] First-boot setup instructions
- [ ] Network configuration guide
- [ ] Troubleshooting common issues
- [ ] Update/upgrade procedures
- [ ] Backup/restore procedures

---

## 11. BUILD TOOLS & RESOURCES

### 11.1 ISO Creation Tools

**Cubic (GUI - Recommended)**
```bash
sudo apt install cubic
```
- User-friendly GUI
- Live preview of changes
- Built-in terminal for customization
- Generates bootable ISO

**live-build (CLI - Advanced)**
```bash
sudo apt install live-build
```
- Scriptable/automatable
- More control
- Steeper learning curve

**Systemback (Legacy)**
- Creates live ISO from running system
- May not work on Ubuntu 22.04

### 11.2 Debootstrap Minimal Install

```bash
#!/bin/bash
# Create minimal Ubuntu 22.04 base

CHROOT=/mnt/minimal-ubuntu

# Install base system
debootstrap --arch=amd64 jammy $CHROOT http://archive.ubuntu.com/ubuntu

# Chroot and customize
chroot $CHROOT /bin/bash

# Inside chroot:
apt update
apt install -y linux-image-generic systemd-sysv

# Add Sports Bar packages...
# Configure services...
# Exit and create ISO
```

### 11.3 Packer Automation

**HashiCorp Packer** - Automate VM/ISO builds
```bash
# Example packer build
packer build sports-bar-appliance.pkr.hcl
```

Enables:
- Repeatable builds
- Version control
- CI/CD integration
- Multi-target outputs (ISO, OVA, QCOW2)

---

## 12. TESTING & VALIDATION

### 12.1 Functional Tests

```bash
# Test Node.js
node -v
npm -v

# Test PM2
pm2 status
pm2 list

# Test database
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables"

# Test CEC adapter
ls -la /dev/ttyACM0
echo "scan" | cec-client -s -d 1

# Test network
curl http://localhost:3001
curl -I https://google.com

# Test SSH
ssh localhost

# Test services
systemctl status pm2-ubuntu
systemctl status ssh
systemctl status ufw
```

### 12.2 Performance Tests

```bash
# Boot time
systemd-analyze
systemd-analyze blame
systemd-analyze critical-chain

# Memory usage
free -h
ps aux --sort=-%mem | head -20

# Disk usage
df -h
du -sh /* | sort -rh | head -20

# Service count
systemctl list-units --type=service --state=running | wc -l

# Package count
dpkg --list | grep "^ii" | wc -l
```

### 12.3 Security Audit

```bash
# Open ports
ss -tulpn

# Running services
systemctl --type=service --state=running

# AppArmor status
aa-status

# Firewall status
ufw status verbose

# Failed login attempts
journalctl -u ssh | grep "Failed password"
```

---

## 13. MAINTENANCE & UPDATES

### 13.1 Minimal ISO Update Strategy

**Option A: Full Rebuild**
- Rebuild ISO monthly/quarterly
- Include latest security patches
- Test thoroughly before deployment
- Redeploy to appliances

**Option B: Unattended Upgrades**
- Keep unattended-upgrades enabled
- Configure for security updates only
- Exclude kernel/major updates
- Monitor for breaking changes

**Option C: Ansible/Configuration Management**
- Manage fleet of appliances
- Push updates centrally
- Rollback capability
- Consistent configuration

### 13.2 Application Updates

```bash
# On appliance
cd /home/ubuntu/Sports-Bar-TV-Controller
git pull origin main
npm ci --production
npm run build
pm2 restart sports-bar-tv-controller
```

Or use CI/CD to build .next bundle externally and deploy.

---

## 14. ALTERNATIVE: CONTAINERIZED DEPLOYMENT

### 14.1 Docker-Based Appliance

**Dockerfile example:**
```dockerfile
FROM node:20-alpine

# Install only runtime dependencies
RUN apk add --no-cache \
    sqlite \
    libusb \
    cec-utils

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

**Challenges:**
- USB device passthrough (--device=/dev/ttyACM0)
- Host networking for IR control
- Permission management
- Hardware abstraction

**Not recommended** for CEC hardware complexity.

### 14.2 Snap Package

**sports-bar-controller.snap**
- All dependencies bundled
- Auto-updates
- Sandboxed

**Challenges:**
- USB/hardware interfaces
- File system access
- Snap's own overhead (114MB + 2.3GB storage)

**Ironic:** Removes snap from minimal ISO, then rebuilds as snap.

---

## 15. FINAL RECOMMENDATIONS

### 15.1 Recommended Approach

**Phase 1: Prototype (1-2 days)**
1. Clone current system to VM
2. Run cleanup scripts (Section 6)
3. Validate Sports Bar Controller still works
4. Document removed packages
5. Test on sample hardware

**Phase 2: ISO Build (2-3 days)**
1. Use Cubic to customize Ubuntu 22.04 Server ISO
2. Pre-install Node.js 20 from nodesource
3. Pre-configure PM2, systemd services
4. Include Sports Bar Controller app (or install script)
5. Set default network config (DHCP → static on first boot)
6. Test ISO on physical hardware

**Phase 3: Deployment Testing (3-5 days)**
1. Deploy to 2-3 test sites
2. Monitor for issues
3. Collect feedback
4. Iterate on ISO build
5. Document deployment procedures

**Phase 4: Production (ongoing)**
1. Build final ISO version
2. Version control (v1.0.0)
3. Deploy to production sites
4. Establish update cadence
5. Monitor and maintain

### 15.2 Expected Outcomes

**Size Reduction:**
- ISO: 8GB → 2-3GB (62-75% smaller)
- Installed: 38GB → 8-10GB (74-79% smaller)
- Packages: 1,188 → 300-400 (66-75% fewer)

**Performance Improvement:**
- Boot time: 40s → 12s (70% faster)
- Memory available: +600MB
- Services: 55 → 15 (73% fewer)

**Operational Benefits:**
- Faster deployments
- Lower attack surface
- Easier troubleshooting
- Reduced maintenance overhead
- More predictable behavior

### 15.3 Risk Mitigation

**Backup current working system:**
```bash
sudo dd if=/dev/sda of=/backup/sports-bar-backup.img bs=4M status=progress
```

**Test extensively before production:**
- Virtual machine testing
- Physical hardware testing
- Network configuration testing
- Hardware interface testing (CEC, IR)
- Update/upgrade testing

**Maintain fallback:**
- Keep current system as gold master
- Document differences
- Ability to revert to full Ubuntu

---

## 16. COST-BENEFIT ANALYSIS

### 16.1 Development Effort

| Task | Time Estimate | Complexity |
|------|--------------|------------|
| Package removal analysis | 4 hours | Low |
| Cleanup script development | 8 hours | Medium |
| ISO build with Cubic | 8 hours | Medium |
| Testing & validation | 16 hours | High |
| Documentation | 8 hours | Low |
| Deployment automation | 16 hours | High |
| **Total** | **60 hours** | |

### 16.2 Benefits

**One-time:**
- Faster initial deployments (2-3x faster)
- Smaller backup images
- Better understanding of system

**Ongoing:**
- 5-10 minutes faster boot/reboot
- Easier troubleshooting
- Lower disk space costs
- Fewer security updates
- More reliable operation

### 16.3 Break-Even Point

For **10+ deployment sites**, effort justified by:
- Reduced deployment time × sites
- Reduced support calls
- Improved reliability

For **1-5 sites**, consider:
- Current system works fine
- Cleanup may introduce issues
- Maintenance overhead of custom ISO

**Recommendation:** If deploying to 10+ locations, build minimal ISO. If < 5 locations, optimize current system in-place.

---

## APPENDIX A: QUICK CLEANUP SCRIPT

**WARNING: Test on clone/VM first! Backup before running!**

```bash
#!/bin/bash
# sports-bar-minimal-cleanup.sh
# Removes unnecessary packages for Sports Bar Controller appliance

set -euo pipefail

echo "Sports Bar TV Controller - System Cleanup"
echo "==========================================="
echo ""
echo "WARNING: This will remove desktop environments, browsers,"
echo "and many services. Only run on dedicated appliance systems."
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

# Backup package list
dpkg --get-selections > /tmp/pre-cleanup-packages.txt
echo "Package list backed up to /tmp/pre-cleanup-packages.txt"

# Phase 1: Remove desktop environment
echo "[1/7] Removing desktop environment..."
apt purge -y xfce4 xfce4-* xorg xserver-xorg* \
  gnome-* libgtk-3-* libgtk2.0-* \
  xdg-* desktop-* 2>/dev/null || true

# Phase 2: Remove browsers
echo "[2/7] Removing browsers..."
apt purge -y google-chrome-stable firefox 2>/dev/null || true

# Phase 3: Remove snap
echo "[3/7] Removing snap..."
systemctl stop snapd snapd.socket 2>/dev/null || true
apt purge -y snapd 2>/dev/null || true
rm -rf /var/lib/snapd /snap

# Phase 4: Remove cloud-init
echo "[4/7] Removing cloud-init..."
apt purge -y cloud-init cloud-initramfs-* pollinate ubuntu-advantage-tools 2>/dev/null || true

# Phase 5: Remove unnecessary hardware support
echo "[5/7] Removing unnecessary hardware support..."
apt purge -y modemmanager avahi-daemon \
  bluez bluetooth printer-driver-* \
  cups* sane-* 2>/dev/null || true

# Phase 6: Remove old kernels
echo "[6/7] Removing old kernels..."
current_kernel=$(uname -r)
apt purge -y $(dpkg -l 'linux-*' | grep '^ii' | awk '{print $2}' | grep -vE "$current_kernel") 2>/dev/null || true

# Phase 7: Cleanup
echo "[7/7] Final cleanup..."
apt autoremove -y --purge
apt clean
apt autoclean

# Disable unnecessary services
services_to_disable=(
  "avahi-daemon" "ModemManager" "multipathd"
  "cloud-init" "cloud-config" "pollinate"
  "xrdp" "xrdp-sesman"
  "udisks2" "packagekit"
)

for service in "${services_to_disable[@]}"; do
  systemctl disable --now "$service" 2>/dev/null || true
done

echo ""
echo "Cleanup complete!"
echo ""
dpkg --list | grep "^ii" | wc -l
df -h /
free -h
echo ""
echo "Before: $(wc -l < /tmp/pre-cleanup-packages.txt) packages"
echo "After:  $(dpkg --list | grep "^ii" | wc -l) packages"
echo ""
echo "Reboot recommended."
```

---

## APPENDIX B: ESSENTIAL PACKAGES LIST

**Minimal bootable system:**
```
base-files base-passwd bash coreutils dash debianutils diffutils
dpkg e2fsprogs findutils grep gzip hostname init-system-helpers
libc-bin login mount passwd perl-base sed systemd systemd-sysv
tar util-linux
```

**Network:**
```
iproute2 iputils-ping netbase netplan.io openssh-server systemd-networkd
systemd-resolved curl wget
```

**Hardware:**
```
linux-image-generic linux-firmware-minimal grub-pc
libusb-1.0-0 usbutils pciutils
```

**Application:**
```
nodejs sqlite3 git vim-tiny python3-minimal
```

**Total: ~250-300 packages**

---

## APPENDIX C: DISK USAGE BREAKDOWN

```
Current system (38GB):
  - /usr:        12GB (packages, libraries)
  - /var:        8GB  (logs, cache, snap)
  - /home:       2GB  (Sports Bar app)
  - /boot:       500MB (3 kernels)
  - /lib:        3GB  (firmware, modules)
  - Other:       12.5GB

Minimal system (8-10GB):
  - /usr:        3GB  (minimal packages)
  - /var:        1GB  (logs, cache)
  - /home:       2GB  (Sports Bar app)
  - /boot:       200MB (1 kernel)
  - /lib:        500MB (minimal firmware)
  - Other:       2-3GB
```

---

## Document Version

- **Version:** 1.0
- **Date:** 2025-11-21
- **Author:** System Analysis
- **System:** Ubuntu 22.04.5 LTS
- **Application:** Sports Bar TV Controller v15.5.6

---

## Next Steps

1. **Approval:** Review and approve cleanup strategy
2. **Testing:** Run cleanup script on cloned VM
3. **Validation:** Verify Sports Bar Controller functionality
4. **ISO Build:** Create minimal ISO with Cubic
5. **Deployment:** Test on 1-2 production sites
6. **Rollout:** Deploy to remaining sites

**Questions or concerns?** Review specific sections and adjust recommendations based on deployment requirements.
