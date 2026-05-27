# Bare-Metal ISO Install

Operator runbook for installing on a brand-new NUC or bare-metal box
from USB. Boot the USB, walk away, log in.

**As of v3.1.0 (2026-05-27) the install is FULLY UNATTENDED** — no YES
prompt, no Enter to confirm, no disk picker. Subiquity (Ubuntu Server's
installer) + curtin do everything from the autoinstall config baked
into the ISO.

For the curl-one-liner path (Ubuntu already installed, you have SSH),
use `docs/NEW_LOCATION_SETUP.md` instead.

## What you need

- USB stick, 8 GB minimum.
- Bare-metal machine. **Intel NUC is the fleet standard** (i5/i7 with
  Iris Xe iGPU = fast local AI).
- Wired network cable. **DHCP is required for first boot** — the
  installer pulls packages from Ubuntu mirrors and the first-boot script
  clones the app from GitHub.
- Latest ISO from
  **https://github.com/dfultonthebar/Sports-Bar-TV-Controller/releases**
  (the most recent `sports-bar-tv-controller-v3.1.0-YYYY-MM-DD.iso` asset).

## Default install credentials

The autoinstall provisions the installed system with:

- **User:** `ubuntu`
- **Password:** `ubuntu` (change with `passwd` after first login, or
  pass `--password` at build time — see build section below)
- **Hostname:** `sports-bar-controller` (rename anytime via
  `sudo hostnamectl set-hostname <new>`)

These are the credentials for the **installed system**. There is no
separate live-ISO password — autoinstall reboots straight from install
to running system without a "live ISO" interactive state to log into.

## Building the ISO yourself (optional — only if no Release asset exists)

Any fleet box (or any Ubuntu 22.04+ host) can build the v3.1.0 ISO.
One-time build-host setup:

```
sudo apt-get install -y p7zip-full xorriso wget openssl
```

Then:

```
cd /home/ubuntu/Sports-Bar-TV-Controller
bash scripts/iso/build-autoinstall-iso.sh
```

15-30 min on first run (downloads stock Ubuntu 24.04.4 server ISO,
~3 GB, cached at `/home/ubuntu/iso-cache/`). Result lands at
`/home/ubuntu/sports-bar-tv-controller-v3.1.0-YYYY-MM-DD.iso` with
matching `.md5` and `.sha256` checksum files alongside.

Useful flags:

- `--build-dir /tmp/iso-build` — put the working dir somewhere else
  (default `/home/ubuntu/iso-autoinstall-build`)
- `--skip-download` — reuse cached stock ISO without re-verifying SHA
- `--password mypass` — set the `ubuntu` user password (default
  `ubuntu`)

### How v3.1.0 differs from v3.0.x (history)

The v3.0.x installer (`build-sports-bar-iso.sh` + `disk-installer.sh`)
was a hand-rolled debootstrap + chroot + manual partitioning chain
that hit 7 silent-fail bugs in one day (parted, unsquashfs, grub-install,
kernel copy, bios_boot partition, initramfs regen, fstab UUIDs). The
v3.1.0 architecture uses **stock Ubuntu 24.04.4 server ISO + subiquity
autoinstall + curtin** so Canonical handles all the partitioning,
kernel install, and bootloader work that we kept breaking.

The deprecated v3.0.x scripts remain in git history for reference but
should not be used. The v3.1.0 entry point is
`scripts/iso/build-autoinstall-iso.sh`.

## Test the ISO before shipping (optional)

`scripts/iso/smoke-test-autoinstall.sh` drives a Proxmox VM end-to-end
from "fresh disk" to "bartender remote returns 200" with zero manual
intervention. Useful for sanity-checking a newly built ISO before USB
flashing.

```
bash scripts/iso/smoke-test-autoinstall.sh
# Or detached:
nohup bash scripts/iso/smoke-test-autoinstall.sh > /tmp/smoke.log 2>&1 &
```

Requirements: Tailscale SSH access to the Proxmox host, a VM ID and MAC
in the script's env (defaults VMID=200, MAC matches our test VM), and
the VM pre-configured to OVMF/q35/virtio-scsi-pci with an EFI disk. See
the script header for the full requirements list. Total runtime
~30-50 min (install ~20 min + first-boot clone/build ~15 min).

## Build the USB

On any Linux machine, find the device with `lsblk`. Pick the USB by
size (typically `/dev/sdb` or `/dev/sdc`). **Do not pick `/dev/sda`
unless you're 100% sure it isn't your laptop's main disk** — wrong
device erases your laptop.

Unmount auto-mounted partitions on the USB first, then flash. Replace
`/dev/sdX` with the device you identified. **This WILL erase /dev/sdX.
Triple-check the name.**

```
sudo dd if=sports-bar-tv-controller-v3.1.0-YYYY-MM-DD.iso \
        of=/dev/sdX bs=4M status=progress conv=fsync
```

3-8 minutes on USB 3.

