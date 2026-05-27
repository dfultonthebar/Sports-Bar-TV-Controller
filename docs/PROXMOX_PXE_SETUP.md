# Proxmox PXE Server for NUC Pre-Provisioning

**Workflow:** new NUC arrives at the office → plugs into the LAN → PXE-boots a menu → pick "Sports Bar TV Controller v3.1" → ISO autoinstalls fully unattended + first-boot wizard runs → operator ships the NUC to the bar already-configured.

**v3.1.0 (2026-05-27)** swapped the ISO from a hand-rolled debootstrap chain to a stock Ubuntu 24.04.4 server ISO + subiquity autoinstall. The PXE menu still HTTP-loads the ISO the same way; only the ISO file name changed (`sports-bar-tv-controller-v3.1.0-YYYY-MM-DD.iso`).

**One-time setup:** ~30 min. Per-NUC use: one BIOS toggle + one menu pick.

---

## Architecture

```
[ Office Router (DHCP) ]
         │
         ├── [ Proxmox PVE host ]
         │         │
         │         └── [ LXC: sports-bar-netboot ]
         │                   │
         │                   ├── dnsmasq (proxy-DHCP + TFTP)
         │                   │     └── boot/iPXE.efi  (chainloads)
         │                   │
         │                   └── lighttpd (HTTP server on :80)
         │                         ├── /iso/sports-bar-tv-controller-v3.1.0-*.iso
         │                         └── /menu/sports-bar.ipxe
         │
         └── [ NEW NUC (PXE-boot enabled in BIOS) ]
                   ↓
              DHCP from router (normal LAN IP)
                   ↓
              Proxy-DHCP from netboot LXC → "boot iPXE from $LXC_IP"
                   ↓
              iPXE loads → fetches sports-bar.ipxe menu → operator picks ISO
                   ↓
              Boots ISO over HTTP → autoinstall runs unattended → reboot → first-boot wizard
```

**Proxy-DHCP mode is the key.** The netboot LXC does NOT replace your router's DHCP. It augments it: the router still hands out IPs, but the LXC also responds with the PXE bootfile path. Zero router config needed if your router doesn't block proxy-DHCP packets (most don't).

---

## Prerequisites

- Proxmox VE 7.x or 8.x (any recent version)
- A network bridge on the Proxmox host where the new NUC will plug in (`vmbr0` typically — same bridge your office LAN uses)
- ~5 GB free in a Proxmox storage pool (for the ISO)
- One free LAN IP (DHCP-assigned to the LXC is fine)
- Optional but recommended: Tailscale installed on Proxmox so the LXC can pull updated ISOs from Holmgren's Tailscale Serve URL

---

## Setup

### 1. Create the LXC

On the Proxmox node (via the Proxmox web UI or `ssh root@proxmox`):

```bash
# Pull this repo's helper script (or copy it from a fleet box)
wget -O /root/setup-netboot-lxc.sh \
    https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/proxmox/setup-netboot-lxc.sh
chmod +x /root/setup-netboot-lxc.sh

# Run it (creates container 200 by default; pass --ctid to change)
bash /root/setup-netboot-lxc.sh
```

The script creates a Debian 12 LXC named `sports-bar-netboot`, installs dnsmasq + lighttpd + curl, and starts it. ~3-5 min.

### 2. Configure the menu (inside the LXC)

```bash
pct enter 200   # enter the netboot LXC (or use the container ID the previous step printed)

# Inside the LXC:
wget -O /root/configure-netboot-menu.sh \
    https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/proxmox/configure-netboot-menu.sh
bash /root/configure-netboot-menu.sh
exit
```

This downloads the latest Sports-Bar ISO from GitHub Releases (handles the 2-part split + reassembly + sha256 verify), drops it into `/var/www/html/iso/`, writes the iPXE menu to `/var/www/html/menu/sports-bar.ipxe`, and configures dnsmasq.

### 3. PXE-boot your first NUC

1. **BIOS one-time setup on the NUC**: enable "PXE boot" or "Network boot" in BIOS boot order. Set network as first boot device, internal disk second.
2. **Power on the NUC** with a network cable plugged in.
3. **Watch the screen** — should show "Booting iPXE..." → "Sports Bar TV Controller Boot Menu".
4. **Pick "Install Sports Bar TV Controller v3.1"**.
5. ISO loads → subiquity autoinstall runs fully unattended (~15-25 min) → reboot.
6. After reboot: `sports-bar-first-boot.service` clones + builds (~10-15 min), then prints `location-setup-wizard` on tty1. Operator runs it to set bar name, PINs, network scan.

---

## Updating the ISO when a new build ships

```bash
pct enter 200
bash /root/configure-netboot-menu.sh   # re-running fetches the latest release, replaces the ISO
exit
```

The menu always points at the latest ISO downloaded into the LXC. Old ISOs are kept in `/var/www/html/iso/archive/` for rollback.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| NUC shows "PXE-E61 Media test failure" | BIOS PXE not enabled, or NIC cable unplugged | Re-check BIOS boot order + cable |
| iPXE loads but menu is blank | LXC's lighttpd is down OR menu file missing | `pct enter 200; systemctl status lighttpd; ls /var/www/html/menu/` |
| Menu loads but ISO fails to download | LXC IP isn't reachable from NUC's subnet | Verify NUC + LXC are on the same VLAN/bridge |
| ISO downloads but installer doesn't boot | Memory test failure (NUC has <4 GB RAM) | Stock Ubuntu 24.04.4 server ISO needs 2 GB+ RAM; v3.1.0 ISO is the same |
| Router's DHCP overrides PXE option | Some enterprise gear blocks proxy-DHCP | Manually configure router DHCP to set `option 66 = $LXC_IP` and `option 67 = ipxe.efi` |

---

## Why this design (vs alternatives)

- **Proxy-DHCP, not full DHCP server**: doesn't fight the existing router. Easier rollout.
- **netboot LXC, not a Proxmox VM**: LXC is lightweight (~50 MB RAM idle), boots in 2 sec, and dnsmasq + lighttpd don't need a full kernel.
- **iPXE, not legacy PXELINUX**: handles HTTP (not just TFTP), modern UEFI + BIOS support, scriptable menu.
- **Self-contained menu**: the iPXE menu is HTTP-fetchable + version-tagged, so the operator can edit it without rebuilding the LXC.

---

## Future enhancements

- **Multi-version menu**: pin v3.1 + dev/test build side-by-side so the operator can boot either
- **Tailscale Serve integration**: when the operator clicks the Tailscale Serve enablement URL (see Holmgren's status), point the iPXE menu directly at `https://hw-sports-bar-tv-controller.tail-NET.ts.net/iso/...iso` — eliminates the per-update download step on the LXC
- **Already-unattended as of v3.1.0**: the previous "automated unattended install" entry is no longer a future enhancement — subiquity autoinstall handles disk selection and partitioning declaratively from the autoinstall.yaml baked into the ISO. No kernel cmdline tweaks needed.
