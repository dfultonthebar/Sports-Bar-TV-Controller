#!/usr/bin/env bash
#
# setup-iris-ollama.sh
#
# Installs IPEX-LLM's Ollama portable build for Intel Iris Xe iGPU
# acceleration. Replaces the upstream CPU-only Ollama systemd service.
#
# Standardized across the fleet at v2.32.57+. Holmgren's bartender
# AI Suggest endpoint went from 3+ min (and frequent timeouts) on CPU
# to 100s reliably on Iris Xe via this stack.
#
# Idempotent: safe to re-run. Re-runs verify the existing install.
#
# Hardware requirements:
#   - Intel iGPU with level-zero support (clinfo shows "Intel" platform)
#   - Already-installed: intel-level-zero-gpu, intel-opencl-icd, libze1
#     (these come from the Intel GPU apt repo at install.sh time)
#   - Models live at /usr/share/ollama/.ollama/models (default Ollama path)
#     and are accessed via the existing 'ollama' user's group permissions.
#
# Usage: bash scripts/setup-iris-ollama.sh

set -euo pipefail

PORTABLE_DIR=/home/ubuntu/ipex-llm-ollama
PORTABLE_VER=ollama-ipex-llm-2.3.0b20250725-ubuntu
PORTABLE_URL="https://github.com/ipex-llm/ipex-llm/releases/download/v2.3.0-nightly/${PORTABLE_VER}.tgz"
EXTRACTED="$PORTABLE_DIR/$PORTABLE_VER"

log() { echo "[setup-iris-ollama] $*"; }
fail() { echo "[setup-iris-ollama] ❌ $*" >&2; exit 1; }

# --- 0. Add ubuntu user to render+video groups EARLY (v2.32.69).
# clinfo needs to open /dev/dri/renderD128 (group=render) to enumerate
# Intel platforms. If we run clinfo before adding the user to the
# render group, clinfo silently returns 0 platforms even when the
# userspace stack is fully installed — the failure mode that hit all
# 5 fleet locations on the v2.32.67/.68 rollout. usermod -aG is
# idempotent; SupplementaryGroups in the systemd unit gives the
# service the access regardless.
for grp in render video; do
    if ! id -nG ubuntu | tr ' ' '\n' | grep -qx "$grp"; then
        log "Adding 'ubuntu' to '$grp' group (required for /dev/dri access)"
        sudo usermod -a -G "$grp" ubuntu
    fi
done
# Apply the new group membership to THIS shell so the clinfo check
# below runs with the proper /dev/dri access. Without sg, the script
# still has the old group set even after usermod.
if ! id -G | tr ' ' '\n' | grep -qx "$(getent group render | cut -d: -f3)"; then
    log "Re-execing under the render group so clinfo can open /dev/dri"
    exec sg render -c "exec sg video -c 'bash $0 $*'"
fi

# --- 1. Verify Intel iGPU is present ---
if ! command -v clinfo >/dev/null 2>&1; then
    log "Installing clinfo"
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends clinfo
fi

