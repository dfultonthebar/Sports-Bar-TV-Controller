# Bare-Metal ISO Install

Operator runbook for installing on a brand-new NUC or bare-metal box
from USB. Boot the USB, answer prompts, log in.

For the curl-one-liner path (Ubuntu already installed, you have SSH),
use `docs/NEW_LOCATION_SETUP.md` instead.

## What you need

- USB stick, 8 GB minimum.
- Bare-metal machine. **Intel NUC is the fleet standard** (i5/i7 with
  Iris Xe iGPU = fast local AI).
- Wired network cable. **DHCP is required for first boot** — installer
  must reach GitHub.
- Latest ISO from
  **https://github.com/dfultonthebar/Sports-Bar-TV-Controller/releases**
  (the most recent `sports-bar-v*.iso` asset).

## Build the USB

On any Linux machine, find the device with `lsblk`. Pick the USB by
size (typically `/dev/sdb` or `/dev/sdc`). **Do not pick `/dev/sda`
unless you're 100% sure it isn't your laptop's main disk** — wrong
device erases your laptop.

Unmount auto-mounted partitions on the USB first, then flash. Replace
`/dev/sdX` with the device you identified. **This WILL erase /dev/sdX.
Triple-check the name.**

```
sudo dd if=sports-bar-vX.X.XX.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

3-8 minutes on USB 3.

## Boot the installer

Plug the USB into the target machine. Enter BIOS boot menu (F2, F10,
F12, or DEL — varies by manufacturer). Boot from USB.

The ISOLINUX menu has two modes:

- **`fresh`** — wipes the target disk and installs cleanly. **Default
  for a brand-new box.**
- **`install`** — installs without touching an existing
  `/home/ubuntu/sports-bar-data` partition. Use only when reinstalling
  and preserving the existing database.

Pick `fresh`. The disk installer runs on tty1 (see
`scripts/iso/build-sports-bar-iso.sh`). When done, the machine reboots
into the installed system.

## First boot

`sports-bar-first-boot.service` clones the app from GitHub, runs
`npm ci`, applies migrations, starts PM2, configures auto-start. It
then prints on tty1:

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

**As of v2.54.51** the wizard also runs `bootstrap-new-location.sh`
(Location row + AuthPin seeding + `LOCATION_ID` binding), applies
Gotcha #11 hardening (linger, `node`/`npx` symlinks, ollama models
group write), and runs `verify-install.sh` as the final gate — all
automatically. If the wizard exits green, the box is ready to log in.
On earlier ISO builds, the wizard stops at the network-scan step and
asks you to run those by hand — follow `docs/NEW_LOCATION_SETUP.md`
§3-§7b.

## After the wizard

From a laptop or tablet on the same LAN:

- Admin UI: **`http://<box-ip>:3001`** — log in with the admin PIN.
- Bartender remote: **`http://<box-ip>:3002`** — log in with the staff
  PIN. iPad-friendly URL for the tablet behind the bar.

The box's IP shows on tty1 after the wizard, or
`ip -4 addr show | grep inet` from any session.

## If something goes wrong

- **Wizard never appeared.** Check
  `cat /var/log/sports-bar-first-boot.log` or
  `journalctl -u sports-bar-first-boot.service`. #1 cause is network
  unreachable (script waits 2 min for `github.com`, then exits). Verify
  Ethernet + DHCP and `sudo systemctl restart sports-bar-first-boot.service`.

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
