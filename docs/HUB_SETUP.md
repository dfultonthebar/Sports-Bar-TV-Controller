# SBCC Hub — Server Setup (Proxmox)

Provisioning runbook for the central **Sports Bar Command Center (SBCC)** hub: the Proxmox VM that
ingests fleet telemetry (`apps/hub`) and hosts **Hermes as the fleet brain**. Pairs with the
implementation plan (`docs/SBCC_COMMAND_CENTER_PLAN.md`) and the per-location agent
(`packages/hub-agent/`).

**Phasing:** Phase A stands up the VM + dashboard + fleet error feed with **Hermes on cloud Grok-4**
(no GPU needed). The **GPU tier below is the upgrade** that lets Hermes + the dashboard AI run on a
**local model instead of metered Grok** — wire it whenever the card is in.

---

## 1. Hub VM spec

| Tier | vCPU | RAM | Disk | Notes |
|---|---|---|---|---|
| **Phase A (no AI)** | 4 | 8–16 GB | 64–128 GB | Dashboard + ingest + Hermes-on-Grok. Fine on CPU only. |
| **+ GPU (local AI)** | 4 | 16–24 GB | 128 GB | Adds a slot-powered GPU (below) for local Hermes/Ollama. |

- **OS:** Ubuntu Server 24.04 LTS. **Machine type q35, BIOS OVMF (UEFI)** + EFI disk (required for GPU
  passthrough and consistent with the fleet ISO).
