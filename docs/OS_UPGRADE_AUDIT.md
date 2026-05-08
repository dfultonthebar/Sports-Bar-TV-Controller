# OS Upgrade Pre-Flight Audit (2026-05-07)

Companion to `OS_UPGRADE_RUNBOOK.md`. Captured AS-OF 2026-05-07 to give operators a known-good noble baseline + per-location divergences before committing to the upgrade. Use this to pre-decide config-conflict prompts during `do-release-upgrade` and to spot-check the post-upgrade state.

---

## Noble baseline (from holmgren-way)

Holmgren is the reference. Anywhere a jammy box should match this after upgrade:

| Property | Value |
|---|---|
| Codename | `noble` (24.04.4 LTS) |
| Kernel | `6.8.0-100-generic` |
| iGPU driver | `i915` bound (also `xe` module loaded but not in use); `/dev/dri/card1` + `renderD128` exist |
| Intel userspace | 10 packages installed: `intel-igc-cm`, `intel-level-zero-gpu`, `intel-microcode`, `intel-opencl-icd`, `libdrm-intel1`, `libigc1`, `libigdfcl1`, `libigdgmm12`, `libze1` (+ `intel-gpu-tools`) |
| Intel apt repo | `/etc/apt/sources.list.d/intel-gpu.list` → `noble client` |
| ubuntu groups | includes `render` + `video` (required for `/dev/dri/renderD128` access) |
| Custom systemd | `/etc/systemd/system/ollama-ipex.service` (the IPEX-LLM unit) |
| Custom nginx | `/etc/nginx/sites-available/bartender-remote` (the bartender allow-list) |
| PM2 apps | `pm2-logrotate`, `sports-bar-tv-controller` only |
| Sudoers | `/etc/sudoers.d/ubuntu-nopasswd` NOT present (passwordless via default group), or per-location |

If a jammy box ends up looking like this after `do-release-upgrade` + `setup-iris-ollama.sh` re-run, the upgrade succeeded.

---

## Per-location current state (jammy, before upgrade)

### graystone (100.93.130.14)

| Property | Value | Action needed |
|---|---|---|
| Kernel | `5.15.0-171-generic` (jammy default 5.15 series) | upgrade brings 6.8.x |
| `/dev/dri/` | **empty** despite `i915` loaded — module not binding to device | 6.8 kernel should fix this (better Raptor Lake-P support) |
| ubuntu groups | `adm dialout cdrom sudo dip plugdev users ollama` — **missing render + video** | `setup-iris-ollama.sh` adds these post-upgrade |
| Intel apt repo | **none configured** | `setup-iris-ollama.sh` adds noble client repo |
| Intel pkgs | minimal: `intel-microcode`, `libdrm-intel1` only | rest installed by setup script post-upgrade |
| PM2 apps | `pm2-logrotate`, `n8n`, `sports-bar-tv-controller` | **`n8n` should not be here** — per CLAUDE.md, removed in v2.20.0 from the rest of the fleet. Either stop it pre-upgrade or investigate what it's doing here. |
| Pending pkg upgrades | 49 | run `apt-get upgrade` BEFORE `do-release-upgrade` per runbook step 3 |
| Disk free | 374 GB | plenty |
| Memory | 13 GB available of 15 GB total | i5-1340P box, less RAM than the i9 venues |

**Graystone-specific risk**: kernel binding issue is mysterious (i915 loaded but no /dev/dri). If 6.8 kernel doesn't bind either, this box may have a deeper hardware/BIOS issue (integrated graphics disabled in BIOS?). The OS upgrade is BOTH the lowest-risk-of-data-loss path AND the most likely to fix the iGPU binding — but if it doesn't, the runbook's troubleshooting section (modprobe, dmesg, BIOS check) applies.

### greenville (100.112.255.60)

