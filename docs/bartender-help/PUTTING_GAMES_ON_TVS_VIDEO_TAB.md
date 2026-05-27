# Putting a Game on a TV — Video Tab Quick Route

**For:** the bartender who wants to put a specific source on a specific TV right now.
**Goal:** route any source (cable, DirecTV, Fire TV) to any TV in under 30 seconds.
**Time to fix:** about 20 seconds once you know where to tap.
**You can't break it:** the worst that happens is the wrong TV changes for a few seconds — you tap it again to fix. Try things.

---

## When you'd use this

You know which TV the customer is sitting near. You know which source has what they want. You just need to connect the two — no scheduling, no AI suggestions, no guessing.

If you're trying to find a live game and don't know the channel, **[[FINDING_A_LIVE_GAME]]** (Guide tab) is faster. If the game starts later, use **[[SCHEDULING_GAMES_AHEAD]]**. This page covers the simplest case: "put that on that, right now."

---

## Where the Video tab lives

On the iPad behind the bar, tap **Video** along the bottom row of tabs. The screen fills with a **floorplan** of the bar — every TV drawn at its real wall position, each one a tappable tile.

If the floorplan looks weird (TVs in wrong places, or missing), see "If this didn't work" at the bottom.

---

## Step-by-step — route a TV to a source

1. Tap **Video** at the bottom of the iPad.
2. Find the TV you want to change on the floorplan. Each TV tile is labeled — "TV 7", "Main Bar Left", "Patio Big Screen", etc.
3. **Tap the TV's tile.** A source panel slides up from the bottom of the screen, listing every source available — Cable Box 1, Cable Box 2, DirecTV 1, DirecTV 2, Fire TV 1, etc.
4. The panel also shows the TV's **current source** at the top (so you know what it was on).
5. **Tap the source you want.** The panel closes by itself within half a second.
6. Glance at the actual TV. Within 1-2 seconds, the picture switches.

That's the whole thing. Three taps and a glance.

---

## Drag-to-route (faster alternative on some iPads)

Some iPad layouts support a drag interaction:

1. Tap **Video**.
2. Find the source you want in the side panel (look for a row of source tiles, usually along the left or bottom edge).
3. **Drag the source tile onto the TV tile.** The TV tile briefly highlights when you're over it.
4. Release. The route confirms with a small "Routed" banner.

If your iPad doesn't show source tiles on the side, just use the tap method above. Both work the same way.

---

## How you know it worked

- The TV's picture changes within 1-2 seconds.
- The TV tile on the iPad shows the new source name (e.g. "Cable Box 1") underneath the TV label.
- A small **"Routed to Output X"** banner briefly appears at the top of the iPad and disappears after 3 seconds.

If the source you picked has a current channel readout, the iPad's TV tile shows that too — useful for confirming the cable box is on the right channel.

---

## Tapping the same TV to verify or re-route

You can tap any TV tile any time to see what it's currently routed to. The source panel always shows the current source at the top — useful when a customer points at a TV and asks "what's on this one?" and you want to read it from the iPad rather than walking over.

If the answer is "wrong source," tap the right source in the same panel. Done.

---

## Room filter tabs

If your bar has multiple rooms (Main Bar, Patio, Game Room), there's usually a row of **room filter buttons** at the top of the Video tab. Tap **All** to see every TV, or tap a specific room to focus on just those TVs. Useful when you have 20+ TVs and the floorplan gets crowded.

If you don't see room tabs, your bar has just one room view — that's fine, ignore this section.

---

## If this didn't work

- **The floorplan looks weird** (TVs in wrong spots, missing TVs, or just a blank area) → the floorplan image may not have loaded. Pull down on the screen to refresh, or tap a different tab and come back. If still blank, text the manager — the layout file may need to be re-uploaded.
- **I tapped the TV but no source list appeared** → tap again, firmly. Light taps sometimes miss on iPads. If it still doesn't respond, the TV tile may be the wrong size — try tapping near the center of the tile.
- **The route confirmed (banner showed) but the TV is still dark** → the TV may be off. Look for a **Power On** button in the source panel. See **[[WRONG_CHANNEL_ON_TV]]** section "TV is dark" for the full recovery.
- **The route confirmed but the TV shows "No Signal"** → the source you picked isn't outputting (cable box is on a dead channel, Fire TV is asleep). Pick a different source, or wake up the source first.
- **A specific source isn't in the list** → scroll the source panel down — there are usually 8-15 sources and they don't all fit. If you're sure a source should exist and doesn't, text the manager.
- **The TV switched but to the wrong source** → tap it again and pick the right one. You can re-route as many times as you want; it's just software.
- **Several TVs are wrong at once** → don't try to fix them one by one if they all flipped at the same time. See **[[WRONG_CHANNEL_ON_TV]]** section "Everything is wrong" — usually a switcher problem the manager needs to solve.

---

## What NOT to do

- **Don't tap a different TV while the source panel is open.** Close the panel first (tap the X or the dim area), then tap the next TV. Otherwise you may accidentally route the wrong TV.
- **Don't unplug anything on the equipment rack.** All routing is software. Pulling power on a box can take 30 minutes to recover from.
- **Don't fight the Schedule.** If a TV keeps reverting to a different source, there's probably a scheduled game on it — see **[[OVERRIDE_LEARN]]** or edit the Schedule entry directly (**[[SCHEDULING_GAMES_AHEAD]]**).

---

## When to text the manager

- A TV tile is missing from the floorplan and you're sure that TV is wired up.
- The same TV keeps reverting to the wrong source no matter what you tap.
- The source panel is empty or shows weird text instead of source names.
- The "Routed" banner says "Failed" or shows a red error.

Include a screenshot of the iPad Video tab + a photo of the TV.

---

## Related

- **[[FINDING_A_LIVE_GAME]]** — find a live game in the Guide tab and route it.
- **[[SCHEDULING_GAMES_AHEAD]]** — queue up TVs to auto-tune at kickoff.
- **[[WRONG_CHANNEL_ON_TV]]** — TV is dark, on the wrong channel, or showing static.
- **[[MULTI_VIEW_QUAD]]** — split one TV into four panels.
- **[[OVERRIDE_LEARN]]** — system noticed you keep correcting the same TV and offers to make it permanent.