# v2.32.67 — if clinfo doesn't see an Intel platform, the Intel level-zero
# userspace drivers may just be missing (fleet locations have the chip but
# not the userspace stack). Detect via lspci first; if Intel hardware is
# present, install the Intel apt repo + drivers BEFORE failing on clinfo.
if ! clinfo -l 2>/dev/null | grep -qiE "intel.*(graphics|iris|arc|xe)"; then
    log "clinfo doesn't see Intel — checking lspci for the chip"
    # v2.32.68 — match ANY Intel VGA/3D/Display controller. Newer Raptor
    # Lake-P chips (PCI device id a7a0) show up as "Intel Corporation
    # Device a7a0" when the PCI ID database is older than the chip; the
    # generic "intel corporation" match in a VGA/3D/Display line covers
    # both the named "Iris Xe Graphics" line and the unnamed "Device
    # a7a0" line.
    if lspci 2>/dev/null | grep -iE 'vga|3d|display' | grep -qi 'intel corporation'; then
        log "Intel iGPU chip present per lspci. Installing Intel level-zero userspace stack."
        # Install Intel GPU apt repo if not already configured
        if [ ! -f /etc/apt/sources.list.d/intel-gpu.list ]; then
            log "Adding Intel GPU apt repo"
            sudo install -d /usr/share/keyrings
            wget -qO- https://repositories.intel.com/gpu/intel-graphics.key \
                | sudo gpg --yes --dearmor --output /usr/share/keyrings/intel-graphics.gpg
            echo 'deb [arch=amd64 signed-by=/usr/share/keyrings/intel-graphics.gpg] https://repositories.intel.com/gpu/ubuntu noble client' \
                | sudo tee /etc/apt/sources.list.d/intel-gpu.list >/dev/null
            sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
        fi
        # v2.32.69 — additional packages found on the working Holmgren box
        # but missing on the fleet:
        # - intel-igc-cm: Intel Graphics Compiler Common Module (runtime
        #   dep for the opencl ICD; without it the .so loads but reports
        #   0 platforms)
        # - libdrm-intel1: DRM userspace; needed for /dev/dri/ open
        # - libigdfcl1, libigdgmm12: Intel graphics media + memory mgmt
        log "Installing Intel runtime stack (level-zero, opencl, drm, gmm, igc)"
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
            intel-level-zero-gpu intel-opencl-icd intel-igc-cm \
            libze1 libigc1 libigdfcl1 libigdgmm12 libdrm-intel1
        # If the OpenCL ICD shared object is missing despite the package
        # being installed (seen on fleet locations: intel-opencl-icd
        # installed but /usr/lib/x86_64-linux-gnu/intel-opencl/ empty),
        # force a reinstall to re-extract the .so.
        if [ ! -f /usr/lib/x86_64-linux-gnu/intel-opencl/libigdrcl.so ]; then
            log "libigdrcl.so missing — forcing intel-opencl-icd reinstall"
            sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --reinstall \
                intel-opencl-icd
        fi
        # If /dev/dri/ is empty (kernel module not bound), try to load i915.
        # Without /dev/dri/renderD128 the userspace can't see the device
        # regardless of how many libraries are installed.
        if [ -z "$(ls -A /dev/dri/ 2>/dev/null)" ]; then
            log "/dev/dri/ is empty — trying modprobe i915"
            sudo modprobe i915 2>&1 | head -3 || true
            sleep 2
            if [ -z "$(ls -A /dev/dri/ 2>/dev/null)" ]; then
                # Last resort: try the newer xe driver
                log "i915 didn't populate /dev/dri/ — trying xe driver"
                sudo modprobe xe 2>&1 | head -3 || true
                sleep 2
            fi
        fi
        # Re-test clinfo
        if ! clinfo -l 2>/dev/null | grep -qiE "intel.*(graphics|iris|arc|xe)"; then
            fail "Intel userspace installed but clinfo still doesn't see iGPU.
       /dev/dri/ contents:
$(ls /dev/dri/ 2>/dev/null || echo '<empty>')
       Common causes: i915/xe kernel module not loaded, or BIOS has integrated
       graphics disabled. Try:
         sudo modprobe i915      # or 'xe' on newer kernels
         dmesg | tail -50        # look for i915/xe errors
         sudo update-grub        # if module load fails
       Then reboot. Once /dev/dri/renderD128 exists, re-run this script.
       Until then, this location stays on CPU-only Ollama (harmless)."
        fi
    else
        fail "No Intel iGPU detected via clinfo or lspci. This script targets
       Intel Iris Xe / Arc iGPUs. If this is an AMD or Nvidia box, do not
       run this script. Verify with: lspci | grep -iE 'vga|3d|display'"
    fi
fi
log "Intel iGPU detected"

# --- 1b. Install intel-gpu-tools + grant cap_perfmon. Powers the GPU meter
# in the System Admin Hub at v2.32.59+ (read by /api/system/metrics).
# Harmless if already installed.
if ! command -v intel_gpu_top >/dev/null 2>&1; then
    log "Installing intel-gpu-tools (provides intel_gpu_top for the GPU meter)"
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends intel-gpu-tools
fi
# CAP_PERFMON lets the Next.js (ubuntu) user run intel_gpu_top without sudo.
# Requires Linux 5.8+; sports-bar boxes are on 6.8 so this is fine.
if [ -x /usr/bin/intel_gpu_top ] && ! getcap /usr/bin/intel_gpu_top 2>/dev/null | grep -q cap_perfmon; then
    log "Granting cap_perfmon to /usr/bin/intel_gpu_top (lets the API run it as ubuntu)"
    sudo setcap cap_perfmon=ep /usr/bin/intel_gpu_top