- **Base packages:** Node 22 + PM2 (match the fleet — see Gotcha #11 PATH/linger notes), Tailscale.
- **Reach:** join Tailscale; MagicDNS name e.g. `hub`. The hub app listens on **:3010**, PIN-auth,
  **Tailscale/home-network only** (no public exposure unless you add Caddy + DDNS + TLS deliberately).

---

## 2. GPU tier — Lenovo ThinkSystem ST250 V3

The ST250 V3 is an **entry single-socket Xeon E-2400 tower**. Its PSU + power-cabling is the deciding
constraint, and it points hard at **slot-powered (≤75 W) datacenter GPUs**.

### Why slot-powered only
Entry tower PSUs (this box ships **~300 W fixed**, or **450 W/550 W redundant** as an option) frequently
have **no spare PCIe 6/8-pin power cables**. So:

| Card | VRAM | Power | Fits ST250 V3? | Why |
|---|---|---|---|---|
| **NVIDIA T4** | 16 GB | **70 W, slot-powered** | ✅ **best baseline** | No external power cable; trivial PSU load; datacenter card → clean passthrough |
| **NVIDIA L4** | 24 GB | **72 W, slot-powered** | ✅ **best if budget allows** | Same no-cable story as T4, 2× VRAM, faster (Ada) — comfortable 14B @ 64K |
| NVIDIA A2 | 16 GB | 40–60 W, slot-powered | ✅ ok (slower) | Lowest heat; fine for an 8B brain |
| Tesla P40 | 24 GB | 250 W, **needs 8-pin** | ❌ likely no | Exceeds a 300 W PSU next to the Xeon; needs a power cable the box may lack |
| RTX 3060 | 12 GB | 170 W, **needs 8-pin** | ❌ likely no | Needs supplemental power + consumer-GeForce in a server BIOS/airflow |

**Recommendation: T4 (baseline) or L4 (24 GB upgrade).** The generic "cheaper P40 / easy 3060" advice
does NOT apply to this chassis — they need power this server probably can't give.

### Verify on the actual unit before buying
1. **PSU wattage** (PSU sticker / Lenovo XClarity). T4/L4 fit almost anything, but confirm.
2. **A free PCIe x16 slot** (the ST250 V3 has several PCIe 4.0/5.0 slots — confirm one is open and x16
   electrically).
3. **Airflow over the slot.** T4/L4/A2 are **passive** (no fan) — they rely on chassis airflow. In a
   server tower this is usually fine, but check whether Lenovo offers a **GPU air-baffle/thermal kit**
   for the ST250 V3, or that the fan config moves air across the PCIe area, so the card doesn't throttle.
4. **UEFI:** enable **Above 4G Decoding** (and **Resizable BAR** if offered) — required to map full VRAM
   for passthrough.

### Proxmox passthrough (host)
```bash
# 1. BIOS: VT-d ON, Above 4G Decoding ON (see above)
# 2. Host kernel cmdline — IOMMU on:
#    GRUB: add to GRUB_CMDLINE_LINUX_DEFAULT, then update-grub
#    systemd-boot: edit /etc/kernel/cmdline, then proxmox-boot-tool refresh
#        intel_iommu=on iommu=pt
# 3. vfio modules:
echo -e "vfio\nvfio_iommu_type1\nvfio_pci" | sudo tee -a /etc/modules
# 4. Find the GPU PCI id + vendor:device, then bind to vfio-pci:
lspci -nn | grep -i nvidia          # e.g. 01:00.0 ... [10de:1eb8] (T4)  /  [10de:27b8] (L4)
echo "options vfio-pci ids=10de:1eb8" | sudo tee /etc/modprobe.d/vfio.conf   # use YOUR id
echo -e "blacklist nouveau\nblacklist nvidia" | sudo tee /etc/modprobe.d/blacklist-gpu.conf
sudo update-initramfs -u && sudo reboot
# 5. After reboot, confirm the card is bound to vfio-pci:
lspci -nnk -d 10de:1eb8             # "Kernel driver in use: vfio-pci"
# 6. Attach to the hub VM (q35 + OVMF):
qm set <VMID> -hostpci0 01:00,pcie=1
```
### Guest (Ubuntu 24.04 in the hub VM)
```bash
sudo apt-get update && sudo apt-get install -y nvidia-driver-550 nvidia-utils-550   # or current LTS branch
sudo reboot
nvidia-smi                          # must show the T4/L4 before Ollama will use it
# Ollama auto-detects CUDA; no SYCL/IPEX-LLM gymnastics (unlike the Iris Xe bar boxes)
```

### Local model sizing on this GPU
- **T4 / A2 (16 GB):** `hermes3:8b` or `llama3.1:8b` @ 64K context fits comfortably; `qwen2.5:14b` @ 64K
  is **tight but workable** (Q4). 8B is the safe default.
- **L4 (24 GB):** `qwen2.5:14b` @ 64K is **comfortable** (the strong tool-caller), even a quantized 32B.
- Either way this **clears the ≥64K-context floor** that blocked local models on the bar boxes
  (`[[feedback_hermes_kanban_worker_broken]]` notes the context limit). Point Hermes's profile + the
  hub chat at the local Ollama once `nvidia-smi` is green; fall back to Grok-4 if the GPU is absent.

---

## 3. Networking & security
- Agent → hub: **HMAC-SHA256** signed payloads (see `packages/hub-agent/src/hmac.ts`), per-location
  `HUB_AGENT_SECRET`, over Tailscale.
- Hub dashboard: **PIN-auth**, Tailscale/home-network only. No credentials transit; API-response JSON only.
- Ports: hub app **:3010**. Locations reach the hub at `http://hub:3010` (MagicDNS) or its Tailscale IP.

---

## 4. Provisioning order
1. Create the VM (q35/OVMF, spec above), install Ubuntu 24.04, join Tailscale.
2. Node 22 + PM2 (+ linger/PATH per Gotcha #11).
3. *(GPU tier)* passthrough + driver per §2; verify `nvidia-smi`.
4. Deploy `apps/hub` (build + PM2 on :3010) — **steps land here when the app ships (Phase A2).**
5. Register locations + roll `packages/hub-agent` to the fleet via `auto-update.sh` (Phase A4).
6. *(Phase B)* relocate Hermes to the hub; point its model at local Ollama if GPU present, else Grok-4.

---

**Status:** Phase A in progress. Hub VM + GPU tier documented; `apps/hub` deploy steps added when the app lands.