## Boot the installer

Plug the USB into the target machine. Enter BIOS boot menu (F2, F10,
F12, or DEL — varies by manufacturer). Boot from USB.

The GRUB menu auto-selects **"Sports Bar TV Controller — Autoinstall
(default)"** after 5 seconds. You can also press Enter to start
immediately, or pick a different entry if you need to drop into the
live shell for debugging.

From here on, **walk away**. The install is fully unattended:

1. Subiquity boots into the Ubuntu Server 24.04.4 live environment.
2. Reads `/cdrom/server/user-data` (our autoinstall config).
3. Curtin partitions the disk (GPT + bios_boot + EFI + ext4 root),
   installs Ubuntu base + linux-image-generic + our extra packages,
   regenerates initramfs, installs GRUB for BIOS+UEFI both, writes
   fstab UUIDs.
4. Late-commands copy our first-boot script and enable the systemd
   service.
5. Reboots into the installed system.

Total install time: **~15-25 min**.

## First boot

After the post-install reboot, `sports-bar-first-boot.service` runs
once and:

- Clones the repo from GitHub to `/home/ubuntu/Sports-Bar-TV-Controller`
- Runs `npm ci` and applies pending Drizzle migrations
- Builds the app (Turborepo)
- Registers PM2 and configures auto-start
- Touches `/var/lib/sports-bar-first-boot-done` so it never re-runs

When the service finishes, the box prints on tty1:

```
location-setup-wizard
```

Run as the `ubuntu` user (alias pre-installed; wizard auto-`sudo`s
where needed). The wizard prompts for:

- Bar name (creates the `location/<slug>` git branch).
- Admin PIN + staff PIN (4 digits each).
- Optional Anthropic API key (auto-update Checkpoints — falls back to
  Claude Code CLI subscription without it).
- Network scan: probes the LAN for Wolf Pack matrices, Atlas / BSS /
  dbx audio processors, Global Cache IR blasters, DirecTV / Fire TV /
  Samsung / LG / Roku TVs, Crestron switchers. Interactive Wolf Pack
  input/output mapping.
- Ollama model pulls (`llama3.1:8b` + `nomic-embed-text`).

The wizard also runs `bootstrap-new-location.sh` (Location row +
AuthPin seeding + `LOCATION_ID` binding), applies Gotcha #11 hardening
(linger, `node`/`npx` symlinks, ollama models group write), and runs
`verify-install.sh` as the final gate — all automatically. If the
wizard exits green, the box is ready to log in.

## After the wizard

From a laptop or tablet on the same LAN:

- Admin UI: **`http://<box-ip>:3001`** — log in with the admin PIN.
- Bartender remote: **`http://<box-ip>:3002`** — log in with the staff
  PIN. iPad-friendly URL for the tablet behind the bar.

The box's IP shows on tty1 after the wizard, or
`ip -4 addr show | grep inet` from any session.

## If something goes wrong

Most of what used to break in v3.0.x (partitioning, grub embed, kernel
copy, initramfs, fstab UUIDs) is now curtin's responsibility, not ours.
When curtin fails it logs verbosely to the installer's tty and to
`/var/log/installer/` on the live ISO before reboot — capture those if
the install hangs or errors.

- **Install never finished / box won't boot after install.** Boot back
  into the USB (BIOS boot menu → USB). Pick a non-default GRUB entry
  to get a live shell. Mount the installed root and check
  `/var/log/installer/curtin-install.log` and
  `/var/log/installer/subiquity-server-debug.log` for the failure
  point. Most common cause: the target disk had a non-clean partition
  table that curtin's `storage.layout.name: direct` couldn't reconcile.
  Wipe the disk first with `sgdisk --zap-all /dev/sdX`, reboot to the
  ISO, install again.

- **Box boots after install but wizard never appears on tty1.** Check
  `cat /var/log/sports-bar-first-boot.log` or
  `journalctl -u sports-bar-first-boot.service`. #1 cause is network
  unreachable (script waits 2 min for `github.com`, then exits).
  Verify Ethernet + DHCP and
  `sudo systemctl restart sports-bar-first-boot.service`.

- **Wizard skipped a step or exited early.** Re-run (idempotent):
  `sudo bash /usr/local/bin/location-setup-wizard.sh`.

- **Login returns "Invalid PIN".** Auth bootstrap skipped. Run by hand:

  ```
  cd /home/ubuntu/Sports-Bar-TV-Controller
  bash scripts/bootstrap-new-location.sh \
    --name "Your Bar Name" --admin-pin XXXX --staff-pin YYYY
  pm2 restart sports-bar-tv-controller --update-env
  ```

  Still failing? See `docs/NEW_LOCATION_SETUP.md` §6 for the
  end-to-end auth diagnostic.

- **Anything else.** Open `docs/NEW_LOCATION_SETUP.md` §0 and walk the
  step-by-step runbook — every command the wizard runs is documented
  there in order, with troubleshooting notes.