fi

# --- 2. (group add moved to section 0 in v2.32.69 so clinfo can open /dev/dri) ---

# --- 3. Download portable zip if missing ---
mkdir -p "$PORTABLE_DIR"
if [ ! -d "$EXTRACTED" ]; then
    log "Downloading IPEX-LLM Ollama portable ($PORTABLE_VER, ~140 MB)"
    curl -sL --fail -o "$PORTABLE_DIR/portable.tgz" "$PORTABLE_URL"
    log "Extracting"
    tar xzf "$PORTABLE_DIR/portable.tgz" -C "$PORTABLE_DIR"
    rm -f "$PORTABLE_DIR/portable.tgz"
fi

[ -x "$EXTRACTED/ollama" ] || fail "extracted directory missing 'ollama' binary at $EXTRACTED"

# --- 4. Make existing models dir group-accessible to ubuntu ---
# /usr/share/ollama is owned by 'ollama:ollama'. The systemd unit runs as
# 'ubuntu' with SupplementaryGroups=ollama, so we just need group-write on
# the manifests/blobs subtrees so future 'ollama pull' can write into them.
if [ -d /usr/share/ollama/.ollama/models ]; then
    log "Granting group-write on /usr/share/ollama/.ollama/models tree"
    sudo chmod g+w /usr/share/ollama/.ollama /usr/share/ollama/.ollama/models 2>/dev/null || true
    sudo find /usr/share/ollama/.ollama/models -type d -exec chmod g+w {} \; 2>/dev/null || true
fi

# --- 5. systemd unit ---
log "Writing /etc/systemd/system/ollama-ipex.service"
sudo tee /etc/systemd/system/ollama-ipex.service >/dev/null <<EOF
[Unit]
Description=Ollama (IPEX-LLM Iris Xe GPU build)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
SupplementaryGroups=render video ollama
WorkingDirectory=$EXTRACTED
Environment="LD_LIBRARY_PATH=$EXTRACTED"
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_CONTEXT_LENGTH=8192"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MODELS=/usr/share/ollama/.ollama/models"
Environment="OLLAMA_NUM_GPU=999"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="ZES_ENABLE_SYSMAN=1"
Environment="SYCL_PI_LEVEL_ZERO_USE_IMMEDIATE_COMMANDLISTS=1"
Environment="SYCL_CACHE_PERSISTENT=1"
Environment="ONEAPI_DEVICE_SELECTOR=level_zero:0"
Environment="no_proxy=localhost,127.0.0.1"
ExecStart=$EXTRACTED/ollama serve
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# --- 6. Stop + disable old upstream ollama; enable + start ipex unit ---
if systemctl is-enabled ollama >/dev/null 2>&1 || systemctl is-active ollama >/dev/null 2>&1; then
    log "Stopping + disabling upstream 'ollama' systemd unit"
    sudo systemctl stop ollama 2>/dev/null || true
    sudo systemctl disable ollama 2>/dev/null || true
fi

sudo systemctl daemon-reload
sudo systemctl enable ollama-ipex
sudo systemctl restart ollama-ipex

# --- 7. Wait for it to bind ---
log "Waiting for ollama-ipex to come up on :11434"
for _ in $(seq 1 30); do
    if curl -s -m 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then break; fi
    sleep 1
done

if ! curl -s -m 5 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    fail "ollama-ipex did not respond on :11434 within 30s; check 'sudo journalctl -u ollama-ipex'"
fi

# --- 8. Verify GPU detection in journal ---
sleep 2
if sudo journalctl -u ollama-ipex --since="2 minutes ago" --no-pager | grep -q "using Intel GPU"; then
    log "✅ IPEX-LLM Ollama is active on Intel iGPU"
else
    log "⚠ Service responding but 'using Intel GPU' not found in journal — falling back to CPU mode."
    log "   Run a generate test and check 'sudo journalctl -u ollama-ipex' for SYCL load lines."
fi

log "Done. AI consumers (AI Suggest, RAG) talk to :11434 unchanged."