| Property | Value | Action needed |
|---|---|---|
| Kernel | `5.15.0-174-generic` | upgrade |
| `/dev/dri/` | empty | should populate post-upgrade |
| ubuntu groups | has `render` (good) but **missing `video`** | setup script adds `video` |
| Intel apt repo | `/etc/apt/sources.list.d/intel-gpu.list` exists | will be rewritten for `noble` post-upgrade by v2.32.70+ setup |
| Intel pkgs | only `intel-microcode` installed (the noble repo's main packages failed on jammy due to libc6 mismatch) | clean post-upgrade |
| PM2 apps | `pm2-logrotate`, `sports-bar-tv-controller` only | clean ✓ |
| Pending pkg upgrades | **78** | apt-get upgrade before dist-upgrade is mandatory; this box has been neglected |
| Disk free | (didn't capture; assume ample) | – |
| Memory | 32 GB | – |

### appleton (100.107.223.47)

| Property | Value | Action needed |
|---|---|---|
| Kernel | `5.15.0-174-generic` | upgrade |
| `/dev/dri/` | empty | should populate post-upgrade |
| ubuntu groups | has `render` (good), **missing `video`** | setup script adds `video` |
| Intel apt repo | `intel-gpu.list` configured | rewritten for `noble` post-upgrade |
| Intel pkgs | **full set already installed** (intel-igc-cm, intel-level-zero-gpu, intel-opencl-icd, libdrm-intel1, libigc1, libigdfcl1, libigdgmm12, libze1) | proves the kernel module IS the blocker on jammy — packages alone weren't enough |
| PM2 apps | `sports-bar-tv-controller` only (no logrotate?) | optional: re-add `pm2-logrotate` |
| Pending pkg upgrades | 16 | least-neglected of the three |
| Disk free | 828 GB | plenty |
| Memory | 32 GB | – |

---

## do-release-upgrade config conflict prompt cheat sheet

When `do-release-upgrade` finds a config file you've modified locally that the new package wants to overwrite, it prompts:
> "Configuration file `<path>'<br>What would you like to do? Y or I — install package maintainer's version. N or O — keep your currently-installed version. D — show diff. Z — start a shell."

Pre-decided answers for our boxes:

| File | Answer | Why |
|---|---|---|
| `/etc/ssh/sshd_config` | **N (keep old)** | Venue-specific SSH settings (Tailscale auth keys, etc.) |
| `/etc/sudoers.d/ubuntu-nopasswd` | **N (keep old)** | We just set this; lose it = locked out of automated tasks |
| `/etc/sudoers` | N (keep old) | Holds the `%sudo` line that gives ubuntu group sudo |
| `/etc/nginx/sites-available/bartender-remote` | **N (keep old)** | Our generated bartender config |
| `/etc/nginx/sites-available/default` | I (install new) | Nginx default site we don't use |
| `/etc/nginx/nginx.conf` | I (install new) | Default nginx config; we override per-site |
| `/etc/systemd/system/ollama-ipex.service` | N/A on jammy boxes (file doesn't exist there yet) | Will be created by `setup-iris-ollama.sh` post-upgrade |
| `/etc/systemd/system/ollama.service.d/override.conf` | N (keep old) | Our `OLLAMA_HOST=0.0.0.0:11434` override on the upstream Ollama unit |
| `/etc/cron.d/*` | I (install new) | Use new cron defaults |
| `/etc/services` | I (install new) | Use new services list |
| `/etc/issue`, `/etc/issue.net`, `/etc/motd` | I (install new) | Cosmetic banners |
| `/etc/lsb-release`, `/etc/os-release` | (auto-replaced by upgrade; no prompt) | – |
| `/boot/grub/grub.cfg` | (auto-regenerated; no prompt) | – |
| Anything Intel-related (e.g. `intel-microcode` config) | I (install new) | Use new |
| **Anything else with substantive operator-modified content** | **D (show diff)** then decide | If unsure, `D` then call out before answering |

**Default rule of thumb:** if the file path is under `/etc/<tool-we-manage>/` (sshd, sudoers, nginx-our-site, ollama-ipex unit), keep old. If it's a system distro file (cron defaults, services, issue files), install new. If unsure, show diff.

---

## Pre-flight cleanup tasks (per location, before starting do-release-upgrade)

### graystone-only

1. **Decide what to do with `n8n`.**
   - If unused: `pm2 stop n8n && pm2 delete n8n && pm2 save` BEFORE the upgrade.
   - If used: investigate what's calling it; document; consider migrating off.
   - Per CLAUDE.md memory the rest of the fleet removed n8n in v2.20.0 — graystone got missed somehow.

2. **Apply the 49 pending pkg upgrades** (runbook Step 3). Some are kernel security updates that you want before the dist-upgrade ingests them.

### greenville-only

1. **78 pending pkg upgrades — significant.** Apply BEFORE dist-upgrade. May want to upgrade kernel + reboot first to confirm the box still boots cleanly on jammy before adding dist-upgrade complexity on top.

### appleton-only

1. 16 pending pkg upgrades. Apply per runbook.

### All three

1. Run the runbook's Step 1 (backups) — `production.db`, `.next` build, `.env`, `dump.pm2`, `dpkg -l`.
2. Verify Tailscale connection has fallback (the dist-upgrade opens a backup SSHD on port 1022).
3. Confirm someone is reachable by phone in case of unrecoverable boot failure.

---

## Post-upgrade verification checklist (per location)

Run AFTER the reboot. Should land at the noble baseline (top of this doc):

```bash
# Codename + kernel
lsb_release -cs                                    # noble
uname -r                                            # 6.8.x

# /dev/dri/ should now be populated (the new kernel binds i915)
ls /dev/dri/                                        # by-path  card1  renderD128

# PM2 + app
pm2 status                                          # sports-bar-tv-controller online
                                                    # graystone: confirm n8n is GONE (if pre-flight removed it)
curl -s http://localhost:3001/api/system/health | head -c 200

# verify-install
bash /home/ubuntu/Sports-Bar-TV-Controller/scripts/verify-install.sh   # PASS 7/7

# Bartender proxy
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/        # 302
```

Then run `bash scripts/setup-iris-ollama.sh` per runbook Step 10 to enable the Iris Xe stack. Verify:

```bash
clinfo -l                                                              # Intel platform listed
systemctl is-active ollama-ipex                                        # active
sudo journalctl -u ollama-ipex --since=2m | grep "using Intel GPU"     # one match

# AI Suggest end-to-end test (should be ~100s on iGPU)
curl -s -m 200 -o /dev/null -w "HTTP=%{http_code} time=%{time_total}s\n" \
    http://localhost:3001/api/scheduling/ai-suggest
```

If those all pass, the location matches the noble baseline. If any of them fail, see the rollback section in `OS_UPGRADE_RUNBOOK.md`.
