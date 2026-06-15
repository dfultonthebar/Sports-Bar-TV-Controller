# Adding or replacing a wireless / paging mic

**First, the honest split:** there are two halves to this. A bartender can do the **physical/hardware** half. The **"add it into the system"** half happens on the manager's back-office computer — it is **not on the bartender iPad** (that screen is blocked for it). So you get the box swapped and powered, then hand off to the manager.

**You can't break anything by trying these steps.**

## The hardware
The mic **receiver** is the silver/black box on the equipment rack with **a small screen and one or two short stubby antennas** sticking up. The handheld mics / belt-packs and their chargers sit near it. (This is the house **paging / hosted-event / announcement** mic system. Note: karaoke crews bring their own mics — that's not this system.)

## If a mic just stopped working (not a swap)
1. Check the **mic's battery** first — that's the #1 cause. Swap in fresh batteries or grab a charged spare handheld. (See the **"Mic isn't working"** help doc for the full quick-fix list.)
2. If the receiver box looks **frozen** (screen stuck/blank), power-cycle it: unplug its power for 30 seconds, plug back in, wait for the screen to light up.

## Replacing the receiver box with a spare (the part you CAN do)
3. Note which mics the dead box serves. Unplug the old box completely.
4. Plug the spare receiver into the **same power**, the **same network (Ethernet) cable**, and put the **antennas** back where they were. When its screen comes up, the hardware part is done.
5. **It won't show up in the iPad's mic status yet.** A brand-new/spare receiver has to be added into the system by the manager on the back-office computer, and one setting has to be switched on (next section). So: get it powered + connected, then **text the manager to finish the setup.**
6. After any swap, the handheld/belt-pack mics may need to be **re-synced** to the new receiver (hold the mic up to the receiver and press its **SYNC** button) — otherwise you'll have a working box but no sound. If you're not sure, leave it for the manager.

**If none of this worked:** snap a photo of the receiver's screen (and any lights), and text the manager on duty.

## What the manager does (on a computer, not the iPad)
For completeness — this is the software half:

1. **Turn on the gate first (the #1 gotcha).** On the receiver's own little screen menu: **Menu → Advanced → Network → Allow Third-Party Controls → Enable.** Brand-new boxes ship with this **OFF**, and until it's on, the box is on the network but the system literally can't see it.
2. On the computer, open **Device Config → Audio → Wireless Mics**.
3. Click **"Add Receiver"**, fill in **Name**, **Model** (e.g. SLXD24D), **IP Address**, and **TCP Port** (leave the default **2202**). To *replace* instead, click the **pencil/Edit** icon on the existing row and just change the IP.
4. Click **"Run Pre-flight"** — it shows a 4-item checklist: *TCP reachable · third-party controls enabled · firmware OK · model detected.* All four must be green ("✓ Ready to save"). If "third-party controls" fails, step 1 wasn't done.
5. Click **"Save Receiver"**. Battery + signal for each mic channel then appear live on the bartender iPad's Audio tab.
6. Removing an old one: the **trash** icon ("stops monitoring but doesn't affect the hardware").
